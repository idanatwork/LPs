(function () {
  var theme;
  try { theme = localStorage.getItem("tefila-theme"); } catch (e) {}
  if (theme !== "light" && theme !== "dark") {
    theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.setAttribute("data-theme", theme);
  var meta = document.getElementById("theme-color");
  if (meta) meta.setAttribute("content", theme === "dark" ? "#111111" : "#fdfbf6");
  try {
    var s = localStorage.getItem("tefila-font");
    if (s) document.documentElement.style.setProperty("--fs", Math.max(18, Math.min(40, parseInt(s, 10))) + "px");
  } catch (e) {}
  var mode = "yachid";
  try { if (localStorage.getItem("tefila-minyan") === "minyan") mode = "minyan"; } catch (e) {}
  document.documentElement.setAttribute("data-minyan", mode);
  var accentIds = { gold: 1, blue: 1, olive: 1, bordeaux: 1, purple: 1, turquoise: 1 };
  var accent = "blue";
  try {
    var savedAccent = localStorage.getItem("tefila-accent");
    if (accentIds[savedAccent]) accent = savedAccent;
  } catch (e) {}
  document.documentElement.setAttribute("data-accent", accent);
})();
