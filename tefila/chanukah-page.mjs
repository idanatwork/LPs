import { HDate } from "@hebcal/core";
import { chanukahNight, isDone, markDone } from "./seasonal.mjs?v=65";

function paint() {
  const now = new Date();
  const hd = new HDate(now);
  const { k, year } = chanukahNight(hd);
  const inSeason = k >= 1 && k <= 8;
  const item = { doneKey: "tefila-chanukah-done", doneValue: k + "-" + year };
  const done = inSeason && isDone(item);
  const box = document.getElementById("seasonal-status");
  const title = document.getElementById("seasonal-status-title");
  const text = document.getElementById("seasonal-status-text");
  const btn = document.getElementById("seasonal-done");
  const note = document.getElementById("seasonal-done-note");
  const sh = document.getElementById("shehecheyanu");
  const shNote = document.getElementById("shehecheyanu-note");
  if (sh) sh.hidden = inSeason && k !== 1;
  if (shNote) shNote.hidden = false;
  if (box && title && text) {
    box.hidden = false;
    if (inSeason) {
      title.textContent = k === 1 ? "הלילה נר ראשון" : "הלילה " + k + " נרות";
      text.textContent = k === 1 ? "מברכים שלוש ברכות: להדליק נר של חנוכה, שעשה ניסים ושהחיינו." : "מברכים שתי ברכות: להדליק נר של חנוכה ושעשה ניסים. בלי שהחיינו.";
    } else {
      title.textContent = "לא בחנוכה";
      text.textContent = "הנוסח מוצג במלואו. שהחיינו אומרים בלילה הראשון בלבד.";
    }
  }
  if (btn) {
    btn.hidden = !inSeason || done;
    btn.onclick = function () { markDone(item); paint(); if (note) note.hidden = false; };
  }
  if (note && !done) note.hidden = true;
}
paint();
document.addEventListener("visibilitychange", () => { if (document.visibilityState !== "hidden") paint(); });
