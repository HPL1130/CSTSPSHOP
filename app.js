
// app.js - 強化版：穩定 Google Sheets 解析 + debounce + loading + UI + 優化渲染

const SHEET_ID = '1bKWj9iSJvUtStbVAiBzY1M5D4BSJ5Uf0n9uhTJ4g3b8';
const SHOP_DATA_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&headers=1`;

const itemsPerPage = 10;
let currentPage = 1;
let allShops = [];
let filteredShops = [];
let availableDistricts = new Set();

// DOM
const shopListElement = document.getElementById('shopList');
const keywordInput = document.getElementById('keywordInput');
const districtFilter = document.getElementById('districtFilter');
const pageInfo = document.getElementById('pageInfo');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const categoryButtons = document.querySelector('.category-buttons');
const loadingMessage = document.getElementById('loadingMessage');

// ---- loading helper ----
function showLoading(show, text) {
  if (!loadingMessage) return;
  loadingMessage.style.display = show ? 'flex' : 'none';
  loadingMessage.textContent = text || (show ? '⏳ 正在載入資料...' : '');
}

// ---- 安全且穩定的 Google Sheets JSON 解析 ----
async function fetchSheetJson(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  const text = await res.text();

  const start = text.indexOf("setResponse(");
  if (start === -1) {
    throw new Error("Google Sheets 回傳格式異常（找不到 setResponse）。");
  }

  let jsonText = text.substring(start + "setResponse(".length);
  const end = jsonText.lastIndexOf(")");

  if (end === -1) {
    throw new Error("Google Sheets JSON 格式不完整：找不到結尾 ')'");
  }

  jsonText = jsonText.substring(0, end);

  // 如果 JSON 含有未 escape 的換行，需要清洗
  jsonText = jsonText.replace(/\n/g, "\\n");

  try {
    return JSON.parse(jsonText);
  } catch (err) {
    console.error("JSON 解析失敗內容片段：", jsonText.slice(0, 500));
    throw new Error("Google Sheets JSON 無法解析：" + err.message);
  }
}

// ---- 解析表格資料 ----
function parseSheetTable(data) {
  if (!data || !data.table || !data.table.rows) return [];

  const columns = data.table.cols.map(c => c.label || c.id || '');
  return data.table.rows.map(row => {
    const shop = {};
    (row.c || []).forEach((cell, i) => {
      const val = cell && cell.v != null ? cell.v : '';
      const key = columns[i]?.trim() || `col_${i}`;
      shop[key] = String(val);
    });
    shop.name = shop.name || shop['店名'] || shop['名稱'] || shop['Name'] || "未命名店家";
    shop.discount = shop.discount || shop['優惠'] || shop['優惠內容'] || "";
    shop.location = shop.location || shop['地區'] || shop['位置'] || "";
    shop.category = (shop.category || shop['類別'] || "other").toLowerCase();
    return shop;
  });
}

// ---- HTML escape ----
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

// ---- 建立卡片 ----
function createShopCard(item) {
  const card = document.createElement('div');
  card.className = 'shop-card';

  const badge = document.createElement('div');
  badge.className = 'location-badge';
  badge.textContent = (item.location || '').split('、')[0] || 'N/A';
  badge.title = item.location || '';
  card.appendChild(badge);

  const header = document.createElement('div');
  header.className = 'item-header';
  const title = document.createElement('h2');
  title.textContent = item.name;
  header.appendChild(title);
  card.appendChild(header);

  const body = document.createElement('div');
  body.className = 'item-body';

  body.innerHTML = `
    <p><strong>優惠內容：</strong>${
      item.discount ? escapeHtml(item.discount) : '<span class="muted">請洽店家或內部公告</span>'
    }</p>
    <p class="meta"><small>類別：${escapeHtml(item.category)} · 地點：${escapeHtml(item.location)}</small></p>
  `;

  card.appendChild(body);
  return card;
}

// ---- 分頁渲染 ----
function renderList() {
  const start = (currentPage - 1) * itemsPerPage;
  const pageItems = filteredShops.slice(start, start + itemsPerPage);
  const totalPages = Math.ceil(filteredShops.length / itemsPerPage) || 1;

  shopListElement.innerHTML = '';

  if (!pageItems.length) {
    const el = document.createElement('p');
    el.className = 'no-results';
    el.textContent = '找不到符合條件的特約商店。';
    shopListElement.appendChild(el);
  } else {
    const frag = document.createDocumentFragment();
    pageItems.forEach(item => frag.appendChild(createShopCard(item)));
    shopListElement.appendChild(frag);
  }

  pageInfo.textContent = `第 ${currentPage} 頁 / 共 ${totalPages} 頁 (共 ${filteredShops.length} 筆)`;
  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage >= totalPages;
}

// ---- 篩選 ----
function applyFilters() {
  const keyword = keywordInput.value.toLowerCase().trim();
  const district = districtFilter.value || 'all';
  const category = (categoryButtons.querySelector('button.active')?.dataset.cat) || 'all';

  filteredShops = allShops.filter(s => {
    const matchCat = category === 'all' || s.category === category;
    const matchDist = district === 'all' || (s.location || '').includes(district);
    const text = `${s.name} ${s.discount} ${s.location}`.toLowerCase();
    const matchKey = !keyword || text.includes(keyword);
    return matchCat && matchDist && matchKey;
  });

  currentPage = 1;
  renderList();
}

// ---- debounce ----
function debounce(fn, delay=250) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ---- 載入資料 ----
async function loadShops() {
  showLoading(true);

  try {
    const parsed = await fetchSheetJson(SHOP_DATA_URL);
    allShops = parseSheetTable(parsed);

    availableDistricts = new Set();
    allShops.forEach(s => {
      (s.location || '').split('、').forEach(loc => {
        loc = loc.trim();
        if (loc) availableDistricts.add(loc);
      });
    });

    districtFilter.innerHTML = `<option value="all">所有地區</option>` +
      Array.from(availableDistricts)
        .sort((a,b)=>a.localeCompare(b,'zh-TW'))
        .map(d => `<option value="${d}">${d}</option>`)
        .join('');

    applyFilters();
  } catch (err) {
    shopListElement.innerHTML = `<p class="no-results">無法載入商店資料：${err.message}</p>`;
  }

  showLoading(false);
}

// ---- events ----
document.addEventListener('DOMContentLoaded', () => {
  keywordInput.addEventListener('input', debounce(applyFilters, 250));
  districtFilter.addEventListener('change', applyFilters);

  categoryButtons.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    categoryButtons.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyFilters();
  });

  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderList();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  nextBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredShops.length / itemsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      renderList();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  loadShops();
});
