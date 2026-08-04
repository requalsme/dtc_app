const CACHE = "dtc-shell-v2";
const SHELL = ["/", "/logo.png", "/favicon.svg", "/icons.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Never intercept API calls — let them fail naturally (offline queue handles it client-side)
  if (url.pathname.startsWith("/api/")) return;

  // For page navigation: network first, fall back to cached shell
  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put("/", clone));
          return res;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  // For JS/CSS/image assets: cache first (Vite adds content hashes, so stale = stale version)
  if (request.method === "GET" && (
    url.pathname.startsWith("/assets/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico")
  )) {
    e.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request).then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(request, res.clone()));
          return res;
        });
        return cached || network;
      })
    );
  }
});

// Listen for messages from the app (e.g. skipWaiting trigger)
self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
});
