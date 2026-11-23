import { Location, Zmanim } from "@hebcal/core";
import { activeService, hebrewNow, statusForHDate } from "./day-status.mjs?v=71";
import { ORANIT, computeFromSun, formatHM } from "./zmanim-calc.mjs";
import { halachaForHDate } from "./halacha-yomit.mjs?v=71";
import { markDone, seasonalItems } from "./seasonal.mjs?v=71";

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
  paintSeasonal(now);
}

function paintSeasonal(now) {
  const host = document.getElementById("seasonal-cards");
  if (!host) return;
  let items = [];
  try { items = seasonalItems(now); } catch (e) {}
  host.textContent = "";
  items.forEach((item) => {
    const card = document.createElement("aside");
    card.className = "install-banner seasonal-card";
    card.dataset.seasonal = item.id;
    const title = document.createElement("p");
    title.className = "install-banner-title";
    title.textContent = item.title;
    const text = document.createElement("p");
    text.className = "install-banner-text";
    text.textContent = item.text;
    const actions = document.createElement("div");
    actions.className = "install-banner-actions";
    if (item.href) {
      const link = document.createElement("a");
      link.className = "shortcut-btn shortcut-start";
      link.href = item.href;
      link.textContent = item.hrefLabel;
      actions.appendChild(link);
    }
    if (item.doneLabel && item.doneKey) {
      const done = document.createElement("button");
      done.type = "button";
      done.className = "shortcut-btn" + (item.href ? "" : " shortcut-start");
      done.textContent = item.doneLabel;
      done.addEventListener("click", () => { markDone(item); paintSeasonal(new Date()); });
      actions.appendChild(done);
    }
    card.appendChild(title);
    card.appendChild(text);
    card.appendChild(actions);
    host.appendChild(card);
  });
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
