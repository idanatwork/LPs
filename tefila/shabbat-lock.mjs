/** Shabbat and Yom Tov lock for the siddur.
 * Location, candle lighting and end times come from the site's own zmanim
 * (Oranit; 20 clock minutes before sunset; the lock lifts at Rabbeinu Tam,
 * 72 GRA minutes after sunset, times.rabbeinuTam).
 * Israeli calendar only: one-day Yom Tov, except two days of Rosh Hashana.
 */
import { HDate, Location, Zmanim, months } from "@hebcal/core";
import { ORANIT, computeFromSun, formatHM } from "./zmanim-calc.mjs?v=74";

const TZ = ORANIT.tz;
const LOCK_ID = "siddur-shabbat-lock";

export const CHAGIM = [
  { month: months.TISHREI, day: 1, name: "ראש השנה" },
  { month: months.TISHREI, day: 2, name: "ראש השנה" },
  { month: months.TISHREI, day: 10, name: "יום הכיפורים" },
  { month: months.TISHREI, day: 15, name: "סוכות" },
  { month: months.TISHREI, day: 22, name: "שמיני עצרת שמחת תורה" },
  { month: months.NISAN, day: 15, name: "פסח" },
  { month: months.NISAN, day: 21, name: "שביעי של פסח" },
  { month: months.SIVAN, day: 6, name: "שבועות" },
];

function oranitLocation() {
  return new Location(ORANIT.lat, ORANIT.lon, true, TZ, "Oranit", "IL");
}

export function civilIsoInIsrael(now) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function atNoon(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 10, 0, 0));
}

function shiftIso(iso, days) {
  const when = atNoon(iso);
  when.setUTCDate(when.getUTCDate() + days);
  const y = when.getUTCFullYear();
  const mo = String(when.getUTCMonth() + 1).padStart(2, "0");
  const d = String(when.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

export function timesForCivilIso(iso) {
  const noon = atNoon(iso);
  const sun = new Zmanim(oranitLocation(), noon, false);
  return computeFromSun(sun.sunrise(), sun.sunset());
}

export function chagNameOn(hd) {
  const m = hd.getMonth();
  const d = hd.getDate();
  const hit = CHAGIM.find((item) => item.month === m && item.day === d);
  return hit ? hit.name : "";
}

export function holyInfo(hd) {
  const shabbat = hd.greg().getDay() === 6;
  const chag = chagNameOn(hd);
  return { shabbat, chag, holy: shabbat || !!chag };
}

function intervalsAround(now) {
  const today = civilIsoInIsrael(now);
  const list = [];
  for (let i = -2; i <= 5; i++) {
    const iso = shiftIso(today, i);
    const hd = new HDate(atNoon(iso));
    const info = holyInfo(hd);
    if (!info.holy) continue;
    const eve = shiftIso(iso, -1);
    const start = timesForCivilIso(eve).candles;
    const end = timesForCivilIso(iso).rabbeinuTam;
    list.push({
      start,
      end,
      iso,
      shabbat: info.shabbat,
      chag: info.chag,
    });
  }
  list.sort((a, b) => a.start - b.start);
  const merged = [];
  list.forEach((item) => {
    const last = merged[merged.length - 1];
    if (last && item.start <= last.end) {
      last.end = item.end > last.end ? item.end : last.end;
      last.days.push(item);
    } else {
      merged.push({ start: item.start, end: item.end, days: [item] });
    }
  });
  return merged;
}

export function evaluateLock(now) {
  const when = now instanceof Date ? now : new Date();
  const period = intervalsAround(when).find((item) => when >= item.start && when < item.end);
  if (!period) return { locked: false, period: null, greeting: "", heading: "", untilLabel: "", untilTime: "" };

  const current = [...period.days].reverse().find((day) => when >= day.start) || period.days[0];
  const last = period.days[period.days.length - 1];
  const greeting = current.shabbat ? "שבת שלום" : (current.chag === "יום הכיפורים" ? "גמר חתימה טובה" : "חג שמח");
  const heading = current.shabbat ? "" : current.chag;
  let untilLabel = "במוצאי החג";
  if (last.shabbat) untilLabel = "במוצאי שבת";
  else if (last.chag === "ראש השנה") untilLabel = "במוצאי ראש השנה";
  else if (last.chag === "יום הכיפורים") untilLabel = "במוצאי הצום";
  else if (last.chag === "שמיני עצרת שמחת תורה") untilLabel = "במוצאי החג";
  else if (last.chag === "שביעי של פסח") untilLabel = "במוצאי החג";
  else if (last.chag) untilLabel = "במוצאי " + last.chag;

  return {
    locked: true,
    period,
    greeting,
    heading,
    untilLabel,
    untilTime: formatHM(period.end, TZ),
    current,
  };
}

function lockDocument() {
  if (typeof document === "undefined") return null;
  let el = document.getElementById(LOCK_ID);
  if (el) return el;
  el = document.createElement("div");
  el.id = LOCK_ID;
  el.className = "siddur-lock";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-labelledby", "siddur-lock-title");
  el.innerHTML =
    '<div class="siddur-lock-frame" aria-hidden="true"></div>' +
    '<p class="siddur-lock-bsd">בס״ד</p>' +
    '<div class="siddur-lock-card">' +
      '<p class="siddur-lock-greeting" id="siddur-lock-title"></p>' +
      '<p class="siddur-lock-heading" hidden></p>' +
      '<p class="siddur-lock-body">הסידור אינו זמין בשבת ובחג</p>' +
      '<p class="siddur-lock-until"></p>' +
      '<p class="siddur-lock-memorial">לעילוי נשמת עדי עדיאל טויטו הי״ד</p>' +
    '</div>';
  (document.body || document.documentElement).appendChild(el);
  return el;
}

function setText(node, text, hideWhenEmpty) {
  if (!node) return;
  node.textContent = text || "";
  if (hideWhenEmpty) node.hidden = !text;
}

function hideSplash() {
  const splash = document.getElementById("memorial-splash");
  if (splash && splash.parentNode) splash.remove();
  try { document.documentElement.classList.add("splash-seen"); } catch (e) {}
}

export function applyLock(now) {
  if (typeof document === "undefined") return evaluateLock(now);
  const state = evaluateLock(now);
  const root = document.documentElement;
  if (!state.locked) {
    root.classList.remove("siddur-locked", "siddur-lock-pending");
    const el = document.getElementById(LOCK_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
    return state;
  }
  hideSplash();
  const el = lockDocument();
  setText(el.querySelector(".siddur-lock-greeting"), state.greeting);
  setText(el.querySelector(".siddur-lock-heading"), state.heading, true);
  setText(
    el.querySelector(".siddur-lock-until"),
    "יחזור לפעילות " + state.untilLabel + " בשעה " + state.untilTime
  );
  root.classList.add("siddur-locked");
  root.classList.remove("siddur-lock-pending");
  return state;
}

export function startLockWatcher(getNow) {
  const nowFn = typeof getNow === "function" ? getNow : function () { return new Date(); };
  const tick = function () { applyLock(nowFn()); };
  tick();
  setInterval(tick, 60 * 1000);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState !== "hidden") tick();
    });
  }
}

if (typeof document !== "undefined") {
  startLockWatcher();
}
