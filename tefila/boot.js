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
  function showToast() {
    if (document.getElementById("version-toast")) return;
    var button = document.createElement("button");
    button.id = "version-toast";
    button.type = "button";
    button.textContent = "גרסה חדשה זמינה — הקש לרענון";
    button.setAttribute("aria-label", "גרסה חדשה זמינה — הקש לרענון");
    button.style.cssText = "position:fixed;z-index:80;bottom:calc(env(safe-area-inset-bottom) + 18px);left:50%;transform:translateX(-50%);max-width:calc(100% - 24px);padding:10px 14px;border:0;border-radius:999px;background:#1e3a8a;color:#fff;font:600 14px/1.3 inherit;box-shadow:0 6px 18px rgba(0,0,0,.25)";
    button.addEventListener("click", function () { reloadFor(pendingVersion || "toast"); });
    (document.body || document.documentElement).appendChild(button);
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

  function consider(remote) {
    if (!remote || remote === BUILD) { stripBust(); return; }
    pendingVersion = remote;
    var tried = "";
    try { tried = sessionStorage.getItem("tefila-reloaded") || ""; } catch (e) {}
    if (busy() || tried === remote) { showToast(); stripBust(); }
    else reloadFor(remote);
  }

  function checkVersion() {
    if (!BUILD) return;
    fetch(versionPath() + "?t=" + Date.now(), { cache: "no-store" }).then(function (res) {
      if (!res.ok) return null;
      return res.json();
    }).then(function (data) {
      consider(data && data.v ? String(data.v) : "");
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
    navigator.serviceWorker.register(scopeBase + "sw.js").then(function () {
      whenSplashDone(notifyWorker);
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
