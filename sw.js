const CACHE = 'espadana-v9-fresh-html';
// فقط دارایی‌های ثابت کش می‌شوند؛ خودِ HTML هرگز از کش قدیمی سرو نمی‌شود.
const ASSETS = [
  '/manifest.json',
  '/assets/stamp.jpg',
  '/assets/SIGNATURE.jpg',
  '/assets/stamp-print.png',
  '/assets/signature-print.png',
  '/assets/icon-192.png',
  '/assets/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;

  // HTML (ناوبری و ریشه): همیشه از شبکه؛ یک نسخه برای حالت آفلاین نگه داشته می‌شود.
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(event.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('/index.html', copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
