import { Location, Zmanim } from "@hebcal/core";
import { ORANIT, computeFromSun } from "../tefila/zmanim-calc.mjs";

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok });
  console.log(`${ok ? "OK " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
}

function order(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const when = new Date(Date.UTC(y, m - 1, d, 10, 0, 0));
  const loc = new Location(ORANIT.lat, ORANIT.lon, true, ORANIT.tz, "Oranit", "IL");
  const sun = new Zmanim(loc, when, false);
  const t = computeFromSun(sun.sunrise(), sun.sunset());
  const keys = ["alot", "misheyakir", "sunrise", "shemaGRA", "tefillaGRA", "chatzot", "minchaGedola", "minchaKetana", "plag", "sunset", "tzeit", "rabbeinuTam"];
  for (let i = 1; i < keys.length; i++) {
    if (!(t[keys[i]] > t[keys[i - 1]])) return `${keys[i - 1]} is not before ${keys[i]}`;
  }
  const gra = (t.sunset - t.sunrise) / 12;
  const alotDelta = (t.sunrise - t.alot) / gra * 60;
  const tzeitDelta = (t.tzeit - t.sunset) / gra * 60;
  const rtDelta = (t.rabbeinuTam - t.sunset) / gra * 60;
  if (Math.abs(alotDelta - 72) > 0.01) return `alot ${alotDelta}`;
  if (Math.abs(tzeitDelta - 13.5) > 0.01) return `tzeit ${tzeitDelta}`;
  if (Math.abs(rtDelta - 72) > 0.01) return `rt ${rtDelta}`;
  return "";
}

for (const iso of ["2026-11-09", "2026-11-13", "2026-06-21", "2026-12-21"]) {
  const problem = order(iso);
  check(`zmanim order ${iso}`, problem === "", problem);
}

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);
