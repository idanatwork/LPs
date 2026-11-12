import { Location, Zmanim } from "@hebcal/core";
import { activeService, hebrewNow, statusForHDate } from "./day-status.mjs?v=21";
import { ORANIT, computeFromSun, formatHM } from "./zmanim-calc.mjs";

function paintHub() {
  const now = new Date();
  const service = activeService(now);
  const status = statusForHDate(hebrewNow(now), service);
  const box = document.getElementById("today-banner");
  if (box) {
    const date = box.querySelector(".date");
    const line = box.querySelector(".status");
    const note = box.querySelector(".extra");
    if (date) date.textContent = status.hebrewDate;
    if (line) line.textContent = status.chips.join(" · ");
    if (note) {
      note.textContent = status.note || "";
      note.hidden = !status.note;
    }
    box.hidden = false;
  }
  const strip = document.getElementById("next-zman");
  if (strip) {
    const loc = new Location(ORANIT.lat, ORANIT.lon, true, ORANIT.tz, "Oranit", "IL");
    const sun = new Zmanim(loc, now, false);
    const times = computeFromSun(sun.sunrise(), sun.sunset());
    const order = [
      ["alot", "עלות השחר"],
      ["sunrise", "הנץ"],
      ["chatzot", "חצות"],
      ["minchaGedola", "מנחה גדולה"],
      ["sunset", "שקיעה"],
      ["tzeit", "צאת הכוכבים"],
    ];
    const upcoming = order.find(([key]) => times[key] > now);
    strip.textContent = upcoming ? `הזמן הבא: ${upcoming[1]} ${formatHM(times[upcoming[0]])}` : "עבר צאת הכוכבים";
  }
  document.querySelectorAll(".cards a.now").forEach((el) => {
    el.classList.remove("now");
    el.removeAttribute("aria-current");
  });
  const card = document.getElementById("card-" + service);
  if (card) {
    card.classList.add("now");
    card.setAttribute("aria-current", "true");
  }
}

function refreshHub() {
  if (document.visibilityState === "hidden") return;
  paintHub();
}

paintHub();
document.addEventListener("visibilitychange", refreshHub);
window.addEventListener("pageshow", refreshHub);
