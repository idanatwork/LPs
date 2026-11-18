var CACHE = "tefila-pages-47";
var PRECACHE = ["tefila/parchment-p1.webp?v=47"];

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) { return cache.addAll(PRECACHE); }));
});

self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "tefila-ready") self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) { return key !== CACHE; }).map(function (key) {
        return caches.delete(key);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function cacheable(url, request) {
  if (request.method !== "GET" || url.origin !== self.location.origin) return false;
  if (url.pathname.endsWith("/version.json")) return false;
  var path = url.pathname;
  var dest = request.destination;
  return dest === "document" || dest === "script" || dest === "style" ||
    /\.(html|js|mjs|css|webmanifest|svg|png|webp)$/.test(path) ||
    path.endsWith("/vendor/hebcal-core.js");
}

self.addEventListener("fetch", function (event) {
  var url = new URL(event.request.url);
  if (url.hostname === "static.cloudflareinsights.com" || /\.cloudflareinsights\.com$/.test(url.hostname)) return;
  if (url.hostname === "wa.me" || url.hostname === "api.whatsapp.com" || /\.whatsapp\.com$/.test(url.hostname)) return;
  if (url.hostname === "tefila-push-worker.idanatwork.workers.dev" || /\.workers\.dev$/.test(url.hostname)) return;
  if (!cacheable(url, event.request)) return;
  event.respondWith(
    fetch(event.request).then(function (response) {
      if (response && response.ok) {
        var copy = response.clone();
        caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
      }
      return response;
    }).catch(function () {
      return caches.match(event.request);
    })
  );
});

function notifyIcon(file) {
  try {
    return new URL("tefila/" + file, self.registration.scope).href;
  } catch (e) {
    return "tefila/" + file;
  }
}

self.addEventListener("push", function (event) {
  var data = { title: "תפילה", body: "", url: "https://idanatwork.github.io/LPs/tefila/" };
  try {
    if (event.data) {
      var parsed = event.data.json();
      if (typeof parsed === "string") parsed = JSON.parse(parsed);
      if (parsed && typeof parsed === "object") {
        if (parsed.title) data.title = parsed.title;
        if (parsed.body) data.body = parsed.body;
        if (parsed.url) data.url = parsed.url;
      }
    }
  } catch (e) {
    try { if (event.data) data.body = event.data.text(); } catch (e2) {}
  }
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body || "",
    icon: notifyIcon("apple-touch-icon.png"),
    badge: notifyIcon("favicon-32.png"),
    lang: "he",
    dir: "rtl",
    data: { url: data.url }
  }));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || "https://idanatwork.github.io/LPs/tefila/";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    var targetPath;
    try { targetPath = new URL(url, self.registration.scope).pathname; } catch (e) { targetPath = ""; }
    for (var i = 0; i < list.length; i++) {
      var client = list[i];
      var path = "";
      try { path = new URL(client.url).pathname; } catch (e2) {}
      if (client.url === url || (targetPath && path === targetPath)) {
        if (client.focus) return client.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  }));
});
