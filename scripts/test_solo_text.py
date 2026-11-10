#!/usr/bin/env python3
"""Solo prayer paragraphs stay byte-for-byte the same once minyan blocks are ignored."""
from __future__ import annotations

import html
import json
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class Extract(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.skip = 0
        self.stack: list[bool] = []
        self.capture = False
        self.buf: list[str] = []
        self.out: list[str] = []

    def handle_starttag(self, tag, attrs):
        cls = dict(attrs).get("class", "").split()
        started = "minyan-only" in cls
        if started:
            self.skip += 1
        self.stack.append(started)
        if self.skip == 0 and tag == "p" and ("t" in cls or "note" in cls):
            self.capture = True
            self.buf = []

    def handle_endtag(self, tag):
        if self.capture and tag == "p" and self.skip == 0:
            self.out.append("".join(self.buf))
            self.capture = False
        if self.stack and self.stack.pop():
            self.skip -= 1

    def handle_data(self, data):
        if self.capture and self.skip == 0:
            self.buf.append(data)


def main() -> int:
    baseline = json.loads((ROOT / "scripts/fixtures/solo-baseline.json").read_text(encoding="utf-8"))
    failed = 0
    for name, expected in baseline.items():
        parser = Extract()
        parser.feed((ROOT / "tefila" / name).read_text(encoding="utf-8"))
        got = parser.out
        exp = [html.unescape(item) for item in expected]
        if got == exp or "".join(got) == "".join(exp):
            print(f"OK {name}: {len(got)} solo paragraphs unchanged")
        else:
            failed += 1
            print(f"FAIL {name}: {len(exp)} baseline paragraphs, {len(got)} now")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
