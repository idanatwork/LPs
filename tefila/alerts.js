(function () {
  var WORKER = "https://tefila-push-worker.idanatwork.workers.dev";
  var VAPID = "BAfcnfmCr7UQYyKZviXZirgbb579cBt0VlgUNm83sNE0_KdmnMGhZ3xhNdkpWo9u3q9NtFRwWpyfnVNSVPBAUtU";
  var STORAGE = "tefila-alerts";
  var ORANIT = { lat: 32.1317, lng: 34.9933, tz: "Asia/Jerusalem" };

  function defaults() {
    return {
      shacharit: true,
      shacharitWhen: "shema",
      shacharitOffset: 15,
      mincha: true,
      minchaOffset: 15,
      arvit: true,
      arvitOffset: 0,
      loc: "oranit",
      lat: ORANIT.lat,
      lng: ORANIT.lng,
      tz: ORANIT.tz
    };
  }

  function load() {
    var s = defaults();
    try {
      var raw = localStorage.getItem(STORAGE);
      if (raw) {
        var parsed = JSON.parse(raw);
        Object.assign(s, parsed);
        if (!parsed.shacharitWhen) s.shacharitWhen = "sunrise";
      }
    } catch (e) {}
    return s;
  }

  function save(s) {
    try { localStorage.setItem(STORAGE, JSON.stringify(s)); } catch (e) {}
  }

  function isIos() {
    var ua = navigator.userAgent || "";
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  }

  function isStandalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      window.navigator.standalone === true;
  }

  function urlBase64ToUint8Array(base64String) {
    var padding = "=".repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    var raw = atob(base64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function $(id) { return document.getElementById(id); }

  function setMsg(text) {
    var el = $("alerts-msg");
    if (el) el.textContent = text || "";
  }

  function formatCoords(lat, lng) {
    function fmt(n) { return Math.abs(n).toFixed(3); }
    var ns = lat >= 0 ? "צפון" : "דרום";
    var ew = lng >= 0 ? "מזרח" : "מערב";
    return fmt(lat) + "° " + ns + ", " + fmt(lng) + "° " + ew;
  }

  function readForm(s) {
    s.shacharit = $("alert-shacharit").checked;
    var when = document.querySelector('input[name="alert-shacharit-when"]:checked');
    s.shacharitWhen = when && when.value === "sunrise" ? "sunrise" : "shema";
    s.shacharitOffset = Math.max(0, Math.min(180, Number($("alert-shacharit-offset").value) || 0));
    s.mincha = $("alert-mincha").checked;
    s.minchaOffset = Math.max(0, Math.min(180, Number($("alert-mincha-offset").value) || 0));
    s.arvit = $("alert-arvit").checked;
    s.arvitOffset = Math.max(0, Math.min(180, Number($("alert-arvit-offset").value) || 0));
    var loc = document.querySelector('input[name="alert-loc"]:checked');
    s.loc = loc ? loc.value : "oranit";
    if (s.loc !== "geo") {
      s.lat = ORANIT.lat;
      s.lng = ORANIT.lng;
      s.tz = ORANIT.tz;
    }
    return s;
  }

  function writeForm(s) {
    $("alert-shacharit").checked = !!s.shacharit;
    var whenRadios = document.querySelectorAll('input[name="alert-shacharit-when"]');
    var when = s.shacharitWhen === "sunrise" ? "sunrise" : "shema";
    for (var i = 0; i < whenRadios.length; i++) whenRadios[i].checked = whenRadios[i].value === when;
    $("alert-shacharit-offset").value = String(s.shacharitOffset == null ? 15 : s.shacharitOffset);
    $("alert-mincha").checked = !!s.mincha;
    $("alert-mincha-offset").value = String(s.minchaOffset);
    $("alert-arvit").checked = !!s.arvit;
    $("alert-arvit-offset").value = String(s.arvitOffset);
    var radios = document.querySelectorAll('input[name="alert-loc"]');
    for (var j = 0; j < radios.length; j++) radios[j].checked = radios[j].value === s.loc;
  }

  function setState(text) {
    var el = $("alerts-state");
    if (el) el.textContent = text;
  }

  function supported() {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  }

  function iosBlocked() {
    return isIos() && !isStandalone();
  }

  async function currentSub() {
    if (!("serviceWorker" in navigator)) return null;
    var reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  }

  function b64url(buf) {
    var bin = btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
    return bin.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function keysFromSub(subscription) {
    return {
      endpoint: subscription.endpoint,
      expirationTime: subscription.expirationTime,
      keys: {
        p256dh: b64url(subscription.getKey("p256dh")),
        auth: b64url(subscription.getKey("auth"))
      }
    };
  }

  function payload(s, subscription) {
    return {
      subscription: keysFromSub(subscription),
      lat: s.lat,
      lng: s.lng,
      tz: s.tz,
      alerts: {
        shacharit: !!s.shacharit,
        shacharitWhen: s.shacharitWhen === "sunrise" ? "sunrise" : "shema",
        shacharitOffset: s.shacharitOffset,
        mincha: !!s.mincha,
        minchaOffset: s.minchaOffset,
        arvit: !!s.arvit,
        arvitOffset: s.arvitOffset
      }
    };
  }

  function pushSettings(s) {
    currentSub().then(function (sub) {
      if (!sub) return;
      fetch(WORKER + "/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload(s, sub))
      }).catch(function () {});
    });
  }

  function applyOranit(s, message) {
    s.loc = "oranit";
    s.lat = ORANIT.lat;
    s.lng = ORANIT.lng;
    s.tz = ORANIT.tz;
    writeForm(s);
    save(s);
    setMsg(message);
    pushSettings(s);
  }

  // Must call getCurrentPosition in the same turn as the user gesture (iOS).
  function locateNow(s, done) {
    if (!navigator.geolocation) {
      applyOranit(s, "לא ניתן לקבל את המיקום, נעשה שימוש באורנית");
      if (done) done(s);
      return;
    }
    setMsg("מאתר את המיקום…");
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        s.loc = "geo";
        s.lat = pos.coords.latitude;
        s.lng = pos.coords.longitude;
        s.tz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || ORANIT.tz;
        writeForm(s);
        save(s);
        setMsg("המיקום הנוכחי: " + formatCoords(s.lat, s.lng));
        pushSettings(s);
        if (done) done(s);
      },
      function () {
        applyOranit(s, "לא ניתנה גישה למיקום, נעשה שימוש באורנית");
        if (done) done(s);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  }

  async function refreshState(s) {
    if (!supported()) {
      setState("הדפדפן אינו תומך בהתראות");
      $("alert-subscribe").disabled = true;
      $("alert-unsubscribe").hidden = true;
      $("alert-test").hidden = true;
      return;
    }
    if (iosBlocked()) {
      $("alerts-ios").hidden = false;
      $("alert-subscribe").disabled = true;
      $("alert-unsubscribe").hidden = true;
      $("alert-test").hidden = true;
      setState("לא פעילות");
      return;
    }
    $("alerts-ios").hidden = true;
    if (Notification.permission === "denied") {
      setState("ההרשאה להתראות נחסמה");
      $("alert-subscribe").disabled = true;
      $("alert-unsubscribe").hidden = true;
      $("alert-test").hidden = true;
      return;
    }
    var sub = await currentSub();
    if (sub) {
      setState("פעילות");
      $("alert-subscribe").hidden = true;
      $("alert-subscribe").disabled = false;
      $("alert-unsubscribe").hidden = false;
      $("alert-test").hidden = false;
    } else {
      setState("לא פעילות");
      $("alert-subscribe").hidden = false;
      $("alert-subscribe").disabled = false;
      $("alert-unsubscribe").hidden = true;
      $("alert-test").hidden = true;
    }
    if (s && s.loc === "geo" && typeof s.lat === "number") {
      setMsg("המיקום הנוכחי: " + formatCoords(s.lat, s.lng));
    }
  }

  async function subscribe() {
    var s = readForm(load());
    save(s);
    if (!supported() || iosBlocked()) return;
    var perm = await Notification.requestPermission();
    if (perm !== "granted") {
      setState(perm === "denied" ? "ההרשאה להתראות נחסמה" : "נדרשת הרשאה להתראות");
      await refreshState(s);
      return;
    }
    var reg = await navigator.serviceWorker.ready;
    var sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID)
    });
    var res = await fetch(WORKER + "/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload(s, sub))
    });
    if (!res.ok) {
      setMsg("לא הצלחנו לשמור את ההתראות");
      return;
    }
    setState("פעילות");
    $("alert-subscribe").hidden = true;
    $("alert-unsubscribe").hidden = false;
    $("alert-test").hidden = false;
  }

  async function unsubscribe() {
    var sub = await currentSub();
    if (sub) {
      try {
        await fetch(WORKER + "/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: { endpoint: sub.endpoint } })
        });
      } catch (e) {}
      try { await sub.unsubscribe(); } catch (e) {}
    }
    setState("לא פעילות");
    setMsg("");
    $("alert-subscribe").hidden = false;
    $("alert-unsubscribe").hidden = true;
    $("alert-test").hidden = true;
  }

  function persistFromForm() {
    var s = readForm(load());
    save(s);
    pushSettings(s);
  }

  async function sendTest() {
    var sub = await currentSub();
    if (!sub) {
      setMsg("אין מנוי פעיל");
      return;
    }
    setMsg("שולח התראת בדיקה…");
    try {
      var res = await fetch(WORKER + "/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: { endpoint: sub.endpoint } })
      });
      if (res.status === 429) {
        setMsg("אפשר לשלוח התראת בדיקה אחת בדקה");
        return;
      }
      if (res.status === 404 || res.status === 410) {
        setMsg("אין מנוי פעיל");
        return;
      }
      if (!res.ok) {
        setMsg("לא הצלחנו לשלוח את ההתראה");
        return;
      }
      setMsg("נשלחה התראת בדיקה");
    } catch (e) {
      setMsg("לא הצלחנו לשלוח את ההתראה");
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!$("alerts-panel")) return;
    var s = load();
    writeForm(s);
    refreshState(s);
    $("alert-subscribe").addEventListener("click", function () {
      var cur = readForm(load());
      if (cur.loc === "geo") locateNow(cur, function () { subscribe(); });
      else subscribe();
    });
    $("alert-unsubscribe").addEventListener("click", function () { unsubscribe(); });
    $("alert-test").addEventListener("click", function () { sendTest(); });
    $("alerts-panel").addEventListener("change", function (e) {
      var t = e.target;
      if (t && t.name === "alert-loc" && t.value === "geo") {
        locateNow(readForm(load()));
        return;
      }
      if (t && t.name === "alert-loc" && t.value === "oranit") {
        var cur = readForm(load());
        applyOranit(cur, "");
        return;
      }
      persistFromForm();
    });
  });
})();
