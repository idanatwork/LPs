import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HDate, Location, Zmanim, months } from "@hebcal/core";
import { statusForHDate } from "../tefila/day-status.mjs";
import { ORANIT, computeFromSun, formatHM } from "../tefila/zmanim-calc.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "watch", "zmanim");
const DAYS = 400;
const SHORT = [
  ["alot", "עלות"],
  ["misheyakir", "משיכיר"],
  ["sunrise", "נץ"],
  ["shemaMGA", "ק״ש מג״א"],
  ["shemaGRA", "ק״ש גר״א"],
  ["tefillaMGA", "תפילה מג״א"],
  ["tefillaGRA", "תפילה גר״א"],
  ["chatzot", "חצות"],
  ["minchaGedola", "מנחה גדולה"],
  ["minchaKetana", "מנחה קטנה"],
  ["plag", "פלג"],
  ["sunset", "שקיעה"],
  ["tzeit", "צאת"],
  ["rabbeinuTam", "ר״ת"],
];

function jerusalemParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ORANIT.tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

function whenOffset(offset) {
  const { y, m, d } = jerusalemParts();
  return new Date(Date.UTC(y, m - 1, d + offset, 10, 0, 0));
}

function iso(when) {
  const y = when.getUTCFullYear();
  const m = String(when.getUTCMonth() + 1).padStart(2, "0");
  const day = String(when.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function textFor(when) {
  const loc = new Location(ORANIT.lat, ORANIT.lon, true, ORANIT.tz, "Oranit", "IL");
  const sun = new Zmanim(loc, when, false);
  const times = computeFromSun(sun.sunrise(), sun.sunset());
  const hd = new HDate(when);
  const status = statusForHDate(hd, "shacharit");
  const lines = [status.hebrewDate, status.chips.join(" · "), ""];
  for (const [key, label] of SHORT) lines.push(`${label} ${formatHM(times[key])}`);
  const weekday = hd.greg().getUTCDay();
  if (weekday === 5) lines.push(`נרות ${formatHM(times.candles)}`);
  if (weekday === 6) lines.push(`הבדלה ${formatHM(times.tzeit)}`);
  if (status.flags.fast) {
    const tisha = hd.getMonth() === months.AV && hd.getDate() === 9;
    lines.push(tisha ? "צום מתחיל אמש בשקיעה" : `תחילת צום ${formatHM(times.alot)}`);
    lines.push(`סוף צום ${formatHM(times.tzeit)}`);
  }
  return `\uFEFF${lines.join("\n")}\n`;
}

mkdirSync(dir, { recursive: true });
const keep = new Set();
let todayText = "";
for (let i = 0; i < DAYS; i++) {
  const when = whenOffset(i);
  const name = `${iso(when)}.txt`;
  keep.add(name);
  const body = textFor(when);
  if (i === 0) todayText = body;
  writeFileSync(join(dir, name), body, "utf8");
}
for (const name of readdirSync(dir)) {
  if (!keep.has(name)) unlinkSync(join(dir, name));
}
writeFileSync(join(root, "watch", "zmanim.txt"), todayText, "utf8");
console.log(`wrote ${DAYS} days and watch/zmanim.txt for ${iso(whenOffset(0))}`);
