# SEO pass — final verification audit

Date: 2026-09-12
Scope: verify the six build agents' SEO work before the orchestrator's final rebuild + deploy. Read-only except for this file.

## Top-line result

**NO-GO as-is — one blocking build defect, otherwise clean.**

The structured-data, honesty, sitemap, feed-content, and visual-parity work is all correct. But a plain `python3 build.py` run does **not** produce `dist/feed.xml` — it is silently deleted by `build.py`'s own pipeline ordering before the build finishes. If the orchestrator deploys straight off a clean `python3 build.py`, the RSS feed simply will not exist in production, contradicting this task's own requirement ("dist/feed.xml … now exist[s]"). This is a one-line ordering fix in `build.py` (not in my file scope to make). Everything else below passed.

Honesty violations found: **zero**. Visual regressions found: **zero** (0.0000% pixel diff on all 8 required pages). Schema validation errors: **zero**. Two non-blocking meta-description overruns and a handful of minor process notes are listed below.

---

## 1. Rebuild

`cd site-src && python3 build.py` → `done: 39 page(s), 0 warning(s)`. All 39 sitemap URLs + `/404` write cleanly (40 HTML output targets, 39 unique URLs — `/404` is correctly excluded from the sitemap).

- `dist/llms.txt` — **present** after a plain build (it's copied by `copy_root_files()`, which runs after `copy_assets()`).
- `dist/feed.xml` — **ABSENT** after a plain build. See Blocking issue below.

## 2. Blocking issue: build.py renderer/copy-assets ordering wipes dist/feed.xml

Confirmed empirically:

```
python3 build.py          # dist/feed.xml does NOT exist afterward
ls dist/feed.xml           # No such file or directory
```

Root cause, in `build.py`'s `main()`:

```python
run_renderers()   # runs tools/render_feed.py, which writes dist/feed.xml
copy_assets()      # shutil.rmtree(DIST); DIST.mkdir()  <-- wipes it
bundle_css_js()
urls = build_pages()
write_sitemap(urls)
copy_root_files()  # copies robots.txt/vercel.json/llms.txt — these survive because they're static passthrough files, not renderer output
```

`tools/render_feed.py` writes directly into `dist/` during the renderer pass, which runs *before* `copy_assets()`'s unconditional `rmtree(DIST)`. The blog/feed agent's own report flagged this exact bug in detail and correctly identified both fixes (move `run_renderers()` after `copy_assets()`, or re-run the feed renderer after `copy_assets()`/before `copy_root_files()`). It was not fixed because `build.py` was outside that agent's file ownership. It is also outside mine (read-only audit) — **the orchestrator needs to apply one of the two fixes to `build.py` before the final deploy build**, then re-run `python3 build.py` once and confirm `dist/feed.xml` exists.

I generated `dist/feed.xml` by running `python3 tools/render_feed.py` standalone (after `build.py`) purely to validate its *content* for this audit (section 5) — that workaround is not a fix and must not be mistaken for one; a plain `python3 build.py` still won't produce the file until the ordering is corrected.

`dist/llms.txt` has no such problem — it's a static file copied by `copy_root_files()`, which runs after `copy_assets()`.

## 3. JSON-LD validation (all 39 pages + /404, both copies)

Extracted and `json.loads()`-parsed every `<script type="application/ld+json">` across all 41 rendered HTML files.

- **Parse errors: 0** (94 JSON-LD blocks total, all valid JSON).
- **@id collisions: 0.** 62 distinct `@id`s found; every `@id` used across multiple pages (`#org`, `#founder`, `#website`, `#service`) resolves to the exact same `@type` everywhere. Every page-scoped `@id` (`.../services/<slug>#service`, `#breadcrumb`, `#faq`, etc.) is unique to its page.
- **Dangling `@id` references: 0.** Every `{"@id": "..."}` reference anywhere in any graph (e.g. `provider`, `founder`, `publisher`, `worksFor`, `mainEntity`) resolves to a node that is actually defined somewhere in the same page's graph.
- **Required properties: 0 missing**, checked programmatically for every `@type` used: `Organization` (name+url), `Service` (name+provider), `ProfessionalService` (name), `Person` (name), `WebSite` (name+url), `BreadcrumbList` (itemListElement, and every `ListItem` has position+name+item), `FAQPage` (mainEntity), `ItemList` (itemListElement).
- **FAQPage honesty spot-check (3 pages, all Q&A text checked, not just a sample):** `/services/briefing` (6 questions), `/solutions/launches` (5 questions), `/faq` (spot-checked 4 of 19) — every question string in the JSON-LD `mainEntity` was found verbatim in that same page's rendered `<body>`. No cross-page FAQ leakage.
- **BreadcrumbList site-map fidelity:** every breadcrumb trail (Home → Services → `<service>`, Home → Solutions → `<solution>`, Home → Blog → `<article>`, Home → `<top-level page>`) matches `CONTRACT.md` §3 exactly. `/services` and `/solutions` index pages additionally carry a correct 9-item `ItemList` matching the real sub-pages verbatim (names + URLs pulled from content, checked against both `content/services.json`/`content/solutions.json` and the nav structure in §3).
- **Article schema** (`/blog/*`): headline, datePublished, author (`Person`, "Avi Aggarwal") all present; `publisher.logo.url` correctly points at `hook-icon-512.png` (verified the file is actually 512×512 via PIL) rather than `og.png`.

## 4. Honesty check (CONTRACT §10 / SEO-CONTRACT)

Grepped every JSON-LD block (and the full rendered `<body>` for spot checks) for every banned pattern:

| Check | Result |
|---|---|
| `aggregateRating` / `review` / `Rating` | 0 hits |
| `sameAs` | 0 hits |
| `Person` other than Avi Aggarwal | 0 — every `Person` node across all 41 files is "Avi Aggarwal" |
| Invented prices | 0 — the only prices anywhere are £1,800 / £3,600 / £6,500, matching `content/process.json` exactly |
| Certification/compliance claims | 0 — the one "certification" hit on the homepage is the rights section explicitly *disclaiming* certification ("Our practice, not a certification.") |
| `PostalAddress` / street address | 0 — org uses `areaServed: "GB"` only, no address object |
| `foundingDate`, employee counts, awards, "trusted by" | 0 hits anywhere |

**Zero honesty violations found.** This is the correct outcome and matches every agent's own report.

One nuance worth flagging (not a rule violation, since the SEO-CONTRACT's honesty rule is only "quote the real figure exactly, don't round, don't invent a fourth tier" — satisfied): each package `Offer` carries both a bare `"price": 1800` (etc.) and a `UnitPriceSpecification.minPrice: 1800`. The visible copy and the Offer's own `description` field both say "From £1,800 a month" — a floor, not a fixed price — but a flat `Offer.price` field technically asserts a single fixed price to strict consumers of that field (e.g. a price-comparison rich result) rather than "starting at." Since `minPrice` is also present and correct, this is at most a very minor precision nit, not a fabrication — the number itself is real and unrounded. No action required unless the orchestrator wants to drop the bare `price` field and rely on `minPrice` alone.

## 5. Sitemap / robots.txt / llms.txt / feed.xml

- **`dist/sitemap.xml`** parses as valid XML. All **39 URLs** present, each with `<loc>`, `<lastmod>`, `<changefreq>`, `<priority>` — tiering matches the SEO-CONTRACT's intent (home 1.0/weekly; services/solutions/work/blog index 0.8/weekly; service/solution detail pages 0.6/monthly; privacy/terms 0.3/yearly; everything else 0.5/monthly).
- **`dist/robots.txt`**: unchanged, permissive (`Allow: /`), correctly points `Sitemap:` at `https://hypjam.vercel.app/sitemap.xml`.
- **`dist/llms.txt`**: read in full. Every claim is honest and matches content already published elsewhere on the site (London UGC agency, founder Avi Aggarwal, "has no clients yet", the three real package prices, all service/solution names verbatim). No invented team size, results, or reviews.
- **`dist/feed.xml`** (generated standalone for validation — see blocking issue above): valid XML, exactly **8 `<item>`** entries, one per `content/blog.json` article. Every `<link>` resolves to a real URL in `sitemap.xml`. `pubDate` values are correctly computed RFC-822 dates (from each article's real `YYYY-MM`, day fixed at the 1st, documented as such — not invented precision).
- No page currently links to `/feed.xml` or `/llms.txt` (no `<link rel="alternate" type="application/rss+xml">` in `head.html`) — flagged by the feed agent as an explicit not-done, correctly deferred since `head.html` isn't in that agent's file ownership. Not a broken link (nothing references it), just a missed discoverability win for a future pass.

## 6. Meta title/description lengths

Measured `<title>` and `<meta name="description">` on all 41 rendered files.

- **Titles: 0 over 70 characters.** Longest is `/join` at exactly 70.
- **Descriptions: 2 still over 160 characters**, neither fixed by the content-trimming agent:
  - `/faq` — **195 characters** (content/faq.json → `meta.description`)
  - `/process` — **182 characters** (content/process.json → `meta.description`)

The content-trimming agent's report states "book.json/home.json/notfound.json/agency.json/faq.json/join.json/privacy.json/terms.json/process.json meta fields — all were measured and found already within range, so left untouched." That claim is incorrect for `faq.json` and `process.json` — direct measurement of the built output shows both over the ~160 target. Recommend trimming both descriptions in a follow-up pass (both are copy edits only, per the SEO-CONTRACT's allowance for meta trimming).

No regressions found — no title/description was inflated by another agent's head-extra JSON-LD additions (titles/descriptions are sourced from separate `page.title`/`page.description` tokens untouched by the structured-data work, confirmed by reading `head.html`'s use of these tokens for `<title>`, `og:title`, `twitter:title`, etc.).

Pre-existing, out of scope for this pass (not introduced or touched by any of the six agents — confirmed via their reports and via `content/blog.json`): all 8 blog article meta descriptions are entirely lowercase, including the opening word (e.g. "what is ugc marketing? a plain-english guide…"). Not a regression from this SEO pass; flagging only because it affects how the description actually displays in search results.

## 7. Visual regression check (the most important check)

Screenshotted the same 8 pages at 1920×1080 full-page, using the identical Playwright script and launch args the baseline was generated with (`../seo-baseline` was produced by `pw/baseline.js` against `localhost:8125`; I reused that exact script against a fresh `python3 -m http.server` on the freshly-rebuilt `dist/`), then did a full pixel-diff (PIL/numpy, per-pixel summed-RGB delta, threshold 30 to ignore antialiasing noise) against every baseline PNG.

| Page | Size | Diff pixels | % diff |
|---|---|---|---|
| `/` (home) | 1920×17778 | 0 | 0.0000% |
| `/services` | 1920×5695 | 0 | 0.0000% |
| `/services/briefing` | 1920×13086 | 0 | 0.0000% |
| `/solutions/launches` | 1920×12066 | 0 | 0.0000% |
| `/work` | 1920×7048 | 0 | 0.0000% |
| `/blog/what-is-ugc-marketing` | 1920×6960 | 0 | 0.0000% |
| `/rights` | 1920×3554 | 0 | 0.0000% |
| `/book` | 1920×1080 | 0 | 0.0000% |

**Zero visual regressions. Every image is byte-for-byte pixel-identical to its baseline** (same dimensions, 0 differing pixels even at a strict threshold). This is the strongest possible confirmation that every agent honoured the "no design changes" rule — all six agents' changes were genuinely `<head>`-only / attribute-only / content-JSON-string-only, exactly as instructed and as each agent's own report claimed.

## 8. Console errors / broken links

Crawled the same 8 pages with Playwright, capturing console messages, page errors, and any HTTP response ≥400 for every resource the page actually loads:

- **Console errors: 0** across all 8 pages.
- **Page errors: 0** across all 8 pages.
- **Failed/4xx resource loads: 0** across all 8 pages.

Additionally crawled all **39 rendered pages'** `href`/`src` attributes (4,811 internal link occurrences, 80 distinct internal paths) and resolved each against the actual `dist/` file tree (accounting for clean-URL → `/index.html` mapping): **0 broken internal links.**

Neither `/feed.xml` nor `/llms.txt` is linked from any page, so neither can be a broken link — they're crawler/agent-discovery files, not navigated resources.

## Other minor, non-blocking notes (informational, no action required for deploy)

- `content/notfound.json`'s own `meta.robots` field still says `"noindex"` (not `"noindex, follow"`); the live `/404` page correctly renders `noindex, follow` because `src/pages/404.html` hardcodes that value directly in its own head comment, which wins at build time. Output is correct; the two sources just disagree cosmetically. Already flagged by the agent who made this change.
- `/blog` index's `Blog` schema and each `/blog/<slug>` `Article` schema declare `publisher` as a full inline `Organization` object (name+url, or name+url+logo) rather than referencing the sitewide `{"@id": "https://hypjam.vercel.app/#org"}` the way every other page's schema does. Not an error — the facts are identical and non-conflicting — just a minor style inconsistency with the `@id`-referencing convention every other agent's pages settled on.
- The `hasOfferCatalog` reference to package pricing (see §4 nuance above) is otherwise clean and correctly wired to `content/process.json` for its `description` strings — only the two numeric literal fields are hardcoded, exactly as flagged and justified in the schema-global agent's own report (no bare-number field exists in `content/process.json` to tokenize from).

## Go/no-go recommendation

**No-go until the build.py ordering fix lands.** Everything content-, honesty-, schema-, and design-related in this SEO pass is correct and ready to ship. The single blocker is mechanical: apply one of the two fixes already diagnosed and documented (by the blog/feed agent) in `build.py`'s `main()` — either move `run_renderers()` to after `copy_assets()`, or re-invoke `tools/render_feed.py` after `copy_assets()`/before `copy_root_files()` — then run `python3 build.py` once clean and confirm `dist/feed.xml` exists before deploying. No other agent's files need changes to ship. The two over-length meta descriptions (`/faq`, `/process`) are worth a quick follow-up trim but are not blocking (they degrade SERP snippet display, not correctness or honesty).
