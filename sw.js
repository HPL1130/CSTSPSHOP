// sw.js

const CACHE_NAME = 'cst-affiliate-shop-v4'; // <--- 關鍵：將版本號升級到 v4
const urlsToCache = [
  './', 
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  // PWA 圖標
  './images/icons/icon-192x192.png',
  './images/icons/icon-512x512.png',
  // 類別圖標 
  './images/categories/all.png',
  './images/categories/medical.png',
  './images/categories/food.png',
  './images/categories/leisure.png',
  './images/categories/daily.png',
  './images/categories/learning.png',
  './images/categories/moto.png',
  './images/categories/3c.png',
  './images/categories/car.png',
  './images/categories/finance.png',
  './images/categories/other.png',
  // 橫幅圖
  './images/hero.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      // 刪除所有舊版本的快取
      return Promise.all(
        cacheNames.filter(cacheName => {
          // 刪除所有不等於目前 CACHE_NAME (v2) 的舊版本快取
          return cacheName.startsWith('cst-affiliate-shop-') && cacheName !== CACHE_NAME;
        }).map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  // 對於所有網路請求，都先嘗試從快取中獲取，如果失敗再從網路獲取
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
