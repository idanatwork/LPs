import { HDate, HebrewCalendar, Location, Zmanim, flags, months } from "@hebcal/core";

export function oranit() {
  return new Location(32.13, 34.99, true, "Asia/Jerusalem", "Oranit", "IL");
}

const PUBLIC_FASTS = new Set([
  "Tzom Gedaliah",
  "Asara B'Tevet",
  "Ta'anit Esther",
  "Tzom Tammuz",
  "Tish'a B'Av",
]);

const DEBATE_NOTE =
  "לדעת הרב דרוקמן אין אומרים תחנון. לדעת הרב עובדיה יוסף המנהג שנוי במחלוקת.";

export function eventsOn(hd) {
  return HebrewCalendar.calendar({
    start: hd,
    end: hd,
    il: true,
    sedrot: false,
    omer: false,
  });
}

const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const OCCASIONS = ["ראש חודש", "חנוכה", "פורים", "שושן פורים", "פורים קטן", "שושן פורים קטן", "יום העצמאות", "יום ירושלים", "תענית ציבור", "עשרת ימי תשובה", "חול המועד"];

export function formatHebrewDate(hd) {
  const parts = hd.renderGematriya(true).split(" ");
  if (parts.length < 3) return hd.renderGematriya(true);
  const day = parts[0];
  const year = parts[parts.length - 1];
  const month = parts.slice(1, -1).join(" ").replace("חשון", "חשוון");
  return `${day} ב${month} ${year}`;
}

function isChanukah(events) {
  return events.some((e) => e.getDesc().startsWith("Chanukah") && !(e.getFlags() & flags.EREV));
}

function isErevYomTov(events) {
  return events.some((e) => (e.getFlags() & flags.EREV) && /^Erev (Rosh Hashana|Yom Kippur|Pesach|Shavuot|Sukkot)/.test(e.getDesc()));
}

function isMashiv(hd, service) {
  const m = hd.getMonth();
  const d = hd.getDate();
  const winter = m >= months.CHESHVAN;
  if (service === "mincha") {
    if (m === months.TISHREI && d >= 22) return true;
    if (winter) return true;
    if (m === months.NISAN && d <= 14) return true;
    return false;
  }
  if (m === months.TISHREI && d >= 23) return true;
  if (winter) return true;
  if (m === months.NISAN && d <= 15) return true;
  return false;
}

function isBarech(hd, service) {
  const m = hd.getMonth();
  const d = hd.getDate();
  if (m >= months.KISLEV) return true;
  if (m === months.CHESHVAN && d >= (service === "arvit" ? 7 : 8)) return true;
  if (m === months.NISAN && d <= 14) return true;
  return false;
}

function isBarechenu(hd, service) {
  const m = hd.getMonth();
  const d = hd.getDate();
  if (m === months.NISAN && d >= 16) return true;
  if (m >= months.IYYAR && m <= months.TISHREI) return true;
  if (m === months.CHESHVAN && d <= (service === "arvit" ? 6 : 7)) return true;
  return false;
}

function tachanunDecision(hd, events, service, weekday) {
  const m = hd.getMonth();
  const d = hd.getDate();
  const desc = events.map((e) => e.getDesc());
  const has = (re) => desc.some((x) => re.test(x));
  const mask = events.reduce((acc, e) => acc | e.getFlags(), 0);
  if (service === "arvit") return { say: false, debate: false };
  if (weekday === 6) return { say: false, debate: false };
  if (mask & flags.ROSH_CHODESH) return { say: false, debate: false };
  if (m === months.NISAN) return { say: false, debate: false };
  if (has(/^Pesach Sheni/)) return { say: false, debate: false };
  if (has(/^Lag BaOmer/)) return { say: false, debate: false };
  if (m === months.SIVAN && d <= 12) return { say: false, debate: false };
  if (has(/^Tish'a B'Av$/)) return { say: false, debate: false };
  if (has(/^Tu B'Av$/)) return { say: false, debate: false };
  if (m === months.TISHREI && d >= 9) return { say: false, debate: false };
  if (mask & flags.CHAG) return { say: false, debate: false };
  if (isChanukah(events)) return { say: false, debate: false };
  if (has(/^Tu BiShvat$/)) return { say: false, debate: false };
  if (has(/^(Purim|Shushan Purim|Purim Katan|Shushan Purim Katan)$/)) return { say: false, debate: false };
  if (has(/^Yom HaAtzma/) || has(/^Yom Yerushalayim/)) return { say: false, debate: true };
  // Yalkut Yosef and Chazon Ovadia: no vidui or nefilat apayim on Erev Rosh Hashana, including Shacharit.
  if (has(/^Erev Rosh Hashana/)) return { say: false, debate: false };
  if (service === "mincha" && weekday === 5) return { say: false, debate: false };
  if (service === "mincha" && isErevYomTov(events)) return { say: false, debate: false };
  return { say: true, debate: false };
}

/** Weekday of the civil date. hebcal's greg() is local midnight, so getUTCDay() is the previous day in Israel. */
export function civilWeekday(hd) {
  return hd.greg().getDay();
}

export function statusForHDate(hd, service) {
  const events = eventsOn(hd);
  const weekday = civilWeekday(hd);
  const desc = events.map((e) => e.getDesc());
  const mask = events.reduce((acc, e) => acc | e.getFlags(), 0);
  const chanukah = isChanukah(events);
  const purim = desc.includes("Purim");
  const shushan = desc.includes("Shushan Purim");
  const rc = (mask & flags.ROSH_CHODESH) !== 0;
  const chm = (mask & flags.CHOL_HAMOED) !== 0;
  const pesachChm = chm && hd.getMonth() === months.NISAN;
  const sukkotChm = chm && hd.getMonth() === months.TISHREI;
  const fast = desc.some((d) => PUBLIC_FASTS.has(d));
  const tisha = desc.includes("Tish'a B'Av");
  const aseret = hd.getMonth() === months.TISHREI && hd.getDate() >= 1 && hd.getDate() <= 10;
  const mashiv = isMashiv(hd, service);
  const barech = isBarech(hd, service);
  const barechenu = isBarechenu(hd, service);
  const tachanun = tachanunDecision(hd, events, service, weekday);
  const debate = tachanun.debate;

  let note = "";
  if (debate) note = DEBATE_NOTE;
  else if (shushan) note = "בירושלים אומרים היום ועל הנסים. מחוץ לערים המוקפות אמרו אתמול.";

  const chips = [];
  if (weekday === 6) chips.push("שבת");
  if (rc) chips.push("ראש חודש");
  if (chanukah) chips.push("חנוכה");
  if (purim) chips.push("פורים");
  if (shushan) chips.push("שושן פורים");
  if (desc.includes("Purim Katan")) chips.push("פורים קטן");
  if (desc.includes("Shushan Purim Katan")) chips.push("שושן פורים קטן");
  if (desc.some((d) => d.startsWith("Yom HaAtzma"))) chips.push("יום העצמאות");
  if (desc.some((d) => d.startsWith("Yom Yerushalayim"))) chips.push("יום ירושלים");
  if (fast) chips.push("תענית ציבור");
  if (aseret) chips.push("עשרת ימי תשובה");
  if (chm) chips.push("חול המועד");
  if (service !== "arvit") chips.push(tachanun.say ? "אומרים תחנון" : "לא אומרים תחנון");
  chips.push(mashiv ? "משיב הרוח" : "מוריד הטל");
  if (barech) chips.push("ברך עלינו");
  else if (barechenu) chips.push("ברכנו");

  const openAnenu = tisha || (fast && service === "mincha");
  const flagsOut = {
    aseret,
    tal: !mashiv,
    geshem: mashiv,
    barechenu,
    barech,
    "yaaleh-rc": rc,
    "yaaleh-pesach": pesachChm,
    "yaaleh-sukkot": sukkotChm,
    yaaleh: rc || pesachChm || sukkotChm,
    chanukah,
    purim,
    anenu: openAnenu,
    nachem: tisha && service === "mincha",
    "twice-elohim": service === "shacharit" && (aseret || (hd.getMonth() === months.TISHREI && hd.getDate() === 21)),
    hallel: service === "shacharit" && (rc || chanukah),
    tachanun: service !== "arvit" && tachanun.say,
    "tachanun-mw": service === "shacharit" && tachanun.say && (weekday === 1 || weekday === 4),
    shabbat: weekday === 6,
    "rosh-hashana": hd.getMonth() === months.TISHREI && (hd.getDate() === 1 || hd.getDate() === 2),
    pesach: hd.getMonth() === months.NISAN && hd.getDate() >= 15 && hd.getDate() <= 21,
    shavuot: hd.getMonth() === months.SIVAN && hd.getDate() === 6,
    sukkot: hd.getMonth() === months.TISHREI && hd.getDate() >= 15 && hd.getDate() <= 21,
    "shemini-atzeret": hd.getMonth() === months.TISHREI && hd.getDate() === 22,
    yomtov: (mask & flags.CHAG) !== 0 || chm,
    fast,
    torah:
      (service === "shacharit" && weekday !== 6 && (((weekday === 1 || weekday === 4) && tachanun.say) || rc || fast))
      || (service === "mincha" && fast && weekday !== 6),
  };
  if (service === "shacharit" && weekday <= 5) flagsOut["weekday-" + weekday] = true;

  return {
    hebrewDate: formatHebrewDate(hd),
    chips,
    note,
    flags: flagsOut,
    hd,
  };
}

export function resolveHDate(now, service) {
  const loc = Location.lookup("Jerusalem");
  const zman = new Zmanim(loc, now, false);
  const hd = new HDate(now);
  if (service === "mincha") return hd;
  if (service === "arvit") {
    if (now < zman.sunrise()) return hd;
    return hd.next();
  }
  if (now >= zman.sunset()) return hd.next();
  return hd;
}

export function statusFor(now, service) {
  return statusForHDate(resolveHDate(now, service), service);
}

export function activeService(now) {
  const z = new Zmanim(oranit(), now, false);
  const alot = z.alotHaShachar();
  const mid = z.chatzot();
  const sunset = z.sunset();
  if (!alot || !mid || !sunset || now < alot || now >= sunset) return "arvit";
  if (now < mid) return "shacharit";
  return "mincha";
}

/** Evening indication when this page's Hebrew day is the night, not the daytime date. */
export function isNightService(now, service) {
  if (service === "mincha") return false;
  if (service === "arvit") return true;
  const sunset = new Zmanim(oranit(), now, false).sunset();
  return !!(sunset && now >= sunset);
}

export function formatHeaderDate(status, night) {
  const g = status.hd.greg();
  const greg = `${g.getDate()}.${g.getMonth() + 1}.${g.getFullYear()}`;
  const weekday = "יום " + WEEKDAYS[civilWeekday(status.hd)];
  const heb = (night ? "ליל " : "") + status.hebrewDate;
  const occasions = OCCASIONS.filter((name) => status.chips.includes(name));
  return [heb, ...occasions, weekday, greg].join(" · ");
}

export function mountHeaderDate(text) {
  if (typeof document === "undefined") return;
  let el = document.getElementById("header-date");
  if (!el) {
    const header = document.querySelector("header.bar");
    if (!header) return;
    el = document.createElement("p");
    el.id = "header-date";
    el.className = "header-date";
    header.appendChild(el);
  }
  el.textContent = text;
  el.hidden = !text;
}

export function hebrewNow(now) {
  const z = new Zmanim(oranit(), now, false);
  const hd = new HDate(now);
  const sunset = z.sunset();
  if (sunset && now >= sunset) return hd.next();
  return hd;
}
