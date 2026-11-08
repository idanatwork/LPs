import { activeService, hebrewNow, statusForHDate } from "./day-status.mjs";

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

const card = document.getElementById("card-" + service);
if (card) {
  card.classList.add("now");
  card.setAttribute("aria-current", "true");
}
