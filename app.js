
// app.js

// ====== 基礎設定 ======
const SHOP_DATA_FILE = './shop_data.json';
const itemsPerPage = 24;
let currentPage = 1;

let allShops = [];
let filteredShops = [];
const availableDistricts = new Set();

const shopListElement = document.getElementById('shopList');
const keywordInput = document.getElementById('keywordInput');
const districtFilter = document.getElementById('districtFilter');
const pageInfo = document.getElementById('pageInfo');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const categoryButtons = document.querySelector('.category-buttons');

// 可選：Hero 收合（若 index.html 有 .hero-toggle）
const siteHeader = document.querySelector('.site-header');
const heroToggle = document.querySelector('.hero-toggle');

// ====== 啟動流程 ======
init();

function init() {
  if (!shopListElement || !keywordInput || !districtFilter || !pageInfo || !prevBtn || !nextBtn || !categoryButtons) {
    console.error('必要的 DOM 元素不存在，請確認 index.html 已包含對應的 ID/class。');
    renderMessage('初始化失敗：缺少必要的版面元素。');
    return;
  }

  bindUIEvents();
  loadShops();
}

// ====== 綁定事件 ======
function bindUIEvents() {
  // 類別按鈕（事件委派）：點擊切換 active 並重新過濾
  categoryButtons.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-cat]');
    if (!btn) return;

    // 移除舊 active，設定新 active
    categoryButtons.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // 重新過濾
    filterAndRender();
  });

  // 地區下拉
  districtFilter.addEventListener('change', filterAndRender);

  // 關鍵字輸入（加上防抖）
  let debounceTimer = null;
  keywordInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => filterAndRender(), 200);
  });

  // 分頁按鈕
  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderList();
    }
  });
  nextBtn.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(filteredShops.length / itemsPerPage));
    if (currentPage < totalPages) {
      currentPage++;
      renderList();
    }
  });

  // 可選：Hero 收合
  if (siteHeader && heroToggle) {
    heroToggle.addEventListener('click', () => {
      siteHeader.classList.toggle('collapsed');
    });
  }
}

// ====== 載入資料（相容 file:// 與 http(s)） ======
function loadShops() {
  renderMessage('資料載入中…');

  const xhr = new XMLHttpRequest();
  xhr.open('GET', SHOP_DATA_FILE, true);
  xhr.onload = function () {
    // 200：HTTP 成功；0：本機檔案成功（部分容器）
    if (xhr.status === 200 || (xhr.status === 0 && xhr.responseText)) {
      try {
        allShops = JSON.parse(xhr.responseText);

        // 蒐集地區
        allShops.forEach(shop => {
          splitLocations(shop.location).forEach(loc => {
            const t = loc.trim();
            if (t) availableDistricts.add(t);
          });
        });

        populateDistrictFilter();
        filterAndRender(); // 預設：全部類別＋所有地區＋空關鍵字
      } catch (e) {
        console.error('Error parsing JSON data:', e);
        renderMessage('載入商店資料失敗（JSON 格式錯誤）。');
      }
    } else {
      console.error('Error loading shop data:', xhr.status, xhr.statusText);
      renderMessage(`載入商店資料失敗，請檢查 ${SHOP_DATA_FILE} 路徑與內容。狀態碼：${xhr.status}`);
    }
  };
  xhr.onerror = function () {
    console.error('Network error attempting to load shop data.');
    renderMessage('載入商店資料發生網路錯誤（在手機上可能無法直接讀取本機檔）。');
  };
  xhr.send();
}

// ====== 地區下拉填充 ======
function populateDistrictFilter() {
  const sortedDistricts = Array.from(availableDistricts).sort((a, b) => {
    // 「全」優先、「網路」其次，其餘中文排序
    const aFull = a.includes('全');
    const bFull = b.includes('全');
    if (aFull && !bFull) return -1;
    if (!aFull && bFull) return 1;

    const aWeb = a.includes('網路');
    const bWeb = b.includes('網路');
    if (aWeb && !bWeb) return -1;
    if (!aWeb && bWeb) return 1;

    return a.localeCompare(b, 'zh-Hant');
  });

  // 先清空，再加上「所有地區」
  districtFilter.innerHTML = '';
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = '所有地區';
  districtFilter.appendChild(allOption);

  sortedDistricts.forEach(district => {
    const option = document.createElement('option');
    option.value = district;
    option.textContent = district;
    districtFilter.appendChild(option);
  });
}

// ====== 核心過濾流程 ======
function filterAndRender() {
  const activeBtn = categoryButtons.querySelector('.active');
  const activeCategory = activeBtn ? activeBtn.dataset.cat : 'all';
  const selectedDistrict = districtFilter.value || 'all';
  const keyword = (keywordInput.value || '').toLowerCase().trim();

  filteredShops = allShops.filter(shop => {
    // 1. 類別
    const categoryMatch = (activeCategory === 'all') || (shop.category === activeCategory);

    // 2. 地區（location 可能有多個，以「、」「，」「,」分隔）
    const districtMatch =
      (selectedDistrict === 'all') ||
      splitLocations(shop.location).some(loc => loc.trim() === selectedDistrict);

    // 3. 關鍵字（店名／優惠／地點）
    const nameMatch = safeText(shop.name).toLowerCase().includes(keyword);
    const discountMatch = safeText(shop.discount).toLowerCase().includes(keyword);
    const locationMatch = safeText(shop.location).toLowerCase().includes(keyword);
    const keywordMatch = !keyword || nameMatch || discountMatch || locationMatch;

    return categoryMatch && districtMatch && keywordMatch;
  });

  currentPage = 1;
  renderList();
}

// ====== 渲染列表與分頁 ======
function renderList() {
  if (!filteredShops.length) {
    shopListElement.innerHTML = `
      <div class="no-results">找不到符合條件的商店，請更換分類、地區或關鍵字。</div>
    `;
    pageInfo.textContent = '0 / 0';
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return;
  }

  const totalPages = Math.ceil(filteredShops.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const pageItems = filteredShops.slice(startIdx, startIdx + itemsPerPage);

  // 卡片式渲染
  const html = pageItems.map(shop => renderCard(shop)).join('');
  shopListElement.innerHTML = html;

  // 分頁狀態
  pageInfo.textContent = `${currentPage} / ${totalPages}`;
  prevBtn.disabled = (currentPage <= 1);
  nextBtn.disabled = (currentPage >= totalPages);

  // 綁定卡片內按鈕事件
  bindCardActions();
}

// ====== 卡片 HTML ======
function renderCard(shop) {
  const name = esc(safeText(shop.name));
  const location = esc(safeText(shop.location));
  const discount = esc(safeText(shop.discount));

  // 動作按鈕：導航（一定顯示）、電話（有 phone 才顯示）、複製（一定顯示）
  const phone = safeText(shop.phone); // 若 JSON 沒有 phone，則為空字串
  const phoneBtn = phone
    ? `<button class="action-btn call" data-phone="${escAttr(phone)}" title="撥打電話">撥打</button>`
    : '';

  const mapsUrl = buildMapsUrl(shop);
  return `
    <article class="shop-card">
      <div class="item-header">
        <h2>${name}</h2>
        <span class="location-badge">${location}</span>
      </div>
      <div class="item-body">
        <p><strong>優惠：</strong>${discount || '—'}</p>
      </div>
      <div class="item-actions">
        ${escAttr(mapsUrl)}導航</a>
        ${phoneBtn}
        <button class="action-btn copy" data-copy="${escAttr(buildCopyText(shop))}" title="複製商店資訊">複製</button>
      </div>
    </article>
  `;
}

// ====== 綁定卡片動作 ======
function bindCardActions() {
  // 撥打電話
  document.querySelectorAll('.action-btn.call').forEach(btn => {
    btn.addEventListener('click', () => {
      const phone = btn.getAttribute('data-phone');
      if (phone) {
        // 在行動裝置會觸發撥號；桌面瀏覽器可能無效果
        window.location.href = `tel:${phone}`;
      }
    });
  });

  // 複製資訊
  document.querySelectorAll('.action-btn.copy').forEach(btn => {
    btn.addEventListener('click', async () => {
      const text = btn.getAttribute('data-copy') || '';
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = '已複製';
        setTimeout(() => (btn.textContent = '複製'), 1500);
      } catch (e) {
        // 兼容舊環境：建立暫時 textarea
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (_) {}
        document.body.removeChild(ta);
        btn.textContent = '已複製';
        setTimeout(() => (btn.textContent = '複製'), 1500);
      }
    });
  });
}

// ====== 工具函式 ======
function buildMapsUrl(shop) {
  // 以「店名 + 地點」進行地圖搜尋；行動裝置將開啟 Google Maps App（若已安裝）
  const query = `${safeText(shop.name)} ${safeText(shop.location)}`.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function buildCopyText(shop) {
  const lines = [
    `店名：${safeText(shop.name)}`,
    `地點：${safeText(shop.location)}`,
    `優惠：${safeText(shop.discount)}`,
  ];
  if (shop.phone) lines.push(`電話：${safeText(shop.phone)}`);
  return lines.join('\n');
}

function splitLocations(text) {
  // 同時支援「、」「，」「,」分隔
  return (safeText(text).split(/[、，,]/)).map(s => s.trim()).filter(Boolean);
}

function safeText(v) {
  return (typeof v === 'string') ? v : (v == null ? '' : String(v));
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escAttr(str) {
  return esc(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderMessage(msg) {
  shopListElement.innerHTML = `
    <div class="no-results">${esc(msg)}</div>
  `;
}
