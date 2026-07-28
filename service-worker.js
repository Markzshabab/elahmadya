// Bump this on every deploy that changes index.html/app.js/style.css/etc.
// Because this file's own bytes must also change for the browser to notice
// an update — if you only edit CORE_ASSETS below without touching this
// version string, the old service worker (and its stale cache) can keep
// running indefinitely and visitors will silently keep seeing old code.
const CACHE_NAME = "ahmadiya-survey-v2";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./animations.js",
  "./charts.js",
  "./firebase-config.js",
  "./manifest.json",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// API calls: always network, never cached.
// App shell (HTML/CSS/JS): network-first so a new deploy is picked up on the
// very next load, falling back to cache only when offline.
// Everything else (icons, fonts, etc.): cache-first for speed.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.hostname.includes("workers.dev") || url.pathname.includes("/api/")) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ success: false, offline: true }), {
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    return;
  }

  const isAppShell = event.request.mode === "navigate" ||
    CORE_ASSETS.some((asset) => url.pathname.endsWith(asset.replace("./", "/")));

  if (isAppShell) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});