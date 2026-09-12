#!/usr/bin/env python3
"""hypjam v2 build — assembles dist/ from src/, content/ and assets/.

Standard library only. See CONTRACT.md §6 and README.md.

    python3 build.py            build everything into dist/
    python3 build.py --quiet    only print warnings and the summary

Pipeline
  1. run every tools/render_*.py (same interpreter, cwd = repo root)
  2. wipe dist/, copy assets/ -> dist/assets/
  3. concatenate src/css/*.css (+ src/panels/*.css) -> dist/assets/site.css
     concatenate src/js/*.js   (+ src/panels/*.js)  -> dist/assets/site.js
  4. expand every src/pages/**/*.html and write it to its clean URL
  5. write dist/sitemap.xml, copy robots.txt and vercel.json

Template syntax (all placeholders are expanded recursively, includes may
contain includes, content, drawing and panel tokens):

  <!-- key: value -->                 page meta; only leading comments count
  {{include:partials/x.html}}         inline src/partials/x.html
  {{content:file.a.b}}                value from content/<file>.json
  {{content:file.a.b|fallback text}}  same, with a fallback when missing
  {{drawing}}                         inline src/drawing/hq.svg
  {{panel:name}}                      inline src/panels/<name>.html
  {{page.key}} / {{page.key|fallback}} page meta (title, description, url ...)

A missing include, content key, drawing or panel never stops the build: an
HTML comment such as <!-- missing include: partials/x.html --> is emitted and
the build continues, so the site builds while partials are still being
written by other people.
"""

from __future__ import annotations

import datetime as _dt
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
PAGES = SRC / "pages"
PARTIALS = SRC / "partials"
CSS_DIR = SRC / "css"
JS_DIR = SRC / "js"
PANELS = SRC / "panels"
DRAWING = SRC / "drawing" / "hq.svg"
CONTENT = ROOT / "content"
TOOLS = ROOT / "tools"
ASSETS = ROOT / "assets"
DIST = ROOT / "dist"

BASE_URL = "https://hypjam.vercel.app"

# Built-in page meta defaults. content/site.json (if present) overrides these,
# and the page's own <!-- key: value --> comments override both.
PAGE_DEFAULTS = {
    "title": "hypjam — the UGC agency",
    "description": (
        "hypjam is a London UGC agency. Everyday creators, directed by a team, "
        "making short-form ads for TikTok, Reels and Shorts."
    ),
    "image": "/assets/brand/og.png",
    "nav": "dark",
    "nav-fill": "bg-transparent",
    "body-class": "",
    "lang": "en-GB",
    "robots": "index, follow",
    "head-extra": "",
}

MAX_DEPTH = 24

TOKEN_RE = re.compile(r"\{\{\s*(include|content|panel|page|drawing)(?::|\.)?\s*([^}]*?)\s*\}\}")
META_RE = re.compile(r"^\s*<!--\s*([A-Za-z0-9_-]+)\s*:\s*(.*?)\s*-->[ \t]*\r?\n?", re.S)

QUIET = "--quiet" in sys.argv[1:]
warnings: list[str] = []
_content_cache: dict[str, object] = {}


def log(msg: str) -> None:
    if not QUIET:
        print(msg)


def warn(msg: str) -> None:
    warnings.append(msg)
    print("  ! " + msg, file=sys.stderr)


# --------------------------------------------------------------------------
# content/*.json lookups
# --------------------------------------------------------------------------

def load_content(name: str):
    """Return the parsed content/<name>.json, or None when missing/invalid."""
    if name in _content_cache:
        return _content_cache[name]
    path = CONTENT / f"{name}.json"
    data = None
    if path.is_file():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:  # pragma: no cover - reported, not fatal
            warn(f"content/{name}.json is not valid JSON: {exc}")
    _content_cache[name] = data
    return data


def walk(data, keys: list[str]):
    """Follow a dotted path through dicts and lists. Returns (found, value)."""
    cur = data
    for key in keys:
        if isinstance(cur, dict):
            if key not in cur:
                return False, None
            cur = cur[key]
        elif isinstance(cur, list):
            try:
                cur = cur[int(key)]
            except (ValueError, IndexError):
                return False, None
        else:
            return False, None
    return True, cur


def scalar(value) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float, str)):
        return str(value)
    return json.dumps(value, ensure_ascii=False)


def content_token(arg: str, where: str) -> str:
    """{{content:file.a.b}} or {{content:file.a.b|fallback}}"""
    path, _, fallback = arg.partition("|")
    path = path.strip()
    parts = path.split(".") if path else []
    if not parts or not parts[0]:
        warn(f"{where}: empty content path")
        return "<!-- missing content: (empty) -->"
    data = load_content(parts[0])
    if data is None:
        if fallback:
            return fallback.strip()
        warn(f"{where}: content/{parts[0]}.json not found (for {path})")
        return f"<!-- missing content: {path} -->"
    found, value = walk(data, parts[1:])
    if not found:
        if fallback:
            return fallback.strip()
        warn(f"{where}: content key not found: {path}")
        return f"<!-- missing content: {path} -->"
    return scalar(value)


# --------------------------------------------------------------------------
# page meta (leading <!-- key: value --> comments)
# --------------------------------------------------------------------------

def split_meta(text: str) -> tuple[dict[str, str], str]:
    meta: dict[str, str] = {}
    while True:
        m = META_RE.match(text)
        if not m:
            break
        meta[m.group(1).strip().lower()] = m.group(2).strip()
        text = text[m.end():]
    return meta, text


def site_defaults() -> dict[str, str]:
    defaults = dict(PAGE_DEFAULTS)
    site = load_content("site")
    if isinstance(site, dict):
        for key, value in site.items():
            if isinstance(value, (str, int, float)):
                defaults[str(key).lower()] = str(value)
    return defaults


# --------------------------------------------------------------------------
# template expansion
# --------------------------------------------------------------------------

def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def expand(text: str, page: dict[str, str], where: str, depth: int = 0) -> str:
    if depth > MAX_DEPTH:
        warn(f"{where}: include depth > {MAX_DEPTH}; stopping recursion")
        return text

    def repl(m: re.Match) -> str:
        kind, arg = m.group(1), (m.group(2) or "").strip()
        if kind == "include":
            rel = arg.lstrip("/")
            path = (SRC / rel).resolve()
            if not path.is_file():
                warn(f"{where}: missing include: {rel}")
                return f"<!-- missing include: {rel} -->"
            try:
                path.relative_to(SRC.resolve())
            except ValueError:
                warn(f"{where}: include outside src/: {rel}")
                return f"<!-- missing include: {rel} -->"
            return expand(read_text(path), page, rel, depth + 1)
        if kind == "content":
            return expand(content_token(arg, where), page, where, depth + 1)
        if kind == "panel":
            name = arg.strip("/").removesuffix(".html")
            path = PANELS / f"{name}.html"
            if not path.is_file():
                warn(f"{where}: missing panel: {name}")
                return f"<!-- missing panel: {name} -->"
            return expand(read_text(path), page, f"panels/{name}.html", depth + 1)
        if kind == "drawing":
            if not DRAWING.is_file():
                warn(f"{where}: missing drawing: src/drawing/hq.svg")
                return "<!-- missing drawing: src/drawing/hq.svg -->"
            return read_text(DRAWING)
        if kind == "page":
            key, _, fallback = arg.partition("|")
            key = key.strip().lower()
            if key in page and page[key] != "":
                return page[key]
            if fallback:
                return fallback.strip()
            if key not in page:
                warn(f"{where}: unknown page meta: {key}")
            return ""
        return m.group(0)

    return TOKEN_RE.sub(repl, text)


# --------------------------------------------------------------------------
# steps
# --------------------------------------------------------------------------

def run_renderers() -> None:
    scripts = sorted(TOOLS.glob("render_*.py")) if TOOLS.is_dir() else []
    if not scripts:
        log("renderers: none")
        return
    for script in scripts:
        log(f"renderer: {script.relative_to(ROOT)}")
        try:
            result = subprocess.run(
                [sys.executable, str(script)], cwd=str(ROOT), check=False,
                capture_output=QUIET, text=True,
            )
        except OSError as exc:
            warn(f"could not run {script.name}: {exc}")
            continue
        if result.returncode != 0:
            warn(f"{script.name} exited with {result.returncode}")
            if QUIET and result.stderr:
                print(result.stderr.strip(), file=sys.stderr)


def copy_assets() -> None:
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)
    if ASSETS.is_dir():
        shutil.copytree(ASSETS, DIST / "assets", dirs_exist_ok=True)
        log("assets: copied")
    else:
        (DIST / "assets").mkdir()
        warn("assets/ not found")


def concat(sources: list[Path], out: Path, comment: str) -> None:
    parts = []
    for path in sources:
        rel = path.relative_to(ROOT)
        parts.append(f"{comment[0]} ---- {rel} ---- {comment[1]}\n{read_text(path).rstrip()}\n")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(parts), encoding="utf-8")
    log(f"{out.relative_to(ROOT)}: {len(sources)} file(s)")


def bundle_css_js() -> None:
    css = sorted(CSS_DIR.glob("*.css")) if CSS_DIR.is_dir() else []
    css += sorted(PANELS.glob("*.css")) if PANELS.is_dir() else []
    js = sorted(JS_DIR.glob("*.js")) if JS_DIR.is_dir() else []
    js += sorted(PANELS.glob("*.js")) if PANELS.is_dir() else []
    concat(css, DIST / "assets" / "site.css", ("/*", "*/"))
    concat(js, DIST / "assets" / "site.js", ("/*", "*/"))


def page_targets(src: Path) -> tuple[list[Path], str]:
    """Where a page template is written, and its clean URL path."""
    rel = src.relative_to(PAGES)
    if rel.parent == Path(".") and rel.name == "404.html":
        # Vercel picks up a root-level 404.html as the custom not-found page;
        # the /404/index.html copy makes the URL work on any static server.
        return [DIST / "404.html", DIST / "404" / "index.html"], "/404"
    if rel.name == "index.html":
        folder = rel.parent
        url = "/" if folder == Path(".") else "/" + folder.as_posix()
        return [DIST / folder / "index.html"], url
    folder = rel.with_suffix("")
    return [DIST / folder / "index.html"], "/" + folder.as_posix()


def build_pages() -> list[str]:
    urls: list[str] = []
    if not PAGES.is_dir():
        warn("src/pages/ not found; no pages written")
        return urls
    defaults = site_defaults()
    for src in sorted(PAGES.rglob("*.html")):
        rel = src.relative_to(ROOT).as_posix()
        meta, body = split_meta(read_text(src))
        targets, url = page_targets(src)
        page = dict(defaults)
        page.update(meta)
        page["url"] = url
        page["path"] = url
        page["canonical"] = BASE_URL + url
        # meta values may themselves use {{content:...}} (e.g. a title kept in JSON)
        for key, value in list(page.items()):
            if "{{" in value:
                page[key] = expand(value, page, f"{rel} <!-- {key} -->")
        html = expand(body, page, rel)
        leftover = TOKEN_RE.findall(html)
        if leftover:
            warn(f"{rel}: unresolved placeholders: {[x[0] + ':' + x[1] for x in leftover][:5]}")
        for out in targets:
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(html, encoding="utf-8")
        log(f"page: {rel} -> {targets[0].relative_to(ROOT)}  ({url})")
        if url != "/404":
            urls.append(url)
    return urls


def write_sitemap(urls: list[str]) -> None:
    today = _dt.date.today().isoformat()
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for url in sorted(set(urls), key=lambda u: (u != "/", u)):
        lines.append(f"  <url><loc>{BASE_URL}{url}</loc><lastmod>{today}</lastmod></url>")
    lines.append("</urlset>\n")
    (DIST / "sitemap.xml").write_text("\n".join(lines), encoding="utf-8")
    log(f"sitemap: {len(set(urls))} url(s)")


def copy_root_files() -> None:
    for name in ("robots.txt", "vercel.json"):
        path = ROOT / name
        if path.is_file():
            shutil.copy2(path, DIST / name)
        else:
            warn(f"{name} not found at repo root")
    # browsers request /favicon.ico by default, so serve one at the root too
    ico = ROOT / "assets" / "brand" / "favicon.ico"
    if ico.is_file():
        shutil.copy2(ico, DIST / "favicon.ico")
    else:
        warn("assets/brand/favicon.ico not found")


def main() -> int:
    log(f"building {ROOT.name} -> dist/")
    run_renderers()
    copy_assets()
    bundle_css_js()
    urls = build_pages()
    write_sitemap(urls)
    copy_root_files()
    print(f"done: {len(urls)} page(s), {len(warnings)} warning(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
