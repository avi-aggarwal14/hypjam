# hypjam v2 — build contract

This is the single source of truth for every agent working on this site. Read all of it before touching a file.

## 1. The mission

Recreate **https://www.lance.live/** one-to-one — layout, typography, spacing, motion, interaction, every section and every sub-page — but as the website of **hypjam**, a UGC (user-generated content) marketing agency based in London. Every word is rewritten for hypjam. The hotel line drawing that the hero camera walks through becomes a drawing of **hypjam's HQ**, and the five hotel departments become **five parts of the agency**.

Two deliberate departures from Lance, and only two:

1. **The hero starts at Lance's second beat.** Lance opens with a big "Hotels, made effortless" headline over drone footage, and only after the first scroll shows the paragraph + two line-drawn buildings + logo marquee. We drop the headline beat entirely. Our first frame *is* that second beat: the blurred video, the paragraph, the two buildings drawing themselves in, the marquee — then the camera dive begins exactly as Lance's does.
2. **Brand.** hypjam's hook logo system replaces Lance's wordmark, and Lance's accent (`#2bca95` green) becomes hypjam's vivid orange **`#ff6f1f`**.

Everything else follows Lance exactly. When in doubt, open the reference and match it.

## 2. Reference material (read-only)

All under `ref/`:

| path | what |
|---|---|
| `ref/shots/s00…s32_*.jpg` | Lance home page at 1920×1080, every 540px of scroll (33 frames). `SHEET_page_*.jpg` are contact sheets. |
| `ref/pages/*.jpg` | Full-page screenshots of every Lance sub-page at 1920 wide. |
| `ref/mobile/*.jpg` + `SHEET.jpg` | Lance home at 390×844, every 700px, plus the open mobile menu. |
| `ref/hero_engine.pretty.js` | The **beautified source of Lance's hero engine** (GSAP timeline, camera math, HUD, draw-in, metrics). 832 lines. The hero engine agent ports this. |
| `ref/hero_chunk.pretty.js` | The whole 20k-line chunk it came from, for anything not in the excerpt. |
| `ref/hero_dom.html` | Lance's rendered hero DOM after scrolling (4MB, includes the inlined SVG). Search it for class names and structure. |
| `ref/index.html` | Lance's server-rendered home HTML. |
| `ref/outlines.txt` | Every sub-page's structure and copy, extracted. **Content agents rewrite from this.** |
| `ref/style_spec.json` | Computed font-family/size/line-height/letter-spacing/colour for text in every home section, plus nav and root vars. |
| `ref/lance-css/*.css` | Lance's five compiled CSS files (Tailwind v4). Grep these for exact values: `px-page`, `bg-sand-*`, `max-bp`, `.hero-walk`, `.product-ui-stroke`, `.partner-carousel`, `.trust-word`, button classes. |
| `ref/lance-entire-drawing.svg` | Lance's master hotel drawing (44001×21918, 3948 paths). **For measuring geometry only. Never copy its paths.** |
| `ref/drawing_full.png` | That drawing rendered. |
| `ref/product-1…5.json` | Lance's five Lottie product panels (inspect to see what each mock UI does). |
| `ref/lance-assets/` | Lance's images: partner logos, feature images, testimonial thumbs, security badges, footer-buildings.png. For layout reference only; none of these ship. |
| `ref/video-frames/` | Frames from Lance's hero video (blurred drone footage of a hotel). |

## 3. Site map

Lance → hypjam. Clean URLs (no `.html`).

| Lance | hypjam | notes |
|---|---|---|
| `/` | `/` | home |
| `/product` | `/services` | index of the nine services |
| `/product/ai-front-desk` … (9) | `/services/<slug>` (9) | long-form service pages, one template |
| `/solutions` | `/solutions` | index: by area (6) and by type (3) |
| `/solutions/<area>` (6) + `<type>` (3) | `/solutions/<slug>` (9) | one template |
| `/security` | `/rights` | "Rights and safety at every layer" |
| `/hotels` | `/work` | formats wall + reserved brand-story slots (see §10) |
| `/hotels/<case-study>` | — | **not built**: hypjam has no clients yet and will not invent any |
| `/news` | `/blog` | the eight existing hypjam articles, in Lance's news template |
| `/news/<slug>` | `/blog/<slug>` | article template |
| `/get-started` | `/book` | Lance's split layout; the form is replaced by the cal.com embed |
| `/product-docs` | `/process` | how a brief runs, step by step |
| `/faq` | `/faq` | |
| `/about` | `/agency` | |
| `/career` | `/join` | join the creator roster |
| `/privacy-policy`, `/terms-and-conditions` | `/privacy`, `/terms` | existing legal text, Lance's legal template |
| — | `/404` | |

Existing hypjam content to reuse (rewrite into Lance's structures, keep the facts): `/Users/vinee/Desktop/UGC Agency/hypjam-brand/` — `pages/*.json` (work, hire, join, studio→agency), `blog/*.md` (8 articles with `meta:` first line), `legal/*.md`.

### Nav (exact Lance structure, hypjam labels)

Left cluster: **Services ▾ · Solutions ▾ · Rights · Work · Resources ▾**. Centre: hypjam lockup. Right: **Creators** (→ `/join`, replaces "Log in") · **Book a call ⟶** (pill, → `/book`).

- **Services** dropdown (2 columns + "New" card, exactly like Lance's Product menu): Briefing & scripts · Hook writing · Casting & roster · Shoot direction · Editing & captions · Whitelisting & Spark Ads · Usage rights · Reporting — and the "New" card: **Founder-led video** — "We direct you on camera, so you never sound like a brand deck."
- **Solutions** dropdown (two columns "By goal" / "By brand", like Lance's "By area" / "By type"): By goal: Launches · Always-on paid social · Organic & trends · Founder-led · Creative testing · Retention. By brand: DTC & ecommerce · Apps & subscriptions · Food & drink.
- **Resources** dropdown (list + video card, like Lance): Agency · Blog · Process · FAQ; card: a looping muted clip labelled "Inside a shoot day".
- Mobile: "Menu" opens the full-screen accordion list exactly as `ref/mobile/menu_open.jpg`.

### Footer columns (mirror Lance's six)

Services (9) · Solutions (6 by goal) · By brand (3) · Platform (Overview, FAQ, Process, Rights) · Company (Agency, Join the roster, Blog) · Legal (Privacy, Terms). Left: big lockup, then the small HQ line drawing, copyright "© 2026 hypjam. All rights reserved." Right bottom: a small "Shot on phones, directed by people" badge (replaces "Aligned with ISO 27001").

## 4. Design tokens

Exact values from Lance's compiled CSS and computed styles. Put them in `src/css/00-tokens.css` as custom properties; every partial uses the variables.

**Colour**
- `--black: #000` · `--white: #fff`
- `--sand-s: #f7f6f4` · `--sand-m: #dad9d4` · `--sand-l: #bcbbb4`
- `--grey: #7b7b7b` (body copy on light), `--grey-m: #5b5b5b` (dividers), white alphas `.4 .45 .6 .7 .75`
- `--jam: #ff6f1f` — the accent. Where Lance used green (`#2bca95`): links on hover, the active stop marker, the animated card border glint, the arrow-circle in primary buttons, live dots, focus rings, the metrics numerals' tick. Rationed, never on large surfaces. **Pink, purple, blue are banned.**

**Type** — Lance uses `publishSerif` (proprietary) and `gtStandard` (proprietary). We substitute with open faces that Lance itself also loads and that match closely:
- Display serif: **Newsreader** (self-hosted, `assets/fonts/newsreader.css`, opsz axis; use `font-optical-sizing:auto`). Sizes: h1 64/1.05/-1.28px; h2 42/1.1/-0.84px; trust paragraph and big quotes 36/1.2–1.25/-0.72…-0.84px; HUD card title 26/1.2/-0.52px; story quotes 18/1.25/-0.2px; footer h2 42.
- Body grotesk: **Geist** (self-hosted, `assets/fonts/geist.css`). p 16/24 (light pages colour `--grey`); nav/buttons 14/1.4; captions 13/1.35; eyebrows 12–13 uppercase tracking .08em.
- Weights: display 400 only. Body 400, feature titles 500.

**Layout**
- Page gutter `--px-page: 28px` (Lance's computed `px-page` at 1920). Mobile 20px.
- Section padding 120px desktop, 80px mobile. Nav: fixed, `padding: 28px var(--px-page)`, 88px tall, transparent; gains `background` + `backdrop-filter` when `data-nav-fill` flips (see engine).
- Breakpoints (Lance's `max-bp`/`max-lp`/`max-tp`): `--bp: 1024px`, `--lp: 1280px`, `--tp: 768px`, plus 600px for phones.
- Radii: pills 9999px; cards 12px; panels 6px; images 12–16px.
- Buttons: pill, height 32px, 14px text, `gap:10px`, `padding-left:16px`, trailing 22px circle icon. Primary on dark: translucent white pill (`rgba(255,255,255,.12)`, 1px `rgba(255,255,255,.2)` border, backdrop blur) with a **jam** circle and black arrow. Measure `ref/lance-css` for the exact classes before writing yours.

**Motion**: Lenis smooth scroll (`duration: 1.15, smoothWheel: true, wheelMultiplier: 1`), GSAP 3.12 + ScrollTrigger + CustomEase (vendored in `assets/vendor/`). Respect `prefers-reduced-motion` everywhere: reduced motion = final states, no scrubbed camera (jump to stops), no loops.

## 5. Architecture and file ownership

```
hypjam-v2/
  CONTRACT.md            this file
  build.py               assembles dist/ (see §6)
  content/*.json         all copy, one file per page or section
  src/css/NN-name.css    concatenated in NN order into dist/assets/site.css
  src/js/NN-name.js      concatenated in NN order into dist/assets/site.js
  src/partials/*.html    nav, footer, home sections, shared blocks
  src/pages/**/*.html    page templates → dist/<path>/index.html
  src/drawing/           the HQ drawing: parts/*.svg → hq.svg
  src/panels/            five product-mock panels (html+css+js each)
  tools/*.py             renderers that generate page templates from content JSON
  assets/                fonts, vendor libs, brand, video, badges, img (copied verbatim to dist/assets)
  dist/                  build output, never edited by hand
```

**Ownership is by file.** Your task names the files you own. Never edit a file you do not own. Never edit `dist/`. If you need something from another agent's file, read it; if it is missing, note it in your report and stub locally.

**Class prefixes** to avoid collisions: nav `.nav-`, hero `.hero-`, features `.feat-`, quotes `.quo-`, stories `.sto-`, rights `.rights-`, footer `.foot-`, services `.svc-`, solutions `.sol-`, work `.work-`, blog `.blog-`, book `.book-`, process `.proc-`, legal `.legal-`, panels `.pnl-`, shared utilities `.u-`. Only `src/css/00-tokens.css`, `01-base.css` and `02-typography.css` may declare element selectors or utilities.

**Do not** run `git`. **Do not** install software (Playwright already exists at `/private/tmp/claude-501/-Users-vinee-Desktop-UGC-Agency/5427b9f2-20ea-4225-ae81-cd09121648f3/scratchpad/pw/` — write scripts there and run with `node`; use `--use-gl=swiftshader --enable-unsafe-swiftshader` launch args; note headless Chromium cannot decode H.264, so hero video frames render black there — that is expected).

## 6. Build pipeline

`python3 build.py` (stdlib only):
1. Copies `assets/` → `dist/assets/`.
2. Concatenates `src/css/*.css` (sorted) → `dist/assets/site.css`; `src/js/*.js` (sorted) → `dist/assets/site.js`. Vendor libs are referenced separately as `<script src="/assets/vendor/gsap.min.js">` etc. in the head partial (gsap, ScrollTrigger, CustomEase, lenis, in that order, before site.js).
3. Processes every `src/pages/**/*.html`: replaces `{{include:partials/x.html}}` (recursive), `{{content:file.key.path}}` (from `content/<file>.json`), `{{drawing}}` (inlines `src/drawing/hq.svg`), `{{panel:name}}` (inlines `src/panels/<name>.html`), then writes `dist/<page path>/index.html` (`src/pages/index.html` → `dist/index.html`; `src/pages/services/index.html` → `dist/services/index.html`; `src/pages/services/casting.html` → `dist/services/casting/index.html`).
4. Runs every `tools/render_*.py` **before** step 3 so renderers can emit templates from JSON.
5. Writes `dist/sitemap.xml`, copies `robots.txt`, `vercel.json` (cleanUrls, headers, `/book` stays a page here — the cal.com embed lives inside it).

Serve for testing: `cd dist && python3 -m http.server 8124`.

## 7. The hero engine (port of `ref/hero_engine.pretty.js`)

Owner: the hero engine agent. Files: `src/partials/home/hero.html`, `src/css/20-hero.css`, `src/js/20-hero.js`.

The section is `position:relative` and its inner "stage" (`100vh`, overflow hidden, black) is **pinned by ScrollTrigger for `11 × innerHeight`** (`ep = 11`) with `scrub: 1.2`, `anticipatePin: 1`, `invalidateOnRefresh: true`. One GSAP timeline `b` drives a state object `G` and a camera object `q = {x,y,w,h}` that is written to the drawing's `viewBox` every update.

Layers (z order, all `absolute inset-0`): 
1. video layer (`<video autoplay muted loop playsinline poster>` `object-cover`), opacity `G.video`, `filter: blur(G.blur px)`;
2. overlay `rgba(0,0,0,G.overlay)` — starts **0.4**;
3. map layer (the drawing, `preserveAspectRatio="xMidYMid meet"`), opacity `G.map`;
4. two edge gradients (left `w=min(800px, 800/1512*100vw)` black→transparent; top `h=min(719px, 719/1512*100vw)`);
5. the trust layer (paragraph + marquee), opacity `G.trust`;
6. the HUD layer (stop list + card), opacity computed from progress (see below);
7. the metrics block (`--metrics-text`, `--metrics-nums` custom properties drive its two reveals).

**Because we drop Lance's headline beat**: `G.headline` does not exist; the timeline starts at what Lance calls `g` (after its 1.4s headline fade). On load the trust paragraph words, the marquee and the drawing are at their *initial* state (words at opacity 0, drawing undrawn, map opacity 1, video visible at blur 0, overlay .4) and the first scroll pixels drive: `blur → 20` over `tY/2 + …` (Lance: `b.to(G,{blur:20,duration:y})` from 0), the two buildings **draw in** over `tY = 3.2` (stroke-dashoffset per element, `data-draw-len`), the trust words stagger in (`duration .4`, `stagger.amount = tY - .4`), the marquee fades in over 1s; then `.35 + .12` hold; then trust fades out over `.5`; overlap `.28` into the **first camera dive** (`t2 = 1.65`, CustomEase `"M0,0 C0.48,0 0.18,1 1,1"`) while `vignette → 1` and `overlay → 1, video → 0` (video gone by the dive's midpoint).

Then per stop `e` (five stops): previous detail fades out and previous fade-group back in (`t7 = 1.4`), camera flies with the quintic in-out ease through a zoom-out keyframe (`tf(prev, next, 1.65)`, keyframe split `.45`) over `t3 = 2.8`, this stop's fade-group fades out and its detail draws in (`t7`). `u/d/m/c` arrays record the timeline times of arrival, HUD switch, midpoints and departures; they are normalised to progress fractions and used by the HUD to pick the active stop and to fade the HUD (`hudOut`).

After the last stop: HUD out (`t7`), camera pulls out to the final small camera `l` over `et = 2.8` with `power2.inOut`, `sand → 1, overlay → 0` over `.55·et`, then `metricsText` at `h + .5·et` and `metricsNums` at `h + .65·et` (each `.85`), then a `1` hold. The stage background is `color-mix(in srgb, #f7f6f4 p%, #000)` while `sand` animates; `data-nav` flips to `light` and `data-nav-fill` to `bg-sand-s` when `sand > .55`.

Cameras (all in SVG units on the 44001×21918 canvas):
- **initial** `h`: whole drawing, `widthFraction = min(0.3·1512/stageWidth, .85)` of the stage width, centred at `centerX = .75` of the stage, `centerY = min(.5, max(.32, (stageH − 200 − a·r·.55)/stageH))` — i.e. the two buildings sit on the right, the paragraph on the left.
- **stop** cameras: frame each stop's detail bbox; Lance derives them from Figma offsets — we instead define per stop `{cx, cy, w}` = detail-bbox centre and `w = bbox.width × 1.25`, `h = w / stageAspect`. Store in `content/hero.json` next to the stop copy.
- **final** `l`: whole drawing, `widthFraction = min(.27·1512/stageWidth, .85)`, `centerX = (28 + wf·stageW/2)/stageW`, `centerY = .83`, shifted so the drawing sits bottom-left under the metrics (see `ty()` in the source for the `--metrics-gap` logic).

HUD: left column of five `<button>`s (14px, opacity .4; active: opacity 1 and `translateX(24px)`), a 16px white marker line that slides to the active item's vertical centre (`transition 500ms ease-in-out`), and the **card**: `357×354`, `border-radius:12px`, `background: rgba(188,187,180,.12)`, `box-shadow: 0 12px 12px rgba(0,0,0,.24)`, `backdrop-filter: blur(4px)`, plus a rotating conic-gradient border glint (`.product-ui-stroke-spin`, use `--jam` in the gradient), padding `22px 18px 18px`, title 26px display, description 14px `--sand-l`, a `.5px` divider at 60% `--grey-m`, then the **panel** (`321×184`, radius 6px) holding that stop's product mock. Card height tweens between panels' measured heights (`el = .4s`), panels crossfade (`eh = .28s`). Clicking a stop button scrolls Lenis to that stop's progress. A "(Skip)" link bottom-right jumps to the end of the pin. "Scroll to walk through the agency" hint lives in the trust layer bottom-right with Lance's `.hero-walk` arrow animation.

Draw-in mechanics: on load, for every stroked element inside the drawing set `vector-effect: non-scaling-stroke`, `stroke-width: 1`; elements with `stroke-opacity="0.2"` become dashed `4px 6px`. `data-draw-len = getTotalLength()`; undrawn = `stroke-dasharray: len; stroke-dashoffset: len; stroke-opacity: 0`; drawn = offset 0, opacity restored. Fade groups toggle opacity. Everything happens by setting `style` in the timeline's `onUpdate`, not by thousands of tweens — port Lance's `tM`/`tD` helpers.

Mobile (`≤1024px`): Lance collapses the HUD into an accordion under the paragraph (see `ref/mobile/m01…m03`). The pinned stage still runs but the stop list is a vertical list with `+` disclosures and the card sits full width.

## 8. The HQ drawing

Owner: the drawing planner writes `src/drawing/PLAN.md` + `tools/check_drawing.py`; shell and room agents write `src/drawing/parts/*.svg`; the assembler writes `src/drawing/hq.svg`.

Canvas: `viewBox="0 0 44001 21918"`, same as Lance so the engine's camera maths ports unchanged. Two buildings in the same positions and proportions as Lance's (measure `ref/lance-entire-drawing.svg`'s `fixed` group for wall lines, floor lines, roofline, ground line — geometry is not artwork). **Every path is original.** Style: `stroke="#969696"`, `stroke-width="10"` (the engine normalises to 1px), `fill="none"`, round caps/joins; secondary/background detail at `stroke-opacity="0.2"` (rendered dashed). Only `path line rect circle ellipse polyline polygon`.

Structure and ids (the engine depends on these exactly):
```
<svg viewBox="0 0 44001 21918">
  <g id="Frame 7"><rect .../>   ← a full-canvas rect the engine removes
    <g id="entire-drawing">
      <g id="hotel-drawing">          ← keep this id; the engine looks it up
        <g id="fixed">…building shells, windows, roofs, ground…</g>
        <g id="#1-fade">…the simple exterior of room 1 that hides when we dive in…</g>
        … #2-fade … #5-fade
      </g>
      <g id="#1-front-of-house">…detailed interior of stop 1…</g>
      <g id="#2-back-of-house">…</g>
      <g id="#3-sales">…</g>
      <g id="#4-food-and-beverage">…</g>
      <g id="#5-management">…</g>
    </g>
  </g>
</svg>
```
Yes, the ids literally begin with `#` (Lance's do; the engine queries `[id="#1-fade"]`).

Room slots (bounding boxes in canvas units, matching Lance's so the camera route is identical) and what hypjam puts in them:

| stop | id suffix | bbox x,y,w,h | Lance's room | **hypjam's room** |
|---|---|---|---|---|
| 1 | `1-front-of-house` | 4026, 15716, 8720×4856 | lobby / reception | **The brief desk** — ground floor of Building A: a reception counter, two hypjam people, a client with a product box, a wall of framed phone frames, a plant, the product on the counter |
| 2 | `2-back-of-house` | 3796, 7408, 7603×3552 | housekeeping corridor | **The writers' room** — second floor A: a long table, people writing, a wall covered in hook cards, a whiteboard with a timeline |
| 3 | `3-sales` | 27045, 3959, 13189×4840 | event / wedding room | **The casting floor** — upper floor B: creator headshots pinned on a board, someone with a tablet, phones on charge, a small stage with a phone on a tripod |
| 4 | `4-food-and-beverage` | 27531, 17562, 12703×4351 | bar + restaurant | **The shoot bay** — ground floor B: a kitchen-counter set with ring light and phone tripod, a sofa set, a product shelf, a creator mid-take, a clapper |
| 5 | `5-management` | 6749, 3021, 8669×3983 | top-floor office | **The edit suite** — top floor A: editors at desks with two monitors each showing timelines, headphones, a shelf of drives, a "ship" board with platform icons |

Camera order stays Lance's (1→2→3→4→5), which reads as brief → script → cast → shoot → cut. Each `#N-fade` group is the *simple* version of that room's exterior (the windows/door you see before diving in); each detail group is the full interior. Interiors must be dense enough to reward the zoom (Lance's have 260–1160 elements) and must read at 1px stroke. Figures are line-drawn people, simple and proportional.

## 9. The five product panels

Owner: the panels spec agent writes `src/panels/SPEC.md`; panel agents each own `src/panels/<name>.{html,css,js}`. Each is a self-contained mock UI, `321×184` (or the per-panel height the spec sets), that loops a short GSAP timeline, built from HTML/CSS/inline SVG — **no Lottie**, no images. They must look like real hypjam software screens in Lance's visual language (see `ref/product-*.json` layer names and `ref/mobile/m04…m06` for what Lance's panels show: chat bubbles with translation, a housekeeping board with rows, a labor schedule grid, an agent builder canvas).

| stop | panel | what it shows, looping |
|---|---|---|
| 1 brief desk | `brief` | a client message arrives ("we're launching a new serum in march"), a brief card assembles itself: product · platforms (TikTok, Reels) · budget band · "8 hooks" |
| 2 writers' room | `hooks` | eight hook lines type in one by one; two get a jam tick "picked for the shoot" |
| 3 casting floor | `casting` | creator cards slide in (line avatars, tags: skincare · 25–34 · London); three get shortlisted |
| 4 shoot bay | `shoot` | a phone frame with REC dot and running timecode; a take list ticks off: "hook 03 — take 2 ✓" |
| 5 edit suite | `ship` | a timeline with clips and a captions toggle; an export bar fills, then TikTok / Reels / Shorts ticks light up in jam |

No fake metrics, no fake brand names (see §10). Placeholder brand in mocks is always **"your brand"**.

## 10. Honesty rules (hard constraints, from the owner)

hypjam is new. It has **no clients, no testimonials, no case studies, no performance numbers**. The owner has explicitly banned inventing any. Lance's site is full of social proof; here is how each Lance proof element is handled:

- **Logo marquee** (hero) → the **platforms hypjam ships to**: TikTok, Instagram Reels, YouTube Shorts, Snapchat, Pinterest, Meta ads — as wordmark-style SVG text logos we draw ourselves (typographic, monochrome, opacity .5 like Lance's). This is factual: hypjam makes ads for these placements.
- **"Measured in Outcomes" metrics** (77% / 14% / 6%) → **commitments, not results**: "14 days from a signed brief to your first cuts" · "8 hooks written and tested per script" · "1 contract, one invoice, every creator and editor behind it". Same numeral styling, honest copy. Never percentages that imply measured results.
- **The two big quotes** → quote 1 is the **founder's own statement** attributed to "Avi Aggarwal, founder, hypjam" (real). Quote 2 is a **reserved slot**: the same layout, but the quote text reads as a held-open space — "The first brand quote goes here." — with a small jam-dotted tag "Filled in at launch". No invented name.
- **"Trusted by leading hotels" carousel** → heading "Built for brands launching on TikTok, Reels and Shorts" with the sub-line at 40% opacity; the four cards keep Lance's exact card anatomy (image area, quote, attribution, meta) but are **reserved slots** styled deliberately: dashed hairline frame, a line-drawn phone silhouette in the image area, quote line "The first brand story goes here.", attribution "Filled in at launch", meta "reserved". "Read" is present but inert. This must look designed, not broken.
- **"50+ hotels" / "1,100+ hoteliers"** style stats anywhere → removed or replaced with offer facts ("5 formats per shoot", "30-minute intro call").
- **Security badges** (SOC 2, GDPR, PCI, ISO) → **Rights and safety**: "Usage rights in writing" · "Signed creator releases" · "ASA and CAP disclosure compliance" · "UK GDPR data handling" — with our own line-drawn seals. hypjam's privacy policy genuinely supports UK GDPR; nothing else is a certification and must not be drawn as one.
- **Case studies** → none. `/work` shows format tiles labelled as concept work ("the brand names here are invented — we're new, and we'd rather show the shape of the work than borrow a logo") exactly as the existing hypjam `/work` does.
- Never name a real company as a client. Never write "trusted by".

## 11. Brand rules

- Logos: `assets/brand/logos/` (read its README). Nav centre: `hypjam-lockup-on-dark.svg` on dark pages, `-on-light` on sand/white pages, min 160px wide. Footer big logo: the lockup. Favicon and icons: `assets/brand/hook-icon*.png`, `favicon.ico`, `hook-apple-touch-icon.png`. Small slots: `hypjam-icon.svg`. Never recolour the mark; the play triangle is always jam.
- The word **"studio"** never appears in visible copy. hypjam is a "UGC agency".
- Contact: `hello@hypjam.com`. Booking: cal.com — `https://cal.com/avi-aggarwal-hypjam/intro` (embed with `?embed=true&theme=dark&layout=month_view`; it has its own dark theme, never colour-invert it). `/book` hosts the embed; every "Book a call" goes to `/book`.
- No cookies, no analytics, no trackers (the site's privacy policy promises this). The cal.com embed only loads on `/book` or after a click.

## 12. Copy voice

Lance's register: calm, declarative, sentence case with full stops, short eyebrow labels in caps, second person. Keep that register and Lance's sentence *rhythms* while changing every word to hypjam's business: briefing, scripting, casting everyday creators, directing phone shoots, editing, captions, usage rights, whitelisting/Spark Ads, reporting. British English. Founder: Avi Aggarwal, London. Concrete over grand. No "AI-powered", no "revolutionary", no "trusted by".

## 13. Definition of done

- `python3 build.py` runs clean; `dist/` serves every page in §3 with no 404s in the internal link graph.
- Home at 1920×1080 matches `ref/shots/` section for section: same section order, heights within 10%, same type sizes, same spacing, same colours (with jam where Lance has green).
- The hero pins for 11 viewports, the buildings draw in, the words stagger, the marquee scrolls, the camera dives through five stops with the HUD switching, then pulls out to the sand metrics beat, the nav flips light.
- Mobile 390px matches `ref/mobile/`.
- Every page passes: no "hotel", "guest", "housekeeping", "front desk", "Lance", "studio" in visible copy; no invented client, quote, metric or certification; every link resolves; every image has alt text; fonts load from `/assets/fonts`; no console errors.
