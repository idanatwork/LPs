import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { HDate, months } from "@hebcal/core";
import { civilWeekday, statusFor } from "../tefila/day-status.mjs";
import { EVERYDAY, halachaForHDate, occasionTitles } from "../tefila/halacha-yomit.mjs";

if (process.env.TZ !== "Asia/Jerusalem") {
  const run = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
    env: { ...process.env, TZ: "Asia/Jerusalem" },
    stdio: "inherit",
  });
  process.exit(run.status ?? 1);
}

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok });
  console.log(`${ok ? "OK " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
}

function israel(y, m, d, hour, minute) {
  const probe = new Date(Date.UTC(y, m - 1, d, hour, minute));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(probe);
  const gotH = Number(parts.find((part) => part.type === "hour").value);
  const gotM = Number(parts.find((part) => part.type === "minute").value);
  return new Date(probe.getTime() + ((hour - gotH) * 60 + (minute - gotM)) * 60000);
}

const tuesdayMorning = israel(2026, 11, 10, 8, 30);
const tuesday = statusFor(tuesdayMorning, "shacharit");
check(
  "Tuesday 08:30 Israel is weekday-2, not Monday",
  tuesday.flags["weekday-2"] === true && !tuesday.flags["weekday-1"],
  tuesday.hebrewDate + " " + Object.keys(tuesday.flags).filter((key) => key.startsWith("weekday")).join(","),
);
check("that morning is 30 Cheshvan", tuesday.hebrewDate.startsWith("ל׳"), tuesday.hebrewDate);
check("civil weekday uses local date", civilWeekday(new HDate(tuesdayMorning)) === 2);

const sunday = israel(2026, 11, 8, 8, 30);
for (let i = 0; i < 7; i++) {
  const morning = new Date(sunday.getTime() + i * 86400000);
  const shacharit = statusFor(morning, "shacharit");
  const expected = (civilWeekday(new HDate(sunday)) + i) % 7;
  const flag = "weekday-" + expected;
  const open = Object.keys(shacharit.flags).filter((key) => key.startsWith("weekday-") && shacharit.flags[key]);
  check(`morning day ${i} opens ${flag}`, expected > 5 || (open.length === 1 && open[0] === flag), open.join(",") || "none");

  const evening = israel(2026, 11, 8 + i, 19, 30);
  const next = statusFor(evening, "shacharit");
  const nextDay = (expected + 1) % 7;
  const nextFlag = "weekday-" + nextDay;
  const nextOpen = Object.keys(next.flags).filter((key) => key.startsWith("weekday-") && next.flags[key]);
  check(
    `after sunset day ${i} shacharit opens ${nextFlag}`,
    nextDay > 5 || (nextOpen.length === 1 && nextOpen[0] === nextFlag),
    nextOpen.join(",") || "none",
  );
  const mincha = statusFor(evening, "mincha");
  check(`mincha after sunset stays on day ${i}`, civilWeekday(mincha.hd) === expected, String(civilWeekday(mincha.hd)));
}

const plainTuesday = statusFor(israel(2026, 11, 17, 8, 30), "shacharit");
check("regular Tuesday says tachanun and not Torah", plainTuesday.flags.tachanun && !plainTuesday.flags.torah && plainTuesday.flags["weekday-2"]);
const monday = statusFor(israel(2026, 11, 16, 8, 30), "shacharit");
check("regular Monday says tachanun and Torah", monday.flags.tachanun && monday.flags.torah && monday.flags["tachanun-mw"] && monday.flags["weekday-1"]);

for (let day = 1; day <= 30; day++) {
  check("everyday " + day, Boolean(EVERYDAY[day] && EVERYDAY[day].title && EVERYDAY[day].body && EVERYDAY[day].source));
}
const titles = occasionTitles();
check("occasion list", titles.length >= 15 && titles.every((item) => item.title && item.source), String(titles.length));

const rc = halachaForHDate(new HDate(tuesdayMorning));
check("30 Cheshvan is Rosh Chodesh", rc.id === "rosh-chodesh", rc.title);
check("9 Av halacha", halachaForHDate(new HDate(9, months.AV, 5787)).id === "tisha-bav");
check("15 Shvat halacha", halachaForHDate(new HDate(15, months.SHVAT, 5787)).id === "tu-bishvat");
check("Purim halacha", halachaForHDate(new HDate(14, months.ADAR_II, 5787)).id === "purim");
check("11 Cheshvan is in the moon-blessing window", halachaForHDate(new HDate(11, months.CHESHVAN, 5787)).id === "halevana");
const plain = halachaForHDate(new HDate(20, months.CHESHVAN, 5787));
check("20 Cheshvan uses the rotating set", plain.id === "day-20", plain.title);

const blob = JSON.stringify(EVERYDAY) + JSON.stringify(titles) + rc.body;
check("no Druckman attribution", !blob.includes("דרוקמן"));

const failed = checks.filter((item) => !item.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);
