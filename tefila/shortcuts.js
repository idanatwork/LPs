/* Shortcut name the Shortcuts app must match. Change it here only. */
var TEFILA_SHORTCUTS = {
  end: "תפילה OFF",
};

(function () {
  function showShortcuts() {
    var query = new URLSearchParams(location.search);
    if (query.get("showShortcuts") === "1") return true;
    var ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/i.test(ua)) return true;
    if (/Macintosh/i.test(ua)) return true;
    return false;
  }

  function href(which) {
    return "shortcuts://run-shortcut?name=" + encodeURIComponent(TEFILA_SHORTCUTS[which]);
  }

  if (!showShortcuts()) return;
  document.querySelectorAll("a[data-shortcut]").forEach(function (link) {
    var which = link.getAttribute("data-shortcut");
    if (TEFILA_SHORTCUTS[which]) link.href = href(which);
  });
  document.querySelectorAll(".shortcut-row").forEach(function (row) {
    row.hidden = false;
  });
})();
