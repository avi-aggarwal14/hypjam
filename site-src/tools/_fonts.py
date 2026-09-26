"""_fonts.py — the site's shipped fonts, loaded for Pillow renderers (og.png, the poster).

The site's type is 8x.social's system: Syne 600 for headlines, Inter for body and
UI, DM Mono (uppercase, tracked) for labels. The latin woff2 files under
assets/fonts/ are decoded in memory; variable fonts are pinned to the requested
weight with fontTools' instancer, which is exact (Pillow's own variation setter
depends on axis order and silently no-ops on failure).
"""
import io, os
from functools import lru_cache
from PIL import ImageFont
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = {
    "syne":  "assets/fonts/syne-5be571f9.woff2",     # latin, wght 400-800
    "inter": "assets/fonts/inter-1dc044f4.woff2",    # latin, wght 100-900
    "mono":  "assets/fonts/dm-mono-f41e4e83.woff2",  # latin, 400
    "mono500": "assets/fonts/dm-mono-0fca4fac.woff2",  # latin, 500
}


@lru_cache(maxsize=None)
def _ttf_bytes(name: str, weight: int | None) -> bytes:
    f = TTFont(os.path.join(ROOT, FILES[name]))
    if "fvar" in f and weight is not None:
        f = instancer.instantiateVariableFont(f, {"wght": weight})
    f.flavor = None
    buf = io.BytesIO(); f.save(buf)
    return buf.getvalue()


def font(name: str, px: float, weight: int | None = None) -> ImageFont.FreeTypeFont:
    """font('syne', 61*S, 600) — a Pillow font at a pixel size and weight."""
    return ImageFont.truetype(io.BytesIO(_ttf_bytes(name, weight)), round(px))


def draw_tracked(draw, xy, text, fnt, fill, tracking, anchor_baseline=False):
    """Draw text with letter-spacing (px), which Pillow lacks. Returns the end x.
    Kerning is irrelevant for the monospaced labels this is used for."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill, anchor="ls" if anchor_baseline else "la")
        x += draw.textlength(ch, font=fnt) + tracking
    return x - tracking


def tracked_width(draw, text, fnt, tracking):
    return sum(draw.textlength(ch, font=fnt) for ch in text) + tracking * (len(text) - 1)
