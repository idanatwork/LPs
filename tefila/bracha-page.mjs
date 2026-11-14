import { formatHeaderDate, hebrewNow, isNightService, mountHeaderDate, statusForHDate } from "./day-status.mjs?v=23";

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

function paint() {
  const box = document.getElementById("today-banner");
  try {
    const now = new Date();
    const status = statusForHDate(hebrewNow(now), "shacharit");
    mountHeaderDate(formatHeaderDate(status, isNightService(now, "shacharit"), now));
    const occasion = ["ראש חודש", "שבת", "חנוכה", "פורים", "חול המועד", "עשרת ימי תשובה"].filter((name) => status.chips.includes(name));
    if (box) {
      const date = box.querySelector(".date");
      const line = box.querySelector(".status");
      const note = box.querySelector(".extra");
      if (date) date.textContent = status.hebrewDate;
      if (line) line.textContent = occasion.join(" · ");
      if (note) {
        note.textContent = status.note || "";
        note.hidden = !status.note;
      }
      box.hidden = false;
    }
    openMatching(status.flags);
  } catch (e) {
    if (box) box.hidden = false;
  }
}

function refresh() {
  if (document.visibilityState === "hidden") return;
  paint();
}

paint();
document.addEventListener("visibilitychange", refresh);
window.addEventListener("pageshow", refresh);
