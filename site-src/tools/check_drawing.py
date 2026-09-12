#!/usr/bin/env python3
"""
check_drawing.py — validate hypjam HQ drawing parts and the assembled src/drawing/hq.svg.

    python3 tools/check_drawing.py FILE.svg [MORE.svg ...] [--lance] [--quiet]

What it checks (rules in src/drawing/PLAN.md §1, §2.4, §2.5, §5):
  * root <svg viewBox="0 0 44001 21918">; top-level group ids identify the part
      shell:     one group  fixed-A | fixed-B
      room N:    two groups #N-fade then #N-<detail name>
      assembled: Frame 7 > entire-drawing > hotel-drawing{fixed, #1..5-fade} + five detail groups
  * only g path line rect circle ellipse polyline polygon; no transform/style/text/defs/…
  * every drawable has exactly stroke="#969696" stroke-width="10" fill="none"
    stroke-linecap="round" stroke-linejoin="round" (+ optional stroke-opacity 0.4 | 0.2)
  * geometry parses, is finite, lies on the canvas, is not degenerate; no rect wider than 40000
  * rooms: every element inside the slot bbox (±3 %); detail bbox matches the slot (±2 %);
    fade ≤ 40 elements; detail 300–900 (warn) / 200–1200 (error)
  * shells: nothing enters a slot interior by more than 40 units; the must-have skeleton lines
    of PLAN §2 are present (±30 units, ≥85 % coverage); the should-have ones warn
  * prints per-group counts, bbox, opacity mix; exit 0 = PASS (warnings allowed), 1 = FAIL.

--lance   relax attribute-style rules to warnings (for inspecting ref/lance-entire-drawing.svg,
          whose structure and skeleton must pass but whose attribute style differs by design).
"""
import sys, os, re, math, argparse
import xml.etree.ElementTree as ET

CANVAS_W, CANVAS_H = 44001, 21918

SLOTS = {  # stop -> (detail id, x, y, w, h)   — CONTRACT §8 / PLAN §2.4
    1: ('#1-front-of-house', 4026, 15716, 8720, 4856),
    2: ('#2-back-of-house', 3796, 7408, 7603, 3552),
    3: ('#3-sales', 27045, 3959, 13189, 4840),
    4: ('#4-food-and-beverage', 27531, 17562, 12703, 4351),
    5: ('#5-management', 6749, 3021, 8669, 3983),
}
DETAIL_IDS = {v[0]: k for k, v in SLOTS.items()}
FADE_IDS = {f'#{k}-fade': k for k in SLOTS}
SHELL_IDS = ('fixed-A', 'fixed-B')
RESERVED_IDS = set(SHELL_IDS) | set(DETAIL_IDS) | set(FADE_IDS) | {'fixed', 'Frame 7', 'entire-drawing', 'hotel-drawing'}

DRAWABLE = ('path', 'line', 'rect', 'circle', 'ellipse', 'polyline', 'polygon')
REQUIRED_ATTRS = {'stroke': '#969696', 'stroke-width': '10', 'fill': 'none',
                  'stroke-linecap': 'round', 'stroke-linejoin': 'round'}
OPACITY_OK = ('0.4', '0.2')
GEOM_ATTRS = {'path': ('d',), 'line': ('x1', 'y1', 'x2', 'y2'), 'rect': ('x', 'y', 'width', 'height', 'rx', 'ry'),
              'circle': ('cx', 'cy', 'r'), 'ellipse': ('cx', 'cy', 'rx', 'ry'), 'polyline': ('points',), 'polygon': ('points',)}
GEOM_REQUIRED = {'path': ('d',), 'line': ('x1', 'y1', 'x2', 'y2'), 'rect': ('x', 'y', 'width', 'height'),
                 'circle': ('cx', 'cy', 'r'), 'ellipse': ('cx', 'cy', 'rx', 'ry'), 'polyline': ('points',), 'polygon': ('points',)}

FADE_MAX = 40
DETAIL_ERR = (200, 1200)
DETAIL_WARN = (300, 900)
SLOT_TOL = 0.03          # rooms: elements may exceed the slot by 3 % of w / h
DETAIL_BBOX_TOL = 0.02   # rooms: the detail group's bbox must match the slot edges within 2 %
SHELL_PENETRATION = 40   # shells: nothing enters a slot interior by more than this
BIG_RECT = 40000         # the engine deletes rects wider than this
POS_TOL = 30             # skeleton line position tolerance
COVER_MIN = 0.85         # skeleton line coverage required
MAX_SHOWN = 12           # per error category

# ---------------------------------------------------------------- skeleton (PLAN §2) ----------
def _A_skeleton():
    must = [
        ('H', 21912.6, 0, 17250.4, 'ground line'),
        ('H', 2465.7, 2380.9, 15900.4, 'parapet slab top'),
        ('H', 2661.1, 2380.9, 15900.4, 'parapet slab bottom'),
        ('H', 3021.4, 2576.8, 15712.8, 'top-floor top line'),
        ('V', 2576.8, 3021.4, 7003.6, 'top-floor left wall'),
        ('V', 15814.7, 5724.8, 7003.6, 'top-floor right wall (lower part)'),
        ('H', 7003.6, 2199.8, 15984.6, 'cornice 1 top'),
        ('H', 7408.3, 2305.1, 15879.4, 'cornice 1 bottom'),
        ('V', 2408.2, 7444.8, 10094.1, 'floor-2 left outer wall'),
        ('V', 2576.8, 7444.8, 10094.1, 'floor-2 left inner wall'),
        ('V', 15646.3, 7444.8, 10094.1, 'floor-2 right inner wall'),
        ('V', 15814.7, 7444.8, 10094.1, 'floor-2 right outer wall'),
        ('H', 10094.0, 2408.2, 3795.5, 'balustrade top, left of slot 2'),
        ('H', 10094.0, 11399.5, 15814.7, 'balustrade top, right of slot 2'),
        ('H', 10960.2, 2199.8, 15984.6, 'cornice 2 top / balustrade bottom'),
        ('H', 11364.7, 2305.1, 15879.4, 'cornice 2 bottom'),
        ('V', 2408.2, 11364.7, 21912.7, 'lower left outer wall'),
        ('V', 2576.8, 11364.7, 21912.7, 'lower left inner wall'),
        ('V', 15646.3, 11364.7, 21912.7, 'lower right inner wall'),
        ('V', 15814.7, 11364.7, 21912.7, 'lower right outer wall'),
        ('H', 15716, 3246, 4026, 'canopy line left'),
        ('H', 15716, 12746, 15046, 'canopy line right'),
        ('H', 20577, 2577, 4026, 'plinth line left'),
        ('H', 20577, 12746, 15646, 'plinth line right'),
    ]
    should = [
        ('H', 1409.5, 6442.9, 10723.3, 'roof box top slab'),
        ('V', 6748.8, 1563.7, 2465.7, 'roof box left side'),
        ('V', 10417.4, 1563.7, 2465.7, 'roof box right side'),
        ('V', 3795.8, 4886.9, 6562.6, 'top-floor bay-1 window left jamb'),
        ('V', 5440.9, 4886.9, 6562.6, 'top-floor bay-1 window right jamb'),
        ('V', 13081.5, 8153.8, 10089.9, 'floor-2 bay-4 window left jamb'),
        ('V', 14265.6, 8153.8, 10089.9, 'floor-2 bay-4 window right jamb'),
        ('H', 14535.8, 3161.1, 6075.6, 'balconette 1 top'),
        ('H', 14535.8, 12216.4, 15130.9, 'balconette 2 top'),
        ('H', 15321.9, 3246.2, 5990.4, 'slab line left'),
        ('H', 15321.9, 12301.5, 15045.7, 'slab line right'),
        ('V', 13081.5, 17228.2, 19796.8, 'ground bay-4 window left jamb'),
        ('V', 14265.6, 17228.2, 19796.8, 'ground bay-4 window right jamb'),
        ('H', 20910.7, 7110.9, 11134.3, 'step 1'),
        ('H', 21244.8, 7110.9, 11134.3, 'step 2'),
        ('H', 21578.7, 7110.9, 11134.3, 'step 3'),
        ('V', 6622, 20577, 21913, 'step cheek 6622'),
        ('V', 7111, 20577, 21913, 'step cheek 7111'),
        ('V', 11134, 20577, 21913, 'step cheek 11134'),
        ('V', 11623, 20577, 21913, 'step cheek 11623'),
    ]
    for x0 in (4026.3, 7044.7, 10063.2, 13081.5):
        should.append(('V', x0, 12590, 15158.6, f'floor-1 window left jamb x={x0}'))
        should.append(('V', x0 + 1184.1, 12590, 15158.6, f'floor-1 window right jamb x={x0 + 1184.1:.1f}'))
    return must, should

def _B_skeleton():
    must = [
        ('H', 21912.7, 18827.5, 19875.3, 'ground line, gap side'),
        ('H', 21912.7, 41615.3, 44000, 'ground line, right'),
        ('H', 21912.8, 19875.3, 27534, 'ground-floor bottom, left of slot 4'),
        ('H', 21912.8, 40233.5, 41615.3, 'ground-floor bottom, right of slot 4'),
        ('H', 17562.3, 19875.3, 41615.3, 'ground-floor top line'),
        ('V', 19875.3, 17562.3, 21912.8, 'ground-floor left wall'),
        ('V', 41615.3, 17562.3, 21912.8, 'ground-floor right wall'),
        ('H', 1244.0, 19992.8, 41615.3, 'parapet top'),
        ('H', 2166.9, 20405.7, 33664.3, 'parapet bottom, left part'),
        ('H', 2166.9, 40981.8, 41615.3, 'parapet bottom, right part'),
        ('V', 41615.3, 1244.0, 2166.9, 'parapet right edge'),
        ('V', 20405.7, 1501.1, 8799.2, 'left wall'),
        ('H', 3119.6, 20405.7, 40147.7, 'upper-floor top line'),
        ('H', 8799.2, 20122.1, 40234, 'cornice top'),
        ('H', 9135.0, 20122.1, 40234, 'cornice bottom'),
        ('V', 41140.4, 3958.7, 17562.4, 'right column inner line'),
        ('V', 41380.4, 3958.7, 17562.4, 'right column outer line'),
    ]
    for x in (20302.8, 21061.2, 23797.7, 24298.3, 27034.9, 27535.5, 30272.0, 30772.7,
              33509.4, 34009.8, 36746.5, 37247.1, 39983.7, 40234.1):
        must.append(('V', x, 9135, 17557.4, f'pilaster line x={x}'))
    should = [
        ('H', 5, 29129.8, 32708.2, 'rooftop cap top'),
        ('H', 229.6, 29129.8, 32708.2, 'rooftop cap bottom'),
        ('V', 29257.6, 229.6, 1243.9, 'rooftop box left'),
        ('V', 32580.6, 229.6, 1243.9, 'rooftop box right'),
        ('V', 40147.8, 1548.1, 3119.7, 'stair tower left'),
        ('V', 40981.8, 1548.1, 3119.7, 'stair tower right'),
        ('H', 1883.4, 33664.3, 40147.8, 'rooftop railing top'),
        ('H', 2502.2, 33664.3, 40147.8, 'rooftop railing bottom'),
        ('V', 21210.6, 19649, 21912.6, 'arch 1 left jamb'),
        ('V', 23648.5, 19649, 21912.6, 'arch 1 right jamb'),
        ('V', 24447.8, 19649, 21912.6, 'arch 2 left jamb'),
        ('V', 26885.7, 19649, 21912.6, 'arch 2 right jamb'),
        ('H', 6600.7, 41380.4, 43713.9, 'balcony 1 slab top'),
        ('H', 10266.5, 41380.4, 43713.9, 'balcony 2 slab top'),
        ('H', 13932.5, 41380.4, 43713.9, 'balcony 3 slab top'),
    ]
    for x0 in (22002.6, 25239.7):
        for y0 in (3958.7, 6605.5):
            should.append(('V', x0, y0, y0 + 1592.6, f'upper window jamb x={x0} y={y0}'))
            should.append(('V', x0 + 853.6, y0, y0 + 1592.6, f'upper window jamb x={x0 + 853.6:.1f} y={y0}'))
    for x0 in (22002.6, 25239.7, 28477.1, 31714.3, 34951.5, 38188.6):
        should.append(('V', x0, 10163.9, 16452.4, f'middle window left jamb x={x0}'))
        should.append(('V', x0 + 853.6, 10163.9, 16452.4, f'middle window right jamb x={x0 + 853.6:.1f}'))
    return must, should

SKELETON = {'fixed-A': _A_skeleton(), 'fixed-B': _B_skeleton()}

# ---------------------------------------------------------------- geometry ---------------------
_TOKEN = re.compile(r'[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?')
_ARGC = {'M': 2, 'L': 2, 'T': 2, 'H': 1, 'V': 1, 'C': 6, 'S': 4, 'Q': 4, 'A': 7, 'Z': 0}

def _bez3(p0, p1, p2, p3, n=8):
    out = []
    for i in range(1, n + 1):
        t = i / n; u = 1 - t
        out.append((u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0],
                    u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1]))
    return out

def _bez2(p0, p1, p2, n=8):
    out = []
    for i in range(1, n + 1):
        t = i / n; u = 1 - t
        out.append((u*u*p0[0] + 2*u*t*p1[0] + t*t*p2[0], u*u*p0[1] + 2*u*t*p1[1] + t*t*p2[1]))
    return out

def _arc(x1, y1, rx, ry, phi, fa, fs, x2, y2, n=16):
    if rx == 0 or ry == 0 or (x1 == x2 and y1 == y2):
        return [(x2, y2)]
    rx, ry = abs(rx), abs(ry); phi = math.radians(phi)
    cp, sp = math.cos(phi), math.sin(phi)
    dx, dy = (x1 - x2) / 2, (y1 - y2) / 2
    x1p, y1p = cp * dx + sp * dy, -sp * dx + cp * dy
    lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
    if lam > 1:
        rx *= math.sqrt(lam); ry *= math.sqrt(lam)
    num = rx*rx*ry*ry - rx*rx*y1p*y1p - ry*ry*x1p*x1p
    den = rx*rx*y1p*y1p + ry*ry*x1p*x1p
    coef = 0.0 if den == 0 else math.sqrt(max(0.0, num / den))
    if fa == fs:
        coef = -coef
    cxp, cyp = coef * rx * y1p / ry, -coef * ry * x1p / rx
    cx, cy = cp * cxp - sp * cyp + (x1 + x2) / 2, sp * cxp + cp * cyp + (y1 + y2) / 2
    def ang(ux, uy, vx, vy):
        return math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
    th1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
    dth = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
    if not fs and dth > 0: dth -= 2 * math.pi
    elif fs and dth < 0: dth += 2 * math.pi
    out = []
    for i in range(1, n + 1):
        t = th1 + dth * i / n
        out.append((cx + rx * math.cos(t) * cp - ry * math.sin(t) * sp,
                    cy + rx * math.cos(t) * sp + ry * math.sin(t) * cp))
    return out

def parse_path(d):
    """-> (pts, straight, pieces, err). pts: hull/sample points; straight: (x0,y0,x1,y1) of L/H/V/Z
    segments (used for skeleton coverage); pieces: every sub-segment incl. sampled curves."""
    toks = _TOKEN.findall(d)
    if re.sub(r'[\s,]', '', ''.join(toks)) != re.sub(r'[\s,]', '', d):
        return None, None, None, 'd contains characters that are not path commands or numbers'
    pts, straight, pieces = [], [], []
    i, cmd = 0, None
    cx = cy = sx = sy = 0.0
    lastc = None; lastcmd = ''
    while i < len(toks):
        t = toks[i]
        if t.isalpha():
            cmd = t; i += 1
            if cmd in 'Zz':
                if pts:
                    straight.append((cx, cy, sx, sy)); pieces.append((cx, cy, sx, sy))
                cx, cy = sx, sy; lastcmd = 'Z'; lastc = None
                continue
        else:
            if cmd is None:
                return None, None, None, 'd must start with M'
            if cmd == 'M': cmd = 'L'
            elif cmd == 'm': cmd = 'l'
        C = cmd.upper(); rel = cmd.islower(); n = _ARGC[C]
        args = toks[i:i + n]
        if len(args) < n or any(a.isalpha() for a in args):
            return None, None, None, f'not enough numbers after "{cmd}"'
        try:
            v = [float(a) for a in args]
        except ValueError:
            return None, None, None, f'bad number after "{cmd}"'
        if any(not math.isfinite(x) for x in v):
            return None, None, None, 'non-finite number in d'
        i += n
        if C == 'M':
            x, y = v; x, y = (x + cx, y + cy) if rel else (x, y)
            cx, cy, sx, sy = x, y, x, y; pts.append((x, y)); lastc = None
        elif C == 'L':
            x, y = v; x, y = (x + cx, y + cy) if rel else (x, y)
            straight.append((cx, cy, x, y)); pieces.append((cx, cy, x, y)); cx, cy = x, y; pts.append((x, y)); lastc = None
        elif C == 'H':
            x = v[0] + cx if rel else v[0]
            straight.append((cx, cy, x, cy)); pieces.append((cx, cy, x, cy)); cx = x; pts.append((cx, cy)); lastc = None
        elif C == 'V':
            y = v[0] + cy if rel else v[0]
            straight.append((cx, cy, cx, y)); pieces.append((cx, cy, cx, y)); cy = y; pts.append((cx, cy)); lastc = None
        elif C == 'C':
            x1, y1, x2, y2, x, y = v
            if rel: x1 += cx; y1 += cy; x2 += cx; y2 += cy; x += cx; y += cy
            samp = _bez3((cx, cy), (x1, y1), (x2, y2), (x, y))
            p = (cx, cy)
            for q in samp: pieces.append((p[0], p[1], q[0], q[1])); p = q
            pts += samp; lastc = (x2, y2); cx, cy = x, y
        elif C == 'S':
            x2, y2, x, y = v
            if rel: x2 += cx; y2 += cy; x += cx; y += cy
            x1, y1 = (2 * cx - lastc[0], 2 * cy - lastc[1]) if (lastc and lastcmd in 'CS') else (cx, cy)
            samp = _bez3((cx, cy), (x1, y1), (x2, y2), (x, y))
            p = (cx, cy)
            for q in samp: pieces.append((p[0], p[1], q[0], q[1])); p = q
            pts += samp; lastc = (x2, y2); cx, cy = x, y
        elif C == 'Q':
            x1, y1, x, y = v
            if rel: x1 += cx; y1 += cy; x += cx; y += cy
            samp = _bez2((cx, cy), (x1, y1), (x, y))
            p = (cx, cy)
            for q in samp: pieces.append((p[0], p[1], q[0], q[1])); p = q
            pts += samp; lastc = (x1, y1); cx, cy = x, y
        elif C == 'T':
            x, y = v
            if rel: x += cx; y += cy
            x1, y1 = (2 * cx - lastc[0], 2 * cy - lastc[1]) if (lastc and lastcmd in 'QT') else (cx, cy)
            samp = _bez2((cx, cy), (x1, y1), (x, y))
            p = (cx, cy)
            for q in samp: pieces.append((p[0], p[1], q[0], q[1])); p = q
            pts += samp; lastc = (x1, y1); cx, cy = x, y
        elif C == 'A':
            rx, ry, rot, fa, fs, x, y = v
            if rel: x += cx; y += cy
            samp = _arc(cx, cy, rx, ry, rot, bool(fa), bool(fs), x, y)
            p = (cx, cy)
            for q in samp: pieces.append((p[0], p[1], q[0], q[1])); p = q
            pts += samp; cx, cy = x, y; lastc = None
        lastcmd = C
    if not pts:
        return None, None, None, 'empty path'
    return pts, straight, pieces, None

def _num(a, name):
    try:
        v = float(a)
    except (TypeError, ValueError):
        raise ValueError(f'{name}="{a}" is not a number')
    if not math.isfinite(v):
        raise ValueError(f'{name}="{a}" is not finite')
    return v

def _ellipse_pts(cx, cy, rx, ry, n=16):
    return [(cx + rx * math.cos(2 * math.pi * i / n), cy + ry * math.sin(2 * math.pi * i / n)) for i in range(n)]

def element_geometry(tag, at):
    """-> dict(pts, straight, pieces, bbox) or raises ValueError."""
    if tag == 'path':
        pts, straight, pieces, err = parse_path(at.get('d', ''))
        if err: raise ValueError(err)
    elif tag == 'line':
        x1, y1, x2, y2 = (_num(at.get(k), k) for k in ('x1', 'y1', 'x2', 'y2'))
        pts = [(x1, y1), (x2, y2)]; straight = [(x1, y1, x2, y2)]; pieces = list(straight)
    elif tag == 'rect':
        x, y, w, h = (_num(at.get(k), k) for k in ('x', 'y', 'width', 'height'))
        if w <= 0 or h <= 0: raise ValueError('rect with zero width or height')
        pts = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
        straight = [(x, y, x + w, y), (x + w, y, x + w, y + h), (x + w, y + h, x, y + h), (x, y + h, x, y)]
        pieces = list(straight)
    elif tag == 'circle':
        cx, cy, r = (_num(at.get(k), k) for k in ('cx', 'cy', 'r'))
        if r <= 0: raise ValueError('circle with r <= 0')
        pts = _ellipse_pts(cx, cy, r, r); straight = []
        pieces = [(pts[i][0], pts[i][1], pts[(i + 1) % len(pts)][0], pts[(i + 1) % len(pts)][1]) for i in range(len(pts))]
        pts = pts + [(cx - r, cy - r), (cx + r, cy + r)]
    elif tag == 'ellipse':
        cx, cy, rx, ry = (_num(at.get(k), k) for k in ('cx', 'cy', 'rx', 'ry'))
        if rx <= 0 or ry <= 0: raise ValueError('ellipse with rx or ry <= 0')
        pts = _ellipse_pts(cx, cy, rx, ry); straight = []
        pieces = [(pts[i][0], pts[i][1], pts[(i + 1) % len(pts)][0], pts[(i + 1) % len(pts)][1]) for i in range(len(pts))]
        pts = pts + [(cx - rx, cy - ry), (cx + rx, cy + ry)]
    elif tag in ('polyline', 'polygon'):
        nums = re.findall(r'[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?', at.get('points', ''))
        if len(nums) < 4 or len(nums) % 2: raise ValueError('points needs an even count of at least 4 numbers')
        v = [float(n) for n in nums]
        if any(not math.isfinite(x) for x in v): raise ValueError('non-finite number in points')
        pts = list(zip(v[0::2], v[1::2]))
        straight = [(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) for i in range(len(pts) - 1)]
        if tag == 'polygon': straight.append((pts[-1][0], pts[-1][1], pts[0][0], pts[0][1]))
        pieces = list(straight)
    else:
        raise ValueError(f'<{tag}> is not a drawable')
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    bbox = (min(xs), min(ys), max(xs), max(ys))
    if bbox[2] - bbox[0] < 1e-6 and bbox[3] - bbox[1] < 1e-6:
        raise ValueError('degenerate (zero-length) element')
    return {'pts': pts, 'straight': straight, 'pieces': pieces, 'bbox': bbox}

def coverage(straight, axis, pos, lo, hi, tol=POS_TOL):
    """fraction of [lo,hi] covered by straight segments lying on the line axis=pos (±tol)."""
    if hi <= lo: return 1.0
    iv = []
    for x0, y0, x1, y1 in straight:
        if axis == 'H':
            if abs(y0 - pos) <= tol and abs(y1 - pos) <= tol:
                a, b = sorted((x0, x1)); iv.append((max(a, lo), min(b, hi)))
        else:
            if abs(x0 - pos) <= tol and abs(x1 - pos) <= tol:
                a, b = sorted((y0, y1)); iv.append((max(a, lo), min(b, hi)))
    iv = sorted(i for i in iv if i[1] > i[0])
    total, cur = 0.0, None
    for a, b in iv:
        if cur is None: cur = [a, b]
        elif a <= cur[1] + tol: cur[1] = max(cur[1], b)
        else: total += cur[1] - cur[0]; cur = [a, b]
    if cur: total += cur[1] - cur[0]
    return total / (hi - lo)

# ---------------------------------------------------------------- report -----------------------
class Report:
    def __init__(self, path):
        self.path = path; self.errors = []; self.warnings = []; self.lines = []
        self._cat = {}
    def _add(self, lst, cat, msg):
        n = self._cat.get((id(lst), cat), 0); self._cat[(id(lst), cat)] = n + 1
        if n < MAX_SHOWN: lst.append(msg)
        elif n == MAX_SHOWN: lst.append(f'{cat}: … more of the same (only the first {MAX_SHOWN} shown)')
    def err(self, msg, cat='general'): self._add(self.errors, cat, msg)
    def warn(self, msg, cat='general'): self._add(self.warnings, cat, msg)
    def info(self, msg): self.lines.append(msg)

def local(tag):
    return tag.split('}')[-1] if isinstance(tag, str) else ''

def elem_label(el, idx):
    t = local(el.tag); i = el.get('id')
    return f'<{t}{" id=" + i if i else ""} #{idx}>'

# ---------------------------------------------------------------- element + group checks -------
def check_group_elements(g, rep, lenient, gid):
    """Validate every drawable under g. -> list of dicts(el, tag, tier, geom) for the valid ones."""
    out = []
    idx = 0
    seen_ids = {}
    for el in g.iter():
        if el is g: continue
        tag = local(el.tag)
        idx += 1
        lab = f'{gid} {elem_label(el, idx)}'
        if tag == 'g':
            for k in el.attrib:
                if k != 'id':
                    rep.err(f'{lab}: <g> may only carry an id (found {k}="{el.get(k)}")', 'g-attrs')
            i = el.get('id')
            if i:
                if i.startswith('#') or i in RESERVED_IDS:
                    rep.err(f'{lab}: nested group id "{i}" is reserved', 'g-id')
                if i in seen_ids: rep.err(f'{lab}: duplicate id "{i}"', 'dup-id')
                seen_ids[i] = 1
            continue
        if tag not in DRAWABLE:
            rep.err(f'{lab}: element <{tag}> is not allowed (only g path line rect circle ellipse polyline polygon)', 'bad-element')
            continue
        at = dict(el.attrib)
        i = at.pop('id', None)
        if i is not None:
            if i.startswith('#') or i in RESERVED_IDS: rep.err(f'{lab}: id "{i}" is reserved', 'g-id')
            if i in seen_ids: rep.err(f'{lab}: duplicate id "{i}"', 'dup-id')
            seen_ids[i] = 1
        style_bad = rep.warn if lenient else rep.err
        for k, want in REQUIRED_ATTRS.items():
            got = at.pop(k, None)
            if got is None:
                style_bad(f'{lab}: missing {k}="{want}"', f'missing-{k}')
            elif got.strip().lower() != want:
                style_bad(f'{lab}: {k}="{got}" must be "{want}"', f'bad-{k}')
        op = at.pop('stroke-opacity', None)
        tier = 'solid'
        if op is not None:
            if op.strip() in OPACITY_OK: tier = op.strip()
            else: style_bad(f'{lab}: stroke-opacity="{op}" must be 0.4 or 0.2 (or absent)', 'bad-opacity')
        geom_keys = GEOM_ATTRS[tag]
        for k in list(at):
            if k in geom_keys: continue
            style_bad(f'{lab}: attribute {k}="{at[k]}" is not allowed', f'extra-attr-{k}')
            at.pop(k)
        for k in GEOM_REQUIRED[tag]:
            if k not in at:
                rep.err(f'{lab}: missing {k}', 'missing-geom'); at = None; break
        if at is None: continue
        try:
            geom = element_geometry(tag, at)
        except ValueError as e:
            rep.err(f'{lab}: {e}', 'bad-geometry'); continue
        b = geom['bbox']
        if tag == 'rect' and float(at['width']) > BIG_RECT:
            rep.err(f'{lab}: rect wider than {BIG_RECT} (the engine deletes it)', 'big-rect'); continue
        if b[0] < -1 or b[1] < -1 or b[2] > CANVAS_W + 1 or b[3] > CANVAS_H + 1:
            rep.err(f'{lab}: outside the canvas (bbox {b[0]:.0f},{b[1]:.0f} → {b[2]:.0f},{b[3]:.0f})', 'off-canvas')
        out.append({'el': el, 'tag': tag, 'tier': tier, 'geom': geom, 'label': lab})
    return out

def group_bbox(items):
    if not items: return None
    return (min(i['geom']['bbox'][0] for i in items), min(i['geom']['bbox'][1] for i in items),
            max(i['geom']['bbox'][2] for i in items), max(i['geom']['bbox'][3] for i in items))

def describe_group(gid, items, rep, slot=None):
    n = len(items); b = group_bbox(items)
    tiers = {'solid': 0, '0.4': 0, '0.2': 0}
    for i in items: tiers[i['tier']] += 1
    tags = {}
    for i in items: tags[i['tag']] = tags.get(i['tag'], 0) + 1
    bs = f'bbox {b[0]:.0f},{b[1]:.0f} {b[2]-b[0]:.0f}×{b[3]-b[1]:.0f}' if b else 'bbox —'
    ss = f'  slot {slot[0]},{slot[1]} {slot[2]}×{slot[3]}' if slot else ''
    rep.info(f'  {gid:<22} {n:>5} elements  {bs}{ss}')
    rep.info(f'  {"":<22}       solid {tiers["solid"]} · 0.4 {tiers["0.4"]} · 0.2 {tiers["0.2"]} · ' +
             ' '.join(f'{k} {v}' for k, v in sorted(tags.items())))
    return n, b, tiers

def check_room_group(gid, items, stop, is_fade, rep, template=False):
    _, x, y, w, h = SLOTS[stop]
    slot = (x, y, w, h)
    n, b, tiers = describe_group(gid, items, rep, slot)
    tx, ty = w * SLOT_TOL, h * SLOT_TOL
    for it in items:
        bb = it['geom']['bbox']
        if bb[0] < x - tx or bb[1] < y - ty or bb[2] > x + w + tx or bb[3] > y + h + ty:
            rep.err(f'{it["label"]}: outside slot {stop} (bbox {bb[0]:.0f},{bb[1]:.0f} → {bb[2]:.0f},{bb[3]:.0f}; '
                    f'slot {x}..{x+w} × {y}..{y+h}, tolerance {tx:.0f}/{ty:.0f})', 'outside-slot')
    if is_fade:
        if n > FADE_MAX: rep.err(f'{gid}: {n} elements — a fade group is the simple exterior, at most {FADE_MAX}', 'fade-count')
        if n == 0: rep.err(f'{gid}: empty — draw the room\'s windows/door as seen from outside', 'fade-count')
    else:
        if n == 0:
            rep.err(f'{gid}: empty', 'detail-count')
        else:
            lo_e, hi_e = DETAIL_ERR; lo_w, hi_w = DETAIL_WARN
            if n < lo_e or n > hi_e:
                (rep.warn if template else rep.err)(f'{gid}: {n} elements is outside {lo_e}–{hi_e}' + (' (template exception)' if template else ' — interiors must reward the zoom'), 'detail-count')
            elif n < lo_w or n > hi_w:
                rep.warn(f'{gid}: {n} elements — the target is {lo_w}–{hi_w}', 'detail-count')
            if b:
                ex, ey = w * DETAIL_BBOX_TOL, h * DETAIL_BBOX_TOL
                dev = [('left', b[0] - x), ('top', b[1] - y), ('right', b[2] - (x + w)), ('bottom', b[3] - (y + h))]
                bad = [f'{k} off by {v:.0f}' for k, v in dev if abs(v) > (ex if k in ('left', 'right') else ey)]
                if bad:
                    (rep.warn if template else rep.err)(f'{gid}: bbox does not match the slot ({", ".join(bad)}; tolerance {ex:.0f}/{ey:.0f}). '
                            f'Draw the interior box on the slot edges (PLAN §4.5) — the camera frames this bbox', 'detail-bbox')
            if n and tiers['0.2'] / n > 0.25:
                rep.warn(f'{gid}: {tiers["0.2"]} of {n} elements at 0.2 opacity (>25 %) — keep the dashed tier for background only', 'tier-mix')

def check_shell_group(gid, items, rep, skeleton_keys):
    n, b, tiers = describe_group(gid, items, rep)
    if not items:
        rep.warn(f'{gid}: empty (part not assembled yet?)', 'structure')
        return 0
    for it in items:
        for stop, (_, x, y, w, h) in SLOTS.items():
            ix0, iy0, ix1, iy1 = x + SHELL_PENETRATION, y + SHELL_PENETRATION, x + w - SHELL_PENETRATION, y + h - SHELL_PENETRATION
            hit = False
            for x0, y0, x1, y1 in it['geom']['pieces']:
                a, c = sorted((x0, x1)); d, e = sorted((y0, y1))
                if a < ix1 and c > ix0 and d < iy1 and e > iy0:
                    hit = True; break
            if hit:
                rep.err(f'{it["label"]}: enters the interior of slot {stop} ({x}..{x+w} × {y}..{y+h}) — shells draw nothing inside a slot; '
                        f'that room\'s #{stop}-fade / detail own it', 'slot-penetration')
                break
    straight = [s for it in items for s in it['geom']['straight']]
    for key in skeleton_keys:
        must, should = SKELETON[key]
        for axis, pos, lo, hi, name in must:
            c = coverage(straight, axis, pos, lo, hi)
            if c < COVER_MIN:
                rep.err(f'{gid}: skeleton line missing — {name}: {axis}={pos} from {lo} to {hi} ({c*100:.0f} % covered, need {COVER_MIN*100:.0f} %, ±{POS_TOL})', 'skeleton-must')
        for axis, pos, lo, hi, name in should:
            c = coverage(straight, axis, pos, lo, hi)
            if c < COVER_MIN:
                rep.warn(f'{gid}: expected line not found — {name}: {axis}={pos} from {lo} to {hi} ({c*100:.0f} % covered)', 'skeleton-should')
    return n

# ---------------------------------------------------------------- file-level -------------------
def _children(el):
    return [c for c in el if isinstance(c.tag, str)]

def check_file(path, lenient=False):
    rep = Report(path)
    try:
        tree = ET.parse(path)
    except ET.ParseError as e:
        rep.err(f'XML parse error: {e}'); return rep
    root = tree.getroot()
    if local(root.tag) != 'svg':
        rep.err('root element is not <svg>'); return rep
    vb = (root.get('viewBox') or '').split()
    if vb != ['0', '0', '44001', '21918']:
        rep.err(f'viewBox must be "0 0 44001 21918" (found "{root.get("viewBox")}")')
    template = os.path.basename(path).startswith('_')
    top = _children(root)
    top_g = [c for c in top if local(c.tag) == 'g']
    for c in top:
        t = local(c.tag)
        if t == 'g': continue
        if t == 'rect' and float(c.get('width') or 0) > BIG_RECT:
            rep.warn(f'top-level frame <rect> found; the assembler emits its own inside "Frame 7" — drop it from a part', 'frame-rect')
            continue
        rep.err(f'top-level <{t}> is not allowed; everything goes inside the part\'s group(s)', 'top-level')
    ids = [g.get('id') for g in top_g]
    kind = None
    if ids == ['Frame 7']:
        kind = 'assembled'
    elif len(ids) == 1 and ids[0] in SHELL_IDS:
        kind = 'shell'
    elif len(ids) == 2 and ids[0] in FADE_IDS and ids[1] in DETAIL_IDS and FADE_IDS[ids[0]] == DETAIL_IDS[ids[1]]:
        kind = 'room'
    else:
        rep.err(f'top-level group ids {ids} do not identify a part. Expected one of: [fixed-A], [fixed-B], '
                f'[#N-fade, #N-<detail>] for N=1..5 (see PLAN §0), or the assembled structure [Frame 7]')
        return rep
    rep.kind = kind
    rep.info(f'{path}: {kind}' + (f' ({", ".join(ids)})' if kind != 'assembled' else ''))

    if kind == 'shell':
        gid = ids[0]
        items = check_group_elements(top_g[0], rep, lenient, gid)
        check_shell_group(gid, items, rep, [gid])
    elif kind == 'room':
        stop = FADE_IDS[ids[0]]
        fade_items = check_group_elements(top_g[0], rep, lenient, ids[0])
        det_items = check_group_elements(top_g[1], rep, lenient, ids[1])
        check_room_group(ids[0], fade_items, stop, True, rep, template)
        check_room_group(ids[1], det_items, stop, False, rep, template)
    else:
        frame = top_g[0]
        fk = _children(frame)
        rects = [c for c in fk if local(c.tag) == 'rect']
        if not rects or float(rects[0].get('width') or 0) < BIG_RECT:
            rep.err('"Frame 7" must start with the full-canvas <rect> the engine removes', 'structure')
        ent = [c for c in fk if local(c.tag) == 'g' and c.get('id') == 'entire-drawing']
        if len(ent) != 1:
            rep.err('"Frame 7" must contain exactly one <g id="entire-drawing">', 'structure'); return rep
        ek = [c for c in _children(ent[0]) if local(c.tag) == 'g']
        eids = [c.get('id') for c in ek]
        want = ['hotel-drawing'] + [SLOTS[n][0] for n in range(1, 6)]
        if sorted(eids) != sorted(want):
            rep.err(f'entire-drawing children must be {want}, found {eids}', 'structure')
        elif eids != want:
            rep.warn(f'entire-drawing children are in the order {eids}; the engine looks groups up by id so this works, but the assembler emits {want}', 'structure')
        hotel = next((c for c in ek if c.get('id') == 'hotel-drawing'), None)
        if hotel is None: return rep
        hk = [c for c in _children(hotel) if local(c.tag) == 'g']
        hids = [c.get('id') for c in hk]
        wanth = ['fixed'] + [f'#{n}-fade' for n in range(1, 6)]
        if sorted(hids) != sorted(wanth):
            rep.err(f'hotel-drawing children must be {wanth}, found {hids}', 'structure')
        elif hids != wanth:
            rep.warn(f'hotel-drawing children are in the order {hids}; fine for the engine, the assembler emits {wanth}', 'structure')
        fixed = next((c for c in hk if c.get('id') == 'fixed'), None)
        if fixed is not None:
            subs = [c for c in _children(fixed) if local(c.tag) == 'g' and c.get('id') in SHELL_IDS]
            if subs:
                for s in subs:
                    items = check_group_elements(s, rep, lenient, s.get('id'))
                    check_shell_group(s.get('id'), items, rep, [s.get('id')])
                missing = [k for k in SHELL_IDS if k not in [s.get('id') for s in subs]]
                for m in missing: rep.warn(f'fixed has no {m} subgroup (part not assembled yet?)', 'structure')
            else:
                items = check_group_elements(fixed, rep, lenient, 'fixed')
                check_shell_group('fixed', items, rep, list(SHELL_IDS))
        for n in range(1, 6):
            fg = next((c for c in hk if c.get('id') == f'#{n}-fade'), None)
            dg = next((c for c in ek if c.get('id') == SLOTS[n][0]), None)
            if fg is not None:
                items = check_group_elements(fg, rep, lenient, f'#{n}-fade')
                if items:
                    check_room_group(f'#{n}-fade', items, n, True, rep)
                else:
                    rep.warn(f'#{n}-fade: empty (part not assembled yet?)', 'structure')
            if dg is not None:
                items = check_group_elements(dg, rep, lenient, SLOTS[n][0])
                if not items:
                    rep.warn(f'{SLOTS[n][0]}: empty (part not assembled yet?)', 'structure')
                else:
                    check_room_group(SLOTS[n][0], items, n, False, rep)
    return rep

def main(argv=None):
    ap = argparse.ArgumentParser(description='Validate hypjam HQ drawing parts / hq.svg (see src/drawing/PLAN.md).')
    ap.add_argument('files', nargs='+')
    ap.add_argument('--lance', action='store_true', help='relax attribute-style rules to warnings (for the Lance reference)')
    ap.add_argument('--quiet', action='store_true', help='only the summary line per file')
    a = ap.parse_args(argv)
    failed = False
    for f in a.files:
        if not os.path.exists(f):
            print(f'{f}: no such file'); failed = True; continue
        rep = check_file(f, lenient=a.lance)
        if not a.quiet:
            for l in rep.lines: print(l)
            for w in rep.warnings: print(f'  WARN  {w}')
            for e in rep.errors: print(f'  ERROR {e}')
        status = 'FAIL' if rep.errors else 'PASS'
        print(f'{status}  {f}  ({len(rep.errors)} errors, {len(rep.warnings)} warnings)')
        failed |= bool(rep.errors)
    return 1 if failed else 0

if __name__ == '__main__':
    sys.exit(main())
