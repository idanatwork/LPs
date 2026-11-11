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
  function nextSize(current, dir) {
    var next = Math.round(current * (dir > 0 ? 1.09 : 1 / 1.09));
    if (next === current) next = current + dir;
    if (next < 18) next = 18;
    if (next > 40) next = 40;
    return next;
  }
  function readingAnchor() {
    var nodes = document.querySelectorAll("p.t");
    var line = window.innerHeight * 0.3;
    var best = null;
    var bestDist = Infinity;
    for (var i = 0; i < nodes.length; i++) {
      var rect = nodes[i].getBoundingClientRect();
      if (rect.height < 8 || rect.bottom < 0 || rect.top > window.innerHeight) continue;
      if (rect.top <= line && rect.bottom >= line) return { el: nodes[i], top: rect.top };
      var dist = Math.abs(rect.top - line);
      if (dist < bestDist) {
        bestDist = dist;
        best = nodes[i];
      }
    }
    return best ? { el: best, top: best.getBoundingClientRect().top } : null;
  }
  function pinReading(anchor, top) {
    if (!anchor || !anchor.isConnected) return;
    root.style.scrollBehavior = "auto";
    var delta = anchor.getBoundingClientRect().top - top;
    if (Math.abs(delta) > 0.5) window.scrollTo({ top: window.scrollY + delta, left: 0, behavior: "auto" });
  }
  var applySize = function (n) {
    n = Math.max(18, Math.min(40, n));
    if (n === read()) return;
    var anchor = readingAnchor();
    var top = anchor ? anchor.top : 0;
    root.style.overflowAnchor = "none";
    root.style.scrollBehavior = "auto";
    root.style.setProperty("--fs", n + "px");
    try { localStorage.setItem("tefila-font", String(n)); } catch (e) {}
    if (anchor) pinReading(anchor.el, top);
    requestAnimationFrame(function () {
      if (anchor) pinReading(anchor.el, top);
      requestAnimationFrame(function () {
        if (anchor) pinReading(anchor.el, top);
      });
    });
  };
  var dec = document.getElementById("font-dec");
  var inc = document.getElementById("font-inc");
  var slider = null;
  var sliderValue = null;
  var sliderFrame = 0;
  var sliderPending = null;
  function syncSlider(n) {
    if (slider && String(slider.value) !== String(n)) slider.value = String(n);
    if (sliderValue) sliderValue.textContent = String(n);
  }
  var applySizeAndSync = function (n) {
    applySize(n);
    syncSlider(read());
  };
  if (dec) dec.addEventListener("click", function () { applySizeAndSync(nextSize(read(), -1)); });
  if (inc) inc.addEventListener("click", function () { applySizeAndSync(nextSize(read(), 1)); });
  if (dec || inc) {
    var pop = document.createElement("div");
    pop.className = "font-pop";
    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.id = "font-slider-toggle";
    toggle.className = "font-slider-toggle";
    toggle.setAttribute("aria-label", "גודל טקסט");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", "font-panel");
    toggle.textContent = "Aא";
    var panel = document.createElement("div");
    panel.id = "font-panel";
    panel.className = "font-panel";
    panel.hidden = true;
    panel.innerHTML = '<div class="font-panel-row"><span class="font-mark font-mark-sm" aria-hidden="true">א</span><input type="range" id="font-slider" min="18" max="40" step="1" dir="rtl" aria-label="גודל טקסט"><span class="font-mark font-mark-lg" aria-hidden="true">א</span><button type="button" id="font-panel-close" aria-label="סגור">×</button></div><p class="font-value" id="font-value"></p>';
    pop.appendChild(toggle);
    var header = document.querySelector("header.bar");
    if (dec && dec.parentNode) dec.parentNode.insertBefore(pop, dec);
    else if (header) header.appendChild(pop);
    document.body.appendChild(panel);
    slider = panel.querySelector("#font-slider");
    sliderValue = panel.querySelector("#font-value");
    syncSlider(read());
    function placePanel(node) {
      var bar = document.querySelector("header.bar");
      var top = bar ? bar.getBoundingClientRect().bottom + 6 : 8;
      node.style.top = top + "px";
    }
    function holdScroll(fn) {
      var y = window.scrollY;
      root.style.scrollBehavior = "auto";
      fn();
      window.scrollTo({ top: y, left: 0, behavior: "auto" });
      requestAnimationFrame(function () {
        window.scrollTo({ top: y, left: 0, behavior: "auto" });
      });
    }
    function setOpen(open) {
      holdScroll(function () {
        if (open && window.tefilaCloseScrollPanel) window.tefilaCloseScrollPanel();
        panel.hidden = !open;
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        if (open) placePanel(panel);
      });
    }
    window.tefilaCloseFontPanel = function () { if (!panel.hidden) setOpen(false); };
    toggle.addEventListener("click", function (event) {
      event.stopPropagation();
      setOpen(panel.hidden);
    });
    panel.querySelector("#font-panel-close").addEventListener("click", function () { setOpen(false); });
    document.addEventListener("pointerdown", function (event) {
      if (panel.hidden) return;
      if (panel.contains(event.target) || pop.contains(event.target)) return;
      setOpen(false);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !panel.hidden) setOpen(false);
    });
    slider.addEventListener("input", function () {
      sliderPending = parseInt(slider.value, 10);
      if (sliderFrame) return;
      sliderFrame = requestAnimationFrame(function () {
        sliderFrame = 0;
        var value = sliderPending;
        sliderPending = null;
        if (value == null) return;
        applySize(value);
        syncSlider(read());
      });
    });

    var speedKey = "tefila-scroll-lpm:" + (document.body.getAttribute("data-service") || location.pathname);
    var speedMin = 6;
    var speedMax = 30;
    var lpm = 12;
    try {
      var savedSpeed = parseInt(localStorage.getItem(speedKey), 10);
      if (savedSpeed >= speedMin && savedSpeed <= speedMax) lpm = savedSpeed;
    } catch (e) {}
    var scrollPop = document.createElement("div");
    scrollPop.className = "font-pop";
    var scrollToggle = document.createElement("button");
    scrollToggle.type = "button";
    scrollToggle.id = "scroll-toggle";
    scrollToggle.className = "font-slider-toggle";
    scrollToggle.setAttribute("aria-label", "גלילה אוטומטית");
    scrollToggle.setAttribute("aria-pressed", "false");
    scrollToggle.setAttribute("aria-controls", "scroll-panel");
    scrollToggle.textContent = "▶";
    var scrollPanel = document.createElement("div");
    scrollPanel.id = "scroll-panel";
    scrollPanel.className = "scroll-panel";
    scrollPanel.hidden = true;
    scrollPanel.innerHTML = '<div class="font-panel-row"><span class="font-mark font-mark-sm" aria-hidden="true">איטי</span><input type="range" id="scroll-speed" min="6" max="30" step="1" dir="rtl" aria-label="מהירות גלילה"><span class="font-mark font-mark-lg" aria-hidden="true">מהיר</span><button type="button" id="scroll-panel-close" aria-label="סגור">×</button></div><div class="scroll-actions"><button type="button" id="scroll-slower" aria-label="לאט יותר">−</button><button type="button" id="scroll-play" aria-label="נגן">▶</button><button type="button" id="scroll-faster" aria-label="מהר יותר">+</button></div><p class="font-value" id="scroll-value"></p><p class="scroll-hint" id="scroll-wake-hint" hidden>אם המסך נכבה, בטלו את הנעילה האוטומטית.</p>';
    var scrollFloat = document.createElement("button");
    scrollFloat.type = "button";
    scrollFloat.id = "scroll-float";
    scrollFloat.className = "scroll-float";
    scrollFloat.hidden = true;
    scrollFloat.setAttribute("aria-label", "השהה גלילה");
    scrollFloat.textContent = "⏸";
    scrollPop.appendChild(scrollToggle);
    if (pop.parentNode) pop.parentNode.insertBefore(scrollPop, pop);
    document.body.appendChild(scrollPanel);
    document.body.appendChild(scrollFloat);
    var speedInput = scrollPanel.querySelector("#scroll-speed");
    var speedLabel = scrollPanel.querySelector("#scroll-value");
    var playBtn = scrollPanel.querySelector("#scroll-play");
    var wakeHint = scrollPanel.querySelector("#scroll-wake-hint");
    var playing = false;
    var acc = 0;
    var lastTick = 0;
    var rafId = 0;
    var wakeSentinel = null;
    function showSpeed() {
      speedInput.value = String(lpm);
      speedLabel.textContent = lpm + " שורות לדקה";
    }
    function saveSpeed() {
      try { localStorage.setItem(speedKey, String(lpm)); } catch (e) {}
    }
    function linePx() {
      var sample = document.querySelector("p.t");
      if (!sample) return read() * 2.05;
      var measured = parseFloat(getComputedStyle(sample).lineHeight);
      return measured > 0 ? measured : read() * 2.05;
    }
    function atEnd() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      return window.scrollY >= max - 2;
    }
    function paintPlay(on) {
      playing = on;
      scrollToggle.textContent = on ? "⏸" : "▶";
      scrollToggle.setAttribute("aria-pressed", on ? "true" : "false");
      playBtn.textContent = on ? "⏸" : "▶";
      playBtn.setAttribute("aria-label", on ? "השהה" : "נגן");
      scrollFloat.hidden = !on || !scrollPanel.hidden;
    }
    function releaseWake() {
      if (wakeSentinel) {
        wakeSentinel.release().catch(function () {});
        wakeSentinel = null;
      }
    }
    function acquireWake() {
      if (!navigator.wakeLock) {
        wakeHint.hidden = false;
        return;
      }
      navigator.wakeLock.request("screen").then(function (sentinel) {
        wakeSentinel = sentinel;
        wakeHint.hidden = true;
      }).catch(function () {
        wakeHint.hidden = false;
      });
    }
    function tick(now) {
      if (!playing) return;
      if (!lastTick) lastTick = now;
      var dt = Math.min(0.05, (now - lastTick) / 1000);
      lastTick = now;
      if (atEnd()) { pauseScroll(); return; }
      acc += (lpm / 60) * linePx() * dt;
      if (acc >= 0.2) {
        var before = window.scrollY;
        root.style.scrollBehavior = "auto";
        window.scrollTo(0, before + acc);
        acc -= window.scrollY - before;
      }
      rafId = requestAnimationFrame(tick);
    }
    function pauseScroll() {
      playing = false;
      lastTick = 0;
      acc = 0;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      releaseWake();
      paintPlay(false);
    }
    function playScroll() {
      if (atEnd()) return;
      paintPlay(true);
      scrollPanel.hidden = true;
      scrollToggle.setAttribute("aria-expanded", "false");
      scrollFloat.hidden = false;
      lastTick = 0;
      acc = 0;
      acquireWake();
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(tick);
    }
    function setScrollOpen(open) {
      holdScroll(function () {
        if (open && window.tefilaCloseFontPanel) window.tefilaCloseFontPanel();
        scrollPanel.hidden = !open;
        scrollToggle.setAttribute("aria-expanded", open ? "true" : "false");
        if (open) placePanel(scrollPanel);
        scrollFloat.hidden = !playing || !scrollPanel.hidden;
      });
    }
    window.tefilaCloseScrollPanel = function () { if (!scrollPanel.hidden) setScrollOpen(false); };
    showSpeed();
    scrollToggle.addEventListener("click", function (event) {
      event.stopPropagation();
      setScrollOpen(scrollPanel.hidden);
    });
    scrollPanel.querySelector("#scroll-panel-close").addEventListener("click", function () { setScrollOpen(false); });
    playBtn.addEventListener("click", function () { if (playing) pauseScroll(); else playScroll(); });
    scrollFloat.addEventListener("click", function () { pauseScroll(); });
    function setLpm(next) {
      lpm = Math.max(speedMin, Math.min(speedMax, next));
      showSpeed();
      saveSpeed();
    }
    scrollPanel.querySelector("#scroll-slower").addEventListener("click", function () { setLpm(lpm - 1); });
    scrollPanel.querySelector("#scroll-faster").addEventListener("click", function () { setLpm(lpm + 1); });
    speedInput.addEventListener("input", function () { setLpm(parseInt(speedInput.value, 10)); });
    document.addEventListener("pointerdown", function (event) {
      if (scrollPanel.hidden) return;
      if (scrollPanel.contains(event.target) || scrollPop.contains(event.target)) return;
      setScrollOpen(false);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !scrollPanel.hidden) setScrollOpen(false);
    });
    function manualPause(event) {
      if (!playing) return;
      if (event.target.closest && event.target.closest("header.bar, #scroll-panel, #scroll-float, #font-panel")) return;
      pauseScroll();
    }
    document.addEventListener("touchstart", manualPause, { passive: true });
    document.addEventListener("wheel", manualPause, { passive: true });
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible" && playing) acquireWake();
    });
  }

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

  var ACCENTS = ["gold", "blue", "olive", "bordeaux", "purple", "turquoise"];
  function readAccent() {
    var attr = document.documentElement.getAttribute("data-accent");
    return ACCENTS.indexOf(attr) === -1 ? "blue" : attr;
  }
  function applyAccent(name, persist) {
    if (ACCENTS.indexOf(name) === -1) name = "blue";
    document.documentElement.setAttribute("data-accent", name);
    document.querySelectorAll("[data-set-accent]").forEach(function (button) {
      button.setAttribute("aria-pressed", button.getAttribute("data-set-accent") === name ? "true" : "false");
    });
    if (persist) {
      try { localStorage.setItem("tefila-accent", name); } catch (e) {}
    }
  }
  function closeAccentMenus() {
    document.querySelectorAll(".accent-menu").forEach(function (menu) { menu.hidden = true; });
    document.querySelectorAll("#accent-toggle, .accent-pop > button").forEach(function (button) {
      button.setAttribute("aria-expanded", "false");
    });
  }

  function boot() {
    if (document.getElementById("today-banner") || document.getElementById("toc") || document.querySelector(".mode-switch")) {
      ensureModeStatus();
      ensureToc();
      applyMode(readMode(), false);
    }
    applyAccent(readAccent(), false);
    document.addEventListener("click", function (event) {
      var minyanButton = event.target.closest && event.target.closest("[data-set-minyan]");
      if (minyanButton) {
        applyMode(minyanButton.getAttribute("data-set-minyan"), true);
        return;
      }
      var accentButton = event.target.closest && event.target.closest("[data-set-accent]");
      if (accentButton) {
        applyAccent(accentButton.getAttribute("data-set-accent"), true);
        closeAccentMenus();
        return;
      }
      var toggle = event.target.closest && event.target.closest(".accent-pop > button");
      if (toggle) {
        var menu = toggle.parentNode.querySelector(".accent-menu");
        var willOpen = menu.hasAttribute("hidden");
        closeAccentMenus();
        if (willOpen) {
          menu.hidden = false;
          toggle.setAttribute("aria-expanded", "true");
        }
        return;
      }
      closeAccentMenus();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeAccentMenus();
    });
    window.addEventListener("storage", function (event) {
      if (event.key === KEY) applyMode(event.newValue === "minyan" ? "minyan" : "yachid", false);
      if (event.key === "tefila-accent") applyAccent(event.newValue, false);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
