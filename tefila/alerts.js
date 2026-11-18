(function () {
  var WORKER = "https://tefila-push-worker.idanatwork.workers.dev";
  var VAPID = "BAfcnfmCr7UQYyKZviXZirgbb579cBt0VlgUNm83sNE0_KdmnMGhZ3xhNdkpWo9u3q9NtFRwWpyfnVNSVPBAUtU";
  var STORAGE = "tefila-alerts";
  var ORANIT = { lat: 32.1317, lng: 34.9933, tz: "Asia/Jerusalem" };

  function defaults() {
    return {
      shacharit: true,
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
      if (raw) Object.assign(s, JSON.parse(raw));
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

  function readForm(s) {
    s.shacharit = $("alert-shacharit").checked;
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
    $("alert-mincha").checked = !!s.mincha;
    $("alert-mincha-offset").value = String(s.minchaOffset);
    $("alert-arvit").checked = !!s.arvit;
    $("alert-arvit-offset").value = String(s.arvitOffset);
    var radios = document.querySelectorAll('input[name="alert-loc"]');
    for (var i = 0; i < radios.length; i++) radios[i].checked = radios[i].value === s.loc;
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

  async function refreshState(s) {
    if (!supported()) {
      setState("הדפדפן אינו תומך בהתראות");
      $("alert-subscribe").disabled = true;
      $("alert-unsubscribe").hidden = true;
      return;
    }
    if (iosBlocked()) {
      $("alerts-ios").hidden = false;
      $("alert-subscribe").disabled = true;
      $("alert-unsubscribe").hidden = true;
      setState("לא פעילות");
      return;
    }
    $("alerts-ios").hidden = true;
    if (Notification.permission === "denied") {
      setState("ההרשאה להתראות נחסמה");
      $("alert-subscribe").disabled = true;
      $("alert-unsubscribe").hidden = true;
      return;
    }
    var sub = await currentSub();
    if (sub) {
      setState("פעילות");
      $("alert-subscribe").hidden = true;
      $("alert-subscribe").disabled = false;
      $("alert-unsubscribe").hidden = false;
    } else {
      setState("לא פעילות");
      $("alert-subscribe").hidden = false;
      $("alert-subscribe").disabled = false;
      $("alert-unsubscribe").hidden = true;
    }
  }

  function payload(s, subscription) {
    return {
      subscription: {
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime,
        keys: {
          p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey("p256dh")))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""),
          auth: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey("auth")))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
        }
      },
      lat: s.lat,
      lng: s.lng,
      tz: s.tz,
      alerts: {
        shacharit: !!s.shacharit,
        mincha: !!s.mincha,
        minchaOffset: s.minchaOffset,
        arvit: !!s.arvit,
        arvitOffset: s.arvitOffset
      }
    };
  }

  function keysFromSub(subscription) {
    function b64url(buf) {
      var bin = btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
      return bin.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    }
    return {
      endpoint: subscription.endpoint,
      expirationTime: subscription.expirationTime,
      keys: {
        p256dh: b64url(subscription.getKey("p256dh")),
        auth: b64url(subscription.getKey("auth"))
      }
    };
  }

  async function maybeGeo(s) {
    if (s.loc !== "geo" || !navigator.geolocation) {
      if (s.loc !== "geo") {
        s.lat = ORANIT.lat;
        s.lng = ORANIT.lng;
        s.tz = ORANIT.tz;
      }
      return s;
    }
    try {
      var pos = await new Promise(function (resolve, reject) {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 });
      });
      s.lat = pos.coords.latitude;
      s.lng = pos.coords.longitude;
      s.tz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || ORANIT.tz;
    } catch (e) {
      setState("לא ניתן לקבל את המיקום, נעשה שימוש באורנית");
      s.loc = "oranit";
      s.lat = ORANIT.lat;
      s.lng = ORANIT.lng;
      s.tz = ORANIT.tz;
      writeForm(s);
    }
    return s;
  }

  async function subscribe() {
    var s = readForm(load());
    s = await maybeGeo(s);
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
    var body = payload(s, sub);
    body.subscription = keysFromSub(sub);
    var res = await fetch(WORKER + "/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      setState("לא הצלחנו לשמור את ההתראות");
      return;
    }
    setState("פעילות");
    $("alert-subscribe").hidden = true;
    $("alert-unsubscribe").hidden = false;
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
    $("alert-subscribe").hidden = false;
    $("alert-unsubscribe").hidden = true;
  }

  function persistFromForm() {
    var s = readForm(load());
    save(s);
    currentSub().then(function (sub) {
      if (!sub) return;
      var body = payload(s, sub);
      body.subscription = keysFromSub(sub);
      fetch(WORKER + "/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }).catch(function () {});
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!$("alerts-panel")) return;
    var s = load();
    writeForm(s);
    refreshState(s);
    $("alert-subscribe").addEventListener("click", function () { subscribe(); });
    $("alert-unsubscribe").addEventListener("click", function () { unsubscribe(); });
    $("alerts-panel").addEventListener("change", function () { persistFromForm(); });
  });
})();
