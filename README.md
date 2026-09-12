# hypjam

The website for **hypjam**, a UGC (user-generated content) marketing agency in London.
Live at **https://hypjam.vercel.app**.

## What this repo is

The repository root **is** the deployed site: plain static HTML, CSS, JS and assets,
served by Vercel with `cleanUrls`. There is no build step on deploy.

The site is generated from source in **`site-src/`**. To change anything, edit the
source and rebuild — never edit the generated HTML at the root.

```bash
cd site-src
python3 build.py          # writes site-src/dist/
cp -R dist/. ..           # publish to the repo root
```

`site-src/CONTRACT.md` is the full brief: site map, design tokens, the hero engine,
the HQ drawing, the product panels, and the honesty rules. Read it before changing
anything structural. `site-src/DESIGN.md` documents the tokens and CSS classes.

## Layout

| path | what |
|---|---|
| `index.html`, `services/`, `solutions/`, `blog/`, … | the generated site (do not edit) |
| `assets/` | fonts, vendor libs (GSAP, Lenis), brand, video, the HQ drawing, badges |
| `site-src/src/` | page templates, partials, CSS, JS, the drawing parts, the panels |
| `site-src/content/` | every word on the site, as JSON, one file per page |
| `site-src/tools/` | the page renderers and the drawing assembler/validator |
| `vercel.json` | clean URLs, security headers, caching, legacy redirects |

## The home page

The hero pins for eleven viewport heights and scrubs one GSAP timeline: footage
blurs out while a line drawing of hypjam's HQ draws itself in, then the camera
flies through five rooms — the brief desk, the writers' room, the casting floor,
the shoot bay and the edit suite — each with its own animated panel, before pulling
back to the commitments. The drawing is `assets/img/hq.svg`, 3,359 original line
elements built from `site-src/src/drawing/parts/`.

## House rules

- **Nothing invented.** hypjam is new: no clients, testimonials, case studies or
  performance figures. Proof slots are deliberately empty and marked "filled in at
  launch". Never add `aggregateRating`, `review` or invented quotes.
- **"Studio" never appears** in visible copy. hypjam is a UGC agency.
- **No cookies, no analytics, no trackers.** The cal.com booking embed loads only
  after a click, which is what keeps the no-cookie-banner promise in the privacy policy.
- The accent is `#ff6f1f`. Pink, purple and blue are not used.

## Restore points

| tag | what |
|---|---|
| `identity-v1` | the previous site: the "Playhead" identity, hook-as-scroll-indicator |
| `bevel-port-v1` | the original build, before that identity work |

```bash
git checkout identity-v1
```

MIT licensed. © 2026 Avi Aggarwal.
