const CACHE = "kademe2-v2-600-release-20261021-" + new URL(self.registration.scope).pathname;
const ASSETS = ["./", "./index.html", "./style.css", "./app.js", "./core.js", "./bank.js", "./icon.svg", "./icon-192.png", "./icon-512.png", "./manifest.webmanifest"];
const URLS = new Set(ASSETS.map(p => new URL(p, self.registration.scope).href));
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("kademe2-") && k.endsWith(new URL(self.registration.scope).pathname) && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || !URLS.has(event.request.url.split("#")[0])) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match(new URL("./index.html", self.registration.scope).href)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
