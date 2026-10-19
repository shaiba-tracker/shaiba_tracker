// Service worker: трекер открывается без интернета.
// V — та же версия ?v=N, что у файлов в index.html, и поднимается вместе с ними. Тогда браузер
// видит новый sw.js, в фоне скачивает новую версию, а при следующем открытии показывает уже её.
'use strict';

const V = 'v=15';
const CACHE = 'shaiba-' + V;
const FONTS = 'shaiba-fonts';
const FILES = [
  './', 'help.html', 'manifest.webmanifest?' + V,
  'css/base.css?' + V, 'css/tabs.css?' + V, 'css/screens.css?' + V,
  'js/data.js?' + V, 'js/logic.js?' + V, 'js/ui.js?' + V, 'js/month.js?' + V,
  'js/tabs.js?' + V, 'js/sync.js?' + V, 'js/app.js?' + V,
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
];

// Новую версию скачиваем целиком мимо HTTP-кеша браузера, чтобы не смешать старые и новые файлы
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(FILES.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

// Старые версии удаляем, шрифты оставляем
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('shaiba-') && k !== CACHE && k !== FONTS)
      .map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Шрифты Google не меняются: из кеша, а первый раз из сети
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }))));
    return;
  }
  // Всё чужое (синхронизация с GitHub, фото игрока) идёт мимо кеша
  if (url.origin !== self.location.origin) return;
  // Страница трекера под любым адресом (./, index.html, ?…) — это './' из кеша
  const page = req.mode === 'navigate' && /\/(index\.html)?$/.test(url.pathname);
  const key = page ? './' : req;
  e.respondWith(caches.open(CACHE).then((c) => c.match(key).then((hit) => {
    const net = fetch(req).then((res) => {
      if (res.ok && !res.redirected) c.put(key, res.clone());
      return res;
    });
    if (hit) {
      // Показываем из кеша сразу, а свежую копию тихо кладём в кеш на следующий раз
      e.waitUntil(net.catch(() => null));
      return hit;
    }
    return net;
  })));
});
