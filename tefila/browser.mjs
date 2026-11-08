import { statusFor } from "./day-status.mjs";

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

function init() {
  const service = document.body && document.body.dataset.service;
  if (!service) return;
  try {
    const status = statusFor(new Date(), service);
    showBanner(status);
    openMatching(status.flags);
  } catch (e) {
    const box = document.getElementById("today-banner");
    if (box) {
      const line = box.querySelector(".status");
      if (line) line.textContent = "לא ניתן לחשב את התאריך.";
      box.hidden = false;
    }
  }
}

init();
