
// app.js — 保留原始欄位對應 + 修正 JSON 解析 + debounce + loading + 數字分頁 + 跳轉
const SHEET_ID = '1bKWj9iSJvUtStbVAiBzY1M5D4BSJ5Uf0n9uhTJ4g3b8';
const SHOP_DATA_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&headers=1`;

// ✅ 每頁顯示 24 筆
const itemsPerPage = 24;

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

// 分頁新增節點
const pageNumbers   = document.getElementById('pageNumbers');
const ellipsisSpan  = document.getElementById('ellipsis');
const lastPageBtn   = document.getElementById('lastPageBtn');
const jumpInput     = document.getElementById('jumpInput');
const jumpBtn       = document.getElementById('jumpBtn');
const totalPagesText= document.getElementById('totalPagesText');

/* -----------------------------
   更健壯的 Google Sheets JSON 解析
------------------------------ */
async function fetchSheetJson(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) {
    throw new Error(`Google Sheets 回應錯誤：HTTP ${res.status}`);
  }
  const text = await res.text();

  // gviz 格式包含 setResponse({...})
  const match = text.match(/setResponse\(([\s\S]*?)\)\s*;?$/);
  if (!match || !match[1]) {
    console.error('原始回應片段：', text.slice(0, 300));
    throw new Error('找不到 setResponse(...) JSON 區塊或格式不符');
  }
  const jsonText = match[1].replace(/\n/g, '\\n');

  try {
    return JSON.parse(jsonText);
  } catch (e) {
    console.error('解析失敗片段：', jsonText.slice(0, 300));
    throw new Error('Google Sheets JSON 無法解析：' + e.message);
  }
}

/* -----------------------------
   顯示 / 隱藏 loading
------------------------------ */
function showLoading(show) {
  if (!loadingMessage) return;
  loadingMessage.style.display = show ? 'block' : 'none';
}

/* -----------------------------
   載入並解析資料
------------------------------ */
async function loadShops() {
  showLoading(true);
  try {
    const parsed = await fetchSheetJson(SHOP_DATA_URL);

    // 取標題列（試算表的第一列 labels）
    const columns = parsed.table.cols.map(c => c.label?.trim());

    // 允許欄位別名（避免標題稍有不同導致抓不到）
    const nameKey     = columns.find(k => /^(店名|名稱|name)$/i.test(k))     || 'name';
    const discountKey = columns.find(k => /^(優惠|內容|discount)$/i.test(k)) || 'discount';
    const locationKey = columns.find(k => /^(地區|區域|location)$/i.test(k)) || 'location';
    const categoryKey = columns.find(k => /^(分類|類別|category)$/i.test(k)) || 'category';

    allShops = parsed.table.rows.map(row => {
      const shop = {};
      row.c.forEach((cell, i) => {
        const key = columns[i] || `col_${i}`;
        shop[key] = cell?.v != null ? String(cell.v) : "";
      });

      // 標準化欄位命名（供後續使用）
      return {
        name:     shop[nameKey]     || "",
        discount: shop[discountKey] || "",
        location: shop[locationKey] || "",
        category: shop[categoryKey] || "其他"
      };
    });

    // 收集地區（使用「、」「，」「/」等常見分隔）
    availableDistricts = new Set();
    allShops.forEach(shop => {
      (shop.location || "")
        .split(/[、，,\/\|]/)
        .map(s => s.trim())
        .filter(Boolean)
        .forEach(d => availableDistricts.add(d));
    });

    populateDistrictFilter();
    filterAndRender();
  } catch (err) {
    console.error(err);
    shopListElement.innerHTML = `<p class="no-results">無法載入商店資料：${err.message}</p>`;
  }
  showLoading(false);
}

/* -----------------------------
   地區下拉選單
------------------------------ */
function populateDistrictFilter() {
  districtFilter.innerHTML = `<option value="all">所有地區</option>`;
  Array.from(availableDistricts)
    .sort((a, b) => a.localeCompare(b, "zh-TW"))
    .forEach(d => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      districtFilter.appendChild(opt);
    });
}

/* -----------------------------
   篩選資料
------------------------------ */
function filterAndRender() {
  currentPage = 1;
  const keyword = (keywordInput.value || "").toLowerCase().trim();
  const district = districtFilter.value;
  const activeBtn = categoryButtons.querySelector("button.active");
  const category = activeBtn ? activeBtn.dataset.cat : "all";

  filteredShops = allShops.filter(shop => {
    const matchCat = category === "all" || shop.category === category;
    const matchDist = district === "all" || shop.location.includes(district);
    const baseText = `${shop.name} ${shop.discount} ${shop.location}`.toLowerCase();
    const matchKey = !keyword || baseText.includes(keyword);
    return matchCat && matchDist && matchKey;
  });

  renderList();
}

/* -----------------------------
   渲染卡片 + 分頁
------------------------------ */
function renderList() {
  const start = (currentPage - 1) * itemsPerPage;
  const shopsToRender = filteredShops.slice(start, start + itemsPerPage);
  const totalPages = Math.ceil(filteredShops.length / itemsPerPage) || 1;

  shopListElement.innerHTML = "";
  if (!shopsToRender.length) {
    shopListElement.innerHTML = `<p class="no-results">找不到符合條件的特約商店。</p>`;
  } else {
    shopsToRender.forEach(item => {
      const card = document.createElement("div");
      card.className = "shop-card";

      const badge = document.createElement("div");
      badge.className = "location-badge";
      badge.textContent = item.location || "";
      card.appendChild(badge);

      const title = document.createElement("h3");
      title.textContent = item.name || "";
      card.appendChild(title);

      const body = document.createElement("div");
      body.className = "item-body";
      body.innerHTML = `
        <p style="color:var(--brand); margin-top:8px;">
          <strong>優惠內容：</strong>${item.discount || "請洽店家或公告"}
        </p>
      `;
      card.appendChild(body);

      shopListElement.appendChild(card);
    });
  }

  // 保留原本文字型頁面資訊
  pageInfo.textContent = `第 ${currentPage} 頁 / 共 ${totalPages} 頁 (共 ${filteredShops.length} 筆)`;

  // 數字分頁與跳轉
  renderPager(totalPages);
}

/* -----------------------------
   數字分頁 + 跳轉框（含 Enter）
------------------------------ */
function renderPager(totalPages) {
  // 邊界保護
  if (currentPage < 1) currentPage = 1;
