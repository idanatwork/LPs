import { daysLeftText, levanaDone, levanaState, markLevanaDone } from "./levana.mjs?v=61";

function fmt(d) {
  return new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", weekday: "long", day: "numeric", month: "long" }).format(d);
}

function paint() {
  const now = new Date();
  const s = levanaState(now);
  const box = document.getElementById("levana-status");
  const title = document.getElementById("levana-status-title");
  const text = document.getElementById("levana-status-text");
  const btn = document.getElementById("levana-done");
  const note = document.getElementById("levana-done-note");
  const done = levanaDone(s.key);
  if (box && title && text) {
    box.hidden = false;
    if (s.inWindow && !done) {
      title.textContent = daysLeftText(s.daysLeft);
      text.textContent = "אפשר לברך עד " + fmt(s.end) + ", בלילה כשהירח נראה.";
    } else if (s.inWindow && done) {
      title.textContent = "בירכתי החודש";
      text.textContent = "ברכת הלבנה של החודש נרשמה. התזכורת תחזור בחודש הבא.";
    } else if (now < s.start) {
      title.textContent = "עדיין לא הגיע הזמן";
      text.textContent = "אפשר להתחיל לברך מ" + fmt(s.start) + " בערב.";
    } else {
      title.textContent = "הזמן לברך החודש עבר";
      text.textContent = "אפשר לברך שוב בחודש הבא.";
    }
  }
  if (btn) {
    btn.hidden = done;
    btn.onclick = function () {
      markLevanaDone(s.key);
      btn.hidden = true;
      if (note) note.hidden = false;
      paint();
      if (note) note.hidden = false;
    };
  }
  if (note && !done) note.hidden = true;
}

paint();
document.addEventListener("visibilitychange", () => { if (document.visibilityState !== "hidden") paint(); });
