(function () {
  var KEY = "tefila-minyan";

  var btn = document.getElementById("theme-toggle");
  function label(theme) {
    if (!btn) return;
    var dark = theme === "dark";
    btn.setAttribute("aria-label", dark ? "מצב בהיר" : "מצב כהה");
    btn.setAttribute("aria-pressed", dark ? "true" : "false");
  }
  label(document.documentElement.getAttribute("data-theme"));
  if (btn) {
    btn.addEventListener("click", function () {
      var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      var meta = document.getElementById("theme-color");
      if (meta) meta.setAttribute("content", next === "dark" ? "#111111" : "#fdfbf6");
      btn.setAttribute("aria-label", next === "dark" ? "מצב בהיר" : "מצב כהה");
      btn.setAttribute("aria-pressed", next === "dark" ? "true" : "false");
      try { localStorage.setItem("tefila-theme", next); } catch (e) {}
    });
  }

  var root = document.documentElement;
  var read = function () { return parseInt(getComputedStyle(root).getPropertyValue("--fs"), 10) || 22; };
  var applySize = function (n) {
    n = Math.max(18, Math.min(40, n));
    root.style.setProperty("--fs", n + "px");
    try { localStorage.setItem("tefila-font", String(n)); } catch (e) {}
  };
  var dec = document.getElementById("font-dec");
  var inc = document.getElementById("font-inc");
  if (dec) dec.addEventListener("click", function () { applySize(read() - 2); });
  if (inc) inc.addEventListener("click", function () { applySize(read() + 2); });

  function readMode() {
    var attr = document.documentElement.getAttribute("data-minyan");
    if (attr === "minyan" || attr === "yachid") return attr;
    try {
      var stored = localStorage.getItem(KEY);
      if (stored === "minyan") return "minyan";
    } catch (e) {}
    return "yachid";
  }

  function applyMode(mode, persist) {
    mode = mode === "minyan" ? "minyan" : "yachid";
    document.documentElement.setAttribute("data-minyan", mode);
    document.querySelectorAll("[data-set-minyan]").forEach(function (button) {
      var on = button.getAttribute("data-set-minyan") === mode;
      button.setAttribute("aria-pressed", on ? "true" : "false");
    });
    document.querySelectorAll("[data-mode-label]").forEach(function (el) {
      var base = el.getAttribute("data-mode-label");
      el.textContent = base + " · " + (mode === "minyan" ? "במניין" : "ביחידות");
    });
    var status = document.getElementById("mode-status");
    if (status) {
      status.textContent = mode === "minyan"
        ? "במניין — נוספים קדיש, ברכו, חזרת הש״ץ וקריאת התורה"
        : "ביחידות — בלי קדיש, ברכו וחזרת הש״ץ";
    }
    document.querySelectorAll(".kicker").forEach(function (el) {
      if (!el.dataset.yachidText) el.dataset.yachidText = el.textContent;
      el.textContent = mode === "minyan"
        ? el.dataset.yachidText.replace("ליחיד", "במניין")
        : el.dataset.yachidText;
    });
    if (persist) {
      try { localStorage.setItem(KEY, mode); } catch (e) {}
    }
  }

  function ensureModeStatus() {
    if (document.getElementById("mode-status")) return;
    var el = document.createElement("p");
    el.id = "mode-status";
    el.className = "mode-status";
    var today = document.getElementById("today-banner");
    if (today && today.parentNode) today.parentNode.insertBefore(el, today);
    else {
      var main = document.querySelector("main");
      if (main) main.insertBefore(el, main.firstChild);
    }
  }

  function ensureToc() {
    var toc = document.getElementById("toc");
    if (!toc || toc.querySelector(".toc-minyan")) return;
    var box = document.createElement("div");
    box.className = "toc-minyan minyan-only";
    var heading = document.createElement("p");
    heading.className = "toc-title";
    heading.textContent = "במניין";
    box.appendChild(heading);
    var count = 0;
    document.querySelectorAll(".minyan-only").forEach(function (el, i) {
      if (el === box) return;
      var title = el.querySelector("h3, summary");
      if (!title) return;
      if (!el.id) el.id = "minyan-block-" + i;
      var link = document.createElement("a");
      link.className = "l3";
      link.href = "#" + el.id;
      link.textContent = title.textContent.trim();
      box.appendChild(link);
      count += 1;
    });
    if (!count) return;
    toc.appendChild(box);
  }

  function boot() {
    ensureModeStatus();
    ensureToc();
    applyMode(readMode(), false);
    document.addEventListener("click", function (event) {
      var button = event.target.closest && event.target.closest("[data-set-minyan]");
      if (!button) return;
      applyMode(button.getAttribute("data-set-minyan"), true);
    });
    window.addEventListener("storage", function (event) {
      if (event.key !== KEY) return;
      applyMode(event.newValue === "minyan" ? "minyan" : "yachid", false);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
