# Retired: live product panels (2026-09-26)

Five animated mock screens (brief, hooks, casting, shoot, ship) built for the hero's
hotel walkthrough and briefly reused, live, in "How a sprint runs". They needed GSAP
on every page. The homepage now shows each panel as a still photographed at its
finished state: `assets/img/process/<name>.jpg` (rendered with Playwright at 2x from
the panels mounted and parked on their `final` label).

To bring them back: move this folder to `src/panels/` (build.py concatenates
`src/panels/*.css|js` and expands `{{panel:name}}`), restore the vendor scripts in
`src/partials/scripts.html`, and mount them as `_retired/panels/22-process-live-panels.js` did.
