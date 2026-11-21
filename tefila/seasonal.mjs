import { HDate, HebrewCalendar, Location, Zmanim, flags, months } from "@hebcal/core";
import { ORANIT, computeFromSun, formatHM } from "./zmanim-calc.mjs";
import { daysLeftText, levanaDone, levanaState } from "./levana.mjs?v=62";
import { omerNumber } from "./omer.mjs?v=62";

/**
 * Seasonal reminders. Every provider returns null (nothing to show now) or a card:
 *   { id, title, text, href, hrefLabel, doneKey?, doneValue? }
 * doneKey/doneValue: when localStorage[doneKey] === doneValue the card is hidden ("done" for this window).
 * Add a provider to PROVIDERS to add a reminder.
 */

const FASTS = {
  "Tzom Gedaliah": "צום גדליה",
  "Asara B'Tevet": "צום עשרה בטבת",
  "Ta'anit Esther": "תענית אסתר",
  "Tzom Tammuz": "צום י״ז בתמוז",
  "Tish'a B'Av": "תשעה באב",
};

const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function sunTimes(date) {
  const loc = new Location(ORANIT.lat, ORANIT.lon, true, ORANIT.tz, "Oranit", "IL");
  const sun = new Zmanim(loc, date, false);
  return computeFromSun(sun.sunrise(), sun.sunset());
}

export function isDone(item) {
  if (!item || !item.doneKey) return false;
  try { return localStorage.getItem(item.doneKey) === item.doneValue; } catch (e) { return false; }
}

export function markDone(item) {
  if (!item || !item.doneKey) return;
  try { localStorage.setItem(item.doneKey, item.doneValue); } catch (e) {}
}

function levanaItem(now) {
  const s = levanaState(now);
  if (!s.inWindow) return null;
  return {
    id: "levana",
    title: "ברכת הלבנה",
    text: daysLeftText(s.daysLeft) + ". בסוף הנוסח יש כפתור ״בירכתי״ והתזכורת תיעלם.",
    href: "birkat-halevana.html",
    hrefLabel: "לנוסח הברכה",
    doneKey: "tefila-levana-done",
    doneValue: s.key,
  };
}

export function ilanotItem(now, force) {
  const hd = new HDate(now);
  const year = hd.getFullYear();
  const key = String(year);
  const item = {
    id: "ilanot",
    title: "ברכת האילנות",
    href: "birkat-hailanot.html",
    hrefLabel: "לנוסח הברכה",
    doneKey: "tefila-ilanot-done",
    doneValue: key,
  };
  if (hd.getMonth() !== months.NISAN) return force ? item : null;
  const left = 30 - hd.getDate() + 1;
  item.text = (left <= 1 ? "היום היום האחרון בניסן" : left === 2 ? "נותרו יומיים בניסן" : "נותרו " + left + " ימים בניסן") + ". מברכים פעם בשנה על אילנות מלבלבים, בחוץ. בסוף הנוסח יש כפתור ״בירכתי״.";
  return item;
}

function fastItem(now) {
  const day = new HDate(now);
  const events = HebrewCalendar.calendar({
    start: day,
    end: new HDate(day.abs() + 4),
    il: true,
    sedrot: false,
    omer: false,
    mask: flags.MINOR_FAST | flags.MAJOR_FAST,
  }).filter((e) => FASTS[e.getDesc()]);
  const e = events[0];
  if (!e) return null;
  const name = FASTS[e.getDesc()];
  const fastDay = e.getDate();
  const diff = fastDay.abs() - day.abs();
  const isAv = e.getDesc() === "Tish'a B'Av";
  const greg = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff, 12);
  const times = sunTimes(greg);
  const weekday = WEEKDAYS[greg.getDay()];
  const card = { id: "fast", title: name, href: "zmanim.html", hrefLabel: "זמני היום" };
  if (diff === 0) {
    const today = sunTimes(now);
    if (now > today.tzeit) return null;
    card.text = "היום צום. הצום מסתיים בצאת הכוכבים, " + formatHM(today.tzeit) + ". אומרים ״עננו״ בתפילה.";
  } else if (diff === 1) {
    card.text = isAv
      ? "מחר תשעה באב. הצום מתחיל בשקיעה, " + formatHM(sunTimes(now).sunset) + ". אוכלים סעודה מפסקת לפני כן."
      : "מחר צום (יום " + weekday + "). הצום מתחיל בעלות השחר, " + formatHM(times.alot) + ".";
  } else {
    card.text = "בעוד " + (diff === 2 ? "יומיים" : diff + " ימים") + ", ביום " + weekday + ". " + (isAv ? "הצום מתחיל בשקיעה." : "הצום מתחיל בעלות השחר.");
  }
  return card;
}

export function omerItem(now, hd, force) {
  // Night N belongs to the Hebrew date 15+N Nisan. hd is the civil-day Hebrew date, so the coming night is always hd+1.
  const today = sunTimes(now);
  const tonight = hd.next();
  const n = omerNumber(tonight);
  const item = {
    id: "omer",
    title: "ספירת העומר",
    href: "sefirat-haomer.html",
    hrefLabel: "לנוסח הספירה",
    doneKey: "tefila-omer-done",
    doneValue: String(n) + "-" + tonight.getFullYear(),
  };
  if (!n) return force ? item : null;
  const night = now >= today.sunset;
  item.text = (night ? "הלילה" : "הערב") + " סופרים יום " + n + " לעומר, אחרי צאת הכוכבים. בסוף הנוסח יש כפתור ״ספרתי״.";
  return item;
}

const PROVIDERS = [
  (now) => fastItem(now),
  (now, hd) => omerItem(now, hd, false),
  (now) => ilanotItem(now, false),
  (now) => levanaItem(now),
];

export function seasonalItems(now, hd) {
  const out = [];
  const h = hd || new HDate(now);
  for (const p of PROVIDERS) {
    try {
      const item = p(now, h);
      if (item && !isDone(item)) out.push(item);
    } catch (e) {}
  }
  return out;
}
