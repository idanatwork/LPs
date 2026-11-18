(function () {
  var theme = "";
  try { theme = localStorage.getItem("tefila-theme") || ""; } catch (e) {}
  if (theme === "light" || theme === "dark") document.documentElement.setAttribute("data-theme", theme);
  else document.documentElement.removeAttribute("data-theme");
  var meta = document.getElementById("theme-color");
  if (meta) {
    var chrome = "#DACCB2";
    if (theme === "light") chrome = "#fdfbf6";
    else if (theme === "dark") chrome = "#111111";
    meta.setAttribute("content", chrome);
  }
  try {
    var s = localStorage.getItem("tefila-font");
    if (s) document.documentElement.style.setProperty("--fs", Math.max(16, Math.min(64, parseInt(s, 10))) + "px");
  } catch (e) {}
  var mode = "yachid";
  try { if (localStorage.getItem("tefila-minyan") === "minyan") mode = "minyan"; } catch (e) {}
  document.documentElement.setAttribute("data-minyan", mode);
  var accentIds = { gold: 1, blue: 1, olive: 1, bordeaux: 1, purple: 1, turquoise: 1 };
  var accent = "";
  try { accent = localStorage.getItem("tefila-accent") || ""; } catch (e) {}
  if (accentIds[accent]) document.documentElement.setAttribute("data-accent", accent);
  else document.documentElement.removeAttribute("data-accent");

  try {
    var lockParts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jerusalem",
      weekday: "short",
      hour: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date());
    var lockWd = "";
    var lockHour = 0;
    lockParts.forEach(function (part) {
      if (part.type === "weekday") lockWd = part.value;
      if (part.type === "hour") lockHour = parseInt(part.value, 10);
    });
    if (lockWd === "Sat" || (lockWd === "Fri" && lockHour >= 16)) {
      document.documentElement.classList.add("siddur-lock-pending");
      var supportsModules = "noModule" in document.createElement("script");
      if (!supportsModules) {
        document.documentElement.classList.remove("siddur-lock-pending");
      } else {
        setTimeout(function () {
          var root = document.documentElement;
          if (root.classList.contains("siddur-lock-pending") && !root.classList.contains("siddur-locked")) {
            root.classList.remove("siddur-lock-pending");
          }
        }, 4000);
      }
    }
  } catch (e) {}

  var buildMeta = document.querySelector('meta[name="tefila-build"]');
  var BUILD = buildMeta ? String(buildMeta.getAttribute("content") || "") : "";

  function versionPath() {
    var script = document.querySelector('script[src*="boot.js"]');
    var src = script ? script.getAttribute("src") : "boot.js";
    return src.replace(/boot\.js.*$/, "version.json");
  }

  function busy() {
    try { return !!(window.tefilaBusy && window.tefilaBusy()); } catch (e) { return false; }
  }

  function restoreScroll() {
    var raw = "";
    try { raw = sessionStorage.getItem("tefila-scroll") || ""; } catch (e) {}
    if (!raw) return;
    try { sessionStorage.removeItem("tefila-scroll"); } catch (e) {}
    var y = parseInt(raw, 10);
    if (!y) return;
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, y);
    requestAnimationFrame(function () { window.scrollTo(0, y); });
  }

  function reloadFor(remote) {
    if (window.tefilaSplashActive) {
      var prev = window.tefilaAfterSplash;
      window.tefilaAfterSplash = function () {
        if (typeof prev === "function") prev();
        reloadFor(remote);
      };
      return;
    }
    try {
      sessionStorage.setItem("tefila-reloaded", remote);
      sessionStorage.setItem("tefila-scroll", String(window.scrollY || 0));
    } catch (e) {}
    var url = new URL(location.href);
    url.searchParams.set("_", String(Date.now()));
    location.replace(url.toString());
  }

  var pendingVersion = "";
  var pendingNotes = "";

  function isSiddurLocked() {
    var root = document.documentElement;
    return root.classList.contains("siddur-locked") || root.classList.contains("siddur-lock-pending");
  }

  function updateDismissed(version) {
    try { return localStorage.getItem("tefila-update-dismissed") === String(version); } catch (e) { return false; }
  }

  function hideUpdateBanner() {
    var el = document.getElementById("update-banner");
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function applyUpdate() {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistration().then(function (reg) {
        if (!reg) return;
        var worker = reg.waiting || reg.installing || reg.active;
        if (worker) worker.postMessage({ type: "tefila-ready" });
      }).catch(function () {});
    }
    reloadFor(pendingVersion || "update");
  }

  function showUpdateBanner(version, notes) {
    if (!version || version === BUILD || updateDismissed(version) || isSiddurLocked()) return;
    var existing = document.getElementById("update-banner");
    if (existing) {
      var noteEl = existing.querySelector(".update-note");
      if (noteEl && notes) noteEl.textContent = notes;
      return;
    }
    pendingVersion = version;
    pendingNotes = notes || "";
    var banner = document.createElement("div");
    banner.id = "update-banner";
    banner.setAttribute("role", "status");
    var note = document.createElement("p");
    note.className = "update-note";
    note.textContent = notes || ("גרסה " + version + " זמינה");
    var how = document.createElement("p");
    how.className = "update-how";
    how.textContent = "כדי לקבל את העדכון לחצו ‘עדכן עכשיו’ (או סגרו ופתחו את הסידור).";
    var actions = document.createElement("div");
    actions.className = "update-actions";
    var nowBtn = document.createElement("button");
    nowBtn.type = "button";
    nowBtn.className = "update-now";
    nowBtn.textContent = "עדכן עכשיו";
    nowBtn.addEventListener("click", function () { applyUpdate(); });
    var dismissBtn = document.createElement("button");
    dismissBtn.type = "button";
    dismissBtn.className = "update-dismiss";
    dismissBtn.textContent = "סגירה";
    dismissBtn.addEventListener("click", function () {
      try { localStorage.setItem("tefila-update-dismissed", String(version)); } catch (e) {}
      hideUpdateBanner();
    });
    actions.appendChild(nowBtn);
    actions.appendChild(dismissBtn);
    banner.appendChild(note);
    banner.appendChild(how);
    banner.appendChild(actions);
    (document.body || document.documentElement).appendChild(banner);
  }

  function watchLockForBanner() {
    if (watchLockForBanner.armed) return;
    watchLockForBanner.armed = true;
    try {
      new MutationObserver(function () {
        if (isSiddurLocked()) hideUpdateBanner();
        else if (pendingVersion && pendingVersion !== BUILD && !updateDismissed(pendingVersion)) {
          showUpdateBanner(pendingVersion, pendingNotes);
        }
      }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    } catch (e) {}
  }

  function stripBust() {
    try {
      var url = new URL(location.href);
      if (!url.searchParams.has("_")) return;
      url.searchParams.delete("_");
      var search = url.searchParams.toString();
      history.replaceState(null, "", url.pathname + (search ? "?" + search : "") + url.hash);
    } catch (e) {}
  }

  function consider(remote, notes) {
    if (!remote || remote === BUILD) { stripBust(); return; }
    pendingVersion = remote;
    pendingNotes = notes || pendingNotes;
    watchLockForBanner();
    showUpdateBanner(remote, notes);
    stripBust();
  }

  function checkVersion() {
    if (!BUILD) return;
    fetch(versionPath() + "?t=" + Date.now(), { cache: "no-store" }).then(function (res) {
      if (!res.ok) return null;
      return res.json();
    }).then(function (data) {
      consider(data && data.v ? String(data.v) : "", data && data.notes ? String(data.notes) : "");
    }).catch(function () {});
  }

  function notifyWorker() {
    if (!navigator.serviceWorker) return;
    navigator.serviceWorker.getRegistration().then(function (reg) {
      if (!reg) return;
      var worker = reg.waiting || reg.installing || reg.active;
      if (worker) worker.postMessage({ type: "tefila-ready" });
    }).catch(function () {});
  }
  function whenSplashDone(fn) {
    function arm() {
      if (window.tefilaSplashActive) {
        var prev = window.tefilaAfterSplash;
        window.tefilaAfterSplash = function () {
          if (typeof prev === "function") prev();
          fn();
        };
      } else fn();
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arm);
    else arm();
  }
  if (navigator.serviceWorker && location.protocol !== "file:") {
    var scopeBase = location.pathname.replace(/\/(tefila|brachot|watch)\/.*$/, "/");
    navigator.serviceWorker.register(scopeBase + "sw.js").then(function (reg) {
      whenSplashDone(notifyWorker);
      if (reg.waiting) checkVersion();
      reg.addEventListener("updatefound", function () {
        var worker = reg.installing;
        if (!worker) return;
        worker.addEventListener("statechange", function () {
          if (worker.state === "installed" && navigator.serviceWorker.controller) checkVersion();
        });
      });
    }).catch(function () {});
  }

  function injectCloudflareAnalytics() {
    if (document.querySelector("script[data-cf-beacon]")) return;
    var script = document.createElement("script");
    script.defer = true;
    script.src = "https://static.cloudflareinsights.com/beacon.min.js";
    script.setAttribute("data-cf-beacon", '{"token": "592bb505d48b45abbe6d55d278ae6008"}');
    (document.body || document.documentElement).appendChild(script);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", injectCloudflareAnalytics);
  else injectCloudflareAnalytics();

  restoreScroll();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", checkVersion);
  else checkVersion();
  window.addEventListener("pageshow", function () { restoreScroll(); checkVersion(); });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") checkVersion();
  });
})();
