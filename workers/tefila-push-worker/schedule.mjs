/** Zmanim match tefila/zmanim-calc.mjs. Lock matches the siddur: candles → Rabbeinu Tam, Israel. */
import { HDate, HebrewCalendar, Location, Zmanim, flags } from "@hebcal/core";

export const ORANIT = { lat: 32.1317, lon: 34.9933, tz: "Asia/Jerusalem" };
export const WINDOW_MS = 5 * 60 * 1000;
export const BASE = "https://idanatwork.github.io/LPs/tefila";

export const PRAYERS = {
  shacharit: {
    title: "שחרית",
    body: "הגיע זמן שחרית",
    url: `${BASE}/shacharit.html`,
  },
  mincha: {
    title: "מנחה",
    body: "הגיע זמן מנחה",
    url: `${BASE}/mincha.html`,
  },
  arvit: {
    title: "ערבית",
    body: "הגיע זמן ערבית",
    url: `${BASE}/arvit.html`,
  },
  candles: {
    title: "הדלקת נרות",
    body: "הדלקת נרות בקרוב",
    url: `${BASE}/zmanim.html`,
  },
};

/** Mincha default moved from 15 to 30 minutes before sunset (v75). */
export const MINCHA_DEFAULT = 30;
const OLD_MINCHA_DEFAULT = 15;
/** Candle-lighting alert: minutes before candle lighting (candles = sunset − 20, so 40 min before sunset). */
export const CANDLES_DEFAULT = 20;

/**
 * Mincha offset for a subscription. Clients before v75 always sent 15 (the old default), so a 15
 * without minchaOffsetSet is treated as "never chosen" and moves to the new default.
 */
export function minchaOffset(alerts) {
  const a = alerts || {};
  const mins = Number(a.minchaOffset);
  if (!Number.isFinite(mins)) return MINCHA_DEFAULT;
  if (mins === OLD_MINCHA_DEFAULT && !a.minchaOffsetSet) return MINCHA_DEFAULT;
  return mins;
}

export function candlesOffset(alerts) {
  const mins = Number(alerts && alerts.candlesOffset);
  return Number.isFinite(mins) ? Math.max(5, Math.min(120, mins)) : CANDLES_DEFAULT;
}

export function computeFromSun(sunrise, sunset) {
  const shaah = (sunset.getTime() - sunrise.getTime()) / 12;
  const minute = shaah / 60;
  const shift = (base, mins) => new Date(base.getTime() + mins * minute);
  const alot = shift(sunrise, -72);
  const tzeit = shift(sunset, 13.5);
  const rabbeinuTam = shift(sunset, 72);
  const shaahMA = (rabbeinuTam.getTime() - alot.getTime()) / 12;
  const fromAlot = (hours) => new Date(alot.getTime() + hours * shaahMA);
  return {
    alot,
    sunrise,
    sunset,
    shemaMGA: fromAlot(3),
    tzeit,
    rabbeinuTam,
    candles: new Date(sunset.getTime() - 20 * 60 * 1000),
  };
}

export function formatHM(date, tz = ORANIT.tz) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** Missing shacharitWhen (v47 subscriptions) keeps sunrise. */
export function shacharitMode(alerts) {
  return alerts && alerts.shacharitWhen === "shema" ? "shema" : "sunrise";
}

export function prayerPayload(kind, times, alerts, tz = ORANIT.tz) {
  const base = PRAYERS[kind];
  if (!base) return null;
  if (kind === "shacharit" && shacharitMode(alerts) === "shema" && times.shemaMGA) {
    return {
      ...base,
      body: `סוף זמן קריאת שמע בשעה ${formatHM(times.shemaMGA, tz)}`,
    };
  }
  if (kind === "candles" && times.candles) {
    return { ...base, body: `הדלקת נרות בשעה ${formatHM(times.candles, tz)}` + (times.candlesFor ? ` · ${times.candlesFor}` : "") };
  }
  return { ...base };
}

export function civilParts(date, tz) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t).value;
  return {
    y: +get("year"),
    m: +get("month"),
    d: +get("day"),
    hour: +get("hour"),
    minute: +get("minute"),
  };
}

export function civilYmd(date, tz) {
  const p = civilParts(date, tz);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

function utcNoon(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function zmanimForCivil(y, m, d, lat, lon, tz) {
  const loc = new Location(lat, lon, true, tz, "", "IL");
  const sun = new Zmanim(loc, utcNoon(y, m, d), false);
  return computeFromSun(sun.sunrise(), sun.sunset());
}

export function hdateFromCivil(y, m, d) {
  return new HDate(utcNoon(y, m, d));
}

/** Hebrew date that has already begun at this instant (rolls at sunset). */
export function hebrewNowAt(now, lat, lon, tz) {
  const p = civilParts(now, tz);
  const times = zmanimForCivil(p.y, p.m, p.d, lat, lon, tz);
  const hd = hdateFromCivil(p.y, p.m, p.d);
  return now >= times.sunset ? hd.next() : hd;
}

function isChagEvent(ev) {
  const f = ev.getFlags();
  if (f & flags.CHOL_HAMOED) return false;
  if (f & flags.EREV) return false;
  const desc = ev.getDesc();
  return (
    // "Rosh Hashana 5787" and "Rosh Hashana II" — not "Rosh Hashana LaBehemot" (1 Elul, a weekday).
    /^Rosh Hashana (\d+|II)$/.test(desc) ||
    desc === "Yom Kippur" ||
    desc === "Pesach I" ||
    desc === "Pesach VII" ||
    desc === "Shavuot" ||
    desc === "Sukkot I" ||
    desc === "Shmini Atzeret"
  );
}

export function isYomTov(hd) {
  const ev = HebrewCalendar.getHolidaysOnDate(hd, true) || [];
  return ev.some(isChagEvent);
}

export function isHoly(hd) {
  return hd.getDay() === 6 || isYomTov(hd);
}

function civilYmdFromHDate(hd) {
  const g = hd.greg();
  return { y: g.getFullYear(), m: g.getMonth() + 1, d: g.getDate() };
}

/** Candle lighting at the start of Hebrew day `hd` (sunset of the previous civil day − 20 clock minutes). */
export function holyStart(hd, lat, lon, tz) {
  const eve = civilYmdFromHDate(hd.prev());
  return zmanimForCivil(eve.y, eve.m, eve.d, lat, lon, tz).candles;
}

/** Rabbeinu Tam at the end of Hebrew day `hd`. */
export function holyEnd(hd, lat, lon, tz) {
  const day = civilYmdFromHDate(hd);
  return zmanimForCivil(day.y, day.m, day.d, lat, lon, tz).rabbeinuTam;
}

/** Same window as the siddur lock: candles Friday/erev chag until Rabbeinu Tam after. */
export function isShabbatOrYomTovLocked(now, lat, lon, tz) {
  const hd = hebrewNowAt(now, lat, lon, tz);
  for (const d of [hd.prev(), hd, hd.next()]) {
    if (!isHoly(d)) continue;
    const start = holyStart(d, lat, lon, tz);
    const end = holyEnd(d, lat, lon, tz);
    if (now >= start && now < end) return true;
  }
  return false;
}

export function alertTime(kind, times, alerts) {
  if (kind === "shacharit") {
    if (shacharitMode(alerts) === "shema") {
      const mins = Number(alerts.shacharitOffset);
      const offset = Number.isFinite(mins) ? mins : 15;
      return new Date(times.shemaMGA.getTime() - offset * 60 * 1000);
    }
    return times.sunrise;
  }
  if (kind === "mincha") {
    return new Date(times.sunset.getTime() - minchaOffset(alerts) * 60 * 1000);
  }
  if (kind === "candles") {
    return new Date(times.candles.getTime() - candlesOffset(alerts) * 60 * 1000);
  }
  if (kind === "arvit") {
    const mins = Number(alerts.arvitOffset);
    const offset = Number.isFinite(mins) ? mins : 0;
    return new Date(times.tzeit.getTime() + offset * 60 * 1000);
  }
  return null;
}

export function kindEnabled(kind, alerts) {
  if (!alerts) return false;
  // Candle-lighting alert is on unless the subscriber turned it off (records before v75 have no field).
  if (kind === "candles") return alerts.candles !== false;
  return !!alerts[kind];
}

/**
 * Candle lighting tonight opens Shabbat / Yom Tov, and today is not itself Shabbat / Yom Tov
 * (2nd day of Rosh Hashana, Yom Tov into Shabbat: candles fall inside the earlier holy day — no alert).
 */
export function candlesTonight(y, m, d) {
  const today = hdateFromCivil(y, m, d);
  if (isHoly(today)) return null;
  const tonight = today.next();
  if (!isHoly(tonight)) return null;
  if (tonight.getDay() === 6) return "שבת שלום";
  const ev = HebrewCalendar.getHolidaysOnDate(tonight, true) || [];
  return ev.some((e) => e.getDesc() === "Yom Kippur") ? "גמר חתימה טובה" : "חג שמח";
}

/**
 * Push TTL in seconds: one hour, but never past tonight's candle lighting on Friday / erev Yom Tov,
 * so a delayed delivery cannot arrive after Shabbat / Yom Tov has begun.
 */
export function pushTtl(record, now) {
  const lat = Number(record.lat) || ORANIT.lat;
  const lon = Number(record.lng ?? record.lon) || ORANIT.lon;
  const tz = record.tz || ORANIT.tz;
  const p = civilParts(now, tz);
  if (!candlesTonight(p.y, p.m, p.d)) return 3600;
  const candles = zmanimForCivil(p.y, p.m, p.d, lat, lon, tz).candles;
  const secs = Math.floor((candles.getTime() - now.getTime()) / 1000);
  return Math.max(0, Math.min(3600, secs));
}

/**
 * Return prayer kinds that should fire at `now` for this subscription record.
 * Does not mutate lastSent — the caller records sends after success.
 */
export function dueAlerts(record, now) {
  const lat = Number(record.lat) || ORANIT.lat;
  const lon = Number(record.lng ?? record.lon) || ORANIT.lon;
  const tz = record.tz || ORANIT.tz;
  const alerts = record.alerts || {};
  if (isShabbatOrYomTovLocked(now, lat, lon, tz)) return [];

  const p = civilParts(now, tz);
  const times = zmanimForCivil(p.y, p.m, p.d, lat, lon, tz);
  const today = civilYmd(now, tz);
  const lastSent = record.lastSent || {};
  const due = [];
  const candlesFor = candlesTonight(p.y, p.m, p.d);
  for (const kind of ["shacharit", "mincha", "arvit", "candles"]) {
    if (!kindEnabled(kind, alerts)) continue;
    if (kind === "candles" && !candlesFor) continue;
    if (lastSent[kind] === today) continue;
    const when = alertTime(kind, times, alerts);
    if (!when) continue;
    const delta = now.getTime() - when.getTime();
    if (delta >= 0 && delta < WINDOW_MS) due.push(kind);
  }
  return due;
}

export async function subKey(endpoint) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function timesForRecord(record, now) {
  const lat = Number(record.lat) || ORANIT.lat;
  const lon = Number(record.lng ?? record.lon) || ORANIT.lon;
  const tz = record.tz || ORANIT.tz;
  const p = civilParts(now, tz);
  const times = zmanimForCivil(p.y, p.m, p.d, lat, lon, tz);
  const candlesFor = candlesTonight(p.y, p.m, p.d);
  if (candlesFor) times.candlesFor = candlesFor;
  return { tz, times, alerts: record.alerts || {} };
}
