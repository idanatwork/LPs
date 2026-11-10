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

/* Address the ON shortcut should open so the siddur knows focus is already on. */
var TEFILA_FOCUS_URL = "https://idanatwork.github.io/LPs/tefila/?focus=on";

var TEFILA_FOCUS_KEY = "tefilaFocus";
var TEFILA_FOCUS_MS = 90 * 60 * 1000;

function tefilaFocusIsOn() {
  try {
    var raw = localStorage.getItem(TEFILA_FOCUS_KEY);
    if (!raw) return false;
    var data = JSON.parse(raw);
    return !!(data && data.on && data.ts && Date.now() - Number(data.ts) < TEFILA_FOCUS_MS);
  } catch (e) {
    return false;
  }
}

function tefilaSetFocus(on) {
  try {
    if (on) localStorage.setItem(TEFILA_FOCUS_KEY, JSON.stringify({ on: true, ts: Date.now() }));
    else localStorage.removeItem(TEFILA_FOCUS_KEY);
  } catch (e) {}
}

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
  var shortcutsVisible = false;

  applyIcloudLinks();

  function showShortcuts() {
    var query = new URLSearchParams(location.search);
    if (query.get("showShortcuts") === "1") return true;
    var ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/i.test(ua)) return true;
    if (/Macintosh/i.test(ua)) return true;
    return false;
  }

  function consumeFocusQuery() {
    var query = new URLSearchParams(location.search);
    var flag = query.get("focus");
    if (flag !== "on" && flag !== "off") return;
    tefilaSetFocus(flag === "on");
    query.delete("focus");
    var search = query.toString();
    history.replaceState(null, "", location.pathname + (search ? "?" + search : "") + location.hash);
  }

  function applyFocusUi() {
    var on = shortcutsVisible && tefilaFocusIsOn();
    document.querySelectorAll("[data-shortcut=start]").forEach(function (link) {
      var row = link.closest(".shortcut-focus-start");
      if (row) row.hidden = !shortcutsVisible || on;
      else if (shortcutsVisible) link.hidden = !!on;
    });
    document.querySelectorAll(".focus-status").forEach(function (el) {
      el.hidden = !on;
    });
  }

  consumeFocusQuery();

  document.querySelectorAll("[data-shortcut=start]").forEach(function (link) {
    link.addEventListener("click", function () {
      tefilaSetFocus(true);
      applyFocusUi();
    });
  });
  document.querySelectorAll("[data-shortcut=end]").forEach(function (link) {
    link.addEventListener("click", function () {
      tefilaSetFocus(false);
      applyFocusUi();
    });
  });

  var copy = document.getElementById("copy-focus-url");
  if (copy) {
    copy.addEventListener("click", function () {
      function done() {
        var prev = copy.textContent;
        copy.textContent = "הועתק";
        setTimeout(function () { copy.textContent = prev; }, 1600);
      }
      function fallback() {
        var input = document.createElement("textarea");
        input.value = TEFILA_FOCUS_URL;
        input.setAttribute("readonly", "");
        document.body.appendChild(input);
        input.select();
        try { document.execCommand("copy"); done(); } catch (e) {}
        input.remove();
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(TEFILA_FOCUS_URL).then(done).catch(fallback);
      } else {
        fallback();
      }
    });
  }

  window.addEventListener("pageshow", applyFocusUi);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") applyFocusUi();
  });

  if (showShortcuts()) {
    shortcutsVisible = true;
    document.querySelectorAll("a[data-shortcut]").forEach(function (link) {
      var which = link.getAttribute("data-shortcut");
      if (TEFILA_SHORTCUTS[which]) {
        link.href = "shortcuts://run-shortcut?name=" + encodeURIComponent(TEFILA_SHORTCUTS[which]);
      }
    });
    document.querySelectorAll(".shortcut-row").forEach(function (row) {
      if (!row.classList.contains("shortcut-focus-start")) row.hidden = false;
    });
  }
  applyFocusUi();
})();
