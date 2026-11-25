"use strict";

// Bump the version when a cached file changes so clients receive a complete update.
const cachePrefix = `workout-tracker:${self.registration.scope}:`;
const cacheName = `${cachePrefix}v1`;
const appFiles = [
  "index.html", "app.js", "history.js", "styles.css", "manifest.webmanifest",
  "icons/workout-192.png", "icons/workout-512.png",
].map((path) => new URL(path, self.registration.scope).href);

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll(appFiles.map((url) => new Request(url, { cache: "reload" })));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(cachePrefix) && name !== cacheName)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  url.search = "";
  const resource = url.href === self.registration.scope ? appFiles[0] : url.href;
  if (!appFiles.includes(resource)) return;

  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    return (await cache.match(resource)) ?? fetch(request);
  })());
});
