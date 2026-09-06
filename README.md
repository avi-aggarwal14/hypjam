# hypjam

**Live:** <https://avi-aggarwal14.github.io/hypjam/>

Landing page for **hypjam**, an all-in-one UGC (user-generated content) studio: everyday creators, directed by a team, making short-form ads that convert.

The whole site is one horizontal track. Scrolling the wheel or trackpad up and down glides the page to the **right**, panel by panel, with eased momentum. Arrow keys, Page Down and Space work too, and the bottom pill navigation glides you straight to a panel. On screens under 900px it falls back to a normal vertical page.

## Run it

It is a single static file with no build step and no dependencies beyond two Google Fonts.

```bash
git clone https://github.com/avi-aggarwal14/hypjam.git
cd hypjam
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Opening `index.html` directly from disk also works.

## What's inside

Everything lives in `index.html`:

- **Horizontal glide** – `html { overflow: auto hidden }`, a `width: max-content` body and a flex `.track` of `100dvh` panels. A `wheel` listener converts vertical deltas into a lerped `window.scrollTo` glide, so the page keeps native horizontal scrolling and keyboard access.
- **Fixed chrome** – dotted top and bottom bands, a pointer-reactive dot field on a canvas, a progress bar, and the bottom navigation pill with a sliding active blob.
- **Panels** – hero, work shelf, services, studio, brand voices, and contact with a working week-view slot picker.
- **Motion** – page-load choreography, 3D tilt on the hero card and work cards, marquees, an auto-cycling services preview, and a drawn-on ROAS chart. Everything respects `prefers-reduced-motion`.
- **Placeholder footage** – the "video" frames are generated with CSS gradients and shapes so the page ships with zero image assets. Replace the `.shot` blocks with real clips or stills.

## Customise

- Colours are CSS custom properties at the top of the stylesheet (`--jam` is the accent).
- Copy, brand names, creator handles and the founder card are plain HTML.
- Point the "send a message" link and the calendar at your own email and booking tool.

## License

MIT. See [LICENSE](LICENSE).
