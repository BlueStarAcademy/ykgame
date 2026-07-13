const CACHE_PREFIX = "ykgame-static-";
const CACHE_NAME = `${CACHE_PREFIX}v3`;
const STATIC_ASSET_EXTENSION =
  /\.(?:avif|gif|ico|jpe?g|json|mp3|ogg|otf|png|svg|ttf|wav|webp|woff2?)$/i;

function isCacheableStaticRequest(request) {
  if (request.method !== "GET") return false;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;

  if (url.pathname.startsWith("/_next/static/")) return true;
  if (
    url.pathname.startsWith("/images/") ||
    url.pathname.startsWith("/icons/")
  ) {
    return STATIC_ASSET_EXTENSION.test(url.pathname);
  }

  // /games also contains HTML routes, so only file-like asset URLs are static.
  return (
    url.pathname.startsWith("/games/") &&
    STATIC_ASSET_EXTENSION.test(url.pathname)
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (!isCacheableStaticRequest(event.request)) {
    // HTML, API, auth, cross-origin, and every non-GET request stay network-only.
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;

      const response = await fetch(event.request);
      if (response.status === 200) {
        await cache.put(event.request, response.clone());
      }
      return response;
    }),
  );
});
