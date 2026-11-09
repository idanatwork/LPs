#!/usr/bin/env python3
"""Insert minyan-only blocks and build bracha pages from the Sefaria Edot HaMizrach dump."""
from __future__ import annotations

import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEF = Path("/tmp/sef")
SRC = {
    "pesukei": "https://www.sefaria.org/Siddur_Edot_HaMizrach%2C_Weekday_Shacharit%2C_Pesukei_D'Zimra",
    "shamida": "https://www.sefaria.org/Siddur_Edot_HaMizrach%2C_Weekday_Shacharit%2C_Amida",
    "torah": "https://www.sefaria.org/Siddur_Edot_HaMizrach%2C_Weekday_Shacharit%2C_Torah_Reading",
    "shvidui": "https://www.sefaria.org/Siddur_Edot_HaMizrach%2C_Weekday_Shacharit%2C_Vidui",
    "arvitb": "https://www.sefaria.org/Siddur_Edot_HaMizrach%2C_Weekday_Arvit%2C_Barchu",
    "arvitam": "https://www.sefaria.org/Siddur_Edot_HaMizrach%2C_Weekday_Arvit%2C_Amidah",
    "alham": "https://www.sefaria.org/Siddur_Edot_HaMizrach%2C_Al_Hamihya",
    "bhm": "https://www.sefaria.org/Siddur_Edot_HaMizrach%2C_Post_Meal_Blessing",
}


def paras(name: str) -> dict[int, str]:
    raw = (SEF / f"{name}.txt").read_text(encoding="utf-8")
    found = re.findall(r"----- (\d+) -----\n(.*?)(?=\n----- \d+ -----|\Z)", raw, re.S)
    return {int(n): t.strip() for n, t in found}


def fix_paren(text: str) -> str:
    return re.sub(
        r"(ב[\u0591-\u05C7]*י[\u0591-\u05C7]*ו[\u0591-\u05C7]*ם) ביום טוב:\s*(טו[\u0591-\u05C7]*ב)",
        r"\1 (ביום טוב: \2)",
        text,
    )


def pieces(text: str):
    text = fix_paren(text)
    for prefix in ("בראש־חודש", "בראש־השנה"):
        if text.startswith(prefix + " "):
            return [("note", prefix), ("t", text[len(prefix):].strip())]
    m = re.search(r"[\u0591-\u05C7]", text)
    if not m:
        return [("note", text)]
    i = m.start()
    while i > 0 and text[i - 1] not in " \n":
        i -= 1
    note, rest = text[:i].strip(), text[i:].strip()
    out = []
    if note:
        out.append(("note", note))
    if rest:
        out.append(("t", rest))
    return out


def body(text: str) -> str:
    return "".join(
        f'<p class="{kind}">{html.escape(value)}</p>' for kind, value in pieces(text)
    )


def block(title: str, texts: list[str], source: str, extra: str = "") -> str:
    inner = "".join(body(t) for t in texts)
    return (
        f'<section class="minyan-only" data-source="{html.escape(source)}"{extra}>'
        f'<p class="minyan-label">במניין</p><h3>{html.escape(title)}</h3>{inner}'
        f'<p class="src"><a href="{html.escape(source)}">ספריא</a></p></section>\n'
    )


def insert_once(path: Path, marker: str, snippet: str, anchor: str) -> None:
    text = path.read_text(encoding="utf-8")
    if marker in text:
        return
    if anchor not in text:
        raise SystemExit(f"{path.name}: missing anchor {anchor[:80]}")
    text = text.replace(anchor, f"<!-- {marker} -->\n" + snippet + anchor, 1)
    path.write_text(text, encoding="utf-8")


def shell(title: str, apple: str, service_attr: str, main: str, toc: str) -> str:
    return """<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="__APPLE__">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" id="theme-color" content="#fdfbf6">
<link rel="apple-touch-icon" sizes="180x180" href="../tefila/icon-tefila.png">
<link rel="icon" type="image/png" href="../tefila/icon-tefila.png">
<link rel="manifest" href="../tefila/index.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;700&amp;display=swap" rel="stylesheet">
<link rel="stylesheet" href="../tefila/tefila.css">
<title>__TITLE__</title>
<script type="importmap">
{
  "imports": {
    "@hebcal/core": "https://cdn.jsdelivr.net/npm/@hebcal/core@6.15.0/+esm"
  }
}
</script>
<script src="../tefila/boot.js"></script>
</head>
<body __ATTR__>
<header class="bar">
  <div class="brand"><a href="../tefila/">בית</a><strong>__APPLE__</strong></div>
  <div class="szs">
    <button type="button" id="minyan-toggle" aria-pressed="false">יחיד</button>
    <button type="button" id="theme-toggle" aria-label="מצב כהה"><svg class="moon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M21 14.5A8.5 8.5 0 0 1 9.5 3a7 7 0 1 0 11.5 11.5z"/></svg><svg class="sun" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></g></svg></button>
    <button type="button" id="font-dec" aria-label="הקטן אות">א−</button>
    <button type="button" id="font-inc" aria-label="הגדל אות">א+</button>
  </div>
</header>
<main>
<p class="kicker">__TITLE__</p>
<div class="sep"></div>
<div class="today" id="today-banner" hidden><p class="date"></p><p class="status"></p><p class="extra" hidden></p></div>
<nav class="toc" id="toc" aria-label="תוכן">__TOC__</nav>
__MAIN__
</main>
<a class="to-toc" href="#toc">תוכן</a>
<script src="../tefila/controls.js"></script>
<script type="module" src="../tefila/bracha-page.mjs"></script>
</body>
</html>
""".replace("__TITLE__", title).replace("__APPLE__", apple).replace("__ATTR__", service_attr).replace("__TOC__", toc).replace("__MAIN__", main)


def spoken(text: str, marker: str) -> str:
    if marker not in text:
        return text.strip()
    return text.split(marker, 1)[1].strip()


def pair(text: str) -> tuple[str, str]:
    left, _, right = text.partition("של ארץ ישראל")
    return left.strip(), right.strip()


def build_meein(p) -> str:
    src = SRC["alham"]
    def sec(i):
        return body(p[i])
    openings = [
        ("m", spoken(p[2], "יאמר")),
        ("g", spoken(p[3], "יאמר")),
        ("e", spoken(p[4], "יאמר")),
    ]
    mids = [("m", *pair(spoken(p[14], "מזונות"))), ("g", *pair(spoken(p[15], "יין"))), ("e", *pair(spoken(p[16], "פירות")))]
    ends = [("m", *pair(spoken(p[18], "מזונות"))), ("g", *pair(spoken(p[19], "יין"))), ("e", *pair(spoken(p[20], "פירות")))]
    def choices(rows, prefix):
        chunks = []
        for key, chutz, baaretz in rows:
            chunks.append(
                f'<p class="t" data-food="{key}">{prefix}'
                f'<span class="chutz">{html.escape(chutz)}</span>'
                f'<span class="baaretz">{html.escape(baaretz)}</span></p>'
            )
        return "".join(chunks)
    open_html = "".join(
        f'<p class="t" data-food="{key}">{html.escape(words)}</p>' for key, words in openings
    )
    main = f'''<h2 id="m1">ברכה מעין שלוש</h2>
<p class="note">הנוסח מספריא, סידור עדות המזרח. בוחרים רק את מה שאכלו או שתו. מילות הארץ מסומנות בתוך הנוסח.</p>
<p class="t">{html.escape(p[1])}</p>
<div class="tg" id="foods">
<button type="button" data-k="m" aria-pressed="true">מזונות</button>
<button type="button" data-k="g" aria-pressed="false">יין</button>
<button type="button" data-k="e" aria-pressed="false">פירות</button>
<button type="button" id="il" aria-pressed="true">מארץ ישראל</button>
</div>
{open_html}
{sec(5)}
<details class="add" data-open="shabbat"><summary>שבת</summary>{sec(6)}</details>
<details class="add" data-open="yaaleh-rc"><summary>ראש חודש</summary>{sec(7)}</details>
<details class="add" data-open="rosh-hashana"><summary>ראש השנה</summary>{sec(8)}</details>
<details class="add" data-open="pesach"><summary>פסח</summary>{sec(9)}</details>
<details class="add" data-open="shavuot"><summary>שבועות</summary>{sec(10)}</details>
<details class="add" data-open="sukkot"><summary>סוכות</summary>{sec(11)}</details>
<details class="add" data-open="shemini-atzeret"><summary>שמיני עצרת</summary>{sec(12)}</details>
{sec(13)}
{choices(mids, "")}
{sec(17)}
{choices(ends, "")}
<p class="src"><a href="{src}">ספריא: ברכה מעין שלוש</a></p>
<script>
document.querySelectorAll(".tg button").forEach(function (b) {{
  b.addEventListener("click", function () {{
    if (b.id !== "il") {{
      var on = b.getAttribute("aria-pressed") === "true";
      b.setAttribute("aria-pressed", on ? "false" : "true");
    }} else {{
      b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true");
    }}
    paint();
  }});
}});
function paint() {{
  var keys = Array.from(document.querySelectorAll("#foods button[data-k]")).filter(function (b) {{
    return b.getAttribute("aria-pressed") === "true";
  }}).map(function (b) {{ return b.dataset.k; }});
  if (!keys.length) keys = ["m"];
  document.querySelectorAll("[data-food]").forEach(function (el) {{
    el.hidden = keys.indexOf(el.dataset.food) === -1;
  }});
  var il = document.getElementById("il").getAttribute("aria-pressed") === "true";
  document.documentElement.setAttribute("data-il", il ? "1" : "0");
}}
paint();
</script>
'''
    # The f-string above doubled braces for a normal string? I used a regular string with {{ by mistake
    # Fix: this function returns an f-string only for src. The script braces were doubled. I'll undo.
    return main


def main():
    pe, sh, ar, tor, vid = paras("pesukei"), paras("shamida"), paras("arvitam"), paras("torah"), paras("shvidui")
    al, bm = paras("alham"), paras("bhm")
    half = block("חצי קדיש", [pe[21], pe[22]], SRC["pesukei"])
    barkhu = block("ברכו", [pe[23], pe[24], pe[25]], SRC["pesukei"])
    kedusha = block(
        "קדושה — בחזרת הש״ץ",
        [sh[6], sh[7], sh[8]],
        SRC["shamida"],
    )
    note = (
        '<section class="minyan-only"><p class="minyan-label">במניין</p>'
        '<p class="note">העמידה נאמרת תחילה בלחש, ואחר כך שליח הציבור חוזר עליה. הקדושה והקטעים שלהלן הם מחזרת הש״ץ.</p></section>\n'
    )
    kohanim = block("ברכת כהנים", [sh[50], sh[53], sh[54], sh[55], sh[56], sh[57], sh[58], sh[59], sh[60]], SRC["shamida"])
    titkabal = block("קדיש תתקבל", [ar[61], ar[62], ar[63], ar[64], ar[65]], SRC["arvitam"])
    shelama = block("קדיש יהא שלמא", [ar[67], ar[68], ar[69]], SRC["arvitam"])
    torah_html = (
        '<details class="sec minyan-only" data-open="torah"><summary>הוצאת ספר תורה</summary>'
        '<p class="minyan-label">במניין</p>'
        + "".join(body(tor[i]) for i in range(1, 21))
        + f'<p class="src"><a href="{SRC["torah"]}">ספריא: סדר קריאת התורה</a></p></details>\n'
    )
    middot = block("י״ג מידות במניין", [vid[2], vid[3], vid[4]], SRC["shvidui"])
    ar_barkhu = block("ברכו", [paras("arvitb")[8], paras("arvitb")[9], paras("arvitb")[10]], SRC["arvitb"])
    ar_half = block("חצי קדיש", [paras("arvitb")[5], paras("arvitb")[6]], SRC["arvitb"])
    ar_end = block("ברכו בסיום ערבית", [ar[70], ar[71], ar[72]], SRC["arvitam"])

    root = ROOT
    insert_once(root / "tefila/shacharit.html", "minyan:shema", half + barkhu, '<h2 id="s9">קריאת שמע וברכותיה</h2>')
    insert_once(root / "tefila/shacharit.html", "minyan:chazara", note + kedusha + kohanim + titkabal, '<details class="sec" id="s11"')
    insert_once(root / "tefila/shacharit.html", "minyan:torah", torah_html, '<h2 id="s14">אשרי שלאחר העמידה</h2>')
    insert_once(root / "tefila/shacharit.html", "minyan:shelama", shelama, '<h2 id="s28">עלינו לשבח</h2>')
    insert_once(
        root / "tefila/shacharit.html",
        "minyan:middot",
        middot,
        '<p class="note">הוראה — יחיד אומר את הפסוקים הבאים בטעמי המקרא',
    )
    insert_once(root / "tefila/mincha.html", "minyan:before-amida", half, '<h2 id="s4">עמידה — תפילת לחש ליחיד</h2>')
    insert_once(root / "tefila/mincha.html", "minyan:torah", torah_html, '<h2 id="s7">עלינו לשבח</h2>')
    insert_once(root / "tefila/mincha.html", "minyan:chazara", note + kedusha + kohanim + titkabal, '<details class="sec" id="s5"')
    insert_once(root / "tefila/mincha.html", "minyan:shelama", shelama, '<h2 id="s7">עלינו לשבח</h2>')
    insert_once(root / "tefila/arvit.html", "minyan:barchu", ar_half + ar_barkhu, '<h2 id="s1">קריאת שמע וברכותיה</h2>')
    insert_once(root / "tefila/arvit.html", "minyan:end", titkabal + shelama + ar_end, '<h2 id="s3">עלינו לשבח</h2>')

    toc_m = '<a class="l2" href="#m1">ברכה מעין שלוש</a>'
    page = shell("ברכה מעין שלוש", "מעין שלוש", "", build_meein(al).replace("{{", "{").replace("}}", "}"), toc_m)
    page = page.replace('<html lang="he" dir="rtl">', '<html lang="he" dir="rtl" data-il="1">', 1)
    # build_meein used doubled braces because I wrote them in a normal string accidentally only in the script part.
    (ROOT / "brachot/meein-shalosh.html").write_text(page, encoding="utf-8")

    # Birkat hamazon
    zimun = list(range(4, 15))
    parts_html = ['<h2 id="b0">לפני ברכת המזון</h2>', body(bm[1]), body(bm[2]), body(bm[3])]
    parts_html.append('<h2 id="b1">זימון</h2><p class="note">ליחיד אין זימון. במניין, שלושה ומעלה מזמנים; בעשרה מוסיפים אלוהינו.</p>')
    parts_html.append('<section class="minyan-only" data-source="' + SRC["bhm"] + '"><p class="minyan-label">במניין</p>')
    for i in zimun:
        parts_html.append(body(bm[i]))
    parts_html.append("</section>")
    parts_html.append('<h2 id="b2">ברכת המזון</h2>')
    parts_html.append('<p class="note">ברכת המזון הולכת אחר היום העברי של הסעודה. אחרי השקיעה זה היום הבא. סעודה שלישית שנמשכה אחרי השקיעה — עדיין אומרים רצה (שולחן ערוך קפח, י).</p>')
    for i in (15, 16):
        parts_html.append(body(bm[i]))
    parts_html.append('<details class="add" data-open="chanukah purim"><summary>על הניסים</summary>' + body(bm[17]) + body(bm[18]) + body(bm[19]) + body(bm[20]) + "</details>")
    parts_html.append(body(bm[21]))
    parts_html.append(body(bm[22]))
    parts_html.append('<details class="add" data-open="shabbat"><summary>רצה — שבת</summary>' + body(bm[23]) + body(bm[24]) + "</details>")
    parts_html.append('<details class="add" data-open="yaaleh yomtov"><summary>יעלה ויבוא</summary>' + "".join(body(bm[i]) for i in range(25, 34)) + "</details>")
    for i in (34, 35):
        parts_html.append(body(bm[i]))
    parts_html.append('<details class="add" data-open="shabbat"><summary>השלמה לשבת</summary>' + "".join(body(bm[i]) for i in range(36, 38)) + "</details>")
    parts_html.append('<details class="add" data-open="yaaleh-rc"><summary>השלמה לראש חודש</summary>' + body(bm[38]) + "</details>")
    parts_html.append('<details class="add" data-open="rosh-hashana"><summary>השלמה לראש השנה</summary>' + body(bm[39]) + "</details>")
    parts_html.append('<details class="add" data-open="yomtov"><summary>השלמה ליום טוב</summary>' + body(bm[40]) + "</details>")
    parts_html.append(body(bm[41]))
    parts_html.append("<h2 id=\"b3\">הרחמן</h2>")
    parts_html.append(body(bm[42]))
    parts_html.append('<details class="add" data-open="shabbat"><summary>הרחמן לשבת</summary>' + body(bm[43]) + body(bm[44]) + "</details>")
    parts_html.append('<details class="add" data-open="yaaleh-rc"><summary>הרחמן לראש חודש</summary>' + body(bm[45]) + body(bm[46]) + "</details>")
    parts_html.append('<details class="add" data-open="rosh-hashana"><summary>הרחמן לראש השנה</summary>' + body(bm[47]) + body(bm[48]) + "</details>")
    parts_html.append('<details class="add" data-open="sukkot"><summary>הרחמן לסוכות</summary>' + body(bm[49]) + body(bm[50]) + "</details>")
    parts_html.append('<details class="add" data-open="yomtov"><summary>הרחמן למועדים</summary>' + body(bm[51]) + body(bm[52]) + body(bm[53]) + body(bm[54]) + "</details>")
    parts_html.append(body(bm[55]))
    parts_html.append("<h2 id=\"b4\">ברכת האורח</h2>")
    parts_html.append(body(bm[56]))
    parts_html.append(body(bm[57]))
    parts_html.append(body(bm[58]))
    parts_html.append(f'<p class="src"><a href="{SRC["bhm"]}">ספריא: ברכת המזון</a></p>')
    toc_b = "".join(
        f'<a class="l2" href="#{i}">{html.escape(t)}</a>'
        for i, t in [("b0", "לפני ברכת המזון"), ("b1", "זימון"), ("b2", "ברכת המזון"), ("b3", "הרחמן"), ("b4", "ברכת האורח")]
    )
    (ROOT / "brachot/birkat-hamazon.html").write_text(
        shell("ברכת המזון", "ברכת המזון", "", "".join(parts_html), toc_b),
        encoding="utf-8",
    )
    write_watch(al)
    print("liturgy written")


def short_lines(text: str, width: int = 24) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    parts = re.split(r"(?<=[,.:׃])\s+", text)
    lines: list[str] = []
    buf = ""
    for part in parts:
        if not buf:
            buf = part
        elif len(buf) + 1 + len(part) <= width:
            buf += " " + part
        else:
            lines.append(buf)
            buf = part
    if buf:
        lines.append(buf)
    return "\n".join(lines)


def plain_from_html(path: Path) -> str:
    raw = path.read_text(encoding="utf-8")
    match = re.search(r'<p class="text">(.*?)</p>', raw, re.S)
    if not match:
        raise SystemExit(f"no bracha text in {path}")
    text = re.sub(r"<[^>]+>", "", match.group(1))
    text = html.unescape(text)
    return text


def write_watch(al: dict[int, str]) -> None:
    watch = ROOT / "watch"
    watch.mkdir(exist_ok=True)
    asher = plain_from_html(ROOT / "brachot/asher-yatzar.html")
    borei = plain_from_html(ROOT / "brachot/borei-nefashot.html")
    (watch / "asher-yatzar.txt").write_text("\ufeffאשר יצר\n\n" + short_lines(asher) + "\n", encoding="utf-8")
    (watch / "borei-nefashot.txt").write_text("\ufeffבורא נפשות\n\n" + short_lines(borei) + "\n", encoding="utf-8")
    lines = ["ברכה מעין שלוש", "", short_lines(al[1]), ""]
    lines.append("(מזונות) " + spoken(al[2], "יאמר"))
    lines.append("(יין) " + spoken(al[3], "יאמר"))
    lines.append("(פירות) " + spoken(al[4], "יאמר"))
    lines.append("")
    lines.append(short_lines(al[5]))
    lines.append("")
    for n, label in (
        (6, "שבת"),
        (7, "ראש חודש"),
        (8, "ראש השנה"),
        (9, "פסח"),
        (10, "שבועות"),
        (11, "סוכות"),
        (12, "שמיני עצרת"),
    ):
        words = fix_paren(al[n])
        for prefix in ("בשבת", "בראש־חודש", "בראש־השנה", "בפסח", "בשבועות", "בסוכות", "בשמיני עצרת"):
            if words.startswith(prefix):
                words = words[len(prefix):].strip()
                break
        lines.append(f"({label}) {words}")
    lines.append("")
    lines.append(short_lines(al[13]))
    for n, label in ((14, "מזונות"), (15, "יין"), (16, "פירות")):
        left, right = pair(spoken(al[n], label if n != 14 else "מזונות"))
        # spoken() already stripped the rubric when the marker is the first word
        if n != 14:
            left, right = pair(spoken(al[n], label))
        lines.append(f"({label}) {left}")
        lines.append(f"({label}, ארץ ישראל) {right}")
    lines.append("")
    lines.append(short_lines(al[17]))
    for n, label in ((18, "מזונות"), (19, "יין"), (20, "פירות")):
        left, right = pair(spoken(al[n], label))
        lines.append(f"({label}) {left}")
        lines.append(f"({label}, ארץ ישראל) {right}")
    (watch / "meein-shalosh.txt").write_text("\ufeff" + "\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
