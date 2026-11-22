/* Bild-Generator – legt alle Dateien auf dem Gerät ab, damit die App ohne Internet läuft. */
var CACHE = "bild-generator-v1";
var DATEIEN = ["./", "./index.html", "./manifest.json", "./icon-180.png", "./icon-512.png", "../kmf-logo.jpg"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(DATEIEN); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (namen) {
    return Promise.all(namen.filter(function (n) { return n.indexOf("bild-generator-") === 0 && n !== CACHE; })
      .map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

// Erst aus dem Netz holen (dann gibt es Verbesserungen), ohne Netz aus dem Gerätespeicher.
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then(function (antwort) {
      if (antwort && antwort.ok) {
        var kopie = antwort.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, kopie); });
      }
      return antwort;
    }).catch(function () {
      return caches.match(e.request, { ignoreSearch: true }).then(function (t) {
        return t || caches.match("./index.html");
      });
    })
  );
});
