import { HDate, months } from "@hebcal/core";

const UNITS = ["", "אֶחָד", "שְׁנַיִם", "שְׁלֹשָׁה", "אַרְבָּעָה", "חֲמִשָּׁה", "שִׁשָּׁה", "שִׁבְעָה", "שְׁמוֹנָה", "תִּשְׁעָה"];
const TEENS = ["עֲשָׂרָה", "אַחַד עָשָׂר", "שְׁנֵים עָשָׂר", "שְׁלֹשָׁה עָשָׂר", "אַרְבָּעָה עָשָׂר", "חֲמִשָּׁה עָשָׂר", "שִׁשָּׁה עָשָׂר", "שִׁבְעָה עָשָׂר", "שְׁמוֹנָה עָשָׂר", "תִּשְׁעָה עָשָׂר"];
const TENS = { 2: "עֶשְׂרִים", 3: "שְׁלֹשִׁים", 4: "אַרְבָּעִים" };

/** Night number of the omer (1-49) for a Hebrew date, or 0 outside the counting. Night N belongs to the Hebrew date 15+N Nisan. */
export function omerNumber(hd) {
  const start = new HDate(16, months.NISAN, hd.getFullYear());
  const n = hd.abs() - start.abs() + 1;
  return n >= 1 && n <= 49 ? n : 0;
}

function days(n) {
  if (n === 1) return "יוֹם אֶחָד";
  if (n === 2) return "שְׁנֵי יָמִים";
  if (n < 10) return UNITS[n] + " יָמִים";
  if (n === 10) return TEENS[0] + " יָמִים";
  if (n < 20) return TEENS[n - 10] + " יוֹם";
  const t = Math.floor(n / 10);
  const u = n % 10;
  if (u === 0) return TENS[t] + " יוֹם";
  return UNITS[u] + (t === 3 ? " וּ" : " וְ") + TENS[t] + " יוֹם";
}

function weeks(w) {
  if (w === 1) return "שָׁבוּעַ אֶחָד";
  if (w === 2) return "שְׁנֵי שָׁבוּעוֹת";
  return UNITS[w] + " שָׁבוּעוֹת";
}

function extraDays(d) {
  if (d === 1) return "וְיוֹם אֶחָד";
  if (d === 2) return "וּשְׁנֵי יָמִים";
  if (d === 3) return "וּשְׁלֹשָׁה יָמִים";
  if (d === 5) return "וַחֲמִשָּׁה יָמִים";
  return "וְ" + UNITS[d] + " יָמִים";
}

/** The counting sentence, e.g. "הַיּוֹם שְׁמוֹנָה יָמִים, שֶׁהֵם שָׁבוּעַ אֶחָד וְיוֹם אֶחָד לָעֹמֶר." */
export function omerCountText(n) {
  let s = "הַיּוֹם " + days(n);
  if (n >= 7) {
    const w = Math.floor(n / 7);
    const d = n % 7;
    s += ", שֶׁהֵם " + weeks(w) + (d ? " " + extraDays(d) : "");
  }
  return s + " לָעֹמֶר.";
}
