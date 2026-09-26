#!/usr/bin/env python3
"""build_platform_wordmarks.py — set the six platform wordmarks in Inter 500.

The wordmarks exist in three places that must agree:
  assets/img/platforms/<name>.svg   standalone files, used by the hero marquee;
                                    each embeds its own subset font
  src/partials/icons.html           the #wm-* sprite symbols (use the page's fonts)
  src/partials/platforms-row.html   <svg viewBox> wrappers around <use href="#wm-*">

Geometry: a 36px icon lane, then the word at x=36, 26px, weight 500,
letter-spacing -0.26. The viewBox width is 36 + the word's rendered length,
rounded up to 0.1px. Lengths are measured in Chrome with SVG
getComputedTextLength() on the shipped Inter latin file at wght 500 (so
kerning is included — summing advance widths overshoots by up to 7px).
Re-measure with: node <scratch>/measure-wm.js if the words or font change.

Each standalone SVG embeds Inter pinned to wght 500 and subset to the glyphs
of its own word (a few KB), so the file renders identically anywhere.

Run: python3 tools/build_platform_wordmarks.py
"""
import base64, io, math, os, re
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INTER = os.path.join(HERE, "assets/fonts/inter-1dc044f4.woff2")  # latin, wght 100-900
STACK = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"

# name -> (word, Chrome-measured length at Inter 500 26px ls -0.26)
WORDS = {
    "tiktok":    ("TikTok",          80.23),
    "instagram": ("Instagram Reels", 194.97),
    "youtube":   ("YouTube Shorts",  192.45),
    "snapchat":  ("Snapchat",        115.45),
    "pinterest": ("Pinterest",       108.06),
    "meta":      ("Meta Ads",        115.91),
}


def vb_width(length):
    return math.ceil((36 + length) * 10 - 1e-6) / 10


def inter_500_subset(text):
    font = TTFont(INTER)
    font = instancer.instantiateVariableFont(font, {"wght": 500})
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.desubroutinize = True
    opts.layout_features = ["kern", "liga"]
    opts.notdef_outline = False
    opts.drop_tables += ["DSIG", "STAT", "fvar", "gvar", "avar", "HVAR", "MVAR"]
    sub = subset.Subsetter(options=opts)
    sub.populate(text=text)
    sub.subset(font)
    buf = io.BytesIO(); font.flavor = "woff2"; font.save(buf)
    return base64.b64encode(buf.getvalue()).decode()


def fmt(n):
    return f"{n:.1f}".rstrip("0").rstrip(".") if n != int(n) else f"{int(n)}"


def main():
    widths = {}
    # 1 · standalone SVGs
    for name, (word, length) in WORDS.items():
        path = os.path.join(HERE, "assets/img/platforms", f"{name}.svg")
        s = open(path, encoding="utf-8").read()
        w = vb_width(length); widths[name] = w
        before = len(s.encode())
        face = ('@font-face{font-family:"Inter";font-style:normal;font-weight:500;font-display:swap;'
                f'src:url(data:font/woff2;base64,{inter_500_subset(word)}) format("woff2")}}')
        s = re.sub(r"<style>.*?</style>", f"<style>{face}</style>", s, count=1, flags=re.S)
        s = re.sub(r'viewBox="0 0 [\d.]+ 32" width="[\d.]+"', f'viewBox="0 0 {fmt(w)} 32" width="{fmt(w)}"', s, count=1)
        s = re.sub(r'(<text[^>]*?)font-family="[^"]*"', rf'\1font-family="{STACK}"', s, count=1)
        assert f'viewBox="0 0 {fmt(w)} 32"' in s and '"Inter"' in s, name
        open(path, "w", encoding="utf-8").write(s)
        print(f"  {name:10s} {word!r:18s} width {fmt(w):>6}  {before:>6,} -> {len(s.encode()):>6,} bytes")

    # 2 · sprite symbols
    p = os.path.join(HERE, "src/partials/icons.html")
    s = open(p, encoding="utf-8").read()
    for name, w in widths.items():
        s, n = re.subn(rf'(<symbol id="wm-{name}" viewBox="0 0 )[\d.]+( 32")', rf"\g<1>{fmt(w)}\2", s)
        assert n == 1, f"icons.html wm-{name}: {n}"
    s, n = re.subn(r'font-family="Geist, [^"]*"', f'font-family="{STACK}"', s)
    open(p, "w", encoding="utf-8").write(s)
    print(f"  icons.html: 6 symbol widths, {n} text font stacks")

    # 3 · platforms row wrappers
    p = os.path.join(HERE, "src/partials/platforms-row.html")
    s = open(p, encoding="utf-8").read()
    for name, w in widths.items():
        s, n = re.subn(rf'viewBox="0 0 [\d.]+ 32"(\s+role="img"[^>]*>\s*<use href="#wm-{name}")', rf'viewBox="0 0 {fmt(w)} 32"\1', s)
        assert n == 1, f"platforms-row wm-{name}: {n}"
    open(p, "w", encoding="utf-8").write(s)
    print("  platforms-row.html: 6 wrapper widths")


if __name__ == "__main__":
    main()
