
// app.js - 重構版
// 功能：穩定的 Google Sheets 解析、debounce、loading、快取、優化渲染與行動裝置友善 UI

const SHEET_ID = '1bKWj9iSJvUtStbVAiBzY1M5D4BSJ5Uf0n9uhTJ4g3b8';
const SHOP_DATA_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&headers=1`;

const itemsPerPage = 10;
let currentPage = 1;
let allShops = [];
let filteredShops = [];
let availableDistricts = new Set();

const shopListElement = document.getElementById('shopList');
const keywordInput = document.getElementById('keywordInput');
const districtFilter = document.getElementById('districtFilter');
const pageInfo = document.getElementById('pageInfo');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const categoryButtons = document.querySelector('.category-buttons');
const loadingMessage = document.getElementById('loadingMessage');

// simple cache config (ms)
const CACHE_KEY = 'cst_shops_cache_v1';
const CACHE_TTL = 1000 * 60 * 10; // 10 minutes

// ---- loading helper ----
function showLoading(show, text) {
  if (!loadingMessage) return;
  loadingMessage.style.display = show ? 'flex' : 'none';
  loadingMessage.textContent = text || (show ? '⏳ 正在載入資料...' : '');
}

// ---- fetch with robust Google Sheets parsing ----
async function fetchSheetJson(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  const text = await res.text();

  // Google returns google.visualization.Query.setResponse({...});
  const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*?)\);?/);
  if (match && match[1]) {
    return JSON.parse(match[1]);
  }

  // fallback: try parse as pure json
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error('無法解析 Google Sheets 回傳資料 (格式不符合預期)。');
  }
}

// ---- cache helpers ----
function saveCache(data) {
  const payload = {
    ts: Date.now(),
    data
  };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch (e) {
    // ignore quota errors
  }
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (Date.now() - payload.ts > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return payload.data;
  } catch (e) {
    return null;
  }
}

// ---- transform sheet data to shop array ----
function parseSheetTable(data) {
  if (!data || !data.table || !Array.isArray(data.table.rows)) return [];

  const columns = (data.table.cols || []).map(c => c.label || c.id || '');
  const rows = data.table.rows;

  return rows.map(row => {
    const shop = {};
    (row.c || []).forEach((cell, idx) => {
      const val = (cell && cell.v !== null && typeof cell.v !== 'undefined') ? cell.v : '';
      const key = columns[idx] || `col_${idx}`;
      // normalize keys to lower-case no-spaces for internal usage
      shop[key.trim()] = String(val);
    });
    // ensure minimal fields exist
    shop.name = shop.name || shop['商店'] || shop['店名'] || shop['名稱'] || shop['Name'] || shop['name'] || '未命名店家';
    shop.discount = shop.discount || shop['優惠'] || shop['優惠內容'] || shop['discount'] || '';
    shop.location = shop.location || shop['地區'] || shop['位置'] || shop['location'] || '';
    shop.category = (shop.category || shop['類別'] || 'other').toLowerCase();
    return shop;
  });
}

// ---- UI helpers ----
function populateDistrictFilter() {
  if (!districtFilter) return;
  districtFilter.innerHTML = '<option value="all">所有地區</option>';
  const sorted = Array.from(availableDistricts).sort((a,b)=>a.localeCompare(b,'zh-TW'));
  sorted.forEach(d => {
    const option = document.createElement('option');
    option.value = d;
    option.textContent = d;
    districtFilter.appendChild(option);
  });
}

function createShopCard(item) {
  const card = document.createElement('article');
  card.className = 'shop-card';
  card.setAttribute('role','article');
  card.setAttribute('aria-label', item.name || '店家');

  // location badge (truncate but show full on title)
  const badge = document.createElement('div');
  badge.className = 'location-badge';
  badge.textContent = (item.location || 'N/A').split('、')[0] || 'N/A';
  badge.title = item.location || '';
  card.appendChild(badge);

  // header
  const header = document.createElement('div');
  header.className = 'item-header';

  const title = document.createElement('h2');
  title.textContent = item.name;
  header.appendChild(title);

  card.appendChild(header);

  // body
  const body = document.createElement('div');
  body.className = 'item-body';

  const discountP = document.createElement('p');
  if (item.discount && item.discount.trim()) {
    discountP.innerHTML = `<strong>優惠內容：</strong>${escapeHtml(item.discount)}`;
  } else {
    discountP.innerHTML = `<strong>優惠內容：</strong><span class="muted">請洽店家或內部公告</span>`;
  }
  body.appendChild(discountP);

  // optional: category and raw location
  const meta = document.createElement('p');
  meta.className = 'meta';
  meta.innerHTML = `<small>類別：${escapeHtml(item.category || '其他')} · 地點：${escapeHtml(item.location || '')}</small>`;
  body.appendChild(meta);

  card.appendChild(body);

  return card;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

// ---- rendering + pagination ----
function renderList() {
  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const shopsToRender = filteredShops.slice(start, end);
  const totalPages = Math.ceil(filteredShops.length / itemsPerPage) || 1;

  shopListElement.innerHTML = '';
  if (!shopsToRender.length) {
    const no = document.createElement('p');
    no.className = 'no-results';
    no.textContent = '找不到符合條件的特約商店。';
    shopListElement.appendChild(no);
  } else {
    const frag = document.createDocumentFragment();
    shopsToRender.forEach(item => {
      frag.appendChild(createShopCard(item));
    });
    shopListElement.appendChild(frag);
  }

  pageInfo.textContent = `第 ${currentPage} 頁 / 共 ${totalPages} 頁 (共 ${filteredShops.length} 筆)`;
  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage === totalPages || totalPages === 0;
}

// ---- filtering ----
function applyFilters() {
  const keyword = (keywordInput.value || '').toLowerCase().trim();
  const district = (districtFilter.value || 'all');
  const activeBtn = categoryButtons.querySelector('button.active');
  const category = activeBtn ? activeBtn.dataset.cat : 'all';

  filteredShops = allShops.filter(shop => {
    const matchesCategory = category === 'all' || (shop.category || 'other') === category;
    const matchesDistrict = district === 'all' || (shop.location || '').split('、').map(s=>s.trim()).includes(district);
    const textTarget = `${shop.name} ${shop.discount} ${shop.location}`.toLowerCase();
    const matchesKeyword = !keyword || textTarget.indexOf(keyword) !== -1;
    return matchesCategory && matchesDistrict && matchesKeyword;
  });

  currentPage = 1;
  renderList();
}

// ---- debounce ----
function debounce(fn, wait=200) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(()=> fn.apply(this, args), wait);
  };
}

// ---- events ----
function bindEvents() {
  // category buttons
  categoryButtons.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    categoryButtons.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyFilters();
  });

  // keyword with debounce
  keywordInput.addEventListener('input', debounce(applyFilters, 220));
  districtFilter.addEventListener('change', applyFilters);

  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; renderList(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });

  nextBtn.addEventListener('click', ()=> {
    const totalPages = Math.ceil(filteredShops.length / itemsPerPage);
    if (currentPage < totalPages) { currentPage++; renderList(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });
}

// ---- main loader ----
async function loadShops(force=false) {
  showLoading(true);
  try {
    if (!force) {
      const cached = loadCache();
      if (cached && Array.isArray(cached) && cached.length) {
        allShops = cached;
        // rebuild districts
        availableDistricts = new Set();
        allShops.forEach(s => {
          (s.location || '').split('、').forEach(loc => {
            const t = (loc||'').trim();
            if (t) availableDistricts.add(t);
          });
        });
        populateDistrictFilter();
        applyFilters();
        showLoading(false);
        // also fetch in background to refresh cache (non-blocking)
        fetchSheetJson(SHOP_DATA_URL).then(parsed => {
          const parsedShops = parseSheetTable(parsed);
          allShops = parsedShops;
          saveCache(allShops);
          availableDistricts = new Set();
          allShops.forEach(s => (s.location||'').split('、').forEach(loc=>{const t=(loc||'').trim(); if(t) availableDistricts.add(t)}));
          populateDistrictFilter();
          applyFilters();
        }).catch(()=>{/* ignore background errors */});
        return;
      }
    }

    const parsed = await fetchSheetJson(SHOP_DATA_URL);
    const shops = parseSheetTable(parsed);
    allShops = shops;
    saveCache(allShops);

    // collect districts
    availableDistricts = new Set();
    allShops.forEach(shop => {
      (shop.location || '').split('、').forEach(loc => {
        const t = (loc||'').trim();
        if (t) availableDistricts.add(t);
      });
    });

    populateDistrictFilter();
    applyFilters();

  } catch (err) {
    console.error('Error loading shops:', err);
    shopListElement.innerHTML = `<p class="no-results">無法載入商店資料。請檢查 Google Sheets 是否已公開或網路連線。 (${escapeHtml(err.message)})</p>`;
  } finally {
    showLoading(false);
  }
}

// ---- initial setup ----
document.addEventListener('DOMContentLoaded', ()=> {
  // bind events, load data
  bindEvents();
  loadShops();

  // hero toggle exists in index.html script; keep compatibility
});
