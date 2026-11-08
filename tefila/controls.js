(function () {
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
})();
