# Retired: the "hotel" scroll walkthrough (homepage hero, 2026-09-12 → 2026-09-26)

The homepage hero used to be a pinned ~11-viewport scroll walkthrough of a line-drawn
building (ported from a hotel-software site's hero), flying between five rooms — Brief
desk, Writers' room, Casting floor, Shoot bay, Edit suite — each with an animated
product panel, then a "Measured in commitments" beat with count-up numbers. Phones got
an accordion version.

It was replaced on 2026-09-26 because a scroll-jacked sequence of that length delays
the offer and the call-to-action, and the owner judged it would not convert. The five
steps and their panels now live in `src/partials/home/process.html` (a click / auto-
advance stepper, no scroll takeover), and the three commitments are a static strip.

These files are kept, outside the build, so the walkthrough can be restored:
  hero.html → src/partials/home/hero.html
  20-hero.js, 21-hero-mobile.js → src/js/
  20-hero.css → src/css/
The drawing it animates is still `assets/img/hq.svg` (sources in `src/drawing/`), and
the git tag `pre-conversion-redesign` is the last commit where it shipped.
