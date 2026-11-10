/* Shortcut names the Shortcuts app must match. Change them here only. */
var TEFILA_SHORTCUTS = {
  start: "תפילה ON",
  end: "תפילה OFF",
};

/* iCloud share links. Leave a string empty until that link exists. */
var ICLOUD_LINKS = {
  on: "https://www.icloud.com/shortcuts/8afce28b59cf4693889900fcef0bde29",
  off: "https://www.icloud.com/shortcuts/fc207386d3f74a829b51ecf87941e40b",
};

function applyIcloudLinks() {
  var pending = "קישור ההורדה יתווסף בקרוב";
  var ready = "הוסף לאייפון";
  document.querySelectorAll("[data-icloud]").forEach(function (link) {
    var key = link.getAttribute("data-icloud");
    var url = (ICLOUD_LINKS[key] || "").trim();
    if (!url) {
      link.removeAttribute("href");
      link.removeAttribute("target");
      link.removeAttribute("rel");
      link.setAttribute("aria-disabled", "true");
      link.textContent = pending;
      link.setAttribute("aria-label", pending);
      return;
    }
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    link.removeAttribute("aria-disabled");
    link.textContent = ready;
    link.setAttribute("aria-label", ready);
  });
}

(function () {
  applyIcloudLinks();

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
