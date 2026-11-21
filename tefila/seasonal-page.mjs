import { HDate } from "@hebcal/core";
import { ilanotItem, isDone, markDone, omerItem } from "./seasonal.mjs?v=62";
import { omerCountText, omerNumber } from "./omer.mjs?v=62";

function paint() {
  const main = document.querySelector("main[data-seasonal]");
  if (!main) return;
  const id = main.dataset.seasonal;
  const now = new Date();
  const hd = new HDate(now);
  const item = id === "omer" ? omerItem(now, hd, true) : ilanotItem(now, true);
  const done = isDone(item);
  const box = document.getElementById("seasonal-status");
  const title = document.getElementById("seasonal-status-title");
  const text = document.getElementById("seasonal-status-text");
  const btn = document.getElementById("seasonal-done");
  const note = document.getElementById("seasonal-done-note");
  const n = id === "omer" ? omerNumber(hd.next()) : 0;
  if (id === "omer") {
    const count = document.getElementById("omer-count");
    if (count) count.textContent = n ? omerCountText(n) : "מתחילים לספור בליל ט״ז בניסן.";
  }
  if (box && title && text) {
    box.hidden = false;
    if (id === "omer") {
      title.textContent = n ? (done ? "ספרתי היום" : "סופרים יום " + n + " לעומר") : "לא בתקופת הספירה";
      text.textContent = n ? (done ? "הספירה של הלילה נרשמה. התזכורת תחזור מחר." : "הנוסח למטה מעודכן לספירה של הלילה, אחרי צאת הכוכבים.") : "הספירה מליל ט״ז בניסן עד ליל ה׳ בסיוון.";
    } else if (item.text) {
      title.textContent = done ? "בירכתי השנה" : "אפשר לברך עכשיו";
      text.textContent = done ? "ברכת האילנות של השנה נרשמה. התזכורת תחזור בניסן הבא." : item.text.split(". ")[0] + ".";
    } else {
      title.textContent = done ? "בירכתי השנה" : "הזמן לברך הוא בחודש ניסן";
      text.textContent = "התזכורת בעמוד הראשי תופיע בניסן.";
    }
  }
  if (btn) {
    btn.hidden = done;
    btn.onclick = function () {
      markDone(item);
      paint();
      if (note) note.hidden = false;
    };
  }
  if (note && !done) note.hidden = true;
}

paint();
document.addEventListener("visibilitychange", () => { if (document.visibilityState !== "hidden") paint(); });
