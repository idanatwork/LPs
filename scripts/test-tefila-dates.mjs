import { HDate, Location, Zmanim, months } from "@hebcal/core";
import { statusForHDate, resolveHDate, formatHebrewDate, formatHeaderDate, isNightService, statusFor, activeService } from "../tefila/day-status.mjs";

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "OK " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
}

function at(y, m, d, service) {
  const hd = new HDate(d, m, y);
  const st = statusForHDate(hd, service);
  return { hd, st };
}

{
  const { st } = at(5787, months.KISLEV, 1, "shacharit");
  check("RC Kislev 5787 date", st.hebrewDate.includes("כסלו") && st.hebrewDate.includes("תשפ״ז"), st.hebrewDate);
  check("RC Kislev chips", st.chips.includes("ראש חודש") && st.chips.includes("לא אומרים תחנון") && st.chips.includes("משיב הרוח") && st.chips.includes("ברך עלינו"), st.chips.join(" · "));
  check("RC Kislev opens yaaleh, not tachanun", st.flags["yaaleh-rc"] && st.flags.yaaleh && st.flags.hallel && !st.flags.tachanun && !st.flags.chanukah);
}

{
  const { hd, st } = at(5787, months.KISLEV, 25, "shacharit");
  check("25 Kislev is Shabbat", hd.greg().getDay() === 6, hd.greg().toDateString());
  check("25 Kislev Chanukah", st.chips.includes("חנוכה") && st.chips.includes("שבת") && st.chips.includes("לא אומרים תחנון") && st.flags.chanukah && !st.flags.tachanun && !st.flags["weekday-6"], st.chips.join(" · "));
}

{
  const { hd, st } = at(5787, months.CHESHVAN, 15, "shacharit");
  const mincha = statusForHDate(hd, "mincha");
  check("regular Monday", hd.greg().getDay() === 1, hd.toString() + " " + hd.greg().toDateString());
  check("Monday tachanun and shir", st.flags.tachanun && st.flags["tachanun-mw"] && st.flags["weekday-1"] && st.chips.includes("אומרים תחנון") && !st.flags.chanukah && !st.flags.yaaleh, st.chips.join(" · "));
  check("Monday mincha still tachanun", mincha.flags.tachanun && mincha.chips.includes("אומרים תחנון"));
}

{
  const { hd, st } = at(5787, months.ADAR_II, 14, "mincha");
  check("14 Adar II 5787 is Purim", hd.toString() === "14 Adar II 5787", hd.toString() + " " + hd.greg().toDateString());
  check("Purim al hanissim, no tachanun", st.flags.purim && !st.flags.tachanun && st.chips.includes("פורים") && st.chips.includes("לא אומרים תחנון") && !st.flags.anenu, st.chips.join(" · "));
  const shushan = statusForHDate(new HDate(15, months.ADAR_II, 5787), "shacharit");
  check("15 Adar II notes Jerusalem and does not auto-open", !shushan.flags.purim && shushan.chips.includes("שושן פורים") && shushan.note.includes("בירושלים"), shushan.chips.join(" · "));
  const katan = statusForHDate(new HDate(14, months.ADAR_I, 5787), "shacharit");
  check("14 Adar I is Purim Katan, no al hanissim", katan.chips.includes("פורים קטן") && !katan.flags.purim && !katan.flags.tachanun, katan.chips.join(" · "));
}

{
  const hd = new HDate(9, months.AV, 5787);
  const sh = statusForHDate(hd, "shacharit");
  const mi = statusForHDate(hd, "mincha");
  const ar = statusForHDate(hd, "arvit");
  check("9 Av 5787 is the fast", hd.greg().toDateString() === "Thu Aug 12 2027" && sh.chips.includes("תענית ציבור"), hd.greg().toDateString());
  check("9 Av aneinu all services, nachem only mincha", sh.flags.anenu && !sh.flags.nachem && mi.flags.anenu && mi.flags.nachem && ar.flags.anenu && !ar.flags.nachem);
  check("9 Av no tachanun, morid and barechenu", !sh.flags.tachanun && sh.flags.tal && sh.flags.barechenu && sh.chips.includes("מוריד הטל") && sh.chips.includes("ברכנו"), sh.chips.join(" · "));
}

{
  const { hd, st } = at(5787, months.CHESHVAN, 10, "shacharit");
  check("10 Cheshvan 5787", hd.greg().toDateString() === "Wed Oct 21 2026", hd.greg().toDateString());
  check("10 Cheshvan barech and mashiv", st.flags.barech && st.flags.geshem && !st.flags.barechenu && !st.flags.tal && st.chips.includes("ברך עלינו") && st.chips.includes("משיב הרוח"), st.chips.join(" · "));
}

{
  const hd = new HDate(7, months.CHESHVAN, 5787);
  const sh = statusForHDate(hd, "shacharit");
  const mi = statusForHDate(hd, "mincha");
  const ar = statusForHDate(hd, "arvit");
  check("7 Cheshvan daytime barechenu, arvit barech", sh.flags.barechenu && !sh.flags.barech && mi.flags.barechenu && ar.flags.barech && !ar.flags.barechenu);
}

{
  const erev = new HDate(29, months.ELUL, 5786);
  const before = new HDate(28, months.ELUL, 5786);
  const sh = statusForHDate(erev, "shacharit");
  const mi = statusForHDate(erev, "mincha");
  const mincha28 = statusForHDate(before, "mincha");
  check("29 Elul 5786 is Erev Rosh Hashana", erev.greg().toDateString() === "Fri Sep 11 2026", erev.greg().toDateString());
  check("29 Elul Shacharit does not say tachanun", !sh.flags.tachanun && sh.chips.includes("לא אומרים תחנון"), sh.chips.join(" · "));
  check("29 Elul Mincha does not say tachanun", !mi.flags.tachanun && mi.chips.includes("לא אומרים תחנון"), mi.chips.join(" · "));
  check("28 Elul is Thursday", before.greg().getDay() === 4, before.greg().toDateString());
  check("28 Elul Mincha says tachanun", mincha28.flags.tachanun && mincha28.chips.includes("אומרים תחנון"), mincha28.chips.join(" · "));
}

{
  const hd = new HDate(5, months.IYYAR, 5787);
  const st = statusForHDate(hd, "shacharit");
  check("Yom HaAtzmaut omits tachanun with a note", !st.flags.tachanun && st.chips.includes("יום העצמאות") && st.note.includes("דרוקמן") && st.note.includes("עובדיה"), st.chips.join(" · "));
}

{
  const before = new Date(Date.UTC(2026, 10, 8, 10, 0, 0));
  const after = new Date(Date.UTC(2026, 10, 8, 16, 0, 0));
  const late = new Date(Date.UTC(2026, 10, 9, 1, 0, 0));
  const day = resolveHDate(before, "mincha");
  const rolled = resolveHDate(after, "shacharit");
  const minchaLate = resolveHDate(after, "mincha");
  const arvitDay = resolveHDate(before, "arvit");
  const arvitNight = resolveHDate(after, "arvit");
  const arvitAfterMidnight = resolveHDate(late, "arvit");
  check("daytime date is 28 Cheshvan", formatHebrewDate(day).startsWith("כ״ח"), formatHebrewDate(day));
  check("after Jerusalem sunset shacharit rolls forward", formatHebrewDate(rolled).startsWith("כ״ט"), formatHebrewDate(rolled));
  check("mincha stays on the daytime date after sunset", formatHebrewDate(minchaLate) === formatHebrewDate(day), formatHebrewDate(minchaLate));
  check("arvit before sunset is the coming day", formatHebrewDate(arvitDay).startsWith("כ״ט"), formatHebrewDate(arvitDay));
  check("arvit after sunset is that new day", formatHebrewDate(arvitNight).startsWith("כ״ט"), formatHebrewDate(arvitNight));
  check("arvit after midnight does not skip another day", formatHebrewDate(arvitAfterMidnight).startsWith("כ״ט"), formatHebrewDate(arvitAfterMidnight));
  const dayStatus = statusFor(before, "shacharit");
  const nightStatus = statusFor(after, "shacharit");
  const minchaStatus = statusFor(after, "mincha");
  const arvitStatus = statusFor(after, "arvit");
  check("header date matches the shacharit day", formatHeaderDate(dayStatus, isNightService(before, "shacharit")) === formatHebrewDate(day) + " · יום ראשון · " + day.greg().getDate() + "." + (day.greg().getMonth() + 1) + "." + day.greg().getFullYear(), formatHeaderDate(dayStatus, false));
  check("evening shacharit is marked as night", isNightService(after, "shacharit") && formatHeaderDate(nightStatus, true).startsWith("ליל " + formatHebrewDate(rolled)), formatHeaderDate(nightStatus, true));
  check("mincha after sunset is not marked as night", !isNightService(after, "mincha") && formatHeaderDate(minchaStatus, false).startsWith(formatHebrewDate(minchaLate)), formatHeaderDate(minchaStatus, false));
  check("arvit header is the night of its computed day", isNightService(before, "arvit") && formatHeaderDate(arvitStatus, true).startsWith("ליל " + formatHebrewDate(arvitNight)), formatHeaderDate(arvitStatus, true));
}

{
  const loc = new Location(32.13, 34.99, true, "Asia/Jerusalem", "Oranit", "IL");
  const z = new Zmanim(loc, new Date("2026-11-08T10:00:00Z"), false);
  const alot = z.alotHaShachar();
  const mid = z.chatzot();
  const sunset = z.sunset();
  check("before dawn is Arvit", activeService(new Date(alot.getTime() - 60000)) === "arvit");
  check("after dawn is Shacharit", activeService(new Date(alot.getTime() + 60000)) === "shacharit");
  check("after chatzot is Mincha", activeService(new Date(mid.getTime() + 60000)) === "mincha");
  check("after sunset is Arvit", activeService(new Date(sunset.getTime() + 60000)) === "arvit");
}

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);
