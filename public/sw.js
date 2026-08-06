// PWA yüklenebilirlik kriteri için minimal service worker — kasıtlı olarak HİÇBİR ŞEYİ
// önbelleklemiyor (yalnız ağdan geçiriyor). Bu site canlı yarış/AGF/oran verisi
// gösteriyor — offline cache burada YANLIŞ, eski/geçersiz bir veriyi doğruymuş gibi
// göstermek gerçek para kararlarını etkileyebilir. Amaç yalnız "yükle" istemini
// mümkün kılmak, çevrimdışı destek değil.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
