#!/usr/bin/env python3
"""render_creator_poster.py — the creator-recruitment poster for X, LinkedIn and Instagram.

Square 1200x1200: the one shape that survives all three feeds uncropped. X crops
tall images in-feed and Instagram dislikes landscape, so square is the only size
that needs no per-platform variant.

Copy is lifted from create.hypjam.com's own welcome screen so the poster and the
page a creator lands on say the same thing. No view counts, no earnings figures,
no creator numbers: hypjam has not run a campaign yet and the poster must not
imply otherwise.

Regenerate:  python3 tools/render_creator_poster.py
Needs Pillow, fonttools and brotli (to decode the shipped woff2).
"""
import io, os
from PIL import Image, ImageDraw
from PIL import ImageFont
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AGENCY = os.path.dirname(ROOT)
S = 2                                   # supersample, downsampled at the end
W = H = 1200
INK   = (11, 11, 12)
JAM   = (255, 127, 54)
WHITE = (246, 245, 243)
DIM   = (150, 146, 142)

LATIN  = os.path.join(ROOT, "assets/fonts/geist-8740fcb6.woff2")
LOCKUP = os.path.join(AGENCY, "assets/brand/logos/hypjam-lockup-on-dark.png")


def geist(size, weight):
    f = TTFont(LATIN)
    buf = io.BytesIO(); f.flavor = None; f.save(buf); buf.seek(0)
    font = ImageFont.truetype(buf, size * S)
    try: font.set_variation_by_axes([weight])
    except Exception: pass
    return font


def main():
    img = Image.new("RGB", (W * S, H * S), INK)

    # the same orange bloom the product uses, so the poster reads as the same surface
    bloom = Image.new("RGB", (W * S, H * S), INK)
    bd = ImageDraw.Draw(bloom)
    cx, cy, rmax = int(W * S * 0.78), int(H * S * 0.10), int(W * S * 0.72)
    for i in range(56, 0, -1):
        r = rmax * i / 56
        t = (1 - i / 56) ** 2
        bd.ellipse([cx - r, cy - r, cx + r, cy + r],
                   fill=tuple(round(INK[c] + (JAM[c] - INK[c]) * t * 0.20) for c in range(3)))
    img = Image.blend(img, bloom, 1.0)
    d = ImageDraw.Draw(img)

    for y in range(0, H * S, 26 * S):
        for x in range(0, W * S, 26 * S):
            d.rectangle([x, y, x + S - 1, y + S - 1], fill=(30, 28, 27))

    M = 88                                   # page margin

    lock = Image.open(LOCKUP).convert("RGBA")
    LH = 46
    lh = LH * S; lw = round(lock.width * lh / lock.height)
    lock = lock.resize((lw, lh), Image.LANCZOS)
    img.paste(lock, (M * S, M * S), lock)

    d.text(((M + lw / S + 20) * S, (M + LH - 18) * S),
           "for creators", font=geist(19, 500), fill=JAM)

    # headline
    h1 = geist(76, 600)
    d.text((M * S, 258 * S), "Get paid for",        font=h1, fill=WHITE)
    d.text((M * S, 346 * S), "every 1,000",         font=h1, fill=WHITE)
    d.text((M * S, 434 * S), "views.",              font=h1, fill=JAM)

    sub = geist(25, 400)
    for i, line in enumerate([
        "Make videos for brands on your own account.",
        "A set rate for every 1,000 views your post gets.",
    ]):
        d.text((M * S, (566 + i * 38) * S), line, font=sub, fill=DIM)

    # three facts, each on its own rule
    fact = geist(24, 500)
    facts = ["No follower minimum",
             "You post on your own channels",
             "Rate agreed in writing before you film"]
    y = 700
    for f in facts:
        d.rectangle([M * S, y * S, (W - M) * S, y * S + S - 1], fill=(48, 45, 43))
        d.ellipse([M * S, (y + 26) * S, (M + 7) * S, (y + 33) * S], fill=JAM)
        d.text(((M + 22) * S, (y + 18) * S), f, font=fact, fill=WHITE)
        y += 66
    d.rectangle([M * S, y * S, (W - M) * S, y * S + S - 1], fill=(48, 45, 43))

    # CTA pill
    pill = geist(25, 600)
    label = "Apply at hypjam.com/apply"
    tw = d.textlength(label, font=pill)
    x0, y0 = M * S, 962 * S
    pw, ph = tw + (30 + 30 + 20 + 12) * S, 62 * S
    d.rounded_rectangle([x0, y0, x0 + pw, y0 + ph], radius=ph // 2, fill=JAM)
    ax, ay = x0 + 30 * S, y0 + ph // 2
    for seg in ([ax, ay, ax + 17 * S, ay],
                [ax + 11 * S, ay - 6 * S, ax + 17 * S, ay],
                [ax + 11 * S, ay + 6 * S, ax + 17 * S, ay]):
        d.line(seg, fill=INK, width=round(2.6 * S))
    d.text((x0 + (30 + 20 + 12) * S, y0 + ph // 2), label, font=pill, fill=INK, anchor="lm")

    d.text((M * S, (H - M - 6) * S), "hypjam · ugc agency · london",
           font=geist(20, 400), fill=(112, 108, 105), anchor="ls")

    out = os.path.join(ROOT, "assets/brand/creator-poster.png")
    img.resize((W, H), Image.LANCZOS).save(out, "PNG", optimize=True)
    print(f"written: {out}  {W}x{H}  {os.path.getsize(out):,} bytes")


if __name__ == "__main__":
    main()
