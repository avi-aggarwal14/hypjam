#!/usr/bin/env python3
"""render_og.py — draws assets/brand/og.png, the social share card.

Kept in-repo because the previous og.png was made outside the build and drifted:
it advertised an invented "2,400,000,000+ views" figure (CONTRACT §10 forbids
invented metrics), clipped its own headline, and named the retired vercel.app
host. Regenerate with: python3 tools/render_og.py

Needs fonttools + brotli to decode the shipped woff2, and Pillow to draw.
Renders at 2x and downsamples, so the type stays crisp at 1200x630.
"""
import io, os, sys
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H, S = 1200, 630, 2                      # card size, supersample factor
BLACK, JAM, WHITE = (10, 10, 10), (255, 111, 31), (255, 255, 255)
LATIN = "assets/fonts/geist-8740fcb6.woff2"  # the U+0000-00FF subset, variable wght 100-900
LOCKUP = "assets/brand/logos/hypjam-lockup-on-dark.png"


def geist(size, weight):
    """Load the shipped variable Geist at a weight, via an in-memory woff2 -> ttf."""
    f = TTFont(os.path.join(ROOT, LATIN))
    buf = io.BytesIO(); f.flavor = None; f.save(buf); buf.seek(0)
    font = ImageFont.truetype(buf, size * S)
    try: font.set_variation_by_axes([weight])
    except Exception: pass
    return font


def main():
    img = Image.new("RGB", (W * S, H * S), BLACK)
    d = ImageDraw.Draw(img)

    # dot grid, then the two hairlines that frame the card
    for y in range(0, H * S, 24 * S):
        for x in range(0, W * S, 24 * S):
            d.rectangle([x, y, x + S - 1, y + S - 1], fill=(24, 24, 24))
    for y in (76, H - 76):
        d.rectangle([0, y * S, W * S, y * S + S - 1], fill=(33, 33, 33))

    # lockup
    lock = Image.open(os.path.join(ROOT, LOCKUP)).convert("RGBA")
    lh = 56 * S; lw = round(lock.width * lh / lock.height)
    img.paste(lock.resize((lw, lh), Image.LANCZOS), (88 * S, 122 * S), lock.resize((lw, lh), Image.LANCZOS))

    # headline — the site's own homepage line, no claims in it
    h1 = geist(61, 600)
    d.text((88 * S, 220 * S), "find the format.", font=h1, fill=WHITE)
    d.text((88 * S, 285 * S), "then film it.", font=h1, fill=JAM)

    # sub
    sub = geist(22, 400)
    for i, line in enumerate(["the ugc agency in london. everyday creators — briefed,",
                              "cast, directed and edited by one team."]):
        d.text((88 * S, (376 + i * 32) * S), line, font=sub, fill=(186, 186, 186))

    # call-to-action pill
    pill = geist(21, 600)
    label = "book a call"
    tw = d.textlength(label, font=pill)
    x0, y0 = 88 * S, 492 * S
    pw, ph = tw + (27 + 27 + 19 + 11) * S, 52 * S
    d.rounded_rectangle([x0, y0, x0 + pw, y0 + ph], radius=ph // 2, fill=JAM)
    ax, ay = x0 + 27 * S, y0 + ph // 2
    d.line([ax, ay, ax + 15 * S, ay], fill=BLACK, width=round(2.4 * S))
    d.line([ax + 10 * S, ay - 5 * S, ax + 15 * S, ay], fill=BLACK, width=round(2.4 * S))
    d.line([ax + 10 * S, ay + 5 * S, ax + 15 * S, ay], fill=BLACK, width=round(2.4 * S))
    d.text((x0 + (27 + 19 + 11) * S, y0 + ph // 2), label, font=pill, fill=BLACK, anchor="lm")

    # the live host, bottom right
    dom = geist(21, 400)
    d.text(((W - 88) * S, (H - 98) * S), "hypjam.com", font=dom, fill=(118, 118, 118), anchor="rs")

    out = os.path.join(ROOT, "assets/brand/og.png")
    img.resize((W, H), Image.LANCZOS).save(out, "PNG", optimize=True)
    print(f"og.png written: {W}x{H}, {os.path.getsize(out):,} bytes")


if __name__ == "__main__":
    main()
