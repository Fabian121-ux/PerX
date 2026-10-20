/* PtahX PWA v10 — public assets only. Authenticated HTML, RSC responses,
   API data, deals, messages and Supabase media must NEVER enter CacheStorage. */
const VERSION = "v10";
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
