#!/usr/bin/env python3
"""subset_platform_svgs.py — shrink the platform wordmark SVGs.

Each of the six platform logos in the hero marquee embeds a full copy of the
Geist latin subset (~29KB) purely to set one word. Six byte-identical copies,
all above the fold. This subsets each embedded font to the handful of glyphs
its own <text> actually uses, which leaves rendering identical.

Run: python3 tools/subset_platform_svgs.py
"""
import base64, glob, io, os, re, sys
from fontTools import subset
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SVGS = sorted(glob.glob(os.path.join(HERE, "assets/img/platforms/*.svg")))
FONT_RE = re.compile(r"(src:url\(data:font/woff2;base64,)([A-Za-z0-9+/=]+)(\))")
TEXT_RE = re.compile(r"<text[^>]*>([^<]*)</text>")


def main():
    before = after = 0
    for path in SVGS:
        s = open(path, encoding="utf-8").read()
        before += len(s.encode())
        fm, tm = FONT_RE.search(s), TEXT_RE.search(s)
        if not fm or not tm:
            print(f"  {os.path.basename(path):18s} skipped (no font or no <text>)"); continue
        chars = "".join(sorted(set(tm.group(1))))

        font = TTFont(io.BytesIO(base64.b64decode(fm.group(2))))
        opts = subset.Options()
        opts.flavor = "woff2"
        opts.desubroutinize = True
        opts.layout_features = ["kern", "liga"]
        opts.notdef_outline = False
        opts.drop_tables += ["DSIG"]
        sub = subset.Subsetter(options=opts)
        sub.populate(text=chars)
        sub.subset(font)

        buf = io.BytesIO(); font.flavor = "woff2"; font.save(buf)
        s2 = s[:fm.start(2)] + base64.b64encode(buf.getvalue()).decode() + s[fm.end(2):]
        open(path, "w", encoding="utf-8").write(s2)
        after += len(s2.encode())
        print(f"  {os.path.basename(path):18s} {len(s.encode()):>7,} -> {len(s2.encode()):>6,} bytes  (glyphs: {chars!r})")

    print(f"\ntotal {before:,} -> {after:,} bytes  ({before - after:,} saved)")


if __name__ == "__main__":
    main()
