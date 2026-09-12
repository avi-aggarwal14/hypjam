#!/usr/bin/env python3
"""
assemble_drawing.py — merge src/drawing/parts/*.svg into src/drawing/hq.svg (CONTRACT §8 structure)
and write assets/img/hq-footer.svg (the exterior only, for the footer's small drawing slot).

    python3 tools/assemble_drawing.py [--parts src/drawing/parts] [--out src/drawing/hq.svg]
                                      [--footer assets/img/hq-footer.svg] [--strict] [--force] [--no-check]

  * every parts/*.svg (except names starting with "_") is parsed; its top-level group ids say what it is
  * each part is validated with tools/check_drawing.py; a part with errors stops the build (--force overrides)
  * a missing part becomes an empty group with a warning so the site still builds (--strict fails instead)
  * XML prologs, comments, and every id except the reserved group ids are stripped; attributes are
    re-serialised in a fixed order (geometry first, then stroke attributes), exactly like Lance's file
  * output structure:
        <svg width height viewBox fill="none">
          <g id="Frame 7"><rect width="44001" height="21918" fill="black"/>
            <g id="entire-drawing">
              <g id="hotel-drawing"><g id="fixed"><g id="fixed-A">…</g><g id="fixed-B">…</g></g>
                <g id="#1-fade">…</g> … <g id="#5-fade">…</g></g>
              <g id="#1-front-of-house">…</g> … <g id="#5-management">…</g>
            </g></g></svg>
  * hq-footer.svg = fixed-A + fixed-B + the five fades (Lance's footer image is exactly the exterior with
    its windows), minus 0.2-opacity lines and elements smaller than 150 units, with stroke-width="1"
    vector-effect="non-scaling-stroke", viewBox tight on the buildings, sized 210×90 (xMinYMax meet).
"""
import sys, os, glob, argparse
import xml.etree.ElementTree as ET
from xml.sax.saxutils import quoteattr

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import check_drawing as cd  # noqa: E402

SHELLS = ['fixed-A', 'fixed-B']
FADES = [f'#{n}-fade' for n in range(1, 6)]
DETAILS = [cd.SLOTS[n][0] for n in range(1, 6)]
EXPECTED_FILES = {'fixed-A': 'shell-A.svg', 'fixed-B': 'shell-B.svg',
                  **{f'#{n}-fade': f'room-{n}.svg' for n in range(1, 6)},
                  **{cd.SLOTS[n][0]: f'room-{n}.svg' for n in range(1, 6)}}
ATTR_ORDER = ['d', 'x1', 'y1', 'x2', 'y2', 'x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'points',
              'stroke', 'stroke-width', 'fill', 'stroke-linecap', 'stroke-linejoin', 'stroke-opacity']
FOOTER_MIN_SIZE = 150
FOOTER_W, FOOTER_H = 210, 90

def local(tag):
    return tag.split('}')[-1] if isinstance(tag, str) else ''

def serialize(el, keep_ids, indent, override=None, skip=None):
    """Serialise an element subtree. override: dict of attribute replacements/additions for drawables.
    skip: callable(el) -> True to drop a drawable."""
    tag = local(el.tag)
    if tag == 'g':
        out = []
        gid = el.get('id')
        open_tag = f'<g id={quoteattr(gid)}>' if (gid in keep_ids) else '<g>'
        out.append(indent + open_tag)
        for c in el:
            if isinstance(c.tag, str):
                s = serialize(c, keep_ids, indent, override, skip)
                if s: out.append(s)
        out.append(indent + '</g>')
        return '\n'.join(out)
    if tag not in cd.DRAWABLE:
        return ''
    if skip and skip(el):
        return ''
    at = {k: v.strip() for k, v in el.attrib.items() if k != 'id'}
    if override:
        at.update(override)
    keys = [k for k in ATTR_ORDER if k in at] + [k for k in at if k not in ATTR_ORDER]
    return indent + f'<{tag} ' + ' '.join(f'{k}={quoteattr(at[k])}' for k in keys) + '/>'

def load_parts(parts_dir, log):
    """-> dict id -> (Element, file)"""
    found = {}
    files = sorted(glob.glob(os.path.join(parts_dir, '*.svg')))
    for f in files:
        base = os.path.basename(f)
        if base.startswith('_'):
            continue
        try:
            root = ET.parse(f).getroot()
        except ET.ParseError as e:
            log(f'ERROR {base}: XML parse error: {e}'); found.setdefault('__bad__', []).append(base); continue
        for g in root:
            if local(g.tag) != 'g': continue
            gid = g.get('id')
            if gid in found:
                log(f'ERROR {base}: group "{gid}" already provided by {found[gid][1]}'); found.setdefault('__bad__', []).append(base)
            else:
                found[gid] = (g, base)
    return found

def main(argv=None):
    ap = argparse.ArgumentParser(description='Assemble src/drawing/hq.svg from parts (see src/drawing/PLAN.md §6).')
    ap.add_argument('--parts', default=os.path.join(ROOT, 'src', 'drawing', 'parts'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'src', 'drawing', 'hq.svg'))
    ap.add_argument('--footer', default=os.path.join(ROOT, 'assets', 'img', 'hq-footer.svg'))
    ap.add_argument('--footer-stroke', default='#969696')
    ap.add_argument('--strict', action='store_true', help='fail when a part is missing')
    ap.add_argument('--force', action='store_true', help='assemble even when a part has check errors')
    ap.add_argument('--no-check', action='store_true', help='skip validation (not recommended)')
    a = ap.parse_args(argv)
    log = print

    parts = load_parts(a.parts, log)
    bad_files = set(parts.pop('__bad__', []))
    used_files = sorted({v[1] for v in parts.values()})
    log(f'parts dir: {a.parts}')
    log(f'files: {", ".join(used_files) if used_files else "(none)"}')

    # validate
    failed = False
    if not a.no_check:
        for f in used_files:
            rep = cd.check_file(os.path.join(a.parts, f))
            for w in rep.warnings: log(f'  WARN  {f}: {w}')
            for e in rep.errors: log(f'  ERROR {f}: {e}')
            log(f'  {"FAIL" if rep.errors else "PASS"}  {f}  ({len(rep.errors)} errors, {len(rep.warnings)} warnings)')
            failed |= bool(rep.errors)
    if bad_files: failed = True
    if failed and not a.force:
        log('assemble: refusing to assemble — fix the errors above (or pass --force).')
        return 1

    missing = [gid for gid in SHELLS + FADES + DETAILS if gid not in parts]
    for gid in missing:
        log(f'  {"ERROR" if a.strict else "WARN"}  missing part group "{gid}" (expected in parts/{EXPECTED_FILES[gid]}) — emitted empty')
    if missing and a.strict:
        return 1
    extra = [gid for gid in parts if gid not in SHELLS + FADES + DETAILS]
    for gid in extra: log(f'  WARN  ignoring unknown top-level group "{gid}" from {parts[gid][1]}')

    keep = set(cd.RESERVED_IDS)
    def body(gid, indent):
        if gid in parts:
            inner = []
            for c in parts[gid][0]:
                if isinstance(c.tag, str):
                    s = serialize(c, keep, indent + '  ')
                    if s: inner.append(s)
            return '\n'.join(inner)
        return ''

    lines = [f'<svg width="{cd.CANVAS_W}" height="{cd.CANVAS_H}" viewBox="0 0 {cd.CANVAS_W} {cd.CANVAS_H}" fill="none" xmlns="http://www.w3.org/2000/svg">',
             '<g id="Frame 7">',
             f'<rect width="{cd.CANVAS_W}" height="{cd.CANVAS_H}" fill="black"/>',
             '<g id="entire-drawing">',
             '<g id="hotel-drawing">',
             '<g id="fixed">']
    for gid in SHELLS:
        lines.append(f'<g id="{gid}">'); b = body(gid, ''); lines.append(b) if b else None; lines.append('</g>')
    lines.append('</g>')
    for gid in FADES:
        lines.append(f'<g id={quoteattr(gid)}>'); b = body(gid, ''); lines.append(b) if b else None; lines.append('</g>')
    lines.append('</g>')
    for gid in DETAILS:
        lines.append(f'<g id={quoteattr(gid)}>'); b = body(gid, ''); lines.append(b) if b else None; lines.append('</g>')
    lines += ['</g>', '</g>', '</svg>', '']
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(lines))
    size = os.path.getsize(a.out)
    log(f'wrote {a.out}  ({size/1024:.0f} KB)')

    # ---- footer: exterior only ----
    ext_items = []
    for gid in SHELLS + FADES:
        if gid not in parts: continue
        for el in parts[gid][0].iter():
            t = local(el.tag)
            if t not in cd.DRAWABLE: continue
            if (el.get('stroke-opacity') or '').strip() == '0.2': continue
            try:
                geom = cd.element_geometry(t, {k: v for k, v in el.attrib.items() if k != 'id'})
            except ValueError:
                continue
            b = geom['bbox']
            if (b[2] - b[0]) < FOOTER_MIN_SIZE and (b[3] - b[1]) < FOOTER_MIN_SIZE: continue
            ext_items.append((el, b))
    if ext_items:
        x0 = min(b[0] for _, b in ext_items); y0 = min(b[1] for _, b in ext_items)
        x1 = max(b[2] for _, b in ext_items); y1 = max(b[3] for _, b in ext_items)
    else:
        x0, y0, x1, y1 = 0, 0, cd.CANVAS_W, cd.CANVAS_H
    pad = 0.01 * (x1 - x0)
    vb = (x0 - pad, y0 - pad, (x1 - x0) + 2 * pad, (y1 - y0) + 2 * pad)
    fl = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb[0]:.0f} {vb[1]:.0f} {vb[2]:.0f} {vb[3]:.0f}" '
          f'width="{FOOTER_W}" height="{FOOTER_H}" preserveAspectRatio="xMinYMax meet" fill="none" aria-hidden="true">']
    for el, _ in ext_items:
        fl.append(serialize(el, keep, '', override={'stroke-width': '1', 'vector-effect': 'non-scaling-stroke', 'stroke': a.footer_stroke}))
    fl += ['</svg>', '']
    os.makedirs(os.path.dirname(os.path.abspath(a.footer)), exist_ok=True)
    with open(a.footer, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(fl))
    log(f'wrote {a.footer}  ({len(ext_items)} exterior elements, viewBox {vb[0]:.0f} {vb[1]:.0f} {vb[2]:.0f} {vb[3]:.0f}, {os.path.getsize(a.footer)/1024:.0f} KB)')

    # ---- final check of the assembled file ----
    if not a.no_check:
        rep = cd.check_file(a.out)
        for l in rep.lines: log(l)
        for w in rep.warnings: log(f'  WARN  {w}')
        for e in rep.errors: log(f'  ERROR {e}')
        log(f'{"FAIL" if rep.errors else "PASS"}  {a.out}  ({len(rep.errors)} errors, {len(rep.warnings)} warnings)')
        if rep.errors and not a.force:
            return 1
    return 0

if __name__ == '__main__':
    sys.exit(main())
