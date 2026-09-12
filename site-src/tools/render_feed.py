#!/usr/bin/env python3
"""render_feed.py — writes an RSS 2.0 feed for the hypjam blog.

Source of truth: content/blog.json (the same file tools/render_blog.py reads
for the /blog index and article pages — title/description/date/slug/href are
read verbatim from there, nothing here is invented). Standard library only.

Writes: dist/feed.xml
  channel: title "hypjam blog", link https://hypjam.vercel.app/blog,
           description = content/blog.json's own meta description.
  one <item> per article: title, link (/blog/<slug>), description (the
  article's own meta description), pubDate (RFC-822, from the article's
  real `date` field), guid (the article's canonical URL).

--- IMPORTANT build-order note for whoever wires this into build.py ---
build.py's main() runs `run_renderers()` (every tools/render_*.py, this file
included) BEFORE `copy_assets()`, and copy_assets() unconditionally does
`shutil.rmtree(DIST)` then `DIST.mkdir(parents=True)` to give every build a
clean slate. That means *anything* a tools/render_*.py script writes into
dist/ during the renderer pass — this script's dist/feed.xml included — is
deleted a few lines later in the same `python3 build.py` run, before it
reaches the copy of assets, page-build or sitemap steps. This script still
defensively creates dist/ and writes feed.xml (mkdir(parents=True,
exist_ok=True) below) so it behaves correctly whenever it runs standalone or
after copy_assets() has already run (e.g. `python3 build.py && python3
tools/render_feed.py`) — but a single `python3 build.py` invocation will NOT
end with dist/feed.xml present until build.py itself (owned by another
agent, not edited here per the file-ownership rule) either moves this
script's effect to run after copy_assets(), or copies feed.xml the way
copy_root_files() already copies robots.txt/vercel.json/favicon.ico. Flagged
in this task's report — not a bug in this file, a build.py ordering gap.
"""

from __future__ import annotations

import datetime as dt
import email.utils as eut
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "content"
DIST = ROOT / "dist"
BASE_URL = "https://hypjam.vercel.app"


def esc(s) -> str:
    """Escape text for an RSS element body (not an attribute)."""
    return html.escape(str(s), quote=False)


def rfc822_date(date_str: str) -> str:
    """content/blog.json article dates are 'YYYY-MM' (month precision only —
    no specific publication day is tracked or shown anywhere on the site).
    Use the 1st of that real month rather than inventing a day; email.utils
    computes the correct real-calendar weekday and formats proper RFC-822/
    RFC-5322. A full 'YYYY-MM-DD' is also accepted, unchanged, in case a
    future article records one."""
    date_str = date_str.strip()
    m = re.match(r"^(\d{4})-(\d{2})$", date_str)
    if m:
        year, month = int(m.group(1)), int(m.group(2))
        d = dt.datetime(year, month, 1, tzinfo=dt.timezone.utc)
    else:
        d = dt.datetime.fromisoformat(date_str)
        if d.tzinfo is None:
            d = d.replace(tzinfo=dt.timezone.utc)
    return eut.format_datetime(d, usegmt=True)


def build_feed() -> tuple[str, int]:
    blog = json.loads((CONTENT / "blog.json").read_text(encoding="utf-8"))
    articles = blog["articles"]
    channel_link = BASE_URL + blog["meta"]["path"]  # /blog
    channel_desc = blog["meta"]["description"]  # already an honest, real line
    now = eut.format_datetime(dt.datetime.now(dt.timezone.utc), usegmt=True)

    items = []
    for a in articles:
        link = BASE_URL + a["href"]
        items.append(
            "    <item>\n"
            f"      <title>{esc(a['title'])}</title>\n"
            f"      <link>{esc(link)}</link>\n"
            f"      <description>{esc(a['description'])}</description>\n"
            f"      <pubDate>{rfc822_date(a['date'])}</pubDate>\n"
            f'      <guid isPermaLink="true">{esc(link)}</guid>\n'
            "    </item>"
        )

    xml = "\n".join([
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0">',
        "  <channel>",
        "    <title>hypjam blog</title>",
        f"    <link>{esc(channel_link)}</link>",
        f"    <description>{esc(channel_desc)}</description>",
        "    <language>en-gb</language>",
        f"    <lastBuildDate>{now}</lastBuildDate>",
        "\n".join(items),
        "  </channel>",
        "</rss>",
        "",
    ])
    return xml, len(articles)


def main() -> int:
    xml, count = build_feed()
    DIST.mkdir(parents=True, exist_ok=True)
    out = DIST / "feed.xml"
    out.write_text(xml, encoding="utf-8")
    print(f"wrote dist/feed.xml ({count} items)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
