#!/usr/bin/env python3
"""Build tefila/*.html from the reviewed Google Docs exports.

Prayer paragraphs and gray instruction notes are copied through unchanged.
Only the markup around them is new.
"""
from __future__ import annotations

import html
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
SRC = {
    "shacharit": Path("/home/ubuntu/.cursor/projects/workspace/uploads/shacharit-export_cdd8.html"),
    "mincha": Path("/home/ubuntu/.cursor/projects/workspace/uploads/mincha-export_422b.html"),
    "arvit": Path("/home/ubuntu/.cursor/projects/workspace/uploads/arvit-export_c146.html"),
}
OUT = ROOT / "tefila"
META = {
    "shacharit": ("שחרית", "#1e3a8a"),
    "mincha": ("מנחה", "#9a3412"),
    "arvit": ("ערבית", "#312e81"),
}


class DocParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.blocks = []
        self.cur = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ("h1", "h2", "h3", "p"):
            self.cur = {"tag": tag, "parts": [], "hrefs": []}
        if tag == "span" and self.cur is not None:
            self.cur["parts"].append({"style": attrs.get("style", ""), "text": ""})
        if tag == "a" and self.cur is not None:
            href = attrs.get("href") or ""
            if href:
                self.cur["hrefs"].append(href)

    def handle_endtag(self, tag):
        if tag in ("h1", "h2", "h3", "p") and self.cur is not None:
            text = "".join(p["text"] for p in self.cur["parts"]).strip()
            styles = " ".join(p["style"] for p in self.cur["parts"])
            if text:
                self.blocks.append({
                    "tag": self.cur["tag"],
                    "text": text,
                    "note": "666666" in styles,
                    "hrefs": list(self.cur["hrefs"]),
                })
            self.cur = None

    def handle_data(self, data):
        if self.cur is None:
            return
        if not self.cur["parts"]:
            self.cur["parts"].append({"style": "", "text": ""})
        self.cur["parts"][-1]["text"] += data


def strip_nikud(s: str) -> str:
    return "".join(ch for ch in s if not (0x0591 <= ord(ch) <= 0x05C7))


def clean_url(url: str) -> str:
    if "google.com/url" in url:
        q = parse_qs(urlparse(url).query).get("q", [None])[0]
        if q:
            return unquote(q)
    return url


def classify(text: str):
    if "בעשרת ימי תשובה ובהושענא רבה" in text:
        return ("twice",)
    if "שיר המעלות ממעמקים" in text:
        return ("one", "שיר המעלות ממעמקים — בעשרת ימי תשובה", "aseret")
    if "בעשרת ימי תשובה בלבד מוסיפים" in text:
        return ("aseret",)
    if "במקום האל הקדוש" in text:
        return ("one", "המלך הקדוש — בעשרת ימי תשובה", "aseret")
    if "במקום מלך אוהב צדקה ומשפט" in text:
        return ("one", "המלך המשפט — בעשרת ימי תשובה", "aseret")
    if "במקום הנוסח הקודם" in text:
        return ("one", "עושה השלום — בעשרת ימי תשובה", "aseret")
    if "בזמן אמירת מוריד הטל" in text:
        return ("one", "מוריד הטל", "tal")
    if "בזמן אמירת משיב הרוח" in text:
        return ("one", "משיב הרוח", "geshem")
    if "בזמן אמירת ברכנו" in text:
        return ("one", "ברכנו — קיץ", "barechenu")
    if "בזמן אמירת ברך עלינו" in text:
        return ("one", "ברך עלינו — חורף", "barech")
    if "מוסיפים נחם" in text:
        return ("two", "נחם — תשעה באב", "nachem")
    if "עננו" in text and ("תענית" in text or "תשעה באב" in text):
        return ("one", "עננו — תענית", "anenu")
    if "מוסיפים יעלה ויבוא" in text:
        return ("yaaleh",)
    if "בחנוכה ובפורים" in text:
        return ("nisim",)
    if "אתה חוננתנו" in text:
        return ("one", "אתה חוננתנו — מוצאי שבת ויום טוב", "chonantanu")
    if "תוספת רשות" in text:
        return ("one", "תפילת רב — רשות, אפשר לדלג", None)
    if "למנצח יענך נאמר" in text:
        return ("one", "למנצח יענך — בימים שיש בהם תחנון", "tachanun")
    if "תפילה לדוד נאמרת" in text:
        return ("one", "תפילה לדוד — בימים שיש בהם תחנון", "tachanun")
    return ("plain",)


def aseret_label(prayer: str) -> str:
    plain = strip_nikud(prayer)
    if "זכרנו לחיים" in plain:
        return "זכרנו לחיים — בעשרת ימי תשובה"
    if "מי כמוך אב" in plain:
        return "מי כמוך אב הרחמן — בעשרת ימי תשובה"
    if "וכתב לחיים" in plain or "וכתוב לחיים" in plain:
        return "וכתוב לחיים — בעשרת ימי תשובה"
    if "ובספר חיים" in plain:
        return "ובספר חיים — בעשרת ימי תשובה"
    return "עשרת ימי תשובה"


class Page:
    def __init__(self):
        self.parts: list[str] = []
        self.toc: list[tuple[int, str, str]] = []
        self.n = 0
        self.prayers: list[str] = []
        self.notes: list[str] = []
        self.heads: list[str] = []

    def hid(self) -> str:
        self.n += 1
        return f"s{self.n}"

    def esc(self, s: str) -> str:
        return html.escape(s, quote=False)

    def note_html(self, b: dict) -> str:
        self.notes.append(b["text"])
        return f'<p class="note">{self.esc(b["text"])}</p>'

    def prayer_html(self, b: dict) -> str:
        self.prayers.append(b["text"])
        if b["hrefs"]:
            url = html.escape(clean_url(b["hrefs"][0]), quote=True)
            return f'<p class="src"><a href="{url}">{self.esc(b["text"])}</a></p>'
        return f'<p class="t">{self.esc(b["text"])}</p>'

    def heading_html(self, b: dict) -> str:
        level = int(b["tag"][1])
        hid = self.hid()
        self.toc.append((level, hid, b["text"]))
        self.heads.append(b["text"])
        return f'<h{level} id="{hid}">{self.esc(b["text"])}</h{level}>'

    def details_html(self, summary, inner, data_open=None, sec=False, heading=None, level=2, hid=None) -> str:
        idattr = ""
        if heading:
            if hid is None:
                hid = self.hid()
                self.toc.append((level, hid, heading))
                self.heads.append(heading)
            idattr = f' id="{hid}"'
            summary_html = f'<span class="src-h">{self.esc(heading)}</span>'
            if summary:
                summary_html += f'<small>{self.esc(summary)}</small>'
        else:
            summary_html = self.esc(summary or "")
        data = f' data-open="{data_open}"' if data_open else ""
        cls = "sec" if sec else "add"
        return f'<details class="{cls}"{idattr}{data}><summary>{summary_html}</summary>{inner}</details>'

    def is_prayer(self, b: dict) -> bool:
        return b["tag"] == "p" and not b["note"]


def expect_prayer(blocks, i, what):
    if i >= len(blocks) or not (blocks[i]["tag"] == "p" and not blocks[i]["note"]):
        raise SystemExit(f"{what}: expected prayer at {i}")
    return blocks[i]


def emit_one(page: Page, blocks, i, label, key):
    prayer = expect_prayer(blocks, i + 1, label or "insert")
    if label is None:
        label = aseret_label(prayer["text"])
    inner = page.note_html(blocks[i]) + page.prayer_html(prayer)
    page.parts.append(page.details_html(label, inner, key))
    return i + 2


def emit_two(page: Page, blocks, i, label, key):
    a = expect_prayer(blocks, i + 1, label)
    b = expect_prayer(blocks, i + 2, label)
    inner = page.note_html(blocks[i]) + page.prayer_html(a) + page.prayer_html(b)
    page.parts.append(page.details_html(label, inner, key))
    return i + 3


def emit_twice(page: Page, blocks, i):
    a = expect_prayer(blocks, i + 1, "twice")
    b = expect_prayer(blocks, i + 2, "twice")
    page.parts.append(page.note_html(blocks[i]))
    page.parts.append(page.prayer_html(a))
    page.parts.append(page.details_html(
        "פעם שנייה — עשרת ימי תשובה והושענא רבה",
        page.prayer_html(b),
        "twice-elohim",
    ))
    return i + 3


def emit_yaaleh(page: Page, blocks, i):
    seq = blocks[i + 1:i + 10]
    spec = [
        (False, None),
        (True, "בראש חודש"),
        (False, None),
        (True, "פסח"),
        (False, None),
        (True, "סוכות"),
        (False, None),
        (True, "המשך"),
        (False, None),
    ]
    if len(seq) != 9:
        raise SystemExit("yaaleh: short sequence")
    for b, (note, needle) in zip(seq, spec):
        if b["tag"] != "p" or b["note"] != note or (needle and needle not in b["text"]):
            raise SystemExit("yaaleh: pattern mismatch: " + b["text"][:80])
    main, n1, t1, n2, t2, n3, t3, n4, t4 = seq
    intro = page.note_html(blocks[i])
    inner = page.prayer_html(main)
    inner += page.details_html("ראש חודש", page.note_html(n1) + page.prayer_html(t1), "yaaleh-rc")
    inner += page.details_html("חול המועד פסח", page.note_html(n2) + page.prayer_html(t2), "yaaleh-pesach")
    inner += page.details_html("חול המועד סוכות", page.note_html(n3) + page.prayer_html(t3), "yaaleh-sukkot")
    inner += page.note_html(n4) + page.prayer_html(t4)
    page.parts.append(intro)
    page.parts.append(page.details_html("יעלה ויבוא — ראש חודש וחול המועד", inner, "yaaleh"))
    return i + 10


def emit_nisim(page: Page, blocks, i):
    seq = blocks[i + 1:i + 6]
    spec = [(False, None), (True, "חנוכה"), (False, None), (True, "פורים"), (False, None)]
    if len(seq) != 5:
        raise SystemExit("nisim: short sequence")
    for b, (note, needle) in zip(seq, spec):
        if b["tag"] != "p" or b["note"] != note or (needle and needle not in b["text"]):
            raise SystemExit("nisim: pattern mismatch: " + b["text"][:80])
    opening, n1, t1, n2, t2 = seq
    intro = page.note_html(blocks[i])
    inner = page.prayer_html(opening)
    inner += page.details_html("חנוכה", page.note_html(n1) + page.prayer_html(t1), "chanukah")
    inner += page.details_html("פורים", page.note_html(n2) + page.prayer_html(t2), "purim")
    page.parts.append(intro)
    page.parts.append(page.details_html("ועל הנסים — חנוכה או פורים", inner, None))
    return i + 6


def chunk_paragraphs(page: Page, blocks, j, stop_tags):
    parts = []
    while j < len(blocks) and blocks[j]["tag"] not in stop_tags:
        b = blocks[j]
        if b["tag"] == "p" and b["note"]:
            parts.append(page.note_html(b))
        elif b["tag"] == "p":
            parts.append(page.prayer_html(b))
        else:
            break
        j += 1
    return "".join(parts), j


def emit_tachanun(page: Page, blocks, i):
    heading = blocks[i]
    small = "אין אומרים בראש חודש, בכל ניסן, בחנוכה, בפורים, בל״ג בעומר, בט״ו בשבט ובלילה"
    hid = page.hid()
    page.toc.append((2, hid, heading["text"]))
    page.heads.append(heading["text"])
    i += 1
    inner = []
    while i < len(blocks) and blocks[i]["tag"] != "h2":
        b = blocks[i]
        if b["tag"] == "h3" and "שני וחמישי" in b["text"]:
            chunk, i = chunk_paragraphs(page, blocks, i + 1, {"h2"})
            inner.append(page.details_html(None, chunk, "tachanun-mw", heading=b["text"], level=3))
            continue
        if b["note"]:
            inner.append(page.note_html(b))
        elif b["tag"] == "p":
            inner.append(page.prayer_html(b))
        else:
            inner.append(page.heading_html(b))
        i += 1
    page.parts.append(page.details_html(small, "".join(inner), "tachanun", sec=True, heading=heading["text"], level=2, hid=hid))
    return i


def emit_shir(page: Page, blocks, i):
    page.parts.append(page.heading_html(blocks[i]))
    i += 1
    while i < len(blocks) and blocks[i]["note"]:
        page.parts.append(page.note_html(blocks[i]))
        i += 1
    day_i = 0
    while i < len(blocks) and blocks[i]["tag"] != "h2":
        b = blocks[i]
        if b["tag"] == "h3" and b["text"].startswith("ליום"):
            chunk, i = chunk_paragraphs(page, blocks, i + 1, {"h2", "h3"})
            key = f"weekday-{day_i}" if day_i <= 5 else None
            day_i += 1
            page.parts.append(page.details_html(None, chunk, key, heading=b["text"], level=3))
            continue
        if b["tag"] == "h3" and "חנוכה" in b["text"]:
            chunk, i = chunk_paragraphs(page, blocks, i + 1, {"h2", "h3"})
            page.parts.append(page.details_html(None, chunk, "chanukah", heading=b["text"], level=3))
            continue
        if b["tag"] in ("h2", "h3"):
            page.parts.append(page.heading_html(b))
        elif b["note"]:
            page.parts.append(page.note_html(b))
        else:
            page.parts.append(page.prayer_html(b))
        i += 1
    return i


def emit_hallel(page: Page, blocks, i):
    heading = blocks[i]
    chunk, i = chunk_paragraphs(page, blocks, i + 1, {"h2", "h3"})
    page.parts.append(page.details_html(None, chunk, "hallel", sec=True, heading=heading["text"], level=2))
    return i


def build_body(blocks):
    page = Page()
    title = blocks[0]["text"]
    if blocks[0]["tag"] != "h1":
        raise SystemExit("missing h1")
    page.heads.append(title)
    i = 1
    while i < len(blocks):
        b = blocks[i]
        if b["tag"] in ("h2", "h3"):
            if "תחנון" in b["text"]:
                i = emit_tachanun(page, blocks, i)
                continue
            if b["text"].startswith("שיר של יום"):
                i = emit_shir(page, blocks, i)
                continue
            nxt = blocks[i + 1] if i + 1 < len(blocks) else None
            if "בראש חודש" in b["text"] and nxt and nxt["note"] and "הלל" in nxt["text"]:
                i = emit_hallel(page, blocks, i)
                continue
            page.parts.append(page.heading_html(b))
            i += 1
            continue
        if b["note"]:
            kind = classify(b["text"])
            if kind[0] == "plain":
                page.parts.append(page.note_html(b))
                i += 1
                continue
            if kind[0] == "aseret":
                if i + 1 < len(blocks) and page.is_prayer(blocks[i + 1]):
                    i = emit_one(page, blocks, i, None, "aseret")
                else:
                    page.parts.append(page.note_html(b))
                    i += 1
                continue
            if kind[0] == "one":
                if i + 1 < len(blocks) and page.is_prayer(blocks[i + 1]):
                    i = emit_one(page, blocks, i, kind[1], kind[2])
                else:
                    page.parts.append(page.note_html(b))
                    i += 1
                continue
            if kind[0] == "two":
                i = emit_two(page, blocks, i, kind[1], kind[2])
                continue
            if kind[0] == "twice":
                i = emit_twice(page, blocks, i)
                continue
            if kind[0] == "yaaleh":
                i = emit_yaaleh(page, blocks, i)
                continue
            if kind[0] == "nisim":
                i = emit_nisim(page, blocks, i)
                continue
        page.parts.append(page.prayer_html(b))
        i += 1
    return title, page


def toc_html(page: Page) -> str:
    lines = ['<nav class="toc" id="toc" aria-label="תוכן העניינים"><p class="toc-title">תוכן</p>']
    for level, hid, text in page.toc:
        cls = "l2" if level == 2 else "l3"
        lines.append(f'<a class="{cls}" href="#{hid}">{html.escape(text, quote=False)}</a>')
    lines.append("</nav>")
    return "\n".join(lines)


def render(service: str, title: str, page: Page) -> str:
    short, theme = META[service]
    icon = f"icon-{service}.png"
    return f"""<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="{short}">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" id="theme-color" content="#fdfbf6">
<link rel="apple-touch-icon" sizes="180x180" href="{icon}">
<link rel="icon" type="image/png" href="{icon}">
<link rel="manifest" href="{service}.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;700&amp;display=swap" rel="stylesheet">
<link rel="stylesheet" href="tefila.css">
<title>{short}</title>
<script type="importmap">
{{
  "imports": {{
    "@hebcal/core": "https://cdn.jsdelivr.net/npm/@hebcal/core@6.15.0/+esm"
  }}
}}
</script>
<script>
(function () {{
  var theme;
  try {{ theme = localStorage.getItem("tefila-theme"); }} catch (e) {{}}
  if (theme !== "light" && theme !== "dark") {{
    theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }}
  document.documentElement.setAttribute("data-theme", theme);
  var meta = document.getElementById("theme-color");
  if (meta) meta.setAttribute("content", theme === "dark" ? "#111111" : "#fdfbf6");
  try {{
    var s = localStorage.getItem("tefila-font");
    if (s) document.documentElement.style.setProperty("--fs", Math.max(18, Math.min(40, parseInt(s, 10))) + "px");
  }} catch (e) {{}}
}})();
</script>
</head>
<body data-service="{service}">
<header class="bar">
  <div class="brand"><a href="index.html">תפילה</a><strong>{short}</strong></div>
  <div class="szs">
    <button type="button" id="theme-toggle" aria-label="מצב כהה"><svg class="moon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M21 14.5A8.5 8.5 0 0 1 9.5 3a7 7 0 1 0 11.5 11.5z"/></svg><svg class="sun" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></g></svg></button>
    <button type="button" id="font-dec" aria-label="הקטן אות">א−</button>
    <button type="button" id="font-inc" aria-label="הגדל אות">א+</button>
  </div>
</header>
<main>
<p class="kicker">{html.escape(title, quote=False)}</p>
<div class="sep"></div>
<div class="today" id="today-banner" hidden>
  <p class="date"></p>
  <p class="status"></p>
  <p class="extra" hidden></p>
</div>
{toc_html(page)}
{chr(10).join(page.parts)}
</main>
<a class="to-toc" href="#toc">תוכן</a>
<script src="controls.js"></script>
<script type="module" src="browser.mjs"></script>
</body>
</html>
"""


def check(blocks, page: Page, service: str):
    src_heads = [b["text"] for b in blocks if b["tag"].startswith("h")]
    src_notes = [b["text"] for b in blocks if b["note"]]
    src_prayers = [b["text"] for b in blocks if b["tag"] == "p" and not b["note"]]
    for name, src, out in (
        ("headings", src_heads, page.heads),
        ("notes", src_notes, page.notes),
        ("prayers", src_prayers, page.prayers),
    ):
        if src != out:
            for n, (a, b) in enumerate(zip(src, out)):
                if a != b:
                    raise SystemExit(f"{service} {name} mismatch at {n}\nSRC {a[:120]}\nOUT {b[:120]}")
            raise SystemExit(f"{service} {name} length src={len(src)} out={len(out)}")
    print(f"{service}: headings {len(src_heads)}, notes {len(src_notes)}, prayers {len(src_prayers)}, chars {sum(len(p) for p in src_prayers)}")


def main():
    OUT.mkdir(exist_ok=True)
    for service, path in SRC.items():
        parser = DocParser()
        parser.feed(path.read_text(encoding="utf-8"))
        title, page = build_body(parser.blocks)
        check(parser.blocks, page, service)
        html_text = render(service, title, page)
        (OUT / f"{service}.html").write_text(html_text, encoding="utf-8")
        for phrase in ("שׁוֹבֵר אוֹיְבִים וּמַכְנִיעַ זֵדִים", "וְעַל זִקְנֵיהֶם"):
            if phrase not in html_text:
                raise SystemExit(f"{service} missing {phrase}")
    print("wrote", ", ".join(SRC))


if __name__ == "__main__":
    try:
        main()
    except BrokenPipeError:
        sys.exit(0)
