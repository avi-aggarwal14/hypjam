# Product panels — shared spec

Five mock hypjam screens live inside the hero HUD card, one per stop. Lance's are Lottie files
(`ref/product-1…5.json`); ours are HTML + CSS + inline SVG animated by a looping GSAP timeline.
This document is the frame all five follow so they read as one product. The `brief` panel
(`brief.html` / `brief.css` / `brief.js`) is the reference implementation — copy its structure.

Read CONTRACT.md §4, §7, §9, §10 first. Everything below is derived from it and from Lance's
reference: `ref/hero_dom.html` (the card DOM), `ref/hero_engine.pretty.js` (`tm[]`, `eh`, `el`),
`ref/shots/s06, s09, s12, s15, s18` (the five panels inside the card) and `ref/mobile/m04–m06`.

---

## 1. What Lance's panels look like (measured)

Card (from `ref/hero_dom.html`): `357×354`, radius 12, `rgba(188,187,180,.12)` on black,
`box-shadow 0 12px 12px rgba(0,0,0,.24)`, `backdrop-filter blur(4px)`, rotating conic border glint.
Body padding `22px 18px 18px`, column gap 18: title 26px display → description 14px/1.35 `--sand-l`
→ `0.5px` divider at `--grey-m` 60% → **the panel** (`321×184`, radius 6, `overflow:hidden`).

Lance's `tm[]` (engine line 92+): panel sizes `321×184`, `306×128`, `304×205`, `324×152`, `306×65`;
card width = panel width + 36. The engine **measures** the card's real height per stop (`J(t)`,
`offsetHeight`) and tweens width/height over `el = .4s`; panels crossfade over `eh = .28s`.

Inside the panels (crops of the shots, 3× zoom), the language is:

| element | measured |
|---|---|
| label ("Guest") | 12px, colour ≈ `#a1a09a` |
| bubble | 1px border `rgba(255,255,255,.14)`, fill `rgba(255,255,255,.06)`, radius 8, padding 8×10, text 13px white, blinking 1px caret |
| status ("⟳ Translating") | 10px spinner ring + 11px mute text |
| list row | 34px pitch, `0.5px` hairline between rows, icon 12px · mono uppercase id · chip |
| chip ("MAINTENANCE REQUIRED") | 17px tall, 9px uppercase 500, tracking .06em, radius 4, fill `rgba(255,255,255,.12)` |
| mono data ("OCEAN BALLROOM \| 120 GUESTS") | monospace (Lance loads `gtStandardMono`), 11px, uppercase, mute |
| stat tile | fill `rgba(255,255,255,.06)`, radius 4, numeral 20px, label 8px uppercase mute |
| button ("⟳ Generating Proposal") | full width, 30px, radius 6, fill `rgba(255,255,255,.08)`, 13px mute |
| clipped list (panel 4) | last row fades out under a bottom mask |
| colours in the Lottie files | `#fff`, `#d9d9d9`, `#cccccc`, `#b1b1b1`, `#a1a09a`, `#000` — **no accent at all** |

Everything is calm, monochrome, and mostly empty space. Our one accent is `--jam`, used for exactly
one thing per panel (a tick, a toggle, a REC dot), never a surface.

---

## 2. Stage

- **Width: 321px for all five.** (Lance varies width per panel; we do not — the card stays 357 wide
  and only its height tweens. Simpler for the engine, and the reference crops show the width
  differences are invisible.)
- **Height: per panel**, declared three times identically: in the table below, as
  `data-panel-height` on the root, and as `height` on the JS registration.

| stop | panel | height | Lance's | why |
|---|---|---|---|---|
| 1 | `brief` | **184** | 184 | message bubble beat, then a four-line brief card |
| 2 | `hooks` | **128** | 128 | four visible rows of a clipped list that scrolls as lines type |
| 3 | `casting` | **205** | 205 | header + five creator rows |
| 4 | `shoot` | **152** | 152 | phone frame (70×140) beside a four-row take list |
| 5 | `ship` | **96** | 65 | timeline strip + export bar + three platform ticks; 65 cannot hold three readable rows |

The engine adds card chrome (title, description, divider, padding) and measures; nominal card
height ≈ panel height + 152 with a three-line description. Do not hard-code card heights anywhere.

The panel root fills its slot: `width:100%; height:100%; overflow:hidden; position:relative`.
Lay out in absolute px inside it (the slot is exactly 321 × height); nothing may overflow.

---

## 3. DOM contract

```html
<div class="pnl pnl--<name>" data-panel="<name>" data-panel-height="<H>" aria-hidden="true">
  …
</div>
```

- One root, class `pnl` + `pnl--<name>`, the two data attributes, `aria-hidden="true"`
  (the card's `aria-hidden` slot mirrors Lance's; screen readers get the stop title/description only).
- Every class inside is prefixed `pnl-`. Shared primitives are `pnl-<primitive>` (§6);
  panel-specific classes are `pnl-<name>__<part>` (BEM, e.g. `pnl-brief__bubble`).
- No ids (the panel may be inlined more than once on a page — desktop card and mobile accordion).
- No images, no Lottie, no external SVG. Inline SVG only, `stroke="currentColor"`, `fill="none"`.
- **HTML + CSS alone must render the panel's final state** (what you see at label `final`).
  JS sets the initial hidden states when it mounts. If JS fails, the card still shows a finished
  screen; the build's `{{panel:<name>}}` inlines exactly this file.
- The file is a fragment: no `<html>`, `<style>`, or `<script>`. CSS goes in `<name>.css`,
  JS in `<name>.js`.

Where it lands: `src/pages/index.html` (hero partial) writes `{{panel:brief}}` etc. inside the
card's panel slot, which the hero agent sizes `width:321px; height:<H>px` from `data-panel-height`.

---

## 4. JS contract

```js
// <name>.js — registers one panel. No other globals. IIFE, ES2018, no modules.
(function () {
  var P = (window.hypjamPanels = window.hypjamPanels || {});
  P.<name> = {
    name: '<name>',
    height: <H>,
    mount: function (el, opts) { /* … */ return tl; }
  };
})();
```

`mount(el, opts)`:
- `el` is the root `.pnl--<name>` element (already in the DOM). Query only inside `el`.
- `opts` (all optional): `{ autoplay = true, reduced = matchMedia('(prefers-reduced-motion: reduce)').matches }`.
- Returns a `gsap.timeline({ repeat: -1, paused: !autoplay, defaults: { ease: 'power2.inOut' } })`.
- Must add a label **`final`** at the start of the final hold. The state at `final` is the complete,
  readable end state and must equal what the static HTML renders.
- Must add a label **`loop`** at time 0 (the engine may `seek('loop')` to restart).
- Idempotent: a second `mount(el)` kills the previous timeline (`el.__pnlTl`) and rebuilds.
- Reduced motion (`opts.reduced === true`): build the same timeline, then
  `tl.pause(); tl.seek('final');` and return it. Nothing moves; the final state shows.
- Requires only the `gsap` global (`assets/vendor/gsap.min.js`). No ScrollTrigger, no CustomEase,
  no `document`/`window` listeners, no timers outside the timeline (`setInterval` etc. — drive
  counters and timecodes from a tween's `onUpdate` so pause/seek stay correct).
- Guard: if `!window.gsap` return `null` without throwing.

Engine side (for the hero agent): after `DOMContentLoaded`, for each `[data-panel]` in the card,
`tl = window.hypjamPanels[name].mount(el, { autoplay: false, reduced })`; `tl.play()` when the stop
becomes active, `tl.pause()` when it leaves (Lance's Lottie players do the same via visibility).
Reduced motion: the engine passes `reduced: true` and never plays. The mobile accordion mounts the
same way. Registration is order-independent: look up `window.hypjamPanels[name]` at mount time,
not at script parse time.

Build note (for the build agent — CONTRACT §6 concatenates only `src/css` and `src/js`):
`site.css` must also append `src/panels/_panels.css` then `src/panels/<name>.css` (alphabetical is
fine; `_panels.css` sorts first), and `site.js` must append `src/panels/<name>.js` (any order,
before or after `20-hero.js`; the engine mounts on `DOMContentLoaded`).

---

## 5. Colour and type inside a panel

Tokens come from `src/css/00-tokens.css` (CONTRACT §4) once it exists; until then every use is
`var(--token, fallback)` with the §4 value as the fallback, so the panel is correct either way.
`_panels.css` sets the panel-local palette on `.pnl`:

```
--pnl-ink:    #fff                      primary text (values, titles, ticked rows)
--pnl-ink-2:  #d9d9d9                   default text
--pnl-mute:   #a1a09a                   labels, ids, meta   (Lance's Lottie label grey)
--pnl-mute-2: rgba(255,255,255,.45)     pending / disabled rows
--pnl-line:   rgba(255,255,255,.10)     hairlines
--pnl-fill:   rgba(255,255,255,.06)     bubbles, tiles, buttons
--pnl-fill-2: rgba(255,255,255,.12)     chips, toggles, bars
--pnl-stroke: rgba(255,255,255,.14)     bubble / phone borders
--pnl-jam:    var(--jam, #ff6f1f)       the accent
--pnl-jam-a:  rgba(255,111,31,.18)      accent chip fill
```

Type: body `Geist` (`var(--font-body, 'Geist', system-ui, sans-serif)`). Sizes used, nothing else:
**13** (bubble text, row values, button), **12** (labels, row text, list items), **11** (mono data,
status), **9** (chips), **8** (tile labels, phone HUD), **20** (tile numerals only). Line-height
1.35. Weight 400; 500 only on chips and one title per panel. Mono data labels use
`.pnl-mono` = `ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace` at 11px,
uppercase, tracking .04em — Lance renders these in `gtStandardMono`; we have no mono in
`assets/fonts`, so the system stack stands in (if a mono is ever self-hosted, change one line in
`_panels.css`). Never use Newsreader inside a panel: the serif is the card title's.

Rule of accent: each panel uses `--pnl-jam` for **one** kind of thing (brief: the signed tick;
hooks: the picked ticks; casting: the shortlist ticks; shoot: the REC dot; ship: the captions
toggle + platform ticks). Never on text larger than 12px, never as a fill wider than a chip.

---

## 6. Primitives (`_panels.css`, all scoped under `.pnl`)

| class | markup | size |
|---|---|---|
| `.pnl-label` | `<span class="pnl-label">Client</span>` | 12px mute |
| `.pnl-mono` | `<span class="pnl-mono">CR-014</span>` | 11px mono uppercase mute; `.pnl-mono--ink` for white |
| `.pnl-row` | `<div class="pnl-row"> …cells… </div>` | flex, gap 10, `min-height:28px`, hairline bottom (`.pnl-row--tall` = 34px like Lance; `.pnl-row--bare` = no hairline) |
| `.pnl-cell` / `.pnl-cell--grow` / `.pnl-cell--end` | cells inside a row | `--grow` takes remaining width, `--end` right-aligns |
| `.pnl-chip` | `<span class="pnl-chip">TikTok</span>` | 17px tall, 9px 500 uppercase; `.pnl-chip--jam` accent; `.pnl-chip--ghost` outline only |
| `.pnl-avatar` | `<span class="pnl-avatar"><svg …head/shoulders…></svg></span>` | 18px line circle, 1px stroke at 35% white; `.pnl-avatar--lg` 24px |
| `.pnl-bubble` | `<div class="pnl-bubble">text<span class="pnl-cursor"></span></div>` | inline-block, max-width 100%, padding 8×10, radius 8, 13px white |
| `.pnl-cursor` | 1px × 1em caret, blinks 1s steps | hide with `[hidden]` |
| `.pnl-spin` | `<span class="pnl-spin"></span>` | 10px ring, 1px, top transparent, rotates .9s |
| `.pnl-status` | `<div class="pnl-status"><span class="pnl-spin"></span>Reading the brief</div>` | 11px mute, gap 6 |
| `.pnl-tick` | `<svg class="pnl-tick" viewBox="0 0 12 12"><path d="M2 6.5 4.8 9.2 10 3.4"/></svg>` | 12px, jam stroke 1.5, path length 12 → draw with `stroke-dashoffset` |
| `.pnl-tick--mute` | same, mute stroke | for already-done rows |
| `.pnl-dot` | `<span class="pnl-dot"></span>` | 6px jam circle, pulses 1.2s; `.pnl-dot--still` no pulse |
| `.pnl-toggle` | `<span class="pnl-toggle" data-on="false"></span>` | 26×15 pill, 11px knob; `data-on="true"` = jam track, knob right |
| `.pnl-bar` | `<div class="pnl-bar"><div class="pnl-bar__fill"></div></div>` | 4px track, fill width 0→100% (`.pnl-bar--jam` fills jam) |
| `.pnl-phone` | `<div class="pnl-phone"> …absolute children… </div>` | 70×140, radius 10, 1px stroke; `::before` = 18×3 notch |
| `.pnl-clip` | `<div class="pnl-clip"><div class="pnl-clip__track">rows…</div></div>` | overflow hidden + bottom fade mask 20px; translate the track to scroll |
| `.pnl-tile` | `<div class="pnl-tile"><div class="pnl-tile__num">8</div><div class="pnl-tile__lbl">hooks</div></div>` | fill, radius 4, padding 8×10, numeral 20, label 8 uppercase |
| `.pnl-btn` | `<div class="pnl-btn"><span class="pnl-spin"></span>Rendering</div>` | 30px, radius 6, fill, 13px mute, centred |
| `.pnl-hr` | `<div class="pnl-hr"></div>` | 0.5px hairline |
| `.pnl-icon` | `<svg class="pnl-icon" viewBox="0 0 12 12">…</svg>` | 12px, stroke currentColor 1.2, no fill |
| `.pnl-head` | `<div class="pnl-head"><span class="pnl-head__t">Brief</span><span class="pnl-mono">your brand</span></div>` | 18px tall, title 13px 500 ink, right slot mute |
| `.pnl-beat` | `<div class="pnl-beat">…</div>` | `position:absolute; inset:0` — one per crossfading state |

Use the primitives; add panel-specific classes only for layout positions and one-offs. Do not
restyle a primitive from a panel file (override sizes via your own `pnl-<name>__x` class on the
same element if you must).

---

## 7. Timing rules

- Loop length **6–10s** (Lance: 4.5–12.8s). Build one timeline, `repeat: -1`.
- Eases: `power2.out` for things arriving, `power2.inOut` for state changes and crossfades, `none`
  for typewriters, bars and timecodes. Nothing elastic, nothing that bounces.
- **Crossfade between beats: 0.28s** (Lance's `eh`). Outgoing beat: opacity → 0 and y → −6;
  incoming starts 0.1s later: opacity → 1 (and y from 6). Use `.pnl-beat` layers stacked in the
  same box so nothing reflows.
- Entrances: fade + ≤12px translate, 0.35–0.45s. Rows stagger 0.18–0.28s.
- Typewriter: each character 0.012–0.016s (a 70-char line ≈ 1s). Pre-split characters into spans
  and stagger their opacity; never mutate text content or the bubble will reflow.
- **Hold to read**: any text that arrives stays ≥ 1.2s before it changes; the `final` hold is
  ≥ 2s; a status line (spinner) shows for 0.8–1.4s.
- End of loop: fade the whole panel content to 0 over 0.28s, then the repeat restarts at `loop`
  where every element is already at its hidden initial state, so the restart is invisible.
- Counters and timecodes: tween a number object and write it in `onUpdate`.
- Keep all `gsap.set` initial states at time 0 *inside* the timeline (`tl.set(…, 0)`) so a repeat
  resets them; also apply them once synchronously in `mount` so the first frame is right before play.
- **The timeline must be seek-safe in both directions.** Never use `tl.call()` for anything
  visible — callbacks do not replay when the playhead jumps (the harness seeks, the engine may
  restart). Discrete state is a zero-duration tween: `tl.set(caret, { display: 'none' }, 3.25)`,
  `tl.set(toggle, { attr: { 'data-on': 'true' } }, 1.6)`, `tl.set(dot, { className: 'pnl-dot pnl-dot--still' }, 4.2)`.
  Text that changes (a counter, a timecode, "next" → "up next") is written from a tween's
  `onUpdate`, which does re-run on seek.
- Total tween count per panel ≲ 60. No per-frame DOM queries.

---

## 8. Reduced motion

- JS: `opts.reduced` → `tl.pause().seek('final')` (see §4). The engine never plays it.
- CSS: `_panels.css` disables the spinner, caret and dot animations under
  `@media (prefers-reduced-motion: reduce)`; the toggle/tick transitions collapse to 0s.
- Static HTML = final state, so with no JS at all the result is the same picture.

---

## 9. Copy rules inside panels (CONTRACT §10, §12)

- The placeholder brand is always **"your brand"**. Never a real or invented brand name, creator
  name, client, or handle. Creators are roster ids (`CR-014`) with tags; people are avatars.
- No numbers that read as results (views, CTR, ROAS, %, £). Counts of work are fine
  (`8 hooks`, `take 2`, `3 of 3 shortlisted`, a timecode).
- Hook lines are demo ad copy: no product claims (nothing "clears", "cures", "in 3 days").
- Lower-case chat voice for the client message; sentence case for UI; uppercase only via
  `.pnl-mono`/`.pnl-chip`. British spelling. Never "studio", "hotel", "guest", "AI-powered".

---

## 10. Storyboards

Times are seconds into the loop. Every visible string is listed; do not add others.

### 10.1 `brief` — 321×184 (stop 1, the brief desk) — loop 8.0s  *(reference build)*

Beat A `.pnl-beat--msg` (y positions inside the panel):
- y0: `.pnl-avatar` + `.pnl-label` **"Client · your brand"**
- y22: `.pnl-bubble` **"we're launching a new serum in march — can you do hooks and a founder cut?"** + caret
- y83: `.pnl-status` **"Reading the brief"**

Beat B `.pnl-beat--card`:
- `.pnl-head`: **"Brief"** · right `.pnl-mono` **"your brand · March"**
- rows (28px, label column 76px `.pnl-mono`, value 13px ink):
  **Product** → **"Serum launch"** · **Platforms** → chips **"TikTok"**, **"Reels"** ·
  **Budget** → **"Launch band"** · **Hooks** → **"8 · plus a founder cut"**
- footer row: `.pnl-tick` (jam, draws) + **"Brief signed"**

Timeline: 0.0 label from + avatar fade (.3) · 0.15 bubble in (y10→0, .45 out) · 0.45 chars stagger
.014 (≈1.0s) with caret · 1.75 status in (.28), hold 1.2 · 3.25 beat A out (.28) · 3.35 beat B in
(.28) · 3.45 head in · 3.65 rows in, stagger .26 (x−8→0, .35) · 4.95 footer in (.3) + tick draws
(.45) · **5.45 `final`** · hold 2.3 · 7.75 all → opacity 0 (.28) · 8.03 end.

### 10.2 `hooks` — 321×128 (stop 2, the writers' room) — loop ≈ 10s

Layout: `.pnl-head` y0: **"Hooks"** · right `.pnl-mono` counter **"0 of 8"** → **"8 of 8"**
(tween a number, write `n + " of 8"`). Below (y24–128): `.pnl-clip` holding a `.pnl-clip__track` of
eight `.pnl-row`s at 26px pitch (four visible). Row = `.pnl-mono` index **01**…**08** (32px col) ·
hook text 12px ink-2 (pre-split into char spans) · right `.pnl-cell--end` slot for a tick + chip.

Hook lines (in order):
01 **"POV: your skincare shelf has one bottle now"**
02 **"I asked a chemist what's actually in this"**
03 **"Three things I got wrong about serums"**
04 **"The 20-second morning routine, no skipping"**
05 **"Rating my serum drawer, honestly"**
06 **"What a founder puts on her own face"**
07 **"My mum tried it before I did"**
08 **"Unboxing the March launch, no script"**

Timeline: head in (.3). From 0.3, each line types (chars .012 → ≈0.5s) then a 0.25s gap; the
counter ticks when a line completes; from line 5 onward the track translates up one row (26px, .35
inOut) as the next line starts, so the newest line is always the bottom visible row. ≈ 6.3s in,
all eight are done; the track scrolls (.45) so rows 03–06 are visible; 6.9: row **03** gets
`.pnl-tick` (draw .4) + `.pnl-chip--jam` **"picked for the shoot"**; 7.5: row **06** the same;
**8.0 `final`**; hold 2.2; 10.2 fade out .28; end ≈ 10.5.

### 10.3 `casting` — 321×205 (stop 3, the casting floor) — loop ≈ 9s

Layout: `.pnl-head` y0: **"Roster"** · right `.pnl-mono` **"Shortlist 0 of 3"** → **"3 of 3"**.
Rows y26 onward, five `.pnl-row--tall` (34px): `.pnl-avatar` · `.pnl-mono--ink` id · chips (ghost)
· right slot tick + chip.

| id | chips |
|---|---|
| **CR-014** | **skincare** · **25–34** · **London** |
| **CR-027** | **skincare** · **18–24** · **Manchester** |
| **CR-031** | **beauty** · **25–34** · **London** |
| **CR-008** | **wellness** · **35–44** · **Bristol** |
| **CR-052** | **skincare** · **25–34** · **Leeds** |

Timeline: head in (.3) · rows slide in x−12→0 + fade, .4 out, stagger .2 (0.3→1.5) · hold 1.2 ·
2.9 / 3.5 / 4.1: **CR-014**, **CR-031**, **CR-052** each get `.pnl-tick` (draw .4) +
`.pnl-chip--jam` **"shortlisted"**, and the counter ticks; non-shortlisted rows ease to
`--pnl-mute-2` (.4) at 4.6 · **5.0 `final`** · hold 2.4 · 7.4 fade out .28 · end ≈ 7.7.
(Loop may extend to 9s by holding longer; do not add beats.)

### 10.4 `shoot` — 321×152 (stop 4, the shoot bay) — loop ≈ 9s

Layout: left `.pnl-phone` at x0 y6 (70×140): top bar `.pnl-dot` + `.pnl-mono` **"REC"** (8px),
centre an inline-SVG head-and-shoulders outline at 35% white (a creator mid-take), bottom
`.pnl-mono` timecode **"00:00:00:00"** (9px, tabular). Right block x86–321: `.pnl-head`
**"Shoot day"** · right `.pnl-mono` **"hook 03 · take 2"**; four `.pnl-row`s (26px):

| left `.pnl-mono` | value 12px | right |
|---|---|---|
| **HOOK 01** | **take 1** | `.pnl-tick--mute` (done) |
| **HOOK 02** | **take 3** | `.pnl-tick--mute` (done) |
| **HOOK 03** | **take 2** | ticks during the loop (jam) |
| **FOUNDER CUT** | **take 1** | `.pnl-mono` **"next"** (mute-2) |

Timeline: phone + list fade in (.35) · 0.4 dot starts pulsing, timecode runs from 00:00:00:00 at
real speed (frames at 25fps, tween a seconds number over 6s, `ease:none`, write
`hh:mm:ss:ff`) · at 4.2 the dot goes `--still` and stops (cut), row **HOOK 03** gets the jam tick
(draw .4) and its value gains **" ✓"** via the tick only (do not change the text) · 4.8 the header's
right slot crossfades to **"founder cut · take 1"** and the last row's **"next"** becomes
`.pnl-mono--ink` **"up next"** · **5.4 `final`** · hold 2.4 · 7.8 fade out .28 · end ≈ 8.1.

### 10.5 `ship` — 321×96 (stop 5, the edit suite) — loop ≈ 8s

Layout (three rows):
- y0–28 timeline strip: five clip blocks (widths 48·70·40·86·52, 2px gaps, height 20, radius 3,
  `--pnl-fill-2`; the picked hook clip **03** labelled `.pnl-mono` 8px **"03"**), a 1px white
  playhead that travels the strip; right end x268–321: `.pnl-label` **"Captions"** + `.pnl-toggle`.
- y40–48: `.pnl-mono` **"Exporting 9:16"** left, **"1080 × 1920"** right, `.pnl-bar` under them
  (y50, full width).
- y64–82: three `.pnl-chip--ghost` with a leading `.pnl-tick`: **"TikTok"**, **"Reels"**,
  **"Shorts"**.

Timeline: strip + labels in (.35) · 0.4 playhead travels 0→100% over 2.2s `none` · 1.6 toggle
`data-on="true"` (jam) · 2.8 bar fills 0→100% over 1.8s `none` (fill white) · 4.7 / 5.1 / 5.5 the
three ticks draw in jam and the chips brighten to ink · **5.9 `final`** · hold 2.2 · 8.1 fade out
.28 · end ≈ 8.4.

---

## 11. Verify before you report

Harness (shared, already written by the brief agent):
`/private/tmp/claude-501/-Users-vinee-Desktop-UGC-Agency/5427b9f2-20ea-4225-ae81-cd09121648f3/scratchpad/pw/panels/`
- `harness.html` — serves a mimic of the HUD card (357 wide, real fonts, `--jam`) and mounts
  `?panel=<name>`; `&reduced=1` mounts in reduced-motion mode; `&t=1.2` seeks to a time.
- `shoot.js` — `node shoot.js <name> [t1,t2,t3]` starts a static server, mounts the panel, pauses
  the timeline, seeks each time, screenshots to `out/<name>_<t>.png`, and prints the timeline
  duration, the `final` label time, and any console errors. Default times are the three storyboard
  moments.

- `state.js` — `node state.js <name> t1 t2 [t3 t4 …]` seeks each pair and diffs the computed
  opacity/transform/visibility/display/stroke-dashoffset of every element in the panel. Use it to
  prove the loop restarts cleanly (`0.3 8.33` for an 8.03s loop = the same moment in iteration 2)
  and that seeking is exact.

Checklist:
1. `node shoot.js <name>` — zero console errors, `scrollH` equals your height (no overflow at
   `final`), duration within 6–10.5s, `final` label present, `card` height sensible.
2. Open the three PNGs: nothing clipped at 321×H, every string legible at 1×, one accent only.
3. `node shoot.js <name> 0` — the first frame is the hidden initial state (not a flash of final).
4. `node shoot.js <name> --reduced` — byte-identical to the `final`-hold screenshot (`cmp`).
5. `node shoot.js <name> --nojs` — the static HTML alone renders the final state (also `cmp`).
6. `node state.js <name> 0.3 <dur+0.3> <final+0.2> <dur+final+0.2>` — "identical DOM state".
7. Grep your three files for `studio`, `hotel`, `guest`, `trusted`, `%`, `£`, `$` — none in copy.
