import { formatHeaderDate, isNightService, mountHeaderDate, statusFor } from "./day-status.mjs?v=19";
import { halachaForHDate } from "./halacha-yomit.mjs?v=19";

function openMatching(flags) {
  document.querySelectorAll("details[data-open]").forEach((el) => {
    el.open = false;
    el.classList.remove("is-today");
  });
  document.querySelectorAll("details[data-open]").forEach((el) => {
    const keys = el.dataset.open.split(/\s+/);
    if (!keys.some((k) => flags[k])) return;
    el.classList.add("is-today");
    el.open = true;
    let p = el.parentElement;
    while (p) {
      if (p.tagName === "DETAILS") {
        if (p.dataset.open && !p.dataset.open.split(/\s+/).some((k) => flags[k])) break;
        p.open = true;
      }
      p = p.parentElement;
    }
  });
}

function showBanner(status) {
  const box = document.getElementById("today-banner");
  if (!box) return;
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

function showHalacha(status) {
  const box = document.getElementById("halacha-yomit");
  if (!box || !status.hd) return;
  const item = halachaForHDate(status.hd);
  const title = document.getElementById("halacha-title");
  const body = document.getElementById("halacha-body");
  const source = document.getElementById("halacha-src");
  if (title) title.textContent = item.title;
  if (body) body.textContent = item.body;
  if (source) source.textContent = item.source;
}

function init() {
  const service = document.body && document.body.dataset.service;
  if (!service) return;
  try {
    const now = new Date();
    const status = statusFor(now, service);
    mountHeaderDate(formatHeaderDate(status, isNightService(now, service), now));
    showBanner(status);
    openMatching(status.flags);
    showHalacha(status);
  } catch (e) {
    const box = document.getElementById("today-banner");
    if (box) {
      const line = box.querySelector(".status");
      if (line) line.textContent = "לא ניתן לחשב את התאריך.";
      box.hidden = false;
    }
  }
}

function refresh() {
  if (document.visibilityState === "hidden") return;
  init();
}

init();
document.addEventListener("visibilitychange", refresh);
window.addEventListener("pageshow", refresh);
