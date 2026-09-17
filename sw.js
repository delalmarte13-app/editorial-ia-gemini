// Service worker minimo: permite que la app sea instalable en Android.
// No cachea nada (todas las peticiones van a la red), asi no puede servir
// contenido viejo ni romper la app.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request));
});