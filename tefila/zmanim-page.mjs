import { HDate, Location, Zmanim, months } from "@hebcal/core";
import { civilWeekday, statusForHDate } from "./day-status.mjs?v=22";
import { ORANIT, ZMAN_ROWS, computeFromSun, formatHM } from "./zmanim-calc.mjs";

const input = document.getElementById("z-date");
const list = document.getElementById("z-list");
const extra = document.getElementById("z-extra");
const head = document.getElementById("z-head");

const EXPLAIN = {
  alot: "עלות השחר הוא הזמן שבו מתחיל אור היום במזרח. מכאן אפשר לומר ברכות השחר. קריאת שמע ותפילת העמידה לכתחילה מאוחר יותר. אצלנו: שבעים ושתים דקות זמניות של הגר״א לפני הנץ.",
  misheyakir: "משיכיר הוא הזמן שבו אפשר להכיר אדם מוכר ממרחק קצר. ממנו מניחים ציצית ותפילין, ולא לפני כן. אצלנו: שש דקות זמניות של הגר״א אחרי עלות השחר.",
  sunrise: "הנץ הוא זריחת החמה, כשעיגול השמש עולה באופק. לכתחילה קוראים שמע ומתפללים שחרית מהנץ, והותיקין מכוונים את העמידה להנץ. אצלנו זה זמן הזריחה המחושב לאורנית, ומכאן נספרות שעות הגר״א.",
  shemaMGA: "זה שלוש שעות זמניות של המג״א מעלות השחר. לדעת הרב עובדיה יוסף לכתחילה מסיימים קריאת שמע של שחרית עד הזמן הזה. הוא מוקדם מזמן הגר״א, כי יום המג״א מתחיל מוקדם יותר. אצלנו: עלות השחר ועוד שלוש שעות מג״א.",
  shemaGRA: "זה שלוש שעות זמניות של הגר״א מהנץ. לדעת הרב עובדיה, מי שלא הספיק עד זמן המג״א עדיין קורא שמע עד כאן. אחרי הזמן הזה עבר זמן קריאת שמע. אצלנו: הנץ ועוד שלוש שעות גר״א.",
  tefillaMGA: "זה ארבע שעות זמניות של המג״א מעלות השחר. יש שמקדימים ומסיימים את תפילת שחרית עד זמן זה. להלכה, לדעת הרב עובדיה יוסף, סוף זמן התפילה נקבע לפי הגר״א. אצלנו מציגים גם את החשבון: עלות ועוד ארבע שעות מג״א.",
  tefillaGRA: "זה ארבע שעות זמניות של הגר״א מהנץ. לדעת הרב עובדיה יוסף זה סוף זמן תפילת שחרית לכתחילה. אחרי כן ועד חצות עדיין מתפללים שחרית, אבל לא בזמנה. אצלנו: הנץ ועוד ארבע שעות גר״א.",
  chatzot: "חצות היום הוא האמצע בין הנץ לשקיעה. עד כאן אפשר עדיין להתפלל שחרית. אחרי חצות אין מתפללים שחרית. אצלנו: נקודת האמצע בין הנץ לשקיעה.",
  minchaGedola: "מנחה גדולה היא חצי שעה זמנית אחרי חצות. מכאן מותר להתפלל מנחה. יש הנוהגים להמתין למנחה קטנה. אצלנו: שש שעות ומחצה זמניות של הגר״א אחרי הנץ.",
  minchaKetana: "מנחה קטנה היא כשעתיים ומחצה זמניות לפני השקיעה. מכאן זמן נוח יותר למנחה. לדעת הרב עובדיה עדיין אפשר להתפלל מנחה עד השקיעה. אצלנו: תשע שעות ומחצה זמניות של הגר״א אחרי הנץ.",
  plag: "פלג המנחה הוא שעה ורבע לפני סוף היום. אחריו, לדעת רבי יהודה, אין מתפללים מנחה ואפשר להקדים ערבית. לדעת הרב עובדיה זמן מנחה עד השקיעה, וערבית מצאת הכוכבים. אין לערב: מי שהתפלל מנחה אחרי הפלג אינו מקדים ערבית מפלג באותו יום. אצלנו, לפי ילקוט יוסף: צאת הכוכבים פחות שבעים וחמש דקות זמניות של הגר״א.",
  sunset: "שקיעה היא שקיעת החמה. עד כאן זמן מנחה לדעת הרב עובדיה. מכאן מתחיל בין השמשות, ושבת ויום טוב נכנסים לעניין האיסור. אצלנו זה זמן השקיעה המחושב לאורנית, וכאן נגמרות שעות הגר״א.",
  tzeit: "צאת הכוכבים הוא תחילת הלילה לעניין ערבית, הבדלה וסוף צום. לדעת הגאונים זה כשלוש עשרה דקות ומחצה אחרי השקיעה. אצלנו: שלוש עשרה וחצי דקות זמניות של הגר״א אחרי השקיעה. לסיום שבת יש המחמירים וממתינים עד ר״ת.",
  rabbeinuTam: "צאת רבינו תם הוא זמן מאוחר יותר ללילה, שבעים ושתים דקות אחרי השקיעה. יש המחמירים וממתינים לו לסיום שבת. אצלנו הוא גם סוף היום לחשבון שעות המג״א: שבעים ושתים דקות זמניות של הגר״א אחרי השקיעה.",
  candles: "הדלקת נרות היא לפני כניסת שבת או יום טוב, כדי להדליק בעוד מותר. באורנית, שאינה ירושלים, נהוג להדליק עשרים דקות לפני השקיעה. אצלנו: עשרים דקות קבועות בשעון, לא דקות זמניות.",
  havdalah: "הבדלה נאמרת בצאת השבת, מצאת הכוכבים. אצלנו מוצג זמן צאת הכוכבים: שלוש עשרה וחצי דקות זמניות אחרי השקיעה. יש המחמירים וממתינים עד צאת ר״ת.",
  fastStart: "תענית רגילה מתחילה בעלות השחר, לא בשקיעה. מי שרוצה לאכול או לשתות קודם צריך להתנות לפי כללי התענית. אצלנו תחילת הצום היא עלות השחר של אותו יום.",
  fastStartTisha: "תשעה באב מתחיל כבר בשקיעה של הערב שלפניו, לא בעלות השחר. מאז נמנעים מאכילה, משתיה ושאר עינויים. הצום מסתיים בצאת הכוכבים.",
  fastEnd: "הצום מסתיים בצאת הכוכבים, לא בשקיעה. אחרי הזמן הזה אפשר לאכול ולשתות. אצלנו: שלוש עשרה וחצי דקות זמניות של הגר״א אחרי השקיעה.",
};

function jerusalemToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ORANIT.tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function atNoon(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 10, 0, 0));
}

function shift(iso, days) {
  const when = atNoon(iso);
  when.setUTCDate(when.getUTCDate() + days);
  const y = when.getUTCFullYear();
  const m = String(when.getUTCMonth() + 1).padStart(2, "0");
  const d = String(when.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function labelNode(text) {
  const span = document.createElement("span");
  const words = ["מג״א", "גר״א"];
  let rest = text;
  words.forEach((word) => {
    const at = rest.indexOf(word);
    if (at < 0) return;
    span.append(document.createTextNode(rest.slice(0, at)));
    const link = document.createElement("a");
    link.href = "#gra-mga";
    link.textContent = word;
    span.append(link);
    rest = rest.slice(at + word.length);
  });
  span.append(document.createTextNode(rest));
  return span;
}

function row(key, label, timeText) {
  const li = document.createElement("li");
  li.className = "z-row";
  const name = document.createElement("span");
  name.className = "z-name";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "z-info";
  btn.textContent = "ⓘ";
  const expId = "z-exp-" + key;
  btn.setAttribute("aria-controls", expId);
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-label", "הסבר על " + label.replace(" — ", " "));
  const time = document.createElement("b");
  time.textContent = timeText;
  const exp = document.createElement("p");
  exp.className = "z-exp";
  exp.id = expId;
  exp.hidden = true;
  exp.textContent = EXPLAIN[key];
  name.append(labelNode(label), btn);
  li.append(name, time, exp);
  return li;
}

function closeAll() {
  list.querySelectorAll(".z-exp").forEach((el) => { el.hidden = true; });
  list.querySelectorAll(".z-info").forEach((el) => el.setAttribute("aria-expanded", "false"));
}

function render(iso) {
  const when = atNoon(iso);
  const loc = new Location(ORANIT.lat, ORANIT.lon, true, ORANIT.tz, "Oranit", "IL");
  const sun = new Zmanim(loc, when, false);
  const times = computeFromSun(sun.sunrise(), sun.sunset());
  const hd = new HDate(when);
  const status = statusForHDate(hd, "shacharit");
  head.textContent = `${status.hebrewDate} · ${status.chips.join(" · ")}`;
  list.replaceChildren();
  for (const [key, label] of ZMAN_ROWS) {
    list.append(row(key, label, formatHM(times[key])));
  }
  const weekday = civilWeekday(hd);
  if (weekday === 5) list.append(row("candles", "הדלקת נרות", formatHM(times.candles)));
  if (weekday === 6) list.append(row("havdalah", "הבדלה", formatHM(times.tzeit)));
  if (status.flags.fast) {
    const tisha = hd.getMonth() === months.AV && hd.getDate() === 9;
    list.append(row(tisha ? "fastStartTisha" : "fastStart", "תחילת הצום", tisha ? "אמש בשקיעה" : formatHM(times.alot)));
    list.append(row("fastEnd", "סוף הצום", formatHM(times.tzeit)));
  }
  if (extra) extra.hidden = true;
}

list.addEventListener("click", (event) => {
  const btn = event.target.closest(".z-info");
  if (!btn || !list.contains(btn)) return;
  const exp = document.getElementById(btn.getAttribute("aria-controls"));
  const willOpen = exp.hidden;
  closeAll();
  if (willOpen) {
    exp.hidden = false;
    btn.setAttribute("aria-expanded", "true");
  }
});

let shownToday = jerusalemToday();
input.value = shownToday;
input.addEventListener("change", () => render(input.value || shownToday));
document.getElementById("z-prev").addEventListener("click", () => {
  input.value = shift(input.value || shownToday, -1);
  render(input.value);
});
document.getElementById("z-next").addEventListener("click", () => {
  input.value = shift(input.value || shownToday, 1);
  render(input.value);
});
function refreshZmanim() {
  if (document.visibilityState === "hidden") return;
  const nextToday = jerusalemToday();
  if (input.value === shownToday) {
    shownToday = nextToday;
    input.value = shownToday;
    render(shownToday);
  }
}
render(shownToday);
document.addEventListener("visibilitychange", refreshZmanim);
window.addEventListener("pageshow", refreshZmanim);
