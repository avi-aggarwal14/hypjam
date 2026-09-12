#!/usr/bin/env python3
"""md.py — a small, dependency-free Markdown → HTML converter for hypjam v2.

Ported from hypjam-brand/build_pages.py and extended for the blog + legal
renderers (tools/render_blog.py). Standard library only.

Handles exactly what the sources use (see content/blog.json "render" and
content/legal.json "render"):

  * `#`/`##`/`###`/`####` headings  → <h2 class="md-h2" id="slug"> …  (the first `# ` is stripped)
  * paragraphs, **bold**, *italic*, `code`
  * - bullet lists, 1. numbered lists
  * | pipe tables |               → <div class="md-tbl"><table class="md-table">…
  * ``` fenced code ```           → <pre class="md-pre"><code>…
  * > blockquotes, --- rules
  * [[link:PATH]] tokens          → <a href=link_map[PATH].href>link_map[PATH].label</a>
  * [text](url) links             → external http(s) links open in a new tab
                                    (rel="noopener noreferrer"); / and mailto: stay

Every element carries an `md-*` class so page CSS never needs bare element
selectors (CONTRACT §5). The text is rendered exactly as written — no
re-casing, no rewording (legal.json "case").

API
  md_to_html(text, link_map=None, strip_meta=True, strip_h1=True,
             strip_last_updated=False, lede=False) -> (html, toc)
      toc is a list of (id, text, level) for every h2/h3 emitted.
  sections(html) -> (intro_html, [(h2_html, body_html), …])
      splits rendered html at every md-h2 so a template can lay each
      section out on its own (the legal template numbers them).
  plain_text(md) -> str   (a rough text version, for descriptions/word counts)
"""

from __future__ import annotations

import html as _html
import re

__all__ = ["md_to_html", "sections", "plain_text", "slugify"]

_LINK_TOKEN = re.compile(r"\[\[link:(/[^\]]*)\]\]")
_MD_LINK = re.compile(r"\[([^\]]+)\]\((https?://[^)\s]+|/[^)\s]*|mailto:[^)\s]+)\)")
_BOLD = re.compile(r"\*\*([^*]+)\*\*")
_ITALIC = re.compile(r"(?<!\*)\*([^*\n]+)\*(?!\*)")
_CODE = re.compile(r"`([^`]+)`")
_HEADING = re.compile(r"^(#{1,4})\s+(.*)")
_UL = re.compile(r"^\s*[-*]\s+")
_OL = re.compile(r"^\s*\d+[.)]\s+")
_LIST_ANY = re.compile(r"^\s*([-*]|\d+[.)])\s+")
_TABLE_SEP = re.compile(r"^:?-{2,}:?$")
_BLOCK_START = re.compile(r"^(#{1,4}\s|\||```|>|\s*[-*]\s|\s*\d+[.)]\s)")
_RULE = re.compile(r"^\s*(---|\*\*\*)\s*$")
_FULL_BOLD_LINE = re.compile(r"^\*\*[^*]+\*\*\s*$")


def slugify(text: str) -> str:
    text = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return text or "section"


def _escape(text: str) -> str:
    return _html.escape(text, quote=False)


def _link_label(path: str, link_map) -> tuple[str, str]:
    """(href, label) for a [[link:PATH]] token."""
    if link_map and path in link_map:
        entry = link_map[path]
        if isinstance(entry, dict):
            return str(entry.get("href", path)), str(entry.get("label", path))
        return path, str(entry)
    # unknown path: keep it navigable, label from the slug
    slug = path.rstrip("/").rsplit("/", 1)[-1]
    return path, slug.replace("-", " ") or path


def _inline(text: str, link_map) -> str:
    """Inline markdown inside an already-escaped-safe string."""
    t = _escape(text)

    def tok(m: re.Match) -> str:
        href, label = _link_label(m.group(1), link_map)
        return f'<a class="md-a" href="{_html.escape(href, quote=True)}">{_escape(label)}</a>'

    t = _LINK_TOKEN.sub(tok, t)
    t = _CODE.sub(r'<code class="md-code">\1</code>', t)
    t = _BOLD.sub(r'<strong class="md-strong">\1</strong>', t)
    t = _ITALIC.sub(r'<em class="md-em">\1</em>', t)

    def link(m: re.Match) -> str:
        label, href = m.group(1), m.group(2)
        attrs = f'class="md-a" href="{_html.escape(href, quote=True)}"'
        if href.startswith("http"):
            attrs += ' target="_blank" rel="noopener noreferrer"'
        return f"<a {attrs}>{label}</a>"

    t = _MD_LINK.sub(link, t)
    return t


def md_to_html(text: str, link_map=None, strip_meta: bool = True, strip_h1: bool = True,
               strip_last_updated: bool = False, lede: bool = False):
    lines = text.replace("\r\n", "\n").split("\n")

    # --- leading strips (blog.json / legal.json "render.strip") ---
    if strip_meta and lines and lines[0].startswith("meta:"):
        lines = lines[1:]

    out: list[str] = []
    toc: list[tuple[str, str, int]] = []
    used_ids: dict[str, int] = {}
    h1_seen = False
    lede_pending = lede
    i = 0
    n = len(lines)

    def uid(base: str) -> str:
        k = used_ids.get(base, 0)
        used_ids[base] = k + 1
        return base if k == 0 else f"{base}-{k + 1}"

    while i < n:
        ln = lines[i]

        # fenced code
        if ln.startswith("```"):
            j = i + 1
            buf = []
            while j < n and not lines[j].startswith("```"):
                buf.append(lines[j])
                j += 1
            out.append('<pre class="md-pre"><code>' + _escape("\n".join(buf)) + "</code></pre>")
            i = j + 1
            continue

        # headings
        m = _HEADING.match(ln)
        if m:
            lvl = len(m.group(1))
            txt = m.group(2).strip()
            i += 1
            if lvl == 1:
                if strip_h1 and not h1_seen:
                    h1_seen = True
                    continue
                lvl = 2  # a second H1 in a body is a section heading
            sid = uid(slugify(txt))
            out.append(f'<h{lvl} class="md-h{lvl}" id="{sid}">{_inline(txt, link_map)}</h{lvl}>')
            if lvl in (2, 3):
                toc.append((sid, txt, lvl))
            lede_pending = False
            continue

        # pipe tables
        if ln.startswith("|"):
            rows = []
            while i < n and lines[i].startswith("|"):
                rows.append(lines[i])
                i += 1
            cells = [[c.strip() for c in r.strip().strip("|").split("|")] for r in rows]
            if len(cells) > 1 and all(_TABLE_SEP.match(c) for c in cells[1]):
                hdr, body = cells[0], cells[2:]
            else:
                hdr, body = None, cells
            t = '<div class="md-tbl"><table class="md-table">'
            if hdr:
                t += "<thead><tr>" + "".join(f'<th class="md-th">{_inline(c, link_map)}</th>' for c in hdr) + "</tr></thead>"
            t += "<tbody>" + "".join(
                "<tr>" + "".join(f'<td class="md-td">{_inline(c, link_map)}</td>' for c in r) + "</tr>" for r in body
            ) + "</tbody></table></div>"
            out.append(t)
            continue

        # lists
        if _UL.match(ln) or _OL.match(ln):
            ordered = bool(_OL.match(ln))
            items = []
            while i < n and _LIST_ANY.match(lines[i]):
                items.append(_LIST_ANY.sub("", lines[i], count=1))
                i += 1
            tag = "ol" if ordered else "ul"
            out.append(
                f'<{tag} class="md-{tag}">' + "".join(f'<li class="md-li">{_inline(x, link_map)}</li>' for x in items) + f"</{tag}>"
            )
            continue

        # blockquote
        if ln.startswith(">"):
            buf = []
            while i < n and lines[i].startswith(">"):
                buf.append(lines[i].lstrip("> "))
                i += 1
            out.append('<blockquote class="md-quote">' + _inline(" ".join(buf), link_map) + "</blockquote>")
            continue

        if _RULE.match(ln):
            out.append('<hr class="md-hr">')
            i += 1
            continue

        if ln.strip() == "":
            i += 1
            continue

        # paragraph: consecutive non-blank, non-block lines
        buf = []
        while i < n and lines[i].strip() and not _BLOCK_START.match(lines[i]):
            buf.append(lines[i].strip())
            i += 1

        # legal.json: drop the "**last updated: …**" paragraph (the page prints its own)
        if strip_last_updated and len(buf) == 1 and buf[0].lower().startswith("**last updated"):
            continue

        cls = "md-p"
        if lede_pending:
            cls += " md-lede"
            lede_pending = False

        # "**question?**" on its own line followed by the answer → keep the
        # question on its own line (the blog FAQ pattern) without inventing structure
        if len(buf) > 1 and _FULL_BOLD_LINE.match(buf[0]):
            first = _inline(buf[0], link_map)
            rest = _inline(" ".join(buf[1:]), link_map)
            out.append(f'<p class="{cls} md-qa">{first}<br>{rest}</p>')
        else:
            out.append(f'<p class="{cls}">' + _inline(" ".join(buf), link_map) + "</p>")

    return "\n".join(out), toc


_H2_SPLIT = re.compile(r'(?m)^(?=<h2 class="md-h2")')


def sections(rendered: str):
    """Split rendered html into (intro, [(heading_html, body_html), …])."""
    parts = _H2_SPLIT.split(rendered)
    intro = parts[0].strip() if parts else ""
    secs = []
    for part in parts[1:]:
        head, _, body = part.partition("\n")
        secs.append((head.strip(), body.strip()))
    return intro, secs


_LEDE_P = re.compile(r'\A<p class="md-p md-lede[^"]*">(.*?)</p>\n?', re.S)


def take_lede(rendered: str):
    """Split the paragraph marked by `lede=True` off the top of a body.

    Returns (lede_inner_html, remaining_body). The article template puts the
    lede under the h1, where the reference article puts its deck, so the
    paragraph must not also open the prose column.
    """
    body = rendered.lstrip("\n")
    m = _LEDE_P.match(body)
    if not m:
        return "", rendered
    return m.group(1).strip(), body[m.end():].lstrip("\n")


def plain_text(md: str) -> str:
    """Rough plain text of a markdown source (for word counts / previews)."""
    t = md.replace("\r\n", "\n")
    t = re.sub(r"^meta:.*$", "", t, flags=re.M)
    t = re.sub(r"```.*?```", "", t, flags=re.S)
    t = _LINK_TOKEN.sub(lambda m: m.group(1).rsplit("/", 1)[-1].replace("-", " "), t)
    t = _MD_LINK.sub(r"\1", t)
    t = re.sub(r"[#*`>|]", "", t)
    return re.sub(r"\s+", " ", t).strip()


if __name__ == "__main__":  # quick manual check: python3 tools/md.py file.md
    import sys
    from pathlib import Path

    src = Path(sys.argv[1]).read_text(encoding="utf-8")
    html_out, toc_out = md_to_html(src, lede=True)
    print(html_out)
    print("<!-- toc:", toc_out, "-->")
