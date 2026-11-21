import { Location, Zmanim } from "@hebcal/core";
import { activeService, hebrewNow, statusForHDate } from "./day-status.mjs?v=60";
import { ORANIT, computeFromSun, formatHM } from "./zmanim-calc.mjs";
import { halachaForHDate } from "./halacha-yomit.mjs?v=60";
import { daysLeftText, levanaDone, levanaState } from "./levana.mjs?v=60";

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
    box.removeAttribute("hidden");
  }
  const halachaBox = document.getElementById("halacha-yomit");
  if (halachaBox && status.hd) {
    const item = halachaForHDate(status.hd);
    const title = document.getElementById("halacha-title");
    const body = document.getElementById("halacha-body");
    const source = document.getElementById("halacha-src");
    if (title) title.textContent = item.title;
    if (body) body.textContent = item.body;
    if (source) source.textContent = item.source;
    halachaBox.removeAttribute("hidden");
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
  paintFab(service);
  paintLevana(now);
}

function paintLevana(now) {
  const banner = document.getElementById("levana-banner");
  if (!banner) return;
  let show = false;
  try {
    const s = levanaState(now);
    show = s.inWindow && !levanaDone(s.key);
    if (show) document.getElementById("levana-banner-text").textContent = daysLeftText(s.daysLeft) + ". אחרי שבירכת, סמן בסוף הנוסח ״בירכתי״ והתזכורת תיעלם.";
  } catch (e) {}
  banner.hidden = !show;
}

const FAB_NAMES = { shacharit: "שחרית", mincha: "מנחה", arvit: "ערבית" };
let fabObserver = null;
function paintFab(service) {
  const fab = document.getElementById("now-fab");
  const card = document.getElementById("card-" + service);
  if (!fab || !card || !FAB_NAMES[service]) return;
  fab.setAttribute("href", card.getAttribute("href"));
  const text = document.getElementById("now-fab-text");
  if (text) text.textContent = FAB_NAMES[service];
  fab.setAttribute("aria-label", FAB_NAMES[service] + " עכשיו");
  fab.hidden = false;
  fab.classList.remove("fab-off");
  if (fabObserver) fabObserver.disconnect();
  if ("IntersectionObserver" in window) {
    fabObserver = new IntersectionObserver((entries) => {
      entries.forEach((e) => fab.classList.toggle("fab-off", e.isIntersecting));
    }, { threshold: 0.6 });
    fabObserver.observe(card);
  }
}

function refreshHub() {
  if (document.visibilityState === "hidden") return;
  paintHub();
}

paintHub();
document.addEventListener("visibilitychange", refreshHub);
window.addEventListener("pageshow", refreshHub);
