/* PtahX PWA v10 — public assets only. Authenticated HTML, RSC responses,
   API data, deals, messages and Supabase media must NEVER enter CacheStorage. */
const VERSION = "v11";
const CACHE_PREFIX = "ptahx-";
const SHELL_CACHE = `${CACHE_PREFIX}offline-shell-${VERSION}`;
const BUILD_CACHE = `${CACHE_PREFIX}immutable-build-${VERSION}`;
const PUBLIC_CACHE = `${CACHE_PREFIX}public-assets-${VERSION}`;
const OFFLINE_URL = "/offline";
const BUILD_MAX_ENTRIES = 180;
const PUBLIC_MAX_ENTRIES = 48;

const CORE_ASSETS = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/brand/ptahx-logo-horizontal-light.png",
  "/brand/ptahx-logo-horizontal-dark.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // The offline page is required; optional brand images must not prevent
    // SW installation when an asset is temporarily missing from a deployment.
    await cache.add(OFFLINE_URL);
    await Promise.all(CORE_ASSETS.slice(1).map((asset) =>
      cache.add(asset).catch(() => undefined),
    ));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, BUILD_CACHE, PUBLIC_CACHE]);
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => key.startsWith(CACHE_PREFIX) && !keep.has(key))
        .map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

function isPublicAsset(pathname) {
  return (
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/brand/") ||
    pathname.startsWith("/image_ux_ux/") ||
    pathname === "/favicon.ico" ||
    pathname === "/main_app_logo.png" ||
    pathname === "/manifest.webmanifest"
  );
}

function cacheFor(url) {
  if (url.pathname.startsWith("/_next/static/")) {
    return { name: BUILD_CACHE, limit: BUILD_MAX_ENTRIES };
  }
  if (isPublicAsset(url.pathname)) {
    return { name: PUBLIC_CACHE, limit: PUBLIC_MAX_ENTRIES };
  }
  return null;
}

function mayStore(request, response) {
  if (!response.ok || response.type !== "basic") return false;
  const cacheControl = response.headers.get("Cache-Control") || "";
  if (/\b(?:no-store|private)\b/i.test(cacheControl)) return false;
  if (response.headers.has("Set-Cookie")) return false;
  // A public asset returning a login/HTML page must never be cached as JS/CSS.
  const type = response.headers.get("Content-Type") || "";
  if (/text\/html|application\/json|text\/event-stream/i.test(type)) return false;
  return request.destination !== "document";
}

async function trimCache(cache, limit) {
  const keys = await cache.keys();
  if (keys.length <= limit) return;
  await Promise.all(keys.slice(0, keys.length - limit).map((key) => cache.delete(key)));
}

async function serveImmutableAsset(event, bucket) {
  const request = event.request;
  const cache = await caches.open(bucket.name);
  const existing = await cache.match(request);
  if (existing) return existing;
  // Do not fall back to an HTML offline page for JS, CSS or images. That
  // previously caused MIME errors and a broken interface on poor networks.
  const response = await fetch(request);
  if (mayStore(request, response)) {
    event.waitUntil(
      cache.put(request, response.clone())
        .then(() => trimCache(cache, bucket.limit))
        .catch(() => undefined),
    );
  }
  return response;
}

async function serveNavigation(event) {
  try {
    // Network-only for all pages: user-specific HTML/RSC is never persisted.
    return await fetch(event.request);
  } catch {
    return (await caches.match(OFFLINE_URL)) ||
      Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept authenticated data, Next RSC flight requests, optimized
  // user-uploaded images, API/SSE responses or admin resources.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/image") ||
    request.headers.get("RSC") ||
    request.headers.get("Next-Router-Prefetch")
  ) return;

  if (request.mode === "navigate") {
    event.respondWith(serveNavigation(event));
    return;
  }

  const bucket = cacheFor(url);
  if (bucket && request.destination !== "document") {
    event.respondWith(serveImmutableAsset(event, bucket));
  }
});


// Push notifications are intentionally handled by the service worker so they
// can be displayed when the installed PWA has no open window.
self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let payload = {};
    try {
      payload = event.data ? event.data.json() : {};
    } catch {
      payload = { title: "preX", body: "You have a new update." };
    }
    const title = typeof payload.title === "string" ? payload.title.slice(0, 80) : "preX";
    const body = typeof payload.body === "string" ? payload.body.slice(0, 180) : "You have a new update.";
    const url = typeof payload.url === "string" && payload.url.startsWith("/") && !payload.url.startsWith("//")
      ? payload.url
      : "/app/notifications";
    await self.registration.showNotification(title, {
      body,
      data: { url },
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: typeof payload.tag === "string" ? payload.tag.slice(0, 100) : "prex-update",
      renotify: false,
      timestamp: Date.now(),
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url;
  const url = typeof target === "string" && target.startsWith("/") && !target.startsWith("//")
    ? new URL(target, self.location.origin).href
    : new URL("/app/notifications", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(url);
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
