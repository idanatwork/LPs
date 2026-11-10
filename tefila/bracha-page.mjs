import { hebrewNow, statusForHDate } from "./day-status.mjs?v=6";

function openMatching(flags) {
  document.querySelectorAll("details[data-open]").forEach((el) => {
    el.open = false;
    el.classList.remove("is-today");
  });
  document.querySelectorAll("details[data-open]").forEach((el) => {
    const keys = el.dataset.open.split(/\s+/);
    if (!keys.some((k) => flags[k])) return;
    el.classList.add("is-today");
    let p = el;
    while (p) {
      if (p.tagName === "DETAILS") p.open = true;
      p = p.parentElement;
    }
  });
}

function paint() {
  const box = document.getElementById("today-banner");
  try {
    const status = statusForHDate(hebrewNow(new Date()), "shacharit");
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
