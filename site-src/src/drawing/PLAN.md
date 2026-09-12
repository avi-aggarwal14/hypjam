# hypjam HQ drawing — the plan

Read all of it. Seven agents draw one part each, in parallel, from this document; the parts must
fit on first assembly. Every number below was measured from `ref/lance-entire-drawing.svg` with
`getBBox()` (Playwright) — geometry only; **not one path of Lance's is copied**.

Contract references: CONTRACT §8 (structure, ids, slots), §7 (camera, draw-in), §10 (honesty — no
text in the drawing means no brand names; no logos), §11 (no "studio" anywhere — the drawing has no
words, so this is moot, but do not name groups or ids with it either).

---

## 0. Parts, files, ids, workflow

| part | file (under `src/drawing/parts/`) | top-level `<g id>` (exact, in this order) | budget (drawables) |
|---|---|---|---|
| shell-A | `shell-A.svg` | `fixed-A` | 260–520 |
| shell-B | `shell-B.svg` | `fixed-B` | 320–620 |
| room-1 | `room-1.svg` | `#1-fade` then `#1-front-of-house` | fade ≤ 40 · detail 300–500 |
| room-2 | `room-2.svg` | `#2-fade` then `#2-back-of-house` | fade ≤ 40 · detail 300–550 |
| room-3 | `room-3.svg` | `#3-fade` then `#3-sales` | fade ≤ 40 · detail 400–700 |
| room-4 | `room-4.svg` | `#4-fade` then `#4-food-and-beverage` | fade ≤ 40 · detail 400–700 |
| room-5 | `room-5.svg` | `#5-fade` then `#5-management` | fade ≤ 40 · detail 350–650 |

Yes, the room ids literally begin with `#` (the engine queries `[id="#1-fade"]`). The detail ids keep
Lance's hotel names because the engine depends on them; the *content* is hypjam's.

Workflow for every drawing agent:

1. `cp src/drawing/parts/_template.svg src/drawing/parts/<your file>` — it has the viewBox, the
   group skeleton, and worked examples of every element style (a figure, a window, a prop, the
   three opacity tiers). Change the ids to yours.
2. Draw in **absolute canvas coordinates** (no transforms, ever).
3. `python3 tools/check_drawing.py src/drawing/parts/<your file>` — fix until it prints `PASS`.
4. `node tools/render_svg.js src/drawing/parts/<your file> out.png x y w h` — render your stop's
   camera crop (§5 gives each room its crop) and the whole canvas (`node tools/render_svg.js
   file.svg whole.png`), and look at both. This is how visitors see it: 1px strokes on black.
5. Report your element counts (the checker prints them) and anything you deliberately left out.

The assembler runs `python3 tools/assemble_drawing.py` → `src/drawing/hq.svg` and
`assets/img/hq-footer.svg`. It re-runs the checker on every part and refuses to assemble a part
with errors.

---

## 1. Format — hard rules (the checker enforces every one)

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44001 21918" fill="none">
  <g id="#1-fade">
    <rect x="4026.3" y="17228.2" width="1184.1" height="2568.6"
          stroke="#969696" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="4618" y1="17228.2" x2="4618" y2="19796.8"
          stroke="#969696" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"
          stroke-opacity="0.4"/>
  </g>
  <g id="#1-front-of-house"> … </g>
</svg>
```

- **Root**: `<svg>` with `viewBox="0 0 44001 21918"`. Width/height attributes optional. An XML
  prolog is optional (the assembler strips it). XML comments are fine (stripped).
- **Top-level groups**: exactly the ids in §0, in that order, and nothing else at the top level.
- **Elements allowed**: `g path line rect circle ellipse polyline polygon`. Nothing else — no
  `text`, `image`, `defs`, `use`, `symbol`, `style`, `title`, `desc`, `clipPath`, `mask`, `filter`.
- **Every drawable carries exactly these five attributes**:
  `stroke="#969696" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"`.
  Optionally `stroke-opacity="0.4"` (secondary line) or `stroke-opacity="0.2"` (background line —
  the engine renders these dashed `4px 6px`). Nothing else: no `opacity`, `style`, `class`,
  `transform`, `stroke-dasharray`, `stroke-miterlimit`, `marker-*`, `data-*`, no filled shapes
  (`fill` is always `none`; a filled dot is drawn as a small circle outline).
- **Geometry attributes** per element and only these: `path d` · `line x1 y1 x2 y2` ·
  `rect x y width height [rx ry]` · `circle cx cy r` · `ellipse cx cy rx ry` ·
  `polyline points` · `polygon points`.
- **Nested `<g>`** is allowed for your own organisation (e.g. `<g id="counter">`). It may carry an
  `id` only (unique in the file, must not start with `#`, must not be one of the reserved ids).
  No transform. The assembler drops all ids except the reserved group ids.
- **Coordinates**: absolute, on the master canvas, 0 ≤ x ≤ 44001, 0 ≤ y ≤ 21918, at most one
  decimal, no exponents. Path commands `M L H V C S Q T A Z` (relative lowercase is accepted but
  absolute is strongly preferred — it is what the checker and your own sanity need).
- **No `rect` wider than 40000** (the engine deletes those — it is how it removes the frame rect).
- **Nothing degenerate**: no zero-length paths, no rects with zero width/height.
- Rooms: every element of both groups lies inside the slot bbox (§2.4) with a tolerance of 3 % of
  the slot's width/height. The detail group's overall bbox must match the slot edges within 2 %
  (draw the interior box, §4.5, and this is automatic — the camera frames this bbox).
- Shells: no element enters the **interior** of any slot by more than 40 units. Lines *on* a slot
  edge are fine and expected (floor lines, ceiling lines). Lance does exactly this: the balustrade
  top line at y=10094 stops at x=3795.5 and resumes at 11399.5; `#2-fade` draws the piece between.
- Keep a part file under ~700 KB. Lance's entire drawing (3948 paths) is 750 KB.

---

## 2. The skeleton — measured from Lance (canvas units; 1 unit ≈ 1 mm)

Canvas 44001 × 21918. Lance's whole drawing occupies x 0→44000, y 5→21913. Ground line y = **21912.6**.
Building A stands left (x 2200→15985 including cornice overhangs), Building B right (x 19875→43714
including its side balconies). Street gap between them: A's outer wall x=15814.7 → B's ground-floor
wall x=19875.3 = **4060 units**; the ground line has a break from x=17250.4 to 18827.5 (a side-street
mouth — keep it).

### 2.1 Building A (13 407 wide) — floor stack, top to bottom

| element | y (top → bottom) | x (left → right) | notes |
|---|---|---|---|
| roof box, top slab | 1409.5 → 1563.7 | 6442.9 → 10723.3 | rect |
| roof box, sides | 1563.7 → 2465.7 | x = 6748.8 and 10417.4 | two verticals |
| parapet slab | 2465.7 → 2661.1 | 2380.9 → 15900.4 | rect; overhangs the walls by ~86 |
| parapet steps | 2661.2 → 3021.4 | left: 2474.8 (2661→2804) → 2576.8 (2804→3021). right: 15814.7 (2661→2804) → 15712.8 (2804→3021) | the wall face steps in under the slab |
| **top floor** (room 5) | 3021.4 → 7003.6 | wall lines: left x=2576.8 (single line); top line y=3021.4 from 2576.8 → 15712.8; right wall stepped: 15814.7 (3031.9→3942.6) → 15617.1 (3942.6→4887.0) → 15708.2 (4887.0→5724.8) → 15814.7 (5724.8→7003.6) | windows: 4 arched bays (§2.1a) |
| cornice band 1 | 7003.6 → 7408.3 | 2199.8 → 15984.6 | profile: top line y=7003.6 full; the band is 2199.8→15984.6 down to y=7190.3, then steps in to 2305.1→15879.4 down to y=7408.3 (Lance draws it as one closed outline) |
| **floor 2** (room 2) | 7408.3 → 10094.1 | outer/inner wall pairs: left x=2408.2 & 2576.8, right x=15646.3 & 15814.7 (y 7444.8→10094.1) | windows: 4 flat bays (§2.1b) |
| balustrade band | 10094.0 → 10960.2 | 2408.2 → 15814.7 | top line broken across slot 2 (3795.5→11399.5 belongs to `#2-fade`); bottom line full; baluster pitch 326.8 |
| cornice band 2 | 10960.2 → 11364.7 | 2199.8 → 15984.6 | same profile as band 1 (step at y=11146.7, inner span 2305.1→15879.4) |
| **floor 1** (no room) | 11364.7 → 15716 | wall pairs continue: x=2408.2/2576.8 and 15646.3/15814.7 from 11364.7 to 21912.7 | windows: 4 flat bays (§2.1c); balconettes under bays 1 and 4 |
| canopy line | y = 15716 | 3246 → 4026 and 12746 → 15046 (fixed) · 4026 → 5990 and 11520 → 12481 (`#1-fade`) | the slot-1 top edge; the portico occupies 6729.8→11515.3 |
| canopy brackets | 15715.7 → 16450.9 | 3426.3→3691.2 and 14600.7→14865.7 (fixed) · 5545.6→5810.5 and 12481.4→12746.3 (`#1-fade`) | 265-wide rects hanging from the canopy line |
| **ground floor** (room 1) | 15716 → 20577 | | right window in fixed (§2.1d); left window + entrance in `#1-fade` |
| plinth line | y = 20577 | 2577 → 4026 and 12746 → 15646 (fixed) · 4026 → 6622 and 7111 → 12746 (`#1-fade`) | the ground floor is raised 1336 above the street |
| entrance steps | y = 20910.7, 21244.8, 21578.7 | 7110.9 → 11134.3 | three risers; step cheeks are verticals at x = 6622, 7111, 11134, 11623 from 20577 to 21913 |
| ground line | y = 21912.6 | 0 → 17250.4 | drawn by shell-A |

**2.1a Top-floor arched bays** (outer 1645.1 wide, inner 1121.2 wide, pitch 3018.4). Bay left edges
x0 = **3795.8** (fixed), **6814.2, 9832.7, 12851.1** (`#5-fade`). Lance: outer semicircle spanning
x0→x0+1645.1 with spring line y=4886.9 and apex y=4064.4; inner semicircle x0+262→x0+1383, apex
4326.3; jambs down to 6562.6; sill line y=6744.1 from x0+262 to x0+1383.

**2.1b Floor-2 bays** (1184.1 wide, pitch 3018.4). Left edges x0 = **4026.3, 7044.7, 10063.2**
(`#2-fade`), **13081.5** (fixed). Opening y 8149.6→10089.9 (bay 4: 8153.8→10094). Lintel line
y=7998.9 from x0+214 to x0+970. Transom y=8841.3 split into x0→x0+480 and x0+704→x0+1184.

**2.1c Floor-1 bays** (same x0s, all in fixed): opening y 12590→15158.6; lintel y=12439.3
(x0+214→x0+970); transom y=13281.7 split. Balconettes: rects 3161.1→6075.6 and 12216.4→15130.9,
y 14535.8→15158.6, with inner verticals at 3344.1 / 5892.5 and 12399.4 / 14947.8; slab lines
y=15321.9 from 3246.2→5990.4 and 12301.5→15045.7.

**2.1d Ground-floor bays**: right window (fixed) 13081.5→14265.6, y 17228.2→19796.8, lintel
y=17077.5 (13295.3→14052), transom y=17919.9 split. Left window (`#1-fade`) 4026.3→5210.4, same ys.
**Entrance** (`#1-fade`): opening 7972.9→10328.3, y 17678.2→20576.8; fanlight above: outer arch
7972.9→10328.3 with apex 16500.6, inner arch 8348→9953.1 with apex 16875.7, spring y=17678.2 and a
transom line at 17816.4 (7973.1→8841.2 and 9436.5→10328.3); portico: columns at 6729.8 and 11515.3
from 15715.7 down to 17541.6, 273.6-square capitals (6729.8→7003.4 and 11241.7→11515.3, y
17541.6→17815.2), pillars 6622→7111 and 11134→11623 from 17816 to 20577.

### 2.2 Building B (19 875 → 41 615, plus a 2 099-wide balcony annex to 43 714)

| element | y | x | notes |
|---|---|---|---|
| rooftop box cap | 5 → 229.6 | 29129.8 → 32708.2 | rect |
| rooftop box | 229.6 → 1243.9 | 29257.6 → 32580.6 | rect |
| parapet | 1244.0 → 2166.9 | 19992.8 → 41615.3 | one outline: `41615.3,1244 → 41615.3,2166.9 → 40981.8,2166.9 → 40981.8,1548.1 → 40147.8,1548.1 → 40147.8,1883.4 → 33664.3,1883.4 → 33664.3,2166.9 → 20405.7,2166.9 → 20405.7,1501.1 → 19992.8,1501.1 → 19992.8,1244 → close` |
| stair tower | 1548.1 → 3119.7 | 40147.8 → 40981.8 | rect |
| rooftop railing | 1883.4 → 2502.2 | 33664.3 → 40147.8 | rect; inner line y=2166.9; posts at x = 34879.1, 35947.1, 37015.1, 38083.1, 39151.3 (pitch 1068) |
| upper-floor top line | y = 3119.6 | 20405.7 → 40147.7 | |
| right step | | 40981.9,3119.6 → 41140.4,3119.6 → 41140.4,3958.7 | |
| left wall | 2166.9 → 8799.2 | x = 20405.7 | single line (the corner pilaster below starts at 20302.8) |
| **upper floor** (room 3) | 3119.6 → 8799.2 | | windows §2.2a |
| cornice | 8799.2 → 9135.0 | 20122.1 → 40234 | rect |
| **middle floor** (no room) | 9135 → 17562.4 | | giant-order pilasters + 6 tall windows §2.2b |
| **ground floor** (room 4) | 17562.3 → 21912.8 | 19875.3 → 41615.3 | outline: top line full; sides x=19875.3 and 41615.3; bottom line broken across slot 4 (27534→40233.5 belongs to `#4-fade`) |
| right column | 3958.7 → 17562.4 | 41140.4 → 41380.4 | rect (a 240-wide pier at the corner) |
| annex balconies ×3 | see §2.2c | 41380.4 → 43713.9 | |
| ground line | y = 21912.7 | 18827.5 → 19875.3 and 41615.3 → 44000 | drawn by shell-B |

**2.2a Upper-floor windows** (853.6 wide × 1592.6 tall, two rows, column pitch 3237.15).
Columns x0 = **22002.6, 25239.7** (fixed) and **28477.1, 31714.3, 34951.5, 38188.6** (`#3-fade`).
Rows y 3958.7→5551.3 and 6605.5→8198.1.

**2.2b Middle floor**: pilasters as vertical lines from y=9130.2 to 17557.4 at
x = 20302.8, 21061.2 | 23797.7, 24048.0, 24298.3 | 27034.9, 27285.2, 27535.5 | 30272.0, 30522.3, 30772.7 |
33509.4, 33759.7, 34009.8 | 36746.5, 36996.9, 37247.1 | 39983.7, 40234.1 (a 758-wide corner pier
each end, 500-wide pilasters with a centre line between). Windows (853.6 wide) at x0 = 22002.6,
25239.7, 28477.1, 31714.3, 34951.5, 38188.6: upper pane y 10163.9→12086.8, lower pane 12086.8→16452.4.

**2.2c Annex balconies** (x 41380.4→43713.9), one at y-offset 0, +3665.9, +7331.8:
lintel slab 4755.0→4917.0 (41380.4→43549.6) · wall recess 4917.0→6122.8 (41380.4→43402.2) ·
door 41665.8→42256.7, y 5394.8→6600.6 · railing 6122.8→6600.7 (41380.4→43402.2), end post
43402.2→43713.9 (6122.8→6361.6) with a drop at x=43576 to 6600.6 · floor slab 6600.7→7176.4
(41380.4→43713.9) with a line at y=6831 (41665.8→43402.2). Add 3665.9 to every y for balcony 2
(8420.8…10842.2) and 7331.8 for balcony 3 (12086.8…14508.2).

**2.2d Ground-floor arches** (Lance): semicircles of radius 1219, spring y=19649, apex 18430, jambs
down to 21912.6, at x = 21210.6→23648.5 and 24447.8→26885.7 (fixed) and 34159.3→36597.2 and
37396.5→39834.4 (`#4-fade`). Shopfront (`#4-fade`): fascia 27882.6→33077.4 × 17938.5→18768;
posts x=28376.3 and 32584.1 from 18768 to 21912.7; transom pane 29114.5→31845.7 × 19052.3→19654.3;
doors 29114.5→30480.1 and 30480.1→31845.7 from 19654.3 to 21912.6.

### 2.3 Wall-thickness convention
Lance draws A's side walls as pairs 168.6 apart (2408.2/2576.8, 15646.3/15814.7) on floors 2 and
1/ground, and single lines elsewhere. Keep exactly that: the pairs are the "wall thickness" the
eye reads as masonry.

### 2.4 Room slots (from CONTRACT §8 = Lance's detail-group bboxes) and Lance's fade bboxes

| stop | detail id | slot x, y, w, h | slot spans | Lance fade bbox | Lance counts fade / detail |
|---|---|---|---|---|---|
| 1 | `#1-front-of-house` | 4026, 15716, 8720, 4856 | x 4026→12746 · y 15716→20572 | 4026, 15716, 8720, 4861 | 22 / 262 |
| 2 | `#2-back-of-house` | 3796, 7408, 7603, 3552 | x 3796→11399 · y 7408→10960 | 3795, 7999, 7605, 2961 | 37 / 393 |
| 3 | `#3-sales` | 27045, 3959, 13189, 4840 | x 27045→40234 · y 3959→8799 | 28477, 3959, 10565, 4239 | 8 / 1157 |
| 4 | `#4-food-and-beverage` | 27531, 17562, 12703, 4351 | x 27531→40234 · y 17562→21913 | 27534, 17939, 12700, 3975 | 9 / 924 |
| 5 | `#5-management` | 6749, 3021, 8669, 3983 | x 6749→15418 · y 3021→7004 | 6814, 4064, 7682, 2680 | 21 / 989 |

Lance's interiors use opacity 0.4 for 24–49 % of elements and 0.2 for 0–23 %.

### 2.5 Who draws which line (the fixed / fade / detail contract)

- **`fixed`** (shell-A + shell-B): everything outside the slots — walls, bands, roofs, the
  windows *outside* slots, the ground line — plus lines that run *along* slot edges (floor and
  ceiling lines). Never anything inside a slot.
- **`#N-fade`**: the simple exterior *inside* the slot: that room's windows/door, the pieces of
  band/canopy/plinth lines that cross the slot, ≤ 40 elements. It is visible before the dive and
  fades out when the camera arrives.
- **`#N-detail`**: the interior with the front wall cut away. It draws its own **interior box**
  (ceiling on the slot top edge, floor on the slot bottom edge, side walls on the slot's left/right
  edges — solid lines) so the room is framed once the fade is gone, and it must re-draw any exterior
  line the fade owns that should persist (room 1: the plinth line pieces at y=20577 become the
  floor line at 20572; room 4: the ground line segment 27534→40234 at y=21913 is its floor).
- What survives at a stop = `fixed` + the other four fades + this detail. Check yours with
  `node tools/render_svg.js src/drawing/hq.svg out.png x y w h --hide=#N-fade` after assembly, or
  `--hide=#N-fade` on your own part file before it.

---

## 3. hypjam HQ — the architecture

Two buildings of one London block, same footprints and floor lines as §2, **original detailing**.
Both are silhouettes at the initial camera (the whole drawing is ~450 px wide on a 1920 stage:
~97 units per pixel — a window is 9 px). So: bold outlines, no fine texture on the shells; the
fine detail lives inside the rooms, where the camera is 6–11 units per pixel.

### 3.1 Building A — the warehouse (shell-A + rooms 1, 2, 5)

A four-storey Victorian brick warehouse conversion (think Clerkenwell/Shoreditch): heavy parapet,
corbelled string courses at the two cornice bands, big **segmental-arched** multi-pane windows on
the top floor, tall **flat-lintel** warehouse windows below, an iron balcony across floor 2, a
raised ground floor with a wide glazed **loading-bay entrance** under a steel canopy, three stone
steps down to the street. Rooftop: a glazed **roof lantern** where Lance has a plant box, and a
small water tank. Two drainpipes. hypjam's rooms: brief desk (ground), writers' room (floor 2),
edit suite (top).

Recipes (x0 = bay left edge; everything solid unless marked 0.4):

- **Top-floor arched window** (bays at x0 = 3795.8 fixed · 6814.2, 9832.7, 12851.1 in `#5-fade`):
  outer reveal `M x0 6562.6 V 4500 Q x0+822.5 3628 x0+1645.1 4500 V 6562.6` (apex lands at
  y≈4064, Lance's apex) · inner opening `M x0+262 6562.6 V 4720 Q x0+822.5 3932 x0+1383 4720 V
  6562.6` (apex ≈4326) · sill block rect x0+200→x0+1445, y 6562.6→6650 · sill shadow line y=6744.1
  from x0+262 to x0+1383 · glazing bars 0.4: verticals at x0+542, x0+822.5, x0+1103 from y 4460 to
  6562.6; horizontals at y 4900, 5320, 5740, 6160 from x0+262 to x0+1383. = 11 elements.
- **Flat warehouse window** (floors 2 and 1, and the two ground-floor windows; 1184.1 wide):
  opening rect x0, ytop, 1184.1 × (ybot−ytop) · lintel rect x0−60 → x0+1244, 150 tall, sitting on
  ytop (floor 2: 7998.9→8149.6; floor 1: 12439.3→12590; ground: 17077.5→17228.2) · sill line at ybot
  from x0−60 to x0+1244 · bars 0.4: one vertical at x0+592 full height, horizontals at ytop+692 and
  ytop+1316 (floor 2: 8841.3 and 9465). = 6 elements.
- **Cornice bands** (7003.6→7408.3 and 10960.2→11364.7): the stepped outline exactly as §2.1
  (one closed path) + a dentil row 0.4: rects 120×120 at pitch 400 along the underside, from
  x=2500 to 15700, tops on y=7190 (and 11147). ≈ 34 per band. Skip the dentils only if over budget.
- **Balustrade band** (10094→10960.2): outline as Lance's shape (top line broken across slot 2);
  posts as verticals from 10094 to 10960.2 at pitch 653.6: **fixed** x = 2903.6, 3557.0 | 11725.5,
  12378.9, 13032.7, 13685.9, 14339.5, 14993.1; `#2-fade` x = 3883.8, 4537.4, 5191.0, 5844.6,
  6498.2, 7151.8, 7805.4, 8459.0, 9112.6, 9766.2, 10419.8, 11073.4; a mid-rail 0.4 at y=10520 in
  both. Where a floor-2 window meets the band the window's sill line sits on 10089.9.
- **Balconettes** (floor 1, bays 1 and 4): outline rect as §2.1c + verticals 0.4 at pitch 326.8
  inside (3344.1, 3670.9, 3997.7, … up to 5892.5; mirror on the right) + slab line y=15321.9 + two
  bracket triangles under the slab (polyline `x,15321.9 → x,15600 → x+250,15321.9`, at x=3400 and
  5700; 12450 and 14750).
- **Canopy** y=15716 pieces as §2.1 + cast-iron column stubs (the 265-wide bracket rects) with a
  capital line 0.4 at y=15800.
- **Plinth face** (20577→21912.6, outside the steps): three joint lines 0.2 at y = 21000, 21350,
  21700 across 2577→6622 and 11623→15646 (skip inside the slot: the slot ends at 20572, so these are
  fine — they sit below it).
- **Steps** at the measured ys, cheeks as rects 6622→7111 and 11134→11623 (20577→21913) with a
  handrail line 0.4 from (6866, 20577) to (6866, 21300) and the mirror.
- **Roof lantern**: top slab rect 6442.9→10723.3 × 1409.5→1563.7; sides x=6748.8 and 10417.4 from
  1563.7 to 2465.7; glazing 0.4: verticals at 6748.8 + n×611.4 (n=1…5) from 1563.7 to 2465.7 and one
  horizontal at y=2000 from 6748.8 to 10417.4. Water tank: rect 12500→13900 × 1900→2465.7 + two leg
  lines 0.4 (12700 and 13700, 2465.7→2350 — i.e. a lip). Drainpipes 0.4: verticals x=2700 and 15520
  from 2661 to 21912 with a bracket tick every 3000.
- **Parapet slab** rect + coping line 0.4 at y=2560 from 2381 to 15900.

### 3.2 Building B — the terrace (shell-B + rooms 3, 4)

A stuccoed late-Georgian/Regency corner block (think Fitzrovia): rusticated ground floor with
round-headed arched openings and keystones, a giant order of pilasters through the middle floor
with tall French windows and iron balconettes, a plainer attic storey of **sash windows** above
the cornice, a parapet with a rooftop railing and a plant room, and on the street corner three
cantilevered balconies stacked on the side elevation. hypjam's rooms: shoot bay (ground floor,
behind a glazed shopfront), casting floor (upper floor).

Recipes:

- **Sash window** (upper floor; 853.6 × 1592.6): rect · vertical bar 0.4 at x0+426.8 · meeting
  rail 0.4 at y0+796 · sill line at y0+1592.6 from x0−60 to x0+914 (solid). = 4 elements. Fixed
  has 2 columns × 2 rows = 4 windows; `#3-fade` has 4 columns × 2 rows = 8 windows = 32 elements.
- **French window** (middle floor, 6 of them, all fixed): frame rect x0, 10163.9, 853.6 × 6288.5 ·
  transom line at y=12086.8 (solid) · vertical bar 0.4 at x0+426.8 · horizontals 0.4 at y 11125,
  13500, 14900 · balconette rect x0−150 → x0+1003.6, y 13600→14450 with 6 verticals 0.4 at pitch
  165 and a slab line at y=14520 (x0−150→x0+1003.6). ≈ 14 each.
- **Pilasters**: the measured verticals; outer two lines solid, centre line 0.4; capital block
  rect (outer width, y 9135→9420) and base block (y 17280→17562.4), both 0.4.
- **Cornice**: rect 20122.1→40234 × 8799.2→9135 + a line 0.4 at y=8900.
- **Rustication** (ground floor outside slot 4): horizontals 0.2 at y = 18000, 18500, 19000, 19500,
  20000, 20500, 21000, 21500, spanning 19875→21210, 23649→24448, 26886→27531, and 40234→41615.
- **Arch** (2 in fixed, 2 in `#4-fade`): `M x0 21912.6 V 19649 A 1219 1219 0 0 1 x0+2438 19649 V
  21912.6` · keystone polygon at the apex (x0+1140,18430 · x0+1298,18430 · x0+1260,18700 ·
  x0+1178,18700) · fanlight 0.4: three radial lines from (x0+1219, 19649) to the arc at 45°, 90°,
  135° · inner door/window rect x0+300 → x0+2138, y 19649→21912.6 with a centre line 0.4. = 8.
- **Shopfront** (`#4-fade` only): fascia rect (§2.2d) + a shutter-box line 0.4 at y=18700 inside it ·
  posts as verticals · side panes rects 28376.3→29114.5 and 31845.7→32584.1, y 18768→21912.7 with a
  stallriser line 0.4 at y=21300 · transom pane rect · two door rects · pull handles as verticals
  0.4 (30380 and 30580, y 20300→21100) · ground line 27534→40234 at y=21913. ≈ 17 with the arches
  ≈ 33 total.
- **Parapet**: the measured outline + a moulding line 0.4 at y=2050 from 19992.8 to 41615.3;
  rooftop railing rect with the 5 posts (solid) and 4 more 0.4 posts at the bay midpoints; plant
  room box + 3 louvre lines 0.4 (y 500, 750, 1000, x 29400→32440); stair tower rect + a door rect
  0.4 inside (40350→40780, 2300→3119.7).
- **Annex balconies**: the slabs/recess/door/railing rects as §2.2c, railing bars 0.4 ×6 at pitch
  ~290 across 41380→43402, door centre line 0.4.
- **Right column** rect + 6 quoin ticks 0.4 (horizontal, 41140→41380) at y = 5000, 7200, 9400,
  11600, 13800, 16000.
- **Street furniture in the gap** (optional, ≤ 8 elements, shell-B's file): a lamp post at x=18000:
  pole 21912.6→17600, lantern rect 17800→18200 × 17250→17600, a base rect 17900→18100 × 21700→21912.6.

---

## 4. Drawing language (all seven parts)

### 4.1 Scale and legibility
- **1 unit = 1 mm.** Standing adult 1700 tall (head Ø 230), seated adult ~1300 from floor to
  crown, door 2100 tall, desk top 740 above the floor, kitchen counter 950, sofa seat 450,
  chair seat 450, monitor 820×540, laptop 320 wide open, phone 90×190 (draw hero phones at
  130×270 so they read), ring light Ø 1000, tripod 1500 tall, product box 250–400.
- Stop cameras: width = slot width × 1.25 on a 1920×1080 stage → **6.3–10.9 units per pixel**.
  Anything under 25 units disappears; hatch/texture spacing ≥ 150 units; gaps between parallel
  lines ≥ 40 units or they merge.
- Strokes are always 1 px on screen. Weight comes only from the opacity tier and density.

### 4.2 Opacity tiers
- **solid** (no `stroke-opacity`): outlines — walls, furniture silhouettes, people, props.
- **0.4**: secondary lines — glazing bars, panel lines, cushions, keyboard, labels, screen
  contents, hair. Aim for 25–45 % of a room.
- **0.2**: background — tile grids, brick coursing, skyline through windows, cables, silhouettes
  behind glass, rugs. Rendered dashed by the engine. ≤ 20 % of a room.

### 4.3 Figures (line people; no faces beyond a hint)
Standing figure, origin (fx, fy) = between the feet on the floor line, 1700 tall, ~13 elements:
```
head      circle cx=fx cy=fy-1585 r=115
hair      path M fx-105 fy-1610 Q fx-30 fy-1705 fx+95 fy-1640        (0.4; vary per person)
neck      line fx,fy-1470 → fx,fy-1420
torso     path M fx-240 fy-1370 Q fx-240 fy-1420 fx-190 fy-1420 L fx+190 fy-1420
               Q fx+240 fy-1420 fx+240 fy-1370 L fx+205 fy-880 L fx-205 fy-880 Z
arm L     polyline fx-235,fy-1400  fx-290,fy-1040  fx-265,fy-790      (hand: circle r=35 at the end)
arm R     polyline fx+235,fy-1400  fx+290,fy-1040  fx+265,fy-790
legs      polyline fx-180,fy-880  fx-175,fy-60  ·  polyline fx+180,fy-880  fx+175,fy-60
          inner lines fx-35,fy-880 → fx-60,fy-60  ·  fx+35,fy-880 → fx+60,fy-60
feet      line fx-250,fy → fx-60,fy  ·  line fx+60,fy → fx+250,fy
(shoulders 480 wide, torso 540 tall, legs 820 — check yours against the template figure)
```
Vary: an arm raised (holding a phone/tablet), a bag strap (0.4 diagonal), a cap, a ponytail
(0.4 curve), a skirt (torso continues to fy-500 as a trapezoid, legs from there), an apron
(0.4 rect on the torso), a jacket lapel (two 0.4 lines). No eyes, no mouths; at most a small
0.4 arc for an ear or a nose.

Seated figure facing us (seat top at (sx, sy), ~12 elements): head circle at (sx, sy−735)
r=115 · neck sy−620→sy−580 · torso path shoulders at sy−580 (±250) tapering to the seat at sy
(±200) · upper arms to the table/lap · thighs as two short horizontals at sy from ±60 to ±220 ·
lower legs from (sx±180, sy) down to the floor · feet lines. If the person sits behind a desk or
counter, **do not draw what the furniture hides** (split the lines) — nearer things occlude.

### 4.4 Props vocabulary (draw these the same way in every room)
- **phone on tripod**: legs 3 lines from a hub (hx, hy) to (hx−300, floor), (hx+300, floor),
  (hx+40, floor−40) · column hx, hy → hy−450 · phone rounded rect 130×270 rx 25 centred on the
  column top · screen inset 0.4 (30 in) · a tiny REC circle r=18 top-left inside the screen (0.4).
- **ring light**: stand pole (x, floor → cy+520) · three base lines · ring circle r=500 at (x, cy)
  · inner circle r=380 0.4 · phone clamp rect 130×270 at the centre (0.4).
- **monitor**: rect 820×540 rx 30 · screen inset 0.4 (30 in) · neck rect 60×220 below · base line
  360 wide · contents 0.4 (a timeline: top preview rect, three track lines, 3–5 clip rects per track,
  one solid playhead vertical).
- **laptop**: base line (320 wide) · screen polygon tilted 8° back · keyboard line 0.4.
- **desk**: top rect 2400×80 · two pedestal rects 400 wide to the floor (solid) with a drawer line 0.4.
- **chair**: seat line 450 wide · back rect · two legs; office chair: stem + 5-star base lines + arms.
- **plant** (monstera / fiddle-leaf): pot polygon (trapezoid) · stem line · 5–9 leaf paths (Q curves)
  with a mid-rib each (0.4).
- **product box**: rect · flap line 0.4 across the top third · label rect 0.4. **Bottle**: rounded
  rect body + neck rect + cap rect.
- **hook-card**: rect 520×330 · 2 text lines 0.4 (x+60→x+400 at y+110 and y+200) · pin circle
  r=28 at (x+40, y+40). "Picked" cards get a tick polyline (x+380,y+250 → x+430,y+300 → x+500,y+180).
- **clapper**: body rect 420×300 · top bar rect 420×80 hinged open (polygon rotated ~20°) · three
  short diagonals 0.4 across the bar.
- **pendant lamp**: cord 0.4 from the ceiling · shade path (dome or cone) · bulb tick 0.4.
- **whiteboard**: rect · inner border 0.4 · tray line · contents 0.4.
- **headphones**: arc over the head (or on a desk) + two cup rects.
- **drive**: rect 220×130 (+ label line 0.4). **phone flat / in hand**: rounded rect 90×190 + screen 0.4.
- **softbox**: rect 800×800 (polygon if tilted) + an X inside (0.4) + cord/stand.
- **glazed partition**: two verticals + 3 muntins 0.4.

### 4.5 The interior box (every room)
Four solid lines on the slot edges: ceiling `y = slot.y`, floor `y = slot.y + h`, walls
`x = slot.x` and `x = slot.x + w`. Then a beam/cornice line 0.4 ~180 below the ceiling and a
skirting line 0.4 ~150 above the floor. Furniture stands on the floor line. The room is seen as
a section: the back wall is the picture plane; nearer objects occlude farther ones (split lines,
do not draw through). No perspective — Lance's rooms are flat elevations with a hint of depth
from overlap only.

### 4.6 Budgets and density
Lance's interiors are 262–1157 elements. Targets per part are in §0. A room under ~300 elements
looks empty at the stop camera; over ~900 costs draw-in time. Aim for the middle of your range.
Fill with meaning, not noise: every extra element should be a thing (a mug, a cable, a card), not
a hatch.

---

## 5. Part briefs

Coordinates are canvas units. "Solid / 0.4 / 0.2" as §4.2. Counts are targets, not laws — the
checker warns outside 300–900 for details and errors above 40 for fades.

### 5.A shell-A — `fixed-A` (Building A shell). Budget 260–520.
Draw §2.1 + §3.1 exactly: parapet steps, top-floor wall (single line left, stepped right), bay 1
arched window, cornice bands 1 and 2 (with dentils if budget allows), wall pairs, floor-2 bay 4
window, balustrade band (top line **broken** 3795.5→11399.5; 8 posts outside the slot; mid-rail
0.4 outside the slot only), floor-1 four windows + two balconettes + slab lines, canopy pieces +
two column stubs, ground-floor right window (bay 4), plinth pieces, plinth joint lines, steps +
cheeks + handrails, roof lantern, water tank, drainpipes, ground line 0→17250.4.
Do **not** draw: anything inside slots 1, 2, 5 (x/y in §2.4) — not even the windows there. The
checker fails an element that enters a slot's interior by > 40 units. Lines on the slot edges
(y=3021.4, 7003.6, 7408.3, 10960.2, 15716, 20577) are fine.
Skeleton check: the checker verifies the must-have lines of §2.1 (walls, bands, parapet, canopy,
plinth, ground line) are present within ±30 units and ≥ 85 % coverage. Camera crop to look at
yourself: `node tools/render_svg.js src/drawing/parts/shell-A.svg a.png 1800 0 14500 21918`.

### 5.B shell-B — `fixed-B` (Building B shell). Budget 320–620.
Draw §2.2 + §3.2 exactly: rooftop plant room (cap + box + louvres), parapet outline + moulding,
stair tower + door, rooftop railing + posts, upper-floor top line, left wall, four sash windows
(columns 22002.6 and 25239.7 × rows 3958.7 and 6605.5), right step, cornice, pilasters (14 outer
lines solid, 5 centre lines 0.4, capitals/bases 0.4), six French windows with balconettes,
ground-floor outline (bottom **broken** 27534→40233.5), two arches with keystones/fanlights/inner
doors, rustication lines, right column + quoins, three annex balconies, ground line pieces
18827.5→19875.3 and 41615.3→44000, optional lamp post in the gap.
Do **not** draw inside slots 3 and 4 (§2.4). Note the slot-3 top edge y=3959 is *not* a wall
line in Lance's shell (the upper-floor wall runs from 3119.6 down); leave that edge to room-3's
interior box. The slot-4 top edge y=17562.3 *is* the ground-floor top line — draw it full width.
Crop: `node tools/render_svg.js src/drawing/parts/shell-B.svg b.png 17500 0 24000 21918`.

### 5.1 room-1 — the brief desk. `#1-fade` (≤ 40) + `#1-front-of-house` (300–500)
Slot x 4026→12746, y 15716→20572. Ground floor of the warehouse: where a client walks in with a
product and a brief is written. Stop camera crop (1920×1080): `2936 15078 10900 6131`.

**`#1-fade`** (the exterior inside the slot, ~30 elements): left flat warehouse window at x0=4026.3
(opening 17228.2→19796.8, lintel 17077.5→17228.2, sill, 3 bars 0.4) · canopy line pieces y=15716:
4026→5990 and 11520→12481 · column stubs (rects 5545.6→5810.5 and 12481.4→12746.3, y
15715.7→16450.9) with capital lines 0.4 · **entrance**: a blank fascia/sign board rect 6729.8→11515.3
× 15716→16450 (solid) with an inner border 0.4 · steel lintel beam rect 7800→10500 × 17500→17680
(solid) · the opening's jambs x=7972.9 and 10328.3 from 17680 down to 20577 · glazed double doors:
rects 7972.9→9150.6 and 9150.6→10328.3, y 17680→20577, each with a glazing rect 0.4 inset 90 and a
pull handle vertical 0.4 (9020 and 9280, y 18900→19700) · fanlight: rect 7972.9→10328.3 × 16450→17500
with two verticals 0.4 at 8758 and 9543 · portico pillars rects 6622→7111 and 11134→11623 (17816→20577)
with a cap line 0.4 · plinth line pieces y=20577: 4026→6622 and 7111→12746.
(Lance had a round-arched door with columns; ours is a square industrial bay with a fanlight.)

**`#1-front-of-house`** — the interior box (§4.5: ceiling 15716, floor **20572**, walls 4026 and
12746; beam 0.4 at 15900; skirting 0.4 at 20420), then left → right:

| zone | x | what |
|---|---|---|
| waiting nook | 4026→6400 | glazed partition: verticals x=6350 and 6400 (15900→20572, solid), muntins 0.4 at y 17200, 18500, 19800 · behind it a **monstera** (pot 4300→4900 × 19800→20572, 7 leaves reaching 17500) · a **flatbed trolley** (platform rect 5000→6300 × 20180→20280, 4 wheels r=90 at y=20480, handle polyline 6300,20180 → 6300,19200 → 6100,19200) carrying **three product boxes** (5100→5700 × 19560→20180 · 5750→6250 × 19680→20180 · 5200→5620 × 19100→19560) |
| client | fx=6720 | standing figure (§4.3), feet on 20572, holding a **product box** (rect 6560→6880 × 19050→19300) with both hands; a bag strap 0.4 |
| counter | 7000→11300 | top rect 6950→11350 × 18980→19080 · front rect 7000→11300 × 19080→20572 · slats 0.4 verticals every 160 from 7080 to 11240 (27) · a base line 0.4 at 20450 |
| hypjam A | fx=7900 | seated-behind-counter figure: head (7900, 17700) r=115, shoulders at 18150, torso to the counter top, both forearms on the counter; **laptop** at 7550→7870 (base on 18980, screen tilted) |
| counter props | | **product box** 9100→9500 × 18580→18980 (the client's product, centre stage) with flap + label 0.4 · **phone on a desk tripod** at x=9850 (hub 18800, phone 9785→9915 × 18320→18590) · **pen pot** 10800→10950 × 18800→18980 with 3 pen lines 0.4 · a **desk lamp** at 11100 (base, stem, dome shade) |
| hypjam B | fx=10350 | same as A but standing behind the counter (head top 18872, counter hides below 18980), holding a phone up (rounded rect 90×190 at (10560, 18250)) |
| phone-frame wall | 7000→11250, y 16200→17080 | **8 portrait frames** 420×880 rx 60 at x0 = 7000 + n×540 (n=0…7), each with a screen inset 0.4 (40 in) and a play triangle 0.4 (polygon centred, 110 tall) |
| hook-card strip | y 17200→17530 | 4 hook-cards (§4.4) at x = 7100, 7900, 8700, 9500 (0.4 lines; card outline solid) |
| shelf | 10900→11350, y 16200→18900 | a narrow tall shelf: 2 uprights + 4 shelves, 3 products per shelf (bottles/boxes, ≤ 200 tall) |
| door | 11600→12500, y 17900→20572 | door rect · two panel rects 0.4 · handle circle r=40 at (12350, 19250) · a **wall clock** circle r=220 at (12050, 16800) with two hands |
| ceiling | | three **pendants**: cords 0.4 at x=7600, 9100, 10600 from 15716 to 16700, dome shades 16700→16950 (path) |
| floor | | a **rug** 0.4 rect 6600→11600 × 20480→20572 · a doormat 0.4 rect 8000→10300 × 20500→20572 in front of the doors is *outside* (skip) |
| background 0.2 | | **brick coursing** on the back wall: horizontals at y = 16100 + n×200 (n=0…14) from 4026 to 12746, **broken** where frames, cards, shelf, door and clock sit (split the lines — do not draw through) |

Extras if under 300: a second plant by the door, a bicycle helmet on the counter, a cable from the
laptop, a small speaker on the shelf, a coat hook with a jacket by the door, a parcel on the floor
by the trolley.

### 5.2 room-2 — the writers' room. `#2-fade` (≤ 40) + `#2-back-of-house` (300–550)
Slot x 3796→11399, y 7408→10960. Floor 2 of the warehouse, behind the iron balcony: hooks are
written here. Crop: `2845 6511 9504 5346`.

**`#2-fade`** (~32): three flat warehouse windows at x0 = 4026.3, 7044.7, 10063.2 (opening
8149.6→10089.9, lintel 7998.9→8149.6, sill on 10089.9 from x0−60 to x0+1244, 3 bars 0.4) = 18 ·
balustrade top line y=10094 from 3795.5 to 11399.5 (solid) · 12 posts at the §3.1 x-list from
10094 to 10960.2 (solid) · mid-rail 0.4 y=10520 from 3796 to 11399.

**`#2-back-of-house`** — interior box: ceiling 7408, **floor 10760** (the balcony slab band
10760→10960 reads as the floor thickness; the fixed group already draws y=10960.2), walls 3796 and
11399; beam 0.4 at 7600; skirting 0.4 at 10650.

| zone | x | what |
|---|---|---|
| hook-card wall | 4100→8900, y 7700→9300 | **32 hook-cards** 480×300, x0 = 4150 + n×600 (n=0…7), y0 = 7720 + m×400 (m=0…3); each: rect (solid) + 2 lines 0.4 + pin circle; three cards tilted ±6° as polygons; **two "picked"** with a tick |
| table | 4500→9300 | top rect 4500→9300 × 9550→9650 · two trestle A-frames (polylines 4700,9650 → 4900,10760 · 4700,9650 → 4500,10760 · crossbar 0.4; mirror at 9100) |
| writers | fx = 5400, 6900, 8400 | three seated figures facing us (§4.3), seat y=10100 (chair seat line 450 wide, back rect 10100→9400 behind the shoulders, legs to 10760); heads at y≈8950; forearms on the table |
| on the table | | laptop at 5240→5560 · laptop at 8240→8560 · notebook rect 6700→7100 × 9470→9550 with a pen line · **three mugs** (rect 160×140 + handle arc) at 5900, 7300, 8900 · a phone flat at 7600 · a small stack of hook-cards 6100→6600 × 9420→9550 (3 offset rects) |
| whiteboard | 9200→11200, y 7750→9300 | rect · inner border 0.4 · tray line at 9300→9360 · **timeline**: baseline y=8500 from 9400 to 11000 (solid), six ticks 0.4 at pitch 320, six milestone rects 200×120 alternating above/below (0.4), two wavy scribble paths 0.4, one circled tick (circle r=90 0.4) · 6 sticky-note rects 0.4 (180×180) along the bottom |
| at the board | fx=10500 | standing figure, feet 10760, right arm raised holding a marker (short line) |
| shelf | 3850→4400, y 8300→10760 | 2 uprights + 4 shelves + 12 binder rects (150 wide, 380 tall) with spine lines 0.4 |
| coat stand | x=11250 | pole 10760→8200, 3 hook ticks, a jacket outline (polygon) hanging at 8300→9300 |
| ceiling | | two pendants (cords 0.4 at 6000 and 8200 from 7408 to 8000, shades to 8250) |
| floor | | rug 0.4 polygon 4300→9500 × 10690→10760 |

Extras if under 300: a wall clock, a plant on the shelf, a printer on the shelf's top, cables 0.2,
a second sticky-note cluster, a poster frame above the coat stand.

### 5.3 room-3 — the casting floor. `#3-fade` (≤ 40) + `#3-sales` (400–700)
Slot x 27045→40234, y 3959→8799 — the widest room (13 189). Upper floor of the terrace: creators
are found, met, and test-shot. Crop: `25396 1742 16486 9274`.

**`#3-fade`** (32): eight sash windows (§3.2) at columns x0 = 28477.1, 31714.3, 34951.5, 38188.6 ×
rows y0 = 3958.7 and 6605.5: rect + vertical bar 0.4 + meeting rail 0.4 + sill line.

**`#3-sales`** — interior box: ceiling 3959, floor 8799, walls 27045 and 40234; cornice 0.4 at
4150; skirting 0.4 at 8650.

| zone | x | what |
|---|---|---|
| casting board | 27300→31600, y 4300→7150 | board rect + inner border 0.4 · **30 headshot cards** 600×500 at x0 = 27450 + n×700 (n=0…5), y0 = 4380 + m×540 (m=0…4): each rect (solid) + head circle r=120 at (x0+300, y0+220) + shoulders path `M x0+150 y0+470 Q x0+300 y0+330 x0+450 y0+470` + hair arc 0.4 · **six shortlisted** cards get a tick (polyline) or a small star (5-point polygon) 0.4 |
| under the board | 27400→30900, y 7700→8799 | low cabinet: rect + 3 door lines 0.4 + 3 handles 0.4 · on top: **five phones on charge** upright (rects 180×380 at pitch 240 from 28000) with cables 0.4 (Q curves) into a power strip rect 29600→30500 × 7560→7700 |
| plant | 27100→27600 | fiddle-leaf on the floor, leaves to 6900 |
| bench | 31300→33100, y 7900→8000 | bench top + 2 legs · **three seated creators** at sx = 31600, 32200, 32800 (seat y=7900): one on a phone, one with a bag on the lap (rect), one with legs crossed (angled lower legs) |
| casting lead + creator | fx = 33700 and 34700 | two standing figures facing each other; the lead holds a **tablet** (polygon 300×420 at chest height 6500→6900, screen 0.4); the creator has a ponytail 0.4 and a bag strap |
| framed stills | 33500→35100, y 4900→5350 | three landscape frames 480×450 (rects) at pitch 560 with inner rects 0.4 and a horizon line 0.4 |
| wardrobe rail | 35300→36000 | rail y=5600 from 35300 to 36000 on two uprights (to 8799) · **6 hangers** (hook arc + shoulder line) at pitch 110 with **garment outlines** (polygons 5650→7300, alternating shirt/dress shapes; folds 0.4) |
| stage | 36000→40000, y 8400→8799 | platform rect + front edge line 0.4 at 8450 · **backdrop**: uprights x=36500 and 39500 from 4300 to 8400, crossbar 4300, paper roll ellipse (38000, 4300, rx 1500, ry 130), paper sheet rect 36550→39450 × 4430→8400 (solid) with a curl path 0.4 at the bottom |
| creator on stage | fx=38300, feet 8400 | standing figure, one arm raised waving, the other holding a product |
| phone on tripod | hub (37000, 7300) | §4.4, legs to 8799, phone at 6350→6620 |
| ring light | x=39750, floor 8400 | §4.4, ring centre (39750, 6300) r=500 — it stands on the platform |
| mirror | 36100→36450, y 4600→6600 | a **light-bulb mirror** on the wall between the rail and the backdrop upright: rect + 10 bulb circles r=45 (0.4) around it |
| ceiling | | track rail 0.4 from 35500 to 40000 at 4250 with 4 spot heads (tilted small rects) · two downlight arcs 0.4 over the board |
| floor | | runner rug 0.4 31300→35200 × 8730→8799 · two prop crates (rects 500×300 with a lid line 0.4) on the floor in front of the platform at 36100→36600 and 36700→37200, y 8500→8799 — they sit in front of the platform edge, so split the platform's front line behind them |

Extras if under 400: a water cooler by the bench, a coat rack, a poster frame over the bench, a
second power strip, cables 0.2, a clipboard on the cabinet, a second row of framed stills.

### 5.4 room-4 — the shoot bay. `#4-fade` (≤ 40) + `#4-food-and-beverage` (400–700)
Slot x 27531→40234, y 17562→21913. Ground floor of the terrace behind the shopfront: sets, lights,
a take in progress. Crop: `25943 15271 15879 8932` (extends below the canvas; that is fine).

**`#4-fade`** (~33): §3.2 shopfront (fascia + shutter line, posts, side panes + stallrisers,
transom pane, doors + handles) · two arches at x0 = 34159.3 and 37396.5 (arc path, keystone, 3
fanlight lines 0.4, inner door rect + centre line) · ground line 27534→40234 at y=21913 (solid).

**`#4-food-and-beverage`** — interior box: ceiling 17562, **floor 21913**, walls 27531 and 40234;
beam 0.4 at 17750; skirting 0.4 at 21760.

| zone | x | what |
|---|---|---|
| kitchen set | 27531→32600 | **backsplash tile grid 0.2**: x 27800→31900, y 19100→20900, horizontals every 300, verticals every 400 · **wall cupboards** 27800→31900 × 18000→19000: 4 door rects + handles 0.4 · **extractor hood** trapezoid over 29200→30600 · **counter** top rect 27750→31950 × 20900→21000, front rect 27800→31900 × 21000→21913 with 4 cupboard door rects 0.4 + handles · hob: 2 circles r=140 0.4 at (28500, 20940) — draw as ellipses rx 140 ry 40 on the top · kettle path at 31300 · chopping board rect + 2 product bottles at 29800 · a **fridge** rect 32100→32600 × 19400→21913 with a handle line |
| creator mid-take | fx=29900 | standing behind the counter: draw from the counter top up (head top 20213, shoulders 20620, one hand raising a **bottle** to camera height) |
| ring light | x=28300, floor 21913 | ring centre (28300, 19900) r=500, inner 0.4, stand to the floor — in front of the counter, so the counter lines behind it are **split** |
| phone on tripod | hub (31500, 20700) | phone at 19750→20020, legs to 21913 |
| hanging softbox | over (29900, 18300) | cord 0.4 from 17562, box polygon 29500→30300 × 17900→18600 tilted, X inside 0.4 |
| divider | x=32800 | a **C-stand with a flag**: pole 21913→18400, arm line to 33400, flag rect 33000→33600 × 18300→18900 (0.4 hatch 3 lines) |
| sofa set | 33400→36300 | sofa: seat rect 33500→36100 × 21000→21250, back rect 33500→36100 × 20250→21000, arms rounded rects 33350→33550 and 36050→36250 × 20600→21250, 4 leg ticks, 2 cushions 0.4 · **seated creator** at sx=34400 (seat 21000; head top 20150) holding a phone · **coffee table** 34200→35400: top line at 21400, 2 legs, a product bottle + a mug on it · **floor lamp** at 33200 (pole to 19900, cone shade) · **rug** 0.4 33300→36400 × 21850→21913 |
| product shelf | 33600→36000, y 19000 and 19600 | two shelf lines (solid) + 4 brackets 0.4 · **8 products** (bottles/boxes 220–380 wide, 260–520 tall; labels 0.4) |
| clapper person | fx=36900 | standing figure holding a **clapper** (§4.4) at chest height (36700→37120 × 20400→20780) |
| framed print | 36300→37000, y 18900→19500 | rect + inner 0.4 |
| product shelving unit | 37800→39600, y 18300→21913 | 2 uprights + 5 shelves (solid) + **14 products** across the shelves (rects; 5 with label lines 0.4) |
| softbox on a stand | x=39900 | pole 21913→18500, softbox polygon 39550→40200 × 17950→18650 (tilted), X 0.4 |
| director's laptop | 32900→33300 | on a stool (seat line + 3 legs at 20900) — a laptop open showing the shot (screen rect 0.4 with a small phone-frame rect inside) |
| ceiling | | track light rail 0.4 33500→37500 at 17800 with 3 heads |
| floor | | three cables 0.2 (wavy paths) from the ring light and softboxes to a power strip at 32600 |

Extras if under 400: a storyboard clipped to the C-stand (rect + 6 frames 0.4), a rail with 4
outfits at 37200→37700, a plant behind the sofa, a crate of products under the coffee table,
a second phone on a mini tripod on the counter, a mirror.

### 5.5 room-5 — the edit suite. `#5-fade` (≤ 40) + `#5-management` (350–650)
Slot x 6749→15418, y 3021→7004. Top floor of the warehouse under the roof lantern: cuts, captions,
delivery. Crop: `5665 1964 10836 6096`.

**`#5-fade`** (33): three arched warehouse windows (§3.1 recipe, 11 each) at x0 = 6814.2,
9832.7, 12851.1.

**`#5-management`** — interior box: ceiling 3021, floor 7004, walls 6749 and 15418; beam 0.4 at
3200; skirting 0.4 at 6860.

| zone | x | what |
|---|---|---|
| plant | 6850→7250 | monstera, pot 6600→7004, leaves to 5200 |
| desk A | 7400→9800 | top rect 7400→9800 × 6260→6340 · pedestals 7500→7900 and 9300→9700 (6340→7004) with drawer lines 0.4 · **two monitors** 820×540 at 7550→8370 and 8730→9550, y 5380→5920, necks to 6200, base lines · each screen: inset 0.4, **timeline** (preview rect top 40 % 0.4; three track lines 0.4; clips: 5/4/3 rects 0.4; a solid playhead vertical; a ruler line 0.4) · keyboard rect 0.4 8100→8700 × 6180→6260 · mouse 0.4 · **headphones on the desk** at 7450 · mug at 9650 |
| editor A | sx=8550 | seated figure facing us, seat y=6560 (office chair: back rect above the desk, stem + 5-star base visible between the pedestals), head at (8550, 5825), **wearing headphones** (arc + 2 cups); forearms hidden by the desk |
| desk B | 10200→12600 | same as desk A shifted +2800 (monitors 10350→11170 and 11530→12350); a **phone on a small stand** on the desk at 12450 showing a vertical video (rect 0.4 inside) |
| editor B | sx=11350 | seated, one hand up on the monitor edge, a mug in the other |
| ship board | 14350→15300, y 3500→5150 | board rect + inner 0.4 · **five tiles** 300×300 rx 40 at x=14450, y = 3600 + n×310 (n=0…4), each with a different abstract glyph 0.4 (play triangle · circle · square · chevron · two short bars) — no trademarks · three tiles get a solid tick polyline at x=14900 |
| drive shelf | 12850→14250, y 3700→5900 | 2 uprights + 4 shelves (solid) · **22 drives** 220×130 (some standing 130×220) with a label line 0.4 each |
| NAS | 12850→13500, y 6100→7004 | rect + 4 LED circles r=25 0.4 + 2 vent lines 0.4 |
| armchair | 14400→15300, y 6000→7004 | review chair: seat, back, two arms, cushion 0.4 |
| back-wall windows 0.2 | x0 = 6814.2, 9832.7, 12851.1 | the **arched window reveal** (outer + inner paths of §3.1, at 0.2 — so when `#5-fade` crossfades to the detail, the same windows recede to dashed) · inside each, a **skyline** 0.2: 4–5 building rects of different heights between y 4900 and 6560, split by the desks/monitors in front (do not draw through them) |
| acoustic panels 0.2 | | four rects 600×900 on the wall between the windows at y 3450→4350 (x 8500, 11500, 14000… avoid the ship board) |
| ceiling | | three downlight arcs 0.4 at x=8600, 11400, 14200 · a cable tray line 0.2 at 3300 |
| floor | | rug 0.4 7300→12700 × 6930→7004 · two cables 0.2 from the desks to the NAS |

Extras if under 350: a **pinboard of thumbnails** (rect + 12 small rects) on the wall at
7400→8700 × 3500→4400, a whiteboard with a delivery list (rect + 8 lines 0.4) at 9000→10000 ×
3500→4400, desk speakers (2 rects per desk), a desk lamp, a coat on the armchair, a second plant.

---

## 6. Tools

- `python3 tools/check_drawing.py <file.svg> [...]` — validates a part (by its ids) or the
  assembled `hq.svg` (by its structure). Prints per-group counts, bboxes vs slots, opacity mix,
  every violation, and `PASS` / `FAIL`. Exit code 1 on FAIL. Errors: format, off-canvas, outside
  slot, detail bbox ≠ slot, fade > 40, detail outside 200–1200, shell entering a slot, missing
  must-have skeleton lines. Warnings: detail outside 300–900, > 25 % at 0.2, should-have skeleton
  lines, empty groups. Files whose name starts with `_` (the template) get count errors as warnings. `--lance` relaxes attribute rules to
  warnings so Lance's reference can be inspected (its structure and skeleton pass; its attribute
  style differs from ours by design).
- `node tools/render_svg.js in.svg out.png [x y w h] [--width=2200] [--hide=id,id] [--only=id,id]`
  — renders exactly as the hero engine does (1px non-scaling strokes, 0.2 dashed, black stage).
- `python3 tools/assemble_drawing.py [--strict] [--force]` — checks every part, merges them into
  `src/drawing/hq.svg` with the CONTRACT §8 structure, writes `assets/img/hq-footer.svg` (the
  exterior only: `fixed` + the five fades, 0.2 lines dropped, tiny elements dropped, 1px strokes;
  Lance's footer image shows exactly the exterior with its windows, so the fades are included).
  Missing parts become empty groups with a warning (so the site still builds); `--strict` fails
  instead.

Definition of done for a drawing agent: your file passes `check_drawing.py`; your crop render
reads as the room described here at 1px; your whole-canvas render shows nothing outside your
slot (rooms) or inside any slot (shells); your report lists counts and omissions.
