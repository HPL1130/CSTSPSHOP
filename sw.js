const CACHE_NAME = 'cst-affiliate-shop-v3'; // <--- 變更到 v3 (強制更新)
const urlsToCache = [
  './', 
  './index.html',
  './styles.css',
  './app.js',
  // './shop_data.json', // <-- 舊資料檔案已移除
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
        // 如果快取中有匹配的資源，就直接返回
        if (response) {
          return response;
        }
        // 否則就從網路發起請求
        return fetch(event.request);
      })
  );
});
