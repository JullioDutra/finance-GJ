// Service worker simples: deixa o app instalável e abre mesmo sem internet
// (mostra a última versão das telas). Os dados (/api) nunca são guardados em cache.
const CACHE = "gj-v2";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/manifest.webmanifest"]).catch(() => undefined)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // arquivos estáticos com hash: cache primeiro
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copia));
            return res;
          }),
      ),
    );
    return;
  }

  // páginas: rede primeiro, cache se estiver offline
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.type === "basic" && !res.redirected) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("/"))),
  );
});
