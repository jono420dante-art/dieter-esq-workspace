// Minimal offline cache for DIETER PWA shell.
// Note: fetch to localhost API won't be cached.

const CACHE = "dieter-pwa-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll([
        "./",
        "./index.html",
        "./styles.css",
        "./app.js",
        "./manifest.webmanifest",
      ])
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE ? Promise.resolve() : caches.delete(k))))
    )
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // never cache API calls
  if (url.hostname === "127.0.0.1" || url.hostname === "localhost") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return resp;
        })
        .catch(() => cached);
    })
  );
});

