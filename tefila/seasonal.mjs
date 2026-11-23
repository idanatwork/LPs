import { HDate, HebrewCalendar, Location, Zmanim, flags, months } from "@hebcal/core";
import { ORANIT, computeFromSun, formatHM } from "./zmanim-calc.mjs";
import { daysLeftText, levanaDone, levanaState } from "./levana.mjs?v=74";
import { omerNumber } from "./omer.mjs?v=74";

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
  "Tish'a B'Av (observed)": "תשעה באב (נדחה)",
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
  const isAv = /^Tish'a B'Av/.test(e.getDesc());
  const nidche = e.getDesc() === "Tish'a B'Av (observed)";
  const greg = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff, 12);
  const times = sunTimes(greg);
  const weekday = WEEKDAYS[greg.getDay()];
  const card = { id: "fast", title: name, href: "zmanim.html", hrefLabel: "זמני היום" };
  if (diff === 0) {
    const today = sunTimes(now);
    if (now > today.tzeit) return null;
    card.text = "היום צום. הצום מסתיים בצאת הכוכבים, " + formatHM(today.tzeit) + ". אומרים ״עננו״ בתפילה." + (nidche ? " במוצאי הצום מבדילים על הכוס, בלי נר ובשמים." : "");
  } else if (diff === 1) {
    card.text = isAv
      ? "מחר תשעה באב. הצום מתחיל בשקיעה, " + formatHM(sunTimes(now).sunset) + (nidche ? ". מפסיקים לאכול לפני השקיעה." : ". אוכלים סעודה מפסקת לפני כן.")
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


const MONTH_HE = { 1: "ניסן", 2: "אייר", 3: "סיוון", 4: "תמוז", 5: "אב", 6: "אלול", 7: "תשרי", 8: "חשוון", 9: "כסלו", 10: "טבת", 11: "שבט" };
function monthHe(m, year) {
  if (m === 12) return HDate.isLeapYear(year) ? "אדר א׳" : "אדר";
  if (m === 13) return "אדר ב׳";
  return MONTH_HE[m];
}
function purimMonth(year) { return HDate.isLeapYear(year) ? months.ADAR_II : months.ADAR_I; }
function doneFor(card, key, value) { card.doneKey = key; card.doneValue = value; return card; }

function roshChodeshItem(now, hd) {
  const d = hd.getDate();
  const m = hd.getMonth();
  let target = null;
  if (d === 30) target = hd.next();
  else if (d === 1 && m !== months.TISHREI) target = hd;
  if (!target) return null;
  const name = monthHe(target.getMonth(), target.getFullYear());
  return {
    id: "roshchodesh",
    title: "ראש חודש " + name,
    text: "היום ראש חודש. אומרים יעלה ויבוא בתפילה ובברכת המזון, הלל בדילוג בשחרית, ומוסיפים תפילת מוסף.",
    href: "shacharit.html",
    hrefLabel: "לשחרית",
  };
}

export function chanukahNight(hd) {
  const tonight = hd.next();
  const first = new HDate(25, months.KISLEV, tonight.getFullYear());
  return { k: tonight.abs() - first.abs() + 1, year: tonight.getFullYear() };
}

function chanukahItem(now, hd) {
  const tonight = hd.next();
  const k = chanukahNight(hd).k;
  if (k < 1 || k > 8) return null;
  const weekday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getDay();
  const t = sunTimes(now);
  const friday = weekday === 5;
  const when = friday ? "לפני הדלקת נרות שבת, " + formatHM(t.candles) : "בצאת הכוכבים, " + formatHM(t.tzeit);
  let text = (k === 1 ? "הלילה מדליקים נר ראשון" : "הלילה מדליקים " + k + " נרות") + " " + "(" + (friday ? "ערב שבת: " : "") + when + "). ";
  text += k === 1 ? "מברכים להדליק נר של חנוכה, שעשה ניסים ושהחיינו." : "מברכים להדליק נר של חנוכה ושעשה ניסים.";
  const card = { id: "chanukah", title: "חנוכה, נר " + (k === 1 ? "ראשון" : k + ""), text, href: "chanukah-nerot.html", hrefLabel: "לנוסח הברכות", doneLabel: "הדלקתי" };
  return doneFor(card, "tefila-chanukah-done", k + "-" + tonight.getFullYear());
}

function purimItem(now, hd) {
  const y = hd.getFullYear();
  const pm = purimMonth(y);
  const t = sunTimes(now);
  const night = now >= t.sunset;
  const d = hd.getDate();
  const m = hd.getMonth();
  if (m === pm && d === 13 && night) {
    return doneFor({ id: "purim", title: "פורים", text: "הלילה פורים. שומעים מגילה בערבית אחרי צאת הכוכבים, " + formatHM(t.tzeit) + ".", href: null, doneLabel: "שמעתי מגילה" }, "tefila-purim-night-done", String(y));
  }
  if (m === pm && d === 14 && !night) {
    return doneFor({ id: "purim", title: "פורים", text: "היום פורים. שומעים מגילה בבוקר, נותנים משלוח מנות לחבר ומתנות לאביונים, ועורכים סעודה.", href: null, doneLabel: "שמעתי מגילה" }, "tefila-purim-day-done", String(y));
  }
  return null;
}

function selichotItem(now, hd) {
  const m = hd.getMonth();
  const d = hd.getDate();
  const shabbat = hd.getDay() === 6;
  if (shabbat) return null;
  let text = null;
  if (m === months.ELUL) text = "בחודש אלול אומרים סליחות כל בוקר לפני שחרית, בעלות השחר.";
  else if (m === months.TISHREI && d >= 3 && d <= 9) text = "בעשרת ימי תשובה אומרים סליחות כל בוקר לפני שחרית.";
  if (!text) return null;
  return { id: "selichot", title: "סליחות", text, href: null };
}

function chametzItem(now, hd) {
  const y = hd.getFullYear();
  const erev = new HDate(14, months.NISAN, y);
  const erevShabbat = erev.getDay() === 6;
  const t = sunTimes(now);
  const night = now >= t.sunset;
  const tonight = hd.next();
  const bedikaDate = erevShabbat ? new HDate(13, months.NISAN, y) : erev;
  {
    if (tonight.abs() === bedikaDate.abs() && hd.abs() < bedikaDate.abs()) {
      return doneFor({ id: "chametz-bedika", title: "בדיקת חמץ", text: "הלילה בודקים חמץ, אחרי צאת הכוכבים, " + formatHM(t.tzeit) + ", לאור נר. מברכים על בִּעוּר חמץ ובסוף מבטלים את החמץ.", href: null, doneLabel: "בדקתי" }, "tefila-bedika-done", String(y));
    }
  }
  const biurDate = erevShabbat ? new HDate(13, months.NISAN, y) : erev;
  if (hd.abs() === biurDate.abs()) {
    const text = erevShabbat
      ? "היום ערב שבת וערב פסח. מבערים את החמץ בבוקר, ומשאירים רק מה שצריך לסעודות שבת."
      : "היום ערב פסח. אוכלים חמץ עד " + formatHM(t.tefillaMGA) + " ומבערים (שורפים) ומבטלים עד " + formatHM(new Date(t.alot.getTime() + 5 * (t.rabbeinuTam.getTime() - t.alot.getTime()) / 12)) + " (לפי מג״א).";
    return doneFor({ id: "chametz-biur", title: "ערב פסח", text, href: "zmanim.html", hrefLabel: "זמני היום", doneLabel: "ביערתי" }, "tefila-biur-done", String(y));
  }
  return null;
}

function geshamItem(now, hd) {
  const tonight = hd.next();
  const y = tonight.getFullYear();
  const seven = new HDate(7, months.CHESHVAN, y);
  const diff = seven.abs() - tonight.abs();
  if (diff > 3 || diff < -3) return null;
  let text;
  if (diff === 0) text = "הלילה, בערבית, מתחילים לומר ״ותן טל ומטר לברכה״ בברכת השנים. עד פסח.";
  else if (diff > 0) text = (diff === 1 ? "מחר בערב" : "בעוד " + diff + " ימים") + " מתחילים לומר ״ותן טל ומטר לברכה״ (ליל ז׳ במרחשוון).";
  else text = "מליל ז׳ במרחשוון אומרים ״ותן טל ומטר לברכה״ בברכת השנים. מי ששכח, מתקן לפי הכללים בהלכה היומית.";
  return { id: "geshamim", title: "שאילת גשם", text, href: null };
}

function omerPeriodItem(now, hd) {
  const m = hd.getMonth();
  const d = hd.getDate();
  if (m === months.IYYAR && d === 18) return { id: "lagbaomer", title: "ל״ג בעומר", text: "היום ל״ג בעומר. אין אומרים תחנון.", href: null };
  return null;
}

function ninedaysItem(now, hd) {
  const m = hd.getMonth();
  const d = hd.getDate();
  if (m === months.AV && d >= 1 && d <= 9) {
    return { id: "ninedays", title: "תשעת הימים", text: "מראש חודש אב: ממעטים בשמחה ולא עורכים נישואין, לא אוכלים בשר ולא שותים יין (חוץ משבת וסעודת מצווה), ולא לובשים בגדים חדשים. בשבוע שחל בו תשעה באב גם לא מסתפרים, לא מכבסים, לא לובשים בגדים מכובסים ולא רוחצים בחמין להנאה. כשתשעה באב חל ביום ראשון או נדחה, אין דין שבוע שחל בו (שו״ע או״ח תקנא). האשכנזים נוהגים בכיבוס וברחצה כבר מראש חודש.", href: null };
  }
  return null;
}

function betweenStraitsItem(now, hd) {
  const m = hd.getMonth();
  const d = hd.getDate();
  if (m === months.TAMUZ && d >= 17) {
    return { id: "bein", title: "בין המצרים", text: "מי״ז בתמוז ועד תשעה באב: ימי אבל על חורבן בית המקדש. הספרדים נוהגים לערוך נישואין עד ראש חודש אב, ומראש חודש לא. האשכנזים נמנעים כבר מי״ז בתמוז (שו״ע או״ח תקנא, ב).", href: null };
  }
  return null;
}

function hachamaItem(now, hd) {
  // Birkat hachama: once every 28 years, Wednesday 8 April 2037 (next after 2009).
  const day = new Date(2037, 3, 8, 12);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const diff = Math.round((day - today) / 86400000);
  if (diff < 0 || diff > 3) return null;
  const text = diff === 0
    ? "היום ברכת החמה, אחת ל־28 שנה. מברכים אחרי הנץ החמה, בחוץ: ״עושה מעשה בראשית״."
    : "ברכת החמה, אחת ל־28 שנה, ביום רביעי ח׳ באפריל אחרי הנץ החמה. מברכים בחוץ: ״עושה מעשה בראשית״.";
  return doneFor({ id: "hachama", title: "ברכת החמה", text, href: null, doneLabel: "בירכתי" }, "tefila-hachama-done", "2037");
}

const PROVIDERS = [
  (now) => fastItem(now),
  (now, hd) => omerItem(now, hd, false),
  (now) => ilanotItem(now, false),
  (now) => levanaItem(now),
  roshChodeshItem,
  chanukahItem,
  purimItem,
  selichotItem,
  chametzItem,
  geshamItem,
  omerPeriodItem,
  betweenStraitsItem,
  ninedaysItem,
  hachamaItem,
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
