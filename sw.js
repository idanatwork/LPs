var CACHE = "tefila-pages";

self.addEventListener("install", function (event) {
  event.waitUntil(self.skipWaiting());
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
    /\.(html|js|mjs|css|webmanifest|svg|png)$/.test(path) ||
    path.endsWith("/vendor/hebcal-core.js");
}

self.addEventListener("fetch", function (event) {
  var url = new URL(event.request.url);
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
