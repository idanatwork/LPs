/* Hebrew-date helpers use Intl (en-u-ca-hebrew). Month names are ICU's:
   Tishri, Heshvan, Kislev, Tevet, Shevat, Adar, Adar I, Adar II,
   Nisan, Iyar, Sivan, Tamuz, Av, Elul.
   Arvit auto-open only when today and tomorrow agree, so a wrong
   sunset guess cannot open an addition that is not said. */
(function () {
  const SUMMER = new Set(["Iyar", "Sivan", "Tamuz", "Av", "Elul", "Tishri"]);
  const WINTER = new Set(["Kislev", "Tevet", "Shevat", "Adar", "Adar I", "Adar II"]);
  const BETWEEN = new Set(["Heshvan", "Kislev", "Tevet", "Shevat", "Adar", "Adar I", "Adar II"]);

  function atNoon(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
  }
  function addDays(d, n) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12, 0, 0, 0);
  }
  function hebrewDate(date) {
    const parts = new Intl.DateTimeFormat("en-u-ca-hebrew", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).formatToParts(date);
    const get = (t) => parts.find((p) => p.type === t)?.value;
    return { day: Number(get("day")), month: get("month"), year: String(get("year")) };
  }
  function findCivil(year, month, day, around) {
    for (let delta = -420; delta <= 420; delta++) {
      const d = addDays(around, delta);
      const h = hebrewDate(d);
      if (h.year === year && h.month === month && h.day === day) return d;
    }
    return null;
  }
  function isChanukah(date) {
    for (let back = 0; back < 8; back++) {
      const h = hebrewDate(addDays(date, -back));
      if (h.month === "Kislev" && h.day === 25) return true;
    }
    return false;
  }
  function isPurimMonth(month) {
    return month === "Adar" || month === "Adar II";
  }
  function isTishaBav(date) {
    const h = hebrewDate(date);
    if (h.month !== "Av" || (h.day !== 9 && h.day !== 10)) return false;
    const ninth = findCivil(h.year, "Av", 9, date);
    if (!ninth) return false;
    if (ninth.getDay() === 6) return h.day === 10;
    return h.day === 9;
  }
  function isFast(date) {
    const h = hebrewDate(date);
    if (h.month === "Tishri" && (h.day === 3 || h.day === 4)) {
      const third = findCivil(h.year, "Tishri", 3, date);
      if (third && third.getDay() === 6) return h.day === 4;
      return h.day === 3;
    }
    if (h.month === "Tevet" && h.day === 10) return date.getDay() !== 6;
    if (h.month === "Tamuz" && (h.day === 17 || h.day === 18)) {
      const d17 = findCivil(h.year, "Tamuz", 17, date);
      if (d17 && d17.getDay() === 6) return h.day === 18;
      return h.day === 17;
    }
    if (isTishaBav(date)) return true;
    if (isPurimMonth(h.month) && (h.day === 11 || h.day === 13)) {
      const d13 = findCivil(h.year, h.month, 13, date);
      if (d13 && d13.getDay() === 6) return h.day === 11;
      return h.day === 13;
    }
    return false;
  }
  function isMashiv(h, service) {
    if (service === "mincha") {
      if (h.month === "Tishri" && h.day >= 22) return true;
      if (BETWEEN.has(h.month)) return true;
      if (h.month === "Nisan" && h.day <= 14) return true;
      return false;
    }
    if (h.month === "Tishri" && h.day >= 23) return true;
    if (BETWEEN.has(h.month)) return true;
    if (h.month === "Nisan" && h.day <= 15) return true;
    return false;
  }
  function isBarechenu(h, service) {
    if (service === "arvit") {
      if (h.month === "Nisan" && h.day >= 16) return true;
      if (SUMMER.has(h.month)) return true;
      if (h.month === "Heshvan" && h.day <= 6) return true;
      return false;
    }
    if (h.month === "Nisan" && h.day >= 16) return true;
    if (SUMMER.has(h.month)) return true;
    if (h.month === "Heshvan" && h.day <= 7) return true;
    return false;
  }
  function isBarech(h, service) {
    if (service === "arvit") {
      if (h.month === "Heshvan" && h.day >= 7) return true;
      if (WINTER.has(h.month)) return true;
      if (h.month === "Nisan" && h.day <= 14) return true;
      return false;
    }
    if (h.month === "Heshvan" && h.day >= 8) return true;
    if (WINTER.has(h.month)) return true;
    if (h.month === "Nisan" && h.day <= 14) return true;
    return false;
  }
  function isRoshChodeshPhrase(h) {
    if (h.month === "Tishri" && h.day <= 2) return false;
    return h.day === 1 || h.day === 30;
  }

  function flagsFor(date, service) {
    const d = atNoon(date);
    const h = hebrewDate(d);
    const aseret = h.month === "Tishri" && h.day >= 1 && h.day <= 10;
    const rc = isRoshChodeshPhrase(h);
    const pesach = h.month === "Nisan" && h.day >= 16 && h.day <= 20;
    const sukkot = h.month === "Tishri" && h.day >= 16 && h.day <= 21;
    const chanukah = isChanukah(d);
    const purim = h.day === 14 && isPurimMonth(h.month);
    const mashiv = isMashiv(h, service);
    const daytime = service !== "arvit";
    const flags = {
      aseret: aseret,
      tal: !mashiv,
      geshem: mashiv,
      barechenu: isBarechenu(h, service),
      barech: isBarech(h, service),
      "yaaleh-rc": rc,
      "yaaleh-pesach": pesach,
      "yaaleh-sukkot": sukkot,
      yaaleh: rc || pesach || sukkot,
      chanukah: chanukah,
      purim: purim,
      anenu: daytime && isFast(d),
      nachem: daytime && isTishaBav(d),
      "twice-elohim": service === "shacharit" && (aseret || (h.month === "Tishri" && h.day === 21)),
      hallel: service === "shacharit" && (rc || chanukah),
    };
    if (service === "shacharit" && d.getDay() <= 5) flags["weekday-" + d.getDay()] = true;
    return flags;
  }

  function andFlags(a, b) {
    const out = {};
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    keys.forEach((k) => { out[k] = !!(a[k] && b[k]); });
    return out;
  }

  function activeFlags(service) {
    const now = new Date();
    const today = flagsFor(now, service);
    if (service !== "arvit") return today;
    return andFlags(today, flagsFor(addDays(atNoon(now), 1), service));
  }

  function bindFont() {
    const root = document.documentElement;
    const read = () => parseInt(getComputedStyle(root).getPropertyValue("--fs"), 10) || 22;
    const apply = (n) => {
      n = Math.max(18, Math.min(40, n));
      root.style.setProperty("--fs", n + "px");
      try { localStorage.setItem("tefila-font", String(n)); } catch (e) {}
    };
    const dec = document.getElementById("font-dec");
    const inc = document.getElementById("font-inc");
    if (dec) dec.addEventListener("click", () => apply(read() - 2));
    if (inc) inc.addEventListener("click", () => apply(read() + 2));
  }

  function autoOpen() {
    const service = document.body && document.body.dataset.service;
    if (!service) return;
    const flags = activeFlags(service);
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

  function init() {
    bindFont();
    try { autoOpen(); } catch (e) {}
  }

  if (typeof window !== "undefined") init();

  const api = { hebrewDate, flagsFor, addDays, atNoon, isChanukah, isFast, isTishaBav, activeFlags, andFlags };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
