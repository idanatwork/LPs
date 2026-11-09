import { HDate, Location, Zmanim, months } from "@hebcal/core";
import { statusForHDate } from "./day-status.mjs";
import { ORANIT, ZMAN_ROWS, computeFromSun, formatHM } from "./zmanim-calc.mjs";

const input = document.getElementById("z-date");
const list = document.getElementById("z-list");
const extra = document.getElementById("z-extra");
const head = document.getElementById("z-head");

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
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = label;
    const time = document.createElement("b");
    time.textContent = formatHM(times[key]);
    li.append(name, time);
    list.append(li);
  }
  const bits = [];
  const weekday = hd.greg().getUTCDay();
  if (weekday === 5) bits.push(`הדלקת נרות ${formatHM(times.candles)}`);
  if (weekday === 6) bits.push(`הבדלה ${formatHM(times.tzeit)}`);
  if (status.flags.fast) {
    const tisha = hd.getMonth() === months.AV && hd.getDate() === 9;
    bits.push(tisha ? "הצום מתחיל אמש בשקיעה" : `תחילת הצום ${formatHM(times.alot)}`);
    bits.push(`סוף הצום ${formatHM(times.tzeit)}`);
  }
  extra.textContent = bits.join(" · ");
  extra.hidden = bits.length === 0;
}

const today = jerusalemToday();
input.value = today;
input.addEventListener("change", () => render(input.value || today));
document.getElementById("z-prev").addEventListener("click", () => {
  input.value = shift(input.value || today, -1);
  render(input.value);
});
document.getElementById("z-next").addEventListener("click", () => {
  input.value = shift(input.value || today, 1);
  render(input.value);
});
render(today);
