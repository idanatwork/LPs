// v75: Friday / erev Yom Tov — Mincha page open from candle lighting until sunset; all else locked.
import assert from "node:assert/strict";
import { evaluateLock, timesForCivilIso } from "../tefila/shabbat-lock.mjs";

let n = 0;
function check(label, fn) { fn(); n++; console.log("ok", label); }
const min = (d, m) => new Date(d.getTime() + m * 60 * 1000);

// Friday 20 Nov 2026 (Oranit)
const fri = timesForCivilIso("2026-11-20");
check("Friday before candles: nothing locked", () => {
  assert.equal(evaluateLock(min(fri.candles, -5), { mincha: false }).locked, false);
  assert.equal(evaluateLock(min(fri.candles, -5), { mincha: true }).locked, false);
});
check("Friday between candles and sunset: other pages locked, with Mincha link", () => {
  const s = evaluateLock(min(fri.candles, 5), { mincha: false });
  assert.equal(s.locked, true);
  assert.equal(s.minchaOpen, true);
  assert.equal(s.minchaUntil.getTime(), fri.sunset.getTime());
});
check("Friday between candles and sunset: Mincha page open", () => {
  assert.equal(evaluateLock(min(fri.candles, 5), { mincha: true }).locked, false);
  assert.equal(evaluateLock(min(fri.sunset, -1), { mincha: true }).locked, false);
});
check("Friday at/after sunset: Mincha page locked too", () => {
  assert.equal(evaluateLock(min(fri.sunset, 0.5), { mincha: true }).locked, true);
  const s = evaluateLock(min(fri.sunset, 1), { mincha: false });
  assert.equal(s.locked, true);
  assert.equal(s.minchaOpen, false);
});
check("Shabbat day: Mincha page locked", () => {
  const sat = timesForCivilIso("2026-11-21");
  assert.equal(evaluateLock(min(sat.sunset, -30), { mincha: true }).locked, true);
});

// Erev Pesach 5787 (Wed 21 Apr 2027) — weekday eve, Mincha open until sunset
const erevPesach = timesForCivilIso("2027-04-21");
check("Erev Yom Tov: Mincha open between candles and sunset", () => {
  assert.equal(evaluateLock(min(erevPesach.candles, 5), { mincha: true }).locked, false);
  assert.equal(evaluateLock(min(erevPesach.candles, 5), { mincha: false }).locked, true);
});

// Shavuot 5787 = Fri 11 Jun 2027 → Shabbat: the Friday is Yom Tov, Mincha stays locked
const shavuotFri = timesForCivilIso("2027-06-11");
check("Yom Tov on Friday (into Shabbat): Mincha locked before sunset", () => {
  const s = evaluateLock(min(shavuotFri.candles, 5), { mincha: true });
  assert.equal(s.locked, true);
  assert.equal(s.minchaOpen, false);
});

// Rosh Hashana 5787: Sat 12 + Sun 13 Sep 2026; erev Fri 11 Sep
const rhErev = timesForCivilIso("2026-09-11");
const rh1 = timesForCivilIso("2026-09-12");
check("Erev RH on Friday: Mincha open until sunset", () => {
  assert.equal(evaluateLock(min(rhErev.candles, 5), { mincha: true }).locked, false);
});
check("Day 1 RH before day 2: Mincha locked", () => {
  assert.equal(evaluateLock(min(rh1.candles, 5), { mincha: true }).locked, true);
});

console.log(n + " lock checks passed");
