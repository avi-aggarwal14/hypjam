# hypjam v2 — DESIGN.md (tokens, base, type, UI atoms, icons, badges, wordmarks)

Owner: the tokens agent. Files: `src/css/00-tokens.css`, `01-base.css`, `02-typography.css`, `03-ui.css`,
`src/partials/icons.html`, `assets/badges/*.svg`, `assets/img/platforms/*.svg`.
Everything below was read out of Lance's shipped code or measured on the reference screenshots.
Where the CONTRACT's estimate and Lance's real value differ, **Lance's value is what is encoded** and the
difference is flagged in §10.

## 1. Sources and method

| what | where it came from |
|---|---|
| colour variables, `.px-page`, `.hero-walk`, `.partner-carousel`, `.product-ui-stroke`, `.reveal`, Lenis rules, `.font-display` | `ref/lance-css/2aw2dorymd3mg.css` (Lance's landing stylesheet, the `[data-landing]` block) |
| Tailwind utilities (`.bg-sand-*`, `.h-8`, `.gap-2.5`, `.size-[22px]`, `.backdrop-blur-[6px]`, `.tracking-*`, `--spacing`) and the breakpoint media queries | `ref/lance-css/0802v4mhdt9c4.css` |
| computed type styles per section, nav geometry, `--section-spacing`, `--container-padding`, page padding 28px | `ref/style_spec.json` |
| the "Book a Demo" `<a>` class lists, h1/h2 class lists, story-card and rights-cell markup, ISO seal markup | `ref/index.html` |
| HUD card / panel / stop-list markup, `.trust-word`, marquee cells (260×72, logo heights 22–42px) | `ref/hero_dom.html` |
| light-page pill, eyebrow dash, "Explore →", rights cells, security seals | `ref/pages/product.jpg`, `ref/pages/security.jpg`, `ref/shots/s28…s32`, zoomed 4× with `sips` |
| phone gutter | `ref/mobile/m00_0.jpg` (Menu label starts 14 CSS px from the edge) |

## 2. Colour

Lance's `[data-landing]` block declares:
`--sand-l:#bcbbb4; --sand-m:#dad9d4; --sand-s:#f7f6f4; --sand:#f0f1e9; --grey-m:#7b7b7b; --grey-s:#f5f5f5; --line:#969696; --page-x:1.75rem; color:#fff; background:#000`.
Utilities: `.bg-sand-s{#f7f6f4} .bg-sand-m{#dad9d4} .bg-sand-l{#bcbbb4} .text-sand-l{#bcbbb4} .text-grey-m{#7b7b7b} .bg-grey-m{#7b7b7b} .border-sand-m{#dad9d4}`.
Alphas actually used on the home page: `bg-white/12` (pill), `hover:bg-white/24`, `hover:bg-white/15` (nav text pills), `bg-white/15` (footer rule),
`border-sand-l/60` (rights cell borders), `bg-grey-m/60` (HUD divider, 0.5px), `bg-black/[0.36]` (open nav item + blur 6px), `bg-black/20`,
`text-white/40 /45 /60 /70 /75`, `bg-[rgba(188,187,180,0.12)]` (HUD card).
Lance's accent `#2BCA95` exists only as Tailwind utilities for the product UI (`bg-[#2BCA95]`, `/5 /10 /12 /15 /20`, `border-[#2BCA95]/20 /30 /40`, `ring-[#2BCA95]/30 /40`, `text-[#2BCA95]`, `/70`) — it is not in the marketing HTML. Ours is **`--jam: #ff6f1f`** with the same alpha ladder (`--jam-05 … --jam-70`).

Ours (all in `00-tokens.css`): `--black --white --sand-s --sand-m --sand-l --sand --grey(#7b7b7b) --grey-m(#5b5b5b, CONTRACT's divider tone) --grey-s --line --jam --jam-ink`,
white alphas `--w05 … --w75`, black alphas `--k05 … --k80`, `--sand-l-60`, `--grey-60`, `--hud-card-bg`.
Note the naming shift: **Lance's `--grey-m` (#7b7b7b) is our `--grey`**; our `--grey-m` is the contract's #5b5b5b. Lance's real divider is `--grey` at 60% on black (`--grey-60`), which composites to ≈#4a4a4a.

### Semantic tokens (flip with theme)
`--bg --fg --fg-body --fg-dim --fg-dim-40 --hairline --hairline-strong --pill-bg --pill-bg-hover --pill-fg --pill-fg-hover --pill-ico-bg --pill-ico-fg --ghost-hover --nav-pill-bg --reserved-fill`.
Scopes: `:root` = dark. `[data-theme="light"] | .section--white | .theme-light`, `[data-theme="sand"] | .section--sand-s | .theme-sand`,
`[data-theme="sand-m"] | .section--sand-m | .theme-sand-m`, `[data-theme="dark"] | .section--black | .theme-dark`.
Put the attribute (or class) on a section and every `.btn`, `.hairline`, `.t-body`, `.tag-soon`, `.badge` inside it takes the right colours.

## 3. Type

Faces: Lance = `publishSerif, Georgia, "Times New Roman", serif` (display) and `gtStandard, Arial, Helvetica, sans-serif` (body).
Ours = **Newsreader** (`--font-display`, opsz axis, `font-optical-sizing:auto`) and **Geist** (`--font-body`). Loaded by the head partial from
`/assets/fonts/newsreader.css` (400 normal+italic, 500) and `/assets/fonts/geist.css` (300/400/500/600). Not `@import`ed in site.css (concatenation would make the @import invalid).
Lance's `[data-landing] .font-display`: `font-synthesis:none; -webkit-font-smoothing:auto; text-rendering:geometricprecision; font-weight:400` — replicated on every `.t-*` display class. Body is `-webkit-font-smoothing:antialiased` (Lance's `body.antialiased`).

| class | Lance source | size / line-height / letter-spacing | downshift |
|---|---|---|---|
| `.t-h1` | `h1.font-display text-[64px] leading-[1.05] tracking-[-1.28px]` | 64 / 1.05 (67.2px) / -1.28px | `max-lp:text-[48px] tracking-[-0.96px]` → ≤1024: 48/-0.96 · `max-tp:text-[36px] tracking-[-0.72px]` → ≤600: 36/-0.72 |
| `.t-title` | `[data-landing] .title` (sub-page heroes) | 64 / 1 / -1.28px | ≤600: 40/-0.8px |
| `.t-h2` | `h2.font-display text-[42px] leading-[1.1] tracking-[-0.84px]` | 42 / 1.1 (46.2px) / -0.84px | `max-tp:text-[28px] tracking-[-0.56px]` → ≤600: 28/-0.56 |
| `.t-h2-dim` | `span` at oklab(1 / 0.4) | inherits, colour `--fg-dim-40` | |
| `.t-trust` | hero paragraph `text-[36px] leading-[1.2] tracking-[-0.84px] max-w-[717px] max-[1511px]:max-w-[min(717px,47vw)] max-lp:max-w-none max-tp:text-[24px] max-tp:tracking-[-0.48px]` | 36 / 1.2 / -0.84px, max-width 717 | ≤1511: min(717px,47vw) · ≤1024: none · ≤600: 24/-0.48 |
| `.t-quote` | quote spans 36px / 45px / -0.72px | 36 / 1.25 / -0.72px | ≤600: 24/-0.48 |
| `.t-card-title` | HUD `text-[26px] leading-[1.2] tracking-[-0.52px]` | 26 / 1.2 / -0.52px | |
| `.t-story-quote` | story card p 18px / 22.5px / -0.2px | 18 / 1.25 / -0.2px | |
| `.t-h3` | list titles | 18 / 1.25 / -0.2px | |
| `.t-num` | metrics numerals (display, tabular) | 96 / 1 / -2.88px | ≤1024: 72 · ≤600: 56 |
| `.t-body` | `p` 16px/24px, colour `--grey` on light | 16 / 1.5 (24px) | ≤600: 14px (Lance: `[data-landing] .text-[16px]{font-size:14px}` under 601) |
| `.t-body-tight` | feature blurbs 16px/22.4px | 16 / 1.4 | |
| `.t-feature-title` | feature title span 16px 500 black | weight 500, `--fg` | |
| `.t-small` / `.t-small-medium` | hero sub-line 14px/19.6px · attribution name 14px 500 | 14 / 1.4 | |
| `.t-hud` | stop buttons 14px/21px | 14 / 1.5 | |
| `.t-hud-desc` | HUD description `text-[14px] leading-[1.35] text-sand-l` | 14 / 1.35, `--sand-l` | |
| `.t-btn` | buttons, footer links, "Read", "(Skip)" 14px/14px | 14 / 1 | |
| `.t-nav` | nav items 13px/13px | 13 / 1 | |
| `.t-caption` | attribution 13px/17.55px (white .75) | 13 / 1.35 | |
| `.t-meta` | "Travellers' Choice" 13px/16.9px (white .45) | 13 / 1.3, `--fg-dim-40` | |
| `.t-eyebrow` | small caps labels ("LAUNCH FILM · 1 MIN 18 SEC") | 12 / 1.4 / .08em, uppercase, `--fg-dim` | |
| `.t-eyebrow-lg` | security-card titles | 13 / 1.4 / .06em, uppercase, `--fg` | |
| `.t-label-caps` | rights labels `uppercase leading-[1.4]` in 16px `--grey` | 16 / 1.4, uppercase, `--grey` | |
| `.t-micro` | tags, timecodes | 11 / 1.2 / .06em uppercase | |
| `.t-hanging` | Lance `.hanging-punct` | `hanging-punctuation:first last allow-end` (+ `text-indent:-.4em` fallback) | |

Lance's tracking utilities in the build: `-.01em -.02em -.03em -.003em -.2px -.3px` and `tracking-wide/wider/widest`; the negative px values above are the ones the home page uses.
Weights: display 400 only; body 400; 500 for feature titles and names. `--spacing` = `.25rem` (Tailwind) → `--space: 4px`.

## 4. Layout

- Gutter: `--px-page: 28px` (Lance `--page-x: 1.75rem`, `.px-page{padding-inline:var(--page-x)}`); **phones `--px-page-m: 14px`** (Lance: `@media not (min-width:37.5625rem){[data-landing]{--page-x:14px}}`; confirmed on `ref/mobile/m00_0.jpg`). `00-tokens.css` flips `--px-page` itself at ≤600px, so `var(--px-page)` is always right.
- Sections: `py-[120px] max-bp:py-20` → `--section-y: 120px`, ≤800: 80px (flipped in tokens). Quote section `py-40` = 160px. Stories `py-[140px]`. Rights `pt-16 pb-10` = 64/40. Footer `pt-32 pb-10 max-bp:pt-20` = 128/40, ≤800: 80. Sub-page hero `pt-[150px] pb-6 max-bp:pt-[110px]`. Sub-page image section `pt-14 pb-[120px] max-bp:pb-16 max-bp:pt-10`.
- Nav: 88px tall, `padding: 28px var(--px-page)`, items `h-8 rounded-full px-[14px] text-[13px]`, open item `bg-black/[0.36] backdrop-blur-[6px]`, "Log in" `px-1.5 tp:px-[14px]`.
- Max widths (Lance root vars): `--max-width-container:1800px; --max-width-content:1280px; --max-width-medium:904px; --max-width-small:580px` → `--max-container --max-content --max-medium --max-small`; `--max-trust: 717px`, `--max-h2: 560px`.
- Radii: pills `rounded-full` (3.4e38px → `9999px`); HUD card + feature images `rounded-[12px]`; HUD panel `rounded-[6px]`; story image `rounded-[8px]`; `rounded-[16px]` exists.
- Shadows: HUD card `0px 12px 12px 0px rgba(0,0,0,0.24)`; story image `0_14px_32px_rgba(0,0,0,0.25)`.

### Breakpoints — the real ones
Lance's Tailwind names map to these media queries (verified: every `max-bp\:` rule in the build sits under the same query):

| Lance | media query | our doc token | meaning |
|---|---|---|---|
| `max-tp` | `@media (max-width: 600px)` (`not all and (min-width:37.5625rem)`) | `--bp-tp: 600px` | phones |
| `max-bp` | `@media (max-width: 800px)` (`not all and (min-width:50.0625rem)`) | `--bp-bp: 800px` | small tablets; section padding 80 |
| `max-lp` | `@media (max-width: 1024px)` (`not all and (min-width:64.0625rem)`) | `--bp-lp: 1024px` | HUD collapses, h1 48px, seals 90px |
| `max-nv` | `@media (max-width: 1200px)` (`not all and (min-width:75.0625rem)`) | `--bp-nv: 1200px` | 4-col grids → 2 |
| `max-[1511px]` | `@media (max-width: 1511px)` | `--bp-wide: 1511px` | trust paragraph `min(717px,47vw)` |
| `tp` / `bp` / `lp` / `nv` | `(min-width: 601px / 801px / 1025px / 1201px)` | | |

**The CONTRACT's `--bp:1024 --lp:1280 --tp:768` are not Lance's numbers.** Use 600 / 800 / 1024 / 1200 exactly as above. Copy the queries verbatim; CSS variables cannot drive `@media`.

## 5. Buttons

Lance nav pill (`ref/index.html`):
`group flex shrink-0 items-center rounded-full text-[14px] leading-none transition-colors duration-300 h-8 gap-2.5 pl-4 pr-[5px] bg-white/12 text-white backdrop-blur-[6px] hover:bg-white/24 hover:text-sand-m`
+ `<span class="flex items-center justify-center rounded-full size-[22px] bg-white text-black">` + `<svg viewBox="0 0 12 12" width="11" height="11">` arrow (`M1.5 6h8M6.2 2.5 9.7 6l-3.5 3.5`, stroke 1.3).
Hero pill: `h-9 gap-3 pl-[18px] pr-[6px]`, circle `size-6`, svg 12×12.
So: **32px tall, 10px gap, 16px left / 5px right padding, 22px circle, 11px arrow; large 36 / 12 / 18 / 6 / 24 / 12. No border** (the contract's 1px rgba(255,255,255,.2) border is not in Lance's class list; not added). Hover: bg white/24, text `--sand-m`, 300ms.

Light pages (measured, `ref/pages/product.jpg` nav + hero, `security.jpg` "Talk to our team"): the pill is **light grey (`rgba(0,0,0,.08)` ≈ #ebebeb on white), black text, a black circle with a white arrow** — not a black pill. `.btn` picks that up automatically inside a light/sand scope; `.btn--light` forces it. `.btn--solid` is the literal black pill / white circle if a page needs it. `.btn--dark` forces the dark look; `.btn--jam` forces the jam circle on any variant. `.btn--ghost` = Lance's nav text pill (`px-[14px] hover:bg-white/15`); `.btn--text` = "Log in" (`px-1.5 text-[13px] tp:px-[14px]`).
The circle on dark is `--jam` with a black arrow (contract). Lance's is white.

## 6. Components (03-ui.css)

- `.eyebrow` — product-page "— Operations": 20×1px dash, 12px gap, 13px `--grey`, letter-spacing .01em. `--caps` (12px .08em uppercase), `--nodash`, `--fg`, `--dim`. `.dash` = the 24px rule under security-card titles.
- `.container` (+ `--content 1280 / --medium 904 / --small 580 / --max 1800 / --flush`), `.left-page` / `.right-page` (Lance's anchors at `var(--page-x)`).
- `.section` (+ `--quote --stories --rights --footer --page-hero --tight --flush --fill --clip`) and the theme aliases `.section--black --white --sand-s --sand-m`.
- `.hairline` (+ `--strong --v --hud(.5px grey/60) --sand(sand-l/60) --white15`).
- `.arrow-link` — "Explore →" 13px grey + 12px arrow, hover → `--fg`; `--lg` = "Learn More »" (`py-3 gap-3 text-[16px] text-grey-m hover:text-black`, » at 12px); `--btn` = "Read" 14px; `--underline` = Lance's `.cta-touch` sweep (`.55s cubic-bezier(.4,0,.2,1)`, sand-m 1px); `--nudge`.
- `.reserved` — 1px dashed `--hairline-strong` frame, `--reserved-fill`, radius 8 (`--card` 12, `--square`, `--inline` pill). `.reserved__area`, `.reserved__phone` (84px line-drawn phone, `--lg` 120, `--sm` 40), `.tag-soon` (22px pill, 12px text, 6px jam dot pulsing 2.4s; `--static`, `--caps`), `.live-dot`.
- `.icon` — sprite consumer (1em, stroke currentColor 1.3 round); `--fill`, sizes `--11 … --24`, `--block`.
- `.badge` — 120px, ≤1024: 90px (Lance `size-[120px] max-lp:size-[90px] bg-grey-m hover:bg-black`); `--footer` 36px; `--sm` 64; `.badge-row` (36px seal + 14px `--grey` text, 16px gap).
- `.marquee` = Lance `.partner-carousel`: mask `linear-gradient(90deg,#0000 0,#000 24px calc(100% - 24px),#0000 100%)`, track `translate(-50%)` over **90s** linear infinite (`--compact` 28s + 56px mask; touch 180s), opacity .5, cells 260×72, logo heights via `--logo-h` (Lance's PNGs: 22, 24, 24, 24, 42px).
- `.glint` = Lance `.product-ui-stroke` (`opacity:.6; padding:.5px; mask-composite:exclude`) + `.glint__spin` (220% square, conic `#fff 0° · #ffffff2e 90° · [jam] 180° · #ffffff2e 270° · #fff 360°`, 10s linear; Lance had `#ffffffd9` at 180°; `.glint--white` keeps Lance's).
- `.reveal` / `.reveal-text` = Lance's (`opacity 0 → 1 over .9s ease var(--reveal-delay)`; `.rt-i` colour from `--sand-l` to `--fg`).
- HUD numbers for the hero agent (tokens only): card 357×354, padding `22px 18px 18px`, gap 18px, blur 4px, bg `rgba(188,187,180,.12)`, shadow `0 12px 12px rgba(0,0,0,.24)`, panel 321×184 r6, marker 16px, active shift 24px, list gap 36px.
- `.hero-walk` (for the hero agent, not defined here — Lance's): `color:#fff6; font-size:14px (13px ≤600); gap:8px; arrow box 16×14; caret svg viewBox 0 0 16 8 path M2.5 1.4 8 6.6 13.5 1.4 stroke 1.4; keyframes 0%{o:0;y:-1.5} 20%{o:1;y:0} 55%{o:1;y:2} 80%{o:0;y:5} 100%{o:0;y:-1.5}, cycle var(--hero-walk-cycle,3s) cubic-bezier(.4,0,.2,1); label fades .5s`. `#i-chevron-down` in the sprite is that caret.

## 7. Assets

### Sprite `src/partials/icons.html`
Include once after `<body>` (`{{include:partials/icons.html}}`). `<svg class="icon" aria-hidden="true"><use href="#i-arrow-right"/></svg>`.
ids: `i-arrow-right i-arrow-left i-arrow-up-right i-arrow-down i-plus i-minus i-chevron-left i-chevron-right i-chevron-down i-chevron-up i-play i-play-outline i-check i-close i-dot i-external` (stroke icons, 12/16 grids, Lance's 1.3 stroke) ·
`p-tiktok p-instagram p-youtube p-snapchat p-pinterest p-meta` (24-grid platform glyphs, original monochrome marks: a note, a camera, a portrait phone with a play triangle, a ghost, a map pin, a loop) ·
`wm-tiktok wm-instagram wm-youtube wm-snapchat wm-pinterest wm-meta` (wordmarks, viewBox height 32, widths 113.6 / 229.7 / 220.6 / 149.8 / 144.2 / 149.3 measured in real Geist) ·
`seal-usage-rights seal-releases seal-disclosure seal-uk-gdpr seal-shot-on-phones` (240×240). Wordmark and seal symbols draw in `currentColor`.

### Wordmarks `assets/img/platforms/{tiktok,instagram,youtube,snapchat,pinterest,meta}.svg`
Typographic: glyph (26px) + `<text>` in Geist 500 at 26px, letter-spacing -0.26, viewBox `0 0 W 32`, tight widths measured with Playwright.
Each file embeds the Geist latin woff2 (29 KB) as a data-URI `@font-face` so it renders in Geist even as `<img>` (verified in the marquee screenshot). ≈40 KB each. Lighter alternative: the sprite symbols use the page's Geist. Render at 22–42px tall like Lance's logos (`.marquee__cell img{height:var(--logo-h,28px)}`), at opacity .5 via `.marquee`.

### Seals `assets/badges/{usage-rights,releases,disclosure,uk-gdpr,shot-on-phones}.svg`
240×240, one stroke colour (`stroke="currentColor"`, root `color="#7b7b7b"` so `<img>` shows Lance's `bg-grey-m` grey; inline via the sprite to get `hover:bg-black`).
Anatomy like Lance's AICPA / GDPR / PCI seals: 3px outer ring, an inner ornament ring (dashed, double, or 36 ticks), a pictogram (contract sheet with a signature · person + ticked release card · swing-tag reading "AD" · shield with a lock · phone on a tripod), a short rule, two lines of lettering. The lettering is a hand-built monoline alphabet (no fonts, renders identically everywhere). Text: "USAGE / RIGHTS", "SIGNED / RELEASES", "ASA · CAP / DISCLOSURE", "UK / GDPR", "SHOT ON / PHONES". None reads as a certification mark; no stars, no third-party names.

## 8. Base (01-base.css)
Reset (box-sizing, margins, lists, media `display:block; max-width:100%`, button/anchor/form resets, Lance's cursor rules), `html/body` black + white + Geist 16/24 antialiased + `font-synthesis:none`, **scrollbars hidden like Lance** (`scrollbar-width:none` + `::-webkit-scrollbar{display:none}`), `::selection` jam, `:focus-visible` 2px jam ring (offset 3px; pills keep their radius), Lenis recommended CSS (`html.lenis,html.lenis body{height:auto}`, `.lenis.lenis-stopped{overflow:clip}`, `[data-lenis-prevent]{overscroll-behavior:contain}`, `.lenis.lenis-smooth iframe{pointer-events:none}`, autoToggle), and a global `prefers-reduced-motion: reduce` rule that zeroes every CSS animation/transition (GSAP is unaffected; the engine must handle its own reduced-motion path).
Utilities: `.u-sr-only .u-no-scrollbar .u-cover .u-contain .u-nowrap .u-tabular .u-jam .u-grey .u-dim .u-dim-40 .u-w40 .u-w45 .u-w60 .u-w70 .u-w75 .u-sand-l .u-sand-m .u-hide .u-hide-tp .u-only-tp .u-hide-bp .u-only-bp .u-hide-lp .u-only-lp`.

## 9. Verification
Demo page (every class, both pill sizes on black / white / sand-m, eyebrows, links, reserved slots, sprite, marquee as `<img>` and `<use>`, glint card, rights cells, footer badge row) rendered in Chromium at 1920 and 390 (`scratchpad/pw/tokens/demo_1920.png`, `demo_390.png`, `z_*.png`). Computed styles matched every target (h1 64/67.2/-1.28, h2 42/46.2/-.84, quote 36/45/-.72, trust 36/43.2/-.84, card title 26/31.2/-.52, story 18/22.5/-.2, body 16/24, hud 14/21, caption 13/17.55, meta 13/16.9; `.btn` 32px with a 22px jam circle, `.btn--lg` 36/24; gutter 28 → 14 at 390; section 120 → 80; h1 48 at 1000px; seals 120 → 90 at ≤1024). All four files parse in Chromium's CSSOM with no dropped blocks; no console errors. Fonts loaded: Geist 400/500, Newsreader 400.

## 10. Deviations from the CONTRACT and notes for other agents
1. **Breakpoints**: Lance is 600 / 800 / 1024 / 1200 (+1511), not 768 / 1024 / 1280. Use §4's queries.
2. **Phone gutter** is 14px in Lance, not 20px. `--px-page` flips itself; don't hard-code either.
3. **Light-page pill** is light grey with a black circle, not a black pill (§5). `.btn--solid` exists if a black pill is wanted.
4. Lance's pill has **no border**; none added. The dark circle is jam (contract), Lance's is white (`.btn--white-ico` is not provided; use `.btn--solid`'s circle tokens if ever needed).
5. `--grey-m` naming differs from Lance (§2). Use `--grey` for #7b7b7b copy and `--grey-60` / `.hairline--hud` for the HUD divider.
6. Fonts are linked by the head partial, not imported here. Font files: `/assets/fonts/geist.css`, `/assets/fonts/newsreader.css`.
7. The reduced-motion rule is global and uses `!important`; components that must keep a *final state* under reduced motion should set it in a `@media (prefers-reduced-motion: reduce)` block of their own (see the `.reveal` example at the end of 03-ui.css).
8. Theme scoping is `data-theme="light|sand|sand-m|dark"` (or `.section--*`). The nav's `data-nav` / `data-nav-fill` attributes are untouched by these files; the nav agent should add `.btn--light` (or a `data-theme` on the nav) when it flips to the light state.
9. The `.glint` conic gradient puts jam at 180°; the hero agent can reuse `.glint`/`.glint__spin` inside the HUD card instead of re-porting `.product-ui-stroke`.
10. The wordmark SVG files are ~40 KB each because of the embedded font; the sprite route (`#wm-*`) is ~1 KB per mark and uses the page's Geist.

## 11. Index (generated from the files)

**Custom properties (00-tokens.css, 162):** `--black` `--white` `--sand-s` `--sand-m` `--sand-l` `--sand` `--grey` `--grey-m` `--grey-s` `--line` `--jam` `--jam-ink` `--jam-05` `--jam-10` `--jam-12` `--jam-15` `--jam-20` `--jam-30` `--jam-40` `--jam-70` `--w05` `--w08` `--w10` `--w12` `--w15` `--w20` `--w24` `--w40` `--w45` `--w60` `--w70` `--w75` `--k05` `--k08` `--k10` `--k14` `--k20` `--k36` `--k40` `--k80` `--sand-l-60` `--grey-60` `--hud-card-bg` `--bg` `--fg` `--fg-body` `--fg-dim` `--fg-dim-40` `--hairline` `--hairline-strong` `--pill-bg` `--pill-bg-hover` `--pill-fg` `--pill-fg-hover` `--pill-ico-bg` `--pill-ico-fg` `--ghost-hover` `--nav-pill-bg` `--reserved-fill` `--font-display` `--font-body` `--font-mono` `--fw-display` `--fw-body` `--fw-medium` `--fs-h1` `--fs-h1-lp` `--fs-h1-tp` `--fs-title` `--fs-title-tp` `--fs-h2` `--fs-h2-tp` `--fs-quote` `--fs-quote-tp` `--fs-trust` `--fs-card-title` `--fs-story-quote` `--fs-body` `--lh-body-tight` `--lh-body-loose` `--fs-small` `--fs-hud` `--fs-hud-desc` `--fs-nav` `--fs-btn` `--fs-caption` `--lh-meta` `--fs-eyebrow` `--fs-eyebrow-lg` `--fs-dash-label` `--fs-micro` `--space` `--px-page` `--px-page-m` `--section-y` `--section-y-m` `--section-y-quote` `--section-y-stories` `--nav-h` `--nav-pad` `--nav-item-h` `--nav-item-px` `--max-container` `--max-content` `--max-medium` `--max-small` `--max-trust` `--max-h2` `--grid-gap` `--bp-tp` `--bp-bp` `--bp-lp` `--bp-nv` `--bp-wide` `--r-pill` `--r-card` `--r-panel` `--r-img` `--r-img-lg` `--r-tile` `--btn-h` `--btn-h-lg` `--btn-blur` `--hud-card-w` `--hud-card-h` `--hud-card-pad` `--hud-card-gap` `--hud-card-blur` `--hud-panel-w` `--hud-panel-h` `--hud-marker-w` `--hud-shift` `--hud-gap` `--marquee-cell-w` `--marquee-cell-h` `--marquee-dur` `--marquee-dur-compact` `--marquee-dur-touch` `--marquee-fade` `--marquee-opacity` `--badge-size` `--badge-size-m` `--badge-size-footer` `--badge-ink` `--badge-ink-hover` `--shadow-card` `--shadow-story` `--dur-fast` `--dur` `--dur-slow` `--dur-reveal` `--ease` `--ease-io` `--ease-soft` `--ease-pop` `--ease-camera` `--glint-dur` `--z-nav` `--z-menu` `--z-hud` `--z-trust` `--z-stage`

**Classes in 01-base.css (28):** `.lenis` `.lenis-autoToggle` `.lenis-stopped` `.lenis-smooth` `.u-sr-only` `.u-no-scrollbar` `.u-cover` `.u-contain` `.u-nowrap` `.u-tabular` `.u-jam` `.u-grey` `.u-dim` `.u-dim-40` `.u-w40` `.u-w45` `.u-w60` `.u-w70` `.u-w75` `.u-sand-l` `.u-sand-m` `.u-hide` `.u-hide-tp` `.u-only-tp` `.u-hide-bp` `.u-only-bp` `.u-hide-lp` `.u-only-lp`

**Classes in 02-typography.css (43):** `.t-display` `.t-h1` `.t-title` `.t-h2` `.t-h3` `.t-quote` `.t-trust` `.t-card-title` `.t-story-quote` `.t-num` `.t-h2-dim` `.t-hanging` `.t-body` `.t-body-tight` `.t-feature-title` `.t-small` `.t-small-medium` `.t-hud-desc` `.t-hud` `.t-btn` `.t-nav` `.t-caption` `.t-meta` `.t-eyebrow` `.t-eyebrow-lg` `.t-label-caps` `.t-micro` `.t-mono` `.t-fg` `.t-grey` `.t-dim` `.t-dim-40` `.t-w40` `.t-w45` `.t-w60` `.t-w70` `.t-w75` `.t-sand-l` `.t-sand-m` `.t-jam` `.t-center` `.t-balance` `.t-pretty`

**Classes in 03-ui.css (92):** `.btn` `.btn__ico` `.icon` `.btn--lg` `.btn--dark` `.btn--light` `.btn--solid` `.btn--jam` `.btn--ghost` `.btn--text` `.btn--full` `.eyebrow` `.eyebrow--caps` `.eyebrow--nodash` `.eyebrow--fg` `.eyebrow--dim` `.dash` `.dash--wide` `.container` `.container--content` `.container--medium` `.container--small` `.container--max` `.container--flush` `.left-page` `.right-page` `.section` `.section--quote` `.section--stories` `.section--rights` `.section--footer` `.section--page-hero` `.section--tight` `.section--flush` `.section--fill` `.section--clip` `.hairline` `.hairline--strong` `.hairline--v` `.hairline--hud` `.hairline--sand` `.hairline--white15` `.arrow-link` `.arrow-link__mark` `.arrow-link--lg` `.arrow-link--btn` `.arrow-link--fg` `.arrow-link--underline` `.arrow-link--nudge` `.reserved` `.reserved--card` `.reserved--square` `.reserved--inline` `.reserved__area` `.reserved__phone` `.reserved__phone--lg` `.reserved__phone--sm` `.reserved__label` `.tag-soon` `.tag-soon--static` `.tag-soon--caps` `.live-dot` `.icon--fill` `.icon--11` `.icon--12` `.icon--14` `.icon--16` `.icon--20` `.icon--24` `.icon--block` `.badge` `.badge--footer` `.badge--sm` `.badge-row` `.section--black` `.badge--on-dark` `.section--white` `.section--sand-s` `.section--sand-m` `.marquee` `.marquee__track` `.marquee__group` `.marquee__cell` `.marquee--compact` `.marquee--full` `.glint` `.glint__spin` `.glint--white` `.reveal` `.is-shown` `.reveal-text` `.rt-i`
