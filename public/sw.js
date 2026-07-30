const CACHE = "studyhelper-shell-v3";
const APP_SHELL = ["/", "/offline.html", "/manifest.webmanifest", "/favicon.svg", "/icon-maskable.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
      self.registration.navigationPreload?.enable(),
    ]),
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

async function cacheable(response) {
  return response.ok && !response.headers.get("cache-control")?.includes("no-store");
}

async function networkFirst(request, preloadResponse) {
  try {
    const response = await preloadResponse || await fetch(request);
    if (await cacheable(response)) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return await caches.match(request) || await caches.match("/") || await caches.match("/offline.html");
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (await cacheable(response)) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request, event.preloadResponse));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/assets/") || /\.(?:css|js|svg|png|webp|woff2?)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(event.request));
  }
});
