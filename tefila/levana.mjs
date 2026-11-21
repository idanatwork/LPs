import { HDate, Molad, months } from "@hebcal/core";

const DAY = 24 * 60 * 60 * 1000;
export const DONE_KEY = "tefila-levana-done";

/**
 * Kiddush levana window for the Hebrew month that `now` falls in.
 * Start: 7 full days after the molad (Shulchan Aruch, Yalkut Yosef). End: 15 days after the molad (Shulchan Aruch 426:3).
 * Av waits for the end of Tisha B'Av, Tishrei for the end of Yom Kippur (Yalkut Yosef).
 */
export function levanaState(now, hd = new HDate(now)) {
  const year = hd.getFullYear();
  const month = hd.getMonth();
  const molad = new Molad(year, month);
  const start = new Date(molad.getTchilasZmanKidushLevana7Days().epochMilliseconds);
  const end = new Date(molad.getSofZmanKidushLevana15Days().epochMilliseconds);
  const key = year + "-" + month;
  const day = hd.getDate();
  let held = false;
  if (month === months.AV && day <= 10) held = true;
  if (month === months.TISHREI && day <= 10) held = true;
  const inWindow = !held && now >= start && now <= end;
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY));
  return { key, start, end, inWindow, daysLeft };
}

export function levanaDone(key) {
  try { return localStorage.getItem(DONE_KEY) === key; } catch (e) { return false; }
}

export function markLevanaDone(key) {
  try { localStorage.setItem(DONE_KEY, key); } catch (e) {}
}

export function clearLevanaDone() {
  try { localStorage.removeItem(DONE_KEY); } catch (e) {}
}

export function daysLeftText(n) {
  if (n <= 1) return "הלילה האחרון לברך";
  if (n === 2) return "נותרו יומיים לברך";
  return "נותרו " + n + " ימים לברך";
}
