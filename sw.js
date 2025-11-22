const CACHE_NAME = 'cst-affiliate-shop-v2';
const urlsToCache = [
  './', // 確保使用 './' 表示當前目錄 (這是解決 404 的關鍵之一)
  './index.html',
  './styles.css',
  './app.js',
  './shop_data.json', // 必須確保資料檔案被快取
  './manifest.json',
  // PWA 圖標
  './images/icons/icon-192x192.png',
  './images/icons/icon-512x512.png',
  // 類別圖標 (請確保您已將所有圖標放入 images/categories/ 資料夾)
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
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        // No cache match - fetch from network
        return fetch(event.request);
      })
  );
});
