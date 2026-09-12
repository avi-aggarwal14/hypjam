# SEO pass — ground rules for every agent

Repo root `/Users/vinee/Desktop/UGC Agency/hypjam` **is** the deployed site (static HTML,
served by Vercel). It is generated from source in `site-src/` by `site-src/build.py`.
**You edit files under `site-src/` only.** Never edit the generated HTML at the repo root
directly — it gets overwritten wholesale when the build is copied up, and any hand-edit
there is silently lost.

Read `site-src/CONTRACT.md` first for the site map, the honesty rules (§10) and the brand
rules (§11) — they still apply in full. This document adds the rules for this SEO pass only.

## The one instruction that overrides everything else here

**Do not change the design.** No new visible sections, no layout changes, no colour/type/
spacing changes, no new UI components, no visible copy rewrites beyond what is explicitly
listed below. Everything you do should be invisible to a sighted visitor: `<head>` tags,
structured data (`<script type="application/ld+json">`), `<meta>` tags, `robots.txt`,
`sitemap.xml`, a new `llms.txt`, an RSS feed, HTTP headers, and attribute-level tweaks
(`alt`, `aria-label`, `rel`) that carry no visual weight. Where a task below allows a copy
edit (meta title/description trimming), it is a copy edit only — the string content, never
its container, class, or position.

A verifier will screenshot every page after your changes and diff it against a baseline
taken before this pass. Any pixel difference is a regression you introduced and will be
reverted. If you are not sure whether a change is visible, don't make it — ask in your report
instead.

## Build and test

```bash
cd "/Users/vinee/Desktop/UGC Agency/hypjam/site-src"
python3 build.py            # writes site-src/dist/
```

`build.py` runs every `tools/render_*.py` automatically before assembling pages — you do
not need to register a new renderer anywhere, dropping a `tools/render_foo.py` file is
enough for it to run (the orchestrator confirmed this from the original build report).

To view your change in a real browser: `cd dist && python3 -m http.server 8126` (pick a
free port; 8125 is running the pre-change baseline, leave it alone) and load
`http://localhost:8126/<path>`. Playwright + Chromium are set up at
`/private/tmp/claude-501/-Users-vinee-Desktop-UGC-Agency/5427b9f2-20ea-4225-ae81-cd09121648f3/scratchpad/pw/`
(launch args `--use-gl=swiftshader --enable-unsafe-swiftshader`; headless Chromium cannot
decode H.264, so `<video>` shows the poster only — expected, not a bug).

**Do not run git. Do not copy `dist/` up to the repo root — the orchestrator does the
final rebuild, diff and deploy once every agent is done.** Do not edit anything under
`ref/` (read-only reference material) or the repo-root generated pages.

## The `head-extra` mechanism (how you add structured data)

Every page template in `src/pages/**/*.html` starts with leading HTML comments that
`build.py` reads as page metadata, e.g.:

```html
<!-- title: Briefing and scripts for UGC ads | hypjam -->
<!-- description: ... -->
<!-- head-extra: <script type="application/ld+json">{"@context":"https://schema.org", ...}</script> -->
```

`{{page.head-extra}}` is emitted verbatim just before `</head>` (see `src/partials/head.html`
line 37). A `head-extra` value can itself contain `{{content:file.a.b}}` tokens, which
`build.py` expands — so you can pull real values (prices, dates, names) from
`content/*.json` straight into the JSON-LD rather than hand-typing them. Multiple
`<script>` tags are fine in one `head-extra` comment.

## Honesty (CONTRACT §10) — this is where SEO work most often goes wrong

hypjam has no clients, no reviews, no measured results. Structured data can lie to a
crawler even more easily than a page can lie to a reader, and Google explicitly treats
fabricated structured data as a manual-action risk. Hard rules for every schema you write:

- **Never** emit `aggregateRating`, `review`, or `Rating` of any kind.
- **Never** emit `sameAs` pointing at a social profile that does not exist or is not
  confirmed live. If you don't know a profile is real, omit `sameAs` entirely.
- **Never** invent a `Person` other than Avi Aggarwal (founder). Never invent employee
  count, founding date beyond what content already states, or a street address —
  `PostalAddress` may state `addressLocality: "London"` and `addressCountry: "GB"` only,
  never a street.
- Only state a price (`Offer`/`priceSpecification`) if it is a real figure already
  published in `content/*.json` (the three packages — Starter/Growth/Scale, from £1,800 /
  £3,600 / £6,500 a month — live in `content/process.json`). Quote them exactly; do not
  round, don't invent a fourth tier.
- `FAQPage` schema must match FAQ content that is actually visible on that same page.
  Don't add FAQ schema referencing questions that live on a different page.
- `BreadcrumbList` must match the page's real position in the site map (see
  `CONTRACT.md` §3), not an invented hierarchy.
- `Article` schema (blog) must not claim a review process, an editor, or a publication
  the site doesn't have. `author` is Avi Aggarwal or "hypjam" — never a name not already
  in the content.

If in doubt, leave a field out rather than fill it with something plausible-sounding.

## Reference facts (so you don't have to re-derive them)

- Canonical origin: `https://hypjam.vercel.app`
- Organization name: `hypjam`. Logo: `/assets/brand/hook-icon-512.png` (or the lockup —
  check `assets/brand/logos/` and CONTRACT §11 for the right file per context).
- Founder: Avi Aggarwal, based in London.
- Site map (39 pages) is CONTRACT.md §3. Services: 9 pages under `/services/*`.
  Solutions: 9 pages under `/solutions/*`. Blog: index + 8 articles under `/blog/*`.
  Also `/rights`, `/work`, `/book`, `/process`, `/faq`, `/agency`, `/join`, `/privacy`,
  `/terms`, `/404`.
- Packages (content/process.json): Starter from £1,800/mo, Growth from £3,600/mo, Scale
  from £6,500/mo.
- `robots.txt` currently: `User-agent: * / Allow: / / Sitemap: https://hypjam.vercel.app/sitemap.xml`.
- `sitemap.xml` is generated by `build.py` from every page it writes; currently emits
  `<loc>` and `<lastmod>` only, no `priority` or `changefreq`, no image extension.
- No cookies, no analytics, no trackers anywhere on the site — this is a real, checked
  claim in the privacy policy. Do not add anything (a tracking pixel, a "smart" embed,
  a font loaded from a third-party CDN) that would make that claim false.
- Meta title/description are already present on every page via `page.title`/
  `page.description` comments at the top of each `src/pages/**/*.html`. A few run long:
  `/solutions/launches` description is 209 characters, `/work` is 200, `/services` and
  `/services/briefing` titles are 71 characters. Ideal is ~50–60 chars for titles,
  ~140–160 for descriptions (Google's pixel-based truncation varies; character counts
  are a proxy, not a hard law — don't mangle a sentence to hit an exact number).

## Report requirements

Same as the build phase: `summary`, `files` (every file created or changed), `interface`
(anything another agent needs to know — e.g. a new `@id` convention, a new render tool's
output path), `verified` (rebuilt? screenshotted? validated the JSON-LD how?), `not_done`.
