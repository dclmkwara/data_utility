/**
 * DCLM Field Utility â€” Offline Service Worker
 * Cache-first strategy for app shell and assets
 */

const CACHE_NAME = "dclm-utility-v17";
const ASSETS_TO_CACHE = [
  "/",
  "/login",
  "/counter",
  "/attendance",
  "/attendance/review",
  "/registration",
  "/setup",
  "/queues",
  "/fellowship",
  "/information",
  "/assets/css/utility.css?v=8",
  "/static/css/bootstrap.min.css",
  "/static/css/bootstrap-icons.min.css",
  "/static/css/fonts/bootstrap-icons.woff2?dd67030699838ea613ee6dbda90effa6",
  "/static/css/faststrap-fx.css",
  "/static/css/faststrap-layouts.css",
  "/static/css/faststrap-visual.css",
  "/static/css/faststrap-toast.css",
  "/static/js/bootstrap.bundle.min.js",
  "/static/js/faststrap-htmx.js",
  "/static/js/faststrap-init.js",
  "/static/favicon.svg",
  "/assets/js/db.js?v=8",
  "/assets/js/auth.js?v=3",
  "/assets/js/haptics.js?v=3",
  "/assets/js/sync.js?v=8",
  "/assets/js/app.js?v=11",
  "/assets/manifest.json",
  "/assets/favicon.png",
  "/assets/icon-192.png",
  "/assets/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const results = await Promise.allSettled(ASSETS_TO_CACHE.map((asset) => cache.add(asset)));
      const failures = results.filter((result) => result.status === "rejected").length;
      if (failures) console.warn(`ServiceWorker could not cache ${failures} app-shell asset(s).`);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip caching API network sync calls
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (!response.ok) return response;
        return caches.open(CACHE_NAME).then((cache) =>
          cache.put(event.request, response.clone()).then(() => response)
        );
      }).catch(async () => (await caches.match(event.request)) || (await caches.match("/")))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        if (event.request.mode === "navigate") {
          return caches.match("/");
        }
      });
    })
  );
});
