const CACHE = "tertis-1.12-4";
const FILES = ["/","/index.html","/styles.css?v=1.12.4","/engine.js?v=1.12.4","/app.js?v=1.12.4","/manifest.webmanifest","/assets/icon.png","/assets/background.mp3","/assets/deadlock.mp3","/assets/chaos.mp3"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => { if (event.request.method === "GET") event.respondWith(fetch(event.request).then(response => { const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response; }).catch(()=>caches.match(event.request))); });
