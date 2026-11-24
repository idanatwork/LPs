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
  minchaOffset,
  candlesTonight,
  pushTtl,
  MINCHA_DEFAULT,
  CANDLES_DEFAULT,
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
    const when = alertTime("mincha", times, { minchaOffset: 15, minchaOffsetSet: true });
    const now = new Date(when.getTime() + 20 * 1000);
    assert.deepEqual(dueAlerts(rec({ alerts: { shacharit: false, mincha: true, minchaOffset: 15, minchaOffsetSet: true, arvit: false } }), now), ["mincha"]);
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
    const minchaWhen = alertTime("mincha", fTimes, { minchaOffset: 15, minchaOffsetSet: true });
    // 15 min before sunset is after candles (20 min before sunset) — should be locked
    const now = new Date(minchaWhen.getTime() + 20 * 1000);
    assert.equal(isShabbatOrYomTovLocked(now, loc.lat, loc.lon, loc.tz), true);
    assert.deepEqual(dueAlerts(rec({ alerts: { shacharit: true, mincha: true, minchaOffset: 15, minchaOffsetSet: true, arvit: true } }), now), []);
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


// ---- v75: Mincha default and candle-lighting alert ----

function timesOn(y, m, d) {
  return zmanimForCivil(y, m, d, loc.lat, loc.lon, loc.tz);
}
const candlesOnly = { shacharit: false, mincha: false, arvit: false };

describe("v75 mincha default (30 min before sunset)", () => {
  it("defaults to 30 and migrates an untouched 15", () => {
    assert.equal(MINCHA_DEFAULT, 30);
    assert.equal(minchaOffset({}), 30);
    assert.equal(minchaOffset({ minchaOffset: 15 }), 30);
    assert.equal(minchaOffset({ minchaOffset: 15, minchaOffsetSet: true }), 15);
    assert.equal(minchaOffset({ minchaOffset: 20 }), 20);
    assert.equal(minchaOffset({ minchaOffset: 30 }), 30);
  });

  it("an old record (minchaOffset 15, no flag) now fires 30 min before sunset, not 15", () => {
    const t = timesOn(2026, 11, 18);
    const old = rec({ alerts: { shacharit: false, mincha: true, minchaOffset: 15, arvit: false } });
    const at30 = new Date(t.sunset.getTime() - 30 * 60 * 1000 + 20 * 1000);
    const at15 = new Date(t.sunset.getTime() - 15 * 60 * 1000 + 20 * 1000);
    assert.deepEqual(dueAlerts(old, at30), ["mincha"]);
    assert.deepEqual(dueAlerts(old, at15), []);
  });

  it("Friday mincha at the new default fires before candle lighting", () => {
    const t = timesOn(2026, 11, 20);
    const now = new Date(t.sunset.getTime() - 30 * 60 * 1000 + 20 * 1000);
    assert.equal(isShabbatOrYomTovLocked(now, loc.lat, loc.lon, loc.tz), false);
    const r = rec({ alerts: { shacharit: false, mincha: true, minchaOffset: 30, arvit: false, candles: false } });
    assert.deepEqual(dueAlerts(r, now), ["mincha"]);
  });
});

describe("v75 candle-lighting alert", () => {
  it("defaults to 20 minutes before candle lighting", () => {
    assert.equal(CANDLES_DEFAULT, 20);
  });

  it("fires on Friday 20 min before candles (on by default for old records)", () => {
    const t = timesOn(2026, 11, 20);
    const now = new Date(t.candles.getTime() - 20 * 60 * 1000 + 20 * 1000);
    assert.deepEqual(dueAlerts(rec({ alerts: candlesOnly }), now), ["candles"]);
    const payload = prayerPayload("candles", { ...t, candlesFor: "שבת שלום" }, {}, loc.tz);
    assert.equal(payload.title, "הדלקת נרות");
    assert.match(payload.body, /^הדלקת נרות בשעה \d{2}:\d{2} · שבת שלום$/);
  });

  it("respects a custom offset and an explicit opt-out", () => {
    const t = timesOn(2026, 11, 20);
    const at45 = new Date(t.candles.getTime() - 45 * 60 * 1000 + 20 * 1000);
    assert.deepEqual(dueAlerts(rec({ alerts: { ...candlesOnly, candlesOffset: 45 } }), at45), ["candles"]);
    const at20 = new Date(t.candles.getTime() - 20 * 60 * 1000 + 20 * 1000);
    assert.deepEqual(dueAlerts(rec({ alerts: { ...candlesOnly, candles: false } }), at20), []);
  });

  it("dedupes the candle alert the same day", () => {
    const t = timesOn(2026, 11, 20);
    const now = new Date(t.candles.getTime() - 20 * 60 * 1000 + 20 * 1000);
    assert.deepEqual(dueAlerts(rec({ alerts: candlesOnly, lastSent: { candles: civilYmd(now, loc.tz) } }), now), []);
  });

  it("does not fire on a regular weekday or on Chol HaMoed", () => {
    const t = timesOn(2026, 11, 18);
    const now = new Date(t.candles.getTime() - 20 * 60 * 1000 + 20 * 1000);
    assert.deepEqual(dueAlerts(rec({ alerts: candlesOnly }), now), []);
    assert.equal(candlesTonight(2027, 4, 25), null); // Sun 18 Nisan, Chol HaMoed
  });

  it("fires on erev Yom Tov (erev Pesach 5787, Wed 21 Apr 2027)", () => {
    assert.equal(candlesTonight(2027, 4, 21), "חג שמח");
    const t = timesOn(2027, 4, 21);
    const now = new Date(t.candles.getTime() - 20 * 60 * 1000 + 20 * 1000);
    assert.deepEqual(dueAlerts(rec({ alerts: candlesOnly }), now), ["candles"]);
  });

  it("erev Yom Kippur says גמר חתימה טובה", () => {
    // 10 Tishrei 5787 = Mon 21 Sep 2026; erev = Sun 20 Sep 2026
    assert.equal(candlesTonight(2026, 9, 20), "גמר חתימה טובה");
  });

  it("no alert on the 2nd day of Rosh Hashana (candles fall inside day 1)", () => {
    // RH 5787: Sat 12 + Sun 13 Sep 2026. Erev = Fri 11 Sep.
    assert.equal(candlesTonight(2026, 9, 11), "שבת שלום");
    assert.equal(candlesTonight(2026, 9, 12), null); // Shabbat/RH I → RH II
    const t = timesOn(2026, 9, 12);
    const now = new Date(t.candles.getTime() - 20 * 60 * 1000 + 20 * 1000);
    assert.equal(isShabbatOrYomTovLocked(now, loc.lat, loc.lon, loc.tz), true);
    assert.deepEqual(dueAlerts(rec({ alerts: candlesOnly }), now), []);
  });

  it("no alert for Yom Tov → Shabbat chain (Shavuot 5787 on Friday 11 Jun 2027)", () => {
    // 6 Sivan 5787 = Fri 11 Jun 2027 (Israel), followed by Shabbat.
    assert.equal(candlesTonight(2027, 6, 10), "חג שמח");
    assert.equal(candlesTonight(2027, 6, 11), null);
    const t = timesOn(2027, 6, 11);
    for (const off of [20, 45, 5]) {
      const now = new Date(t.candles.getTime() - off * 60 * 1000 + 20 * 1000);
      assert.equal(isShabbatOrYomTovLocked(now, loc.lat, loc.lon, loc.tz), true, "locked at -" + off);
      assert.deepEqual(dueAlerts(rec({ alerts: { ...candlesOnly, candlesOffset: off } }), now), []);
    }
  });

  it("no alert on motzei Shabbat into Yom Tov (Shabbat 19 May 2029 → Shavuot 5789)", () => {
    // 6 Sivan 5789 = Sun 20 May 2029 (Israel): Shavuot starts on motzei Shabbat, no candles before Shabbat ends.
    assert.equal(isHoly(hdateFromCivil(2029, 5, 20)), true);
    assert.equal(hdateFromCivil(2029, 5, 19).getDay(), 6);
    assert.equal(candlesTonight(2029, 5, 19), null);
    const t = timesOn(2029, 5, 19);
    for (let mins = -60; mins <= 60; mins += 5) {
      const now = new Date(t.candles.getTime() + mins * 60 * 1000);
      assert.deepEqual(dueAlerts(rec({ alerts: candlesOnly }), now), [], "minute " + mins);
    }
  });

  it("Rosh Hashana LaBehemot (1 Elul) is not Yom Tov: no candle alert on 29 Av", () => {
    assert.equal(isHoly(hdateFromCivil(2029, 8, 12)), false);
    assert.equal(candlesTonight(2029, 8, 11), null);
  });

  it("never fires any kind inside a Shabbat or Yom Tov lock (sweep)", () => {
    const all = { shacharit: true, shacharitWhen: "shema", shacharitOffset: 15, mincha: true, minchaOffset: 5, minchaOffsetSet: true, arvit: true, arvitOffset: 0, candles: true, candlesOffset: 5 };
    const start = atCivil(2026, 9, 11, 0, 0); // Fri before RH 5787 through Sun night
    for (let i = 0; i < (3 * 24 * 60) / 5; i++) {
      const now = new Date(start.getTime() + i * 5 * 60 * 1000 + 20 * 1000);
      if (!isShabbatOrYomTovLocked(now, loc.lat, loc.lon, loc.tz)) continue;
      assert.deepEqual(dueAlerts(rec({ alerts: all }), now), [], now.toISOString());
    }
  });

  it("push TTL never extends past candle lighting on Friday", () => {
    const t = timesOn(2026, 11, 20);
    const now = new Date(t.candles.getTime() - 20 * 60 * 1000);
    assert.equal(pushTtl(rec(), now), 20 * 60);
    const weekday = timesOn(2026, 11, 18);
    assert.equal(pushTtl(rec(), new Date(weekday.candles.getTime() - 20 * 60 * 1000)), 3600);
  });
});
