/* Minimal SW so Chromium can offer "Add to Home Screen" / install. */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Required for installability — network-only passthrough.
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
