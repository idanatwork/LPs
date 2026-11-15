(function () {
  var LATER = "tefila-install-later";
  var TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;
  var banner = document.getElementById("install-banner");
  var hub = document.getElementById("install-hub");
  var go = document.getElementById("install-go");
  var later = document.getElementById("install-later");
  var menu = document.getElementById("install-menu");
  var guide = document.getElementById("install-guide");
  var steps = document.getElementById("install-guide-steps");
  var copy = document.getElementById("install-copy");
  var copied = document.getElementById("install-copied");
  var close = document.getElementById("install-close");
  if (!banner || !guide) return;

  function standalone() {
    try {
      if (window.matchMedia("(display-mode: standalone)").matches) return true;
      if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
    } catch (e) {}
    return window.navigator.standalone === true;
  }

  function dismissed() {
    try {
      var at = parseInt(localStorage.getItem(LATER), 10);
      return !!at && Date.now() - at < TWO_WEEKS;
    } catch (e) { return false; }
  }

  function remember() {
    try { localStorage.setItem(LATER, String(Date.now())); } catch (e) {}
    banner.hidden = true;
  }

  function shareIcon() {
    return '<svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M12 15V4M8 7l4-4 4 4"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M6 11v7a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-7"/></svg>';
  }

  function dotsIcon() {
    return '<svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true"><circle cx="6" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="18" cy="12" r="1.7" fill="currentColor"/></svg>';
  }

  function kind() {
    if (standalone()) return "";
    var ua = navigator.userAgent || "";
    var ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (ios) {
      if (/WhatsApp|Instagram|FBAN|FBAV|FB_IAB|Messenger|Line\/|Twitter|Snapchat|TikTok|musical_ly|LinkedInApp|MicroMessenger|GSA\/|Pinterest/i.test(ua)) return "inapp";
      if (/CriOS/i.test(ua)) return "chrome";
      if (/EdgiOS|FxiOS/i.test(ua)) return "share";
      return "safari";
    }
    return window.tefilaInstallPrompt ? "prompt" : "";
  }

  function fillGuide(mode) {
    var items = [];
    var title = document.getElementById("install-guide-title");
    copy.hidden = true;
    copied.hidden = true;
    if (title) title.textContent = mode === "inapp" ? "פתיחה בדפדפן" : "הוספה למסך הבית";
    if (mode === "safari") {
      items = [
        [shareIcon(), "לחצו על כפתור השיתוף בתחתית המסך"],
        [shareIcon(), "בחרו «הוסף למסך הבית»"]
      ];
    } else if (mode === "chrome") {
      items = [
        [shareIcon(), "לחצו על סמל השיתוף בשורת הכתובת, למעלה בצד ימין"],
        [shareIcon(), "בחרו «הוסף למסך הבית»"]
      ];
    } else if (mode === "share") {
      items = [
        [shareIcon(), "לחצו על כפתור השיתוף"],
        [shareIcon(), "בחרו «הוסף למסך הבית»"]
      ];
    } else if (mode === "inapp") {
      items = [
        [dotsIcon(), "פתחו את התפריט של שלוש הנקודות"],
        [shareIcon(), "בחרו פתיחה בדפדפן"]
      ];
      copy.hidden = false;
    }
    steps.innerHTML = "";
    items.forEach(function (item) {
      var li = document.createElement("li");
      li.innerHTML = item[0];
      var span = document.createElement("span");
      span.textContent = item[1];
      li.appendChild(span);
      steps.appendChild(li);
    });
  }

  function openGuide(mode) {
    fillGuide(mode);
    if (typeof guide.showModal === "function") guide.showModal();
    else guide.hidden = false;
  }

  function paint() {
    var mode = kind();
    var show = !!mode;
    if (hub) hub.hidden = !show;
    banner.hidden = !show || dismissed();
    return mode;
  }

  function afterSplash(fn) {
    if (window.tefilaSplashActive) {
      var prev = window.tefilaAfterSplash;
      window.tefilaAfterSplash = function () {
        if (typeof prev === "function") prev();
        fn();
      };
      return;
    }
    fn();
  }

  function start() {
    paint();
    window.tefilaOnInstallPrompt = function () { paint(); };
  }

  go.addEventListener("click", function () {
    var mode = kind();
    if (mode === "prompt" && window.tefilaInstallPrompt) {
      var event = window.tefilaInstallPrompt;
      window.tefilaInstallPrompt = null;
      event.prompt();
      if (event.userChoice) {
        event.userChoice.then(function () { paint(); });
      }
      return;
    }
    if (mode) openGuide(mode);
  });
  if (menu) menu.addEventListener("click", function () { go.click(); });
  later.addEventListener("click", remember);
  close.addEventListener("click", function () {
    if (typeof guide.close === "function") guide.close();
    else guide.hidden = true;
  });
  copy.addEventListener("click", function () {
    var url = location.href;
    function done() { copied.hidden = false; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, done);
      return;
    }
    var field = document.createElement("textarea");
    field.value = url;
    document.body.appendChild(field);
    field.select();
    try { document.execCommand("copy"); } catch (e) {}
    field.remove();
    done();
  });

  afterSplash(start);
})();
