import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  dueAlerts,
  isShabbatOrYomTovLocked,
  isHoly,
  hebrewNowAt,
  zmanimForCivil,
  civilParts,
  civilYmd,
  alertTime,
  prayerPayload,
  shacharitMode,
  ORANIT,
  hdateFromCivil,
} from "../schedule.mjs";

const loc = ORANIT;

function rec(overrides = {}) {
  return {
    lat: loc.lat,
    lng: loc.lon,
    tz: loc.tz,
    alerts: { shacharit: true, mincha: true, minchaOffset: 15, arvit: true, arvitOffset: 0, ...overrides.alerts },
    lastSent: overrides.lastSent || {},
    ...overrides,
  };
}

function atCivil(y, m, d, hh, mm, ss = 5) {
  // Build a Date that is y-m-d hh:mm in Asia/Jerusalem.
  const guess = new Date(Date.UTC(y, m - 1, d, hh - 2, mm, ss));
  const p = civilParts(guess, loc.tz);
  const deltaMin = (hh * 60 + mm) - (p.hour * 60 + p.minute);
  return new Date(guess.getTime() + deltaMin * 60 * 1000);
}

describe("zmanim window matching", () => {
  it("fires shacharit at sunrise within the 5-minute window", () => {
    const nowBase = atCivil(2026, 11, 18, 12, 0); // Wednesday
    const p = civilParts(nowBase, loc.tz);
    const times = zmanimForCivil(p.y, p.m, p.d, loc.lat, loc.lon, loc.tz);
    const now = new Date(times.sunrise.getTime() + 30 * 1000);
    assert.equal(isShabbatOrYomTovLocked(now, loc.lat, loc.lon, loc.tz), false);
    const due = dueAlerts(rec(), now);
    assert.deepEqual(due, ["shacharit"]);
  });

  it("does not fire shacharit 6 minutes after sunrise", () => {
    const nowBase = atCivil(2026, 11, 18, 12, 0);
    const p = civilParts(nowBase, loc.tz);
    const times = zmanimForCivil(p.y, p.m, p.d, loc.lat, loc.lon, loc.tz);
    const now = new Date(times.sunrise.getTime() + 6 * 60 * 1000);
    assert.deepEqual(dueAlerts(rec(), now), []);
  });

  it("fires mincha at sunset minus offset", () => {
    const nowBase = atCivil(2026, 11, 18, 12, 0);
    const p = civilParts(nowBase, loc.tz);
    const times = zmanimForCivil(p.y, p.m, p.d, loc.lat, loc.lon, loc.tz);
    const when = alertTime("mincha", times, { minchaOffset: 15 });
    const now = new Date(when.getTime() + 20 * 1000);
    assert.deepEqual(dueAlerts(rec({ alerts: { shacharit: false, mincha: true, minchaOffset: 15, arvit: false } }), now), ["mincha"]);
  });

  it("fires arvit at tzeit plus offset", () => {
    const nowBase = atCivil(2026, 11, 18, 12, 0);
    const p = civilParts(nowBase, loc.tz);
    const times = zmanimForCivil(p.y, p.m, p.d, loc.lat, loc.lon, loc.tz);
    const when = alertTime("arvit", times, { arvitOffset: 10 });
    const now = new Date(when.getTime() + 20 * 1000);
    assert.deepEqual(dueAlerts(rec({ alerts: { shacharit: false, mincha: false, arvit: true, arvitOffset: 10 } }), now), ["arvit"]);
  });
});

describe("dedupe", () => {
  it("skips a prayer already sent today", () => {
    const nowBase = atCivil(2026, 11, 18, 12, 0);
    const p = civilParts(nowBase, loc.tz);
    const times = zmanimForCivil(p.y, p.m, p.d, loc.lat, loc.lon, loc.tz);
    const now = new Date(times.sunrise.getTime() + 30 * 1000);
    const today = civilYmd(now, loc.tz);
    assert.deepEqual(dueAlerts(rec({ lastSent: { shacharit: today } }), now), []);
  });
});

describe("Shabbat and Yom Tov suppression", () => {
  it("locks from Friday candles until Saturday Rabbeinu Tam", () => {
    const friday = atCivil(2026, 11, 20, 12, 0); // Friday 20 Nov 2026
    const fp = civilParts(friday, loc.tz);
    const fTimes = zmanimForCivil(fp.y, fp.m, fp.d, loc.lat, loc.lon, loc.tz);
    const before = new Date(fTimes.candles.getTime() - 60 * 1000);
    const after = new Date(fTimes.candles.getTime() + 60 * 1000);
    assert.equal(isShabbatOrYomTovLocked(before, loc.lat, loc.lon, loc.tz), false);
    assert.equal(isShabbatOrYomTovLocked(after, loc.lat, loc.lon, loc.tz), true);

    const saturday = atCivil(2026, 11, 21, 12, 0);
    const sp = civilParts(saturday, loc.tz);
    const sTimes = zmanimForCivil(sp.y, sp.m, sp.d, loc.lat, loc.lon, loc.tz);
    const mid = atCivil(2026, 11, 21, 10, 0);
    const afterRT = new Date(sTimes.rabbeinuTam.getTime() + 60 * 1000);
    const beforeRT = new Date(sTimes.rabbeinuTam.getTime() - 60 * 1000);
    assert.equal(isShabbatOrYomTovLocked(mid, loc.lat, loc.lon, loc.tz), true);
    assert.equal(isShabbatOrYomTovLocked(beforeRT, loc.lat, loc.lon, loc.tz), true);
    assert.equal(isShabbatOrYomTovLocked(afterRT, loc.lat, loc.lon, loc.tz), false);
  });

  it("does not fire any alert during the Shabbat lock even if the window matches", () => {
    const friday = atCivil(2026, 11, 20, 12, 0);
    const fp = civilParts(friday, loc.tz);
    const fTimes = zmanimForCivil(fp.y, fp.m, fp.d, loc.lat, loc.lon, loc.tz);
    const minchaWhen = alertTime("mincha", fTimes, { minchaOffset: 15 });
    // 15 min before sunset is after candles (20 min before sunset) — should be locked
    const now = new Date(minchaWhen.getTime() + 20 * 1000);
    assert.equal(isShabbatOrYomTovLocked(now, loc.lat, loc.lon, loc.tz), true);
    assert.deepEqual(dueAlerts(rec(), now), []);
  });

  it("locks Pesach I (Israel) from erev candles until Rabbeinu Tam", () => {
    // Pesach 5787: 15 Nisan 5787 = Thu 22 Apr 2027; erev = Wed 21 Apr 2027
    const erev = atCivil(2027, 4, 21, 12, 0);
    const ep = civilParts(erev, loc.tz);
    const eTimes = zmanimForCivil(ep.y, ep.m, ep.d, loc.lat, loc.lon, loc.tz);
    const before = new Date(eTimes.candles.getTime() - 60 * 1000);
    const after = new Date(eTimes.candles.getTime() + 60 * 1000);
    assert.equal(isShabbatOrYomTovLocked(before, loc.lat, loc.lon, loc.tz), false);
    assert.equal(isShabbatOrYomTovLocked(after, loc.lat, loc.lon, loc.tz), true);
    const day = atCivil(2027, 4, 22, 10, 0);
    assert.equal(isShabbatOrYomTovLocked(day, loc.lat, loc.lon, loc.tz), true);
    const dp = civilParts(day, loc.tz);
    const dTimes = zmanimForCivil(dp.y, dp.m, dp.d, loc.lat, loc.lon, loc.tz);
    const afterRT = new Date(dTimes.rabbeinuTam.getTime() + 60 * 1000);
    assert.equal(isShabbatOrYomTovLocked(afterRT, loc.lat, loc.lon, loc.tz), false);
  });

  it("does not lock Chol HaMoed", () => {
    // 16 Nisan 5787 = Fri 23 Apr 2027, Chol HaMoed Pesach (weekday)
    const chm = atCivil(2027, 4, 23, 10, 0);
    const hd = hebrewNowAt(chm, loc.lat, loc.lon, loc.tz);
    assert.equal(isHoly(hd), false);
    assert.equal(isShabbatOrYomTovLocked(chm, loc.lat, loc.lon, loc.tz), false);
  });
});

describe("shacharit sof zman shema (MGA)", () => {
  it("treats a missing shacharitWhen as sunrise (v47 compatibility)", () => {
    assert.equal(shacharitMode({ shacharit: true }), "sunrise");
    const nowBase = atCivil(2026, 11, 18, 12, 0);
    const p = civilParts(nowBase, loc.tz);
    const times = zmanimForCivil(p.y, p.m, p.d, loc.lat, loc.lon, loc.tz);
    const now = new Date(times.sunrise.getTime() + 30 * 1000);
    assert.deepEqual(dueAlerts(rec(), now), ["shacharit"]);
  });

  it("fires 15 minutes before sof zman kriat shema MGA", () => {
    const nowBase = atCivil(2026, 11, 18, 12, 0);
    const p = civilParts(nowBase, loc.tz);
    const times = zmanimForCivil(p.y, p.m, p.d, loc.lat, loc.lon, loc.tz);
    const alerts = { shacharit: true, shacharitWhen: "shema", shacharitOffset: 15, mincha: false, arvit: false };
    const when = alertTime("shacharit", times, alerts);
    assert.equal(when.getTime(), times.shemaMGA.getTime() - 15 * 60 * 1000);
    const now = new Date(when.getTime() + 20 * 1000);
    assert.deepEqual(dueAlerts(rec({ alerts }), now), ["shacharit"]);
    const payload = prayerPayload("shacharit", times, alerts, loc.tz);
    assert.equal(payload.title, "שחרית");
    assert.match(payload.body, /^סוף זמן קריאת שמע בשעה \d{2}:\d{2}$/);
  });

  it("does not fire shema-mode shacharit 6 minutes after the offset", () => {
    const nowBase = atCivil(2026, 11, 18, 12, 0);
    const p = civilParts(nowBase, loc.tz);
    const times = zmanimForCivil(p.y, p.m, p.d, loc.lat, loc.lon, loc.tz);
    const alerts = { shacharit: true, shacharitWhen: "shema", shacharitOffset: 15, mincha: false, arvit: false };
    const when = alertTime("shacharit", times, alerts);
    const now = new Date(when.getTime() + 6 * 60 * 1000);
    assert.deepEqual(dueAlerts(rec({ alerts }), now), []);
  });

  it("does not fire shema-mode shacharit at sunrise", () => {
    const nowBase = atCivil(2026, 11, 18, 12, 0);
    const p = civilParts(nowBase, loc.tz);
    const times = zmanimForCivil(p.y, p.m, p.d, loc.lat, loc.lon, loc.tz);
    const alerts = { shacharit: true, shacharitWhen: "shema", shacharitOffset: 15, mincha: false, arvit: false };
    const now = new Date(times.sunrise.getTime() + 30 * 1000);
    assert.deepEqual(dueAlerts(rec({ alerts }), now), []);
  });

  it("dedupes shema-mode shacharit after a send the same day", () => {
    const nowBase = atCivil(2026, 11, 18, 12, 0);
    const p = civilParts(nowBase, loc.tz);
    const times = zmanimForCivil(p.y, p.m, p.d, loc.lat, loc.lon, loc.tz);
    const alerts = { shacharit: true, shacharitWhen: "shema", shacharitOffset: 15, mincha: false, arvit: false };
    const when = alertTime("shacharit", times, alerts);
    const now = new Date(when.getTime() + 20 * 1000);
    const today = civilYmd(now, loc.tz);
    assert.deepEqual(dueAlerts(rec({ alerts, lastSent: { shacharit: today } }), now), []);
  });

  it("suppresses shema-mode shacharit during the Shabbat lock", () => {
    const friday = atCivil(2026, 11, 20, 12, 0);
    const fp = civilParts(friday, loc.tz);
    const fTimes = zmanimForCivil(fp.y, fp.m, fp.d, loc.lat, loc.lon, loc.tz);
    const alerts = { shacharit: true, shacharitWhen: "shema", shacharitOffset: 15, mincha: false, arvit: false };
    const mid = atCivil(2026, 11, 21, 10, 0);
    assert.equal(isShabbatOrYomTovLocked(mid, loc.lat, loc.lon, loc.tz), true);
    assert.deepEqual(dueAlerts(rec({ alerts }), mid), []);
  });
});
