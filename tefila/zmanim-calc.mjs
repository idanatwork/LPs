/** Rav Ovadia Yosef / Yalkut Yosef zmanim.
 * GRA hour = (sunset − sunrise) / 12.
 * Alot = 72 GRA-minutes before sunrise.
 * Tzeit = 13.5 GRA-minutes after sunset.
 * Rabbeinu Tam = 72 GRA-minutes after sunset.
 * Magen Avraham hour = (Rabbeinu Tam − alot) / 12.
 * Plag (Yalkut Yosef) = tzeit minus 75 GRA-minutes.
 * Candle lighting outside Jerusalem: 20 clock minutes before sunset.
 */

export const ORANIT = { lat: 32.1317, lon: 34.9933, tz: "Asia/Jerusalem", name: "אורנית" };

export function computeFromSun(sunrise, sunset) {
  const shaah = (sunset.getTime() - sunrise.getTime()) / 12;
  const minute = shaah / 60;
  const shift = (base, mins) => new Date(base.getTime() + mins * minute);
  const alot = shift(sunrise, -72);
  const tzeit = shift(sunset, 13.5);
  const rabbeinuTam = shift(sunset, 72);
  const shaahMA = (rabbeinuTam.getTime() - alot.getTime()) / 12;
  const fromSunrise = (hours) => new Date(sunrise.getTime() + hours * shaah);
  const fromAlot = (hours) => new Date(alot.getTime() + hours * shaahMA);
  return {
    alot,
    misheyakir: shift(alot, 6),
    sunrise,
    shemaMGA: fromAlot(3),
    shemaGRA: fromSunrise(3),
    tefillaMGA: fromAlot(4),
    tefillaGRA: fromSunrise(4),
    chatzot: new Date((sunrise.getTime() + sunset.getTime()) / 2),
    minchaGedola: fromSunrise(6.5),
    minchaKetana: fromSunrise(9.5),
    plag: new Date(tzeit.getTime() - 75 * minute),
    sunset,
    tzeit,
    rabbeinuTam,
    candles: new Date(sunset.getTime() - 20 * 60 * 1000),
  };
}

export function formatHM(date, tz = ORANIT.tz) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export const ZMAN_ROWS = [
  ["alot", "עלות השחר"],
  ["misheyakir", "משיכיר — ציצית ותפילין"],
  ["sunrise", "הנץ החמה"],
  ["shemaMGA", "סוף זמן ק״ש מג״א"],
  ["shemaGRA", "סוף זמן ק״ש גר״א"],
  ["tefillaMGA", "סוף זמן תפילה מג״א"],
  ["tefillaGRA", "סוף זמן תפילה גר״א"],
  ["chatzot", "חצות"],
  ["minchaGedola", "מנחה גדולה"],
  ["minchaKetana", "מנחה קטנה"],
  ["plag", "פלג המנחה"],
  ["sunset", "שקיעה"],
  ["tzeit", "צאת הכוכבים"],
  ["rabbeinuTam", "צאת ר״ת"],
];
