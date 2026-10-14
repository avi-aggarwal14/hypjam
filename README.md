# hypjam

The website for **hypjam**, a UGC (user-generated content) marketing agency in London.
Live at **https://hypjam.com**.

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
- **No cookies, no ad pixels, no cookie banner.** The only analytics is PostHog in
  cookieless mode (see Analytics below). Anything that would set cookies, record
  sessions or identify visitors needs a consent banner and a privacy policy update in
  the same commit. The cal.com embed loads only on `/book`, as the privacy policy says.
- The accent is `#ff6f1f`. Pink, purple and blue are not used.

## Analytics

PostHog, EU cloud, organisation **hypjam**, project **hypjam.com** (eu.posthog.com,
login avi@hypjam.com). Set up 14 October 2026.

- **Cookieless.** `site-src/src/partials/analytics.html` loads the PostHog snippet with
  `cookieless_mode: 'always'` and `person_profiles: 'never'`: no cookies, no local or
  session storage, no session recording, no surveys, no `identify()`. PostHog counts
  visitors with a server-side hash whose salt changes daily (the project setting
  "Cookieless tracking" must stay on). Side effect: no GeoIP, so location comes from
  the browser's `$timezone` and language, not from the IP.
- **First-party proxy.** Events go to `/jamjar/*`, which `vercel.json` rewrites to
  `eu.i.posthog.com` / `eu-assets.i.posthog.com`, so blockers that filter PostHog's
  domains do not drop them. Do not rename it to anything obvious (`/analytics`, `/ingest`).
- **Off for the owner.** Open any page with `?internal=on` to stop analytics in that
  browser (stored as `hypjam_internal` in localStorage); `?internal=off` turns it back
  on. Local previews (localhost) send nothing unless the URL has `?hj_debug=1`, which
  also logs PostHog and cal.com events to the console.
- **Autocapture** (clicks, form changes), pageviews and page leaves with scroll depth,
  heatmaps, dead clicks, web vitals and JavaScript exceptions are on.

Custom events. All go through `window.hjTrack()`, which is a no-op when analytics is off.
None carries personal data.

| event | fired by | properties |
|---|---|---|
| `book_call_clicked` | `90-analytics.js`, any link to `/book` or the cal.com page | `cta_location`, `cta_text`, `destination` |
| `apply_clicked` | `90-analytics.js`, any link to `/apply` | `cta_location`, `cta_text` |
| `email_link_clicked` | `90-analytics.js`, any `mailto:` link | `cta_location`, `cta_text` |
| `outbound_link_clicked` | `90-analytics.js`, any link off hypjam.com | `cta_location`, `cta_text`, `url_host`, `url` |
| `page_not_found` | `90-analytics.js`, the 404 page | `missing_path`, `referrer` |
| `booking_calendar_viewed` | `45-book.js`, the first of cal.com's `navigatedToBooker`/`availabilityLoaded` | `trigger`, `slots_loaded` |
| `booking_calendar_failed` | `45-book.js`, cal.com's `linkFailed` | `code` |
| `call_booked` | `45-book.js`, cal.com's `bookingSuccessfulV2` | `starts_at`, `days_ahead`, `duration_min`, `status`, `is_recurring` |
| `call_rescheduled` / `call_cancelled` | `45-book.js` | timing only |
| `creator_application_started` | `48-apply.js`, first edit of the form | `first_field` |
| `creator_application_invalid` | `48-apply.js`, a submit that fails validation | `problem_count`, `first_problem` |
| `creator_application_submitted` | `48-apply.js`, a valid submit | `method`, `found_us_via`, `biggest_following`, `made_ugc_before`, `content_types`, `niches`, `films_with`, `free_to_film`, `social_platforms`, `gave_discord`, `gave_rate` |
| `creator_application_copied` / `_email_reopened` / `_failed` | `48-apply.js` | none |

Never add names, emails, handles, links, free text or the cal.com booking title (it
contains the booker's name) to an event. Bookings made straight on cal.com (links in
emails) never touch this site, so they are not in PostHog; cal.com's own Insights has them.

Tag links you share so PostHog can attribute them, for example
`https://hypjam.com/?utm_source=linkedin&utm_medium=social&utm_campaign=vaya_post`.

The free plan keeps events for 12 months, which is what the privacy policy says. A paid
plan defaults to 7 years: change the retention setting or the policy if that happens.

## Restore points

| tag | what |
|---|---|
| `identity-v1` | the previous site: the "Playhead" identity, hook-as-scroll-indicator |
| `bevel-port-v1` | the original build, before that identity work |

```bash
git checkout identity-v1
```

MIT licensed. © 2026 Avi Aggarwal.
