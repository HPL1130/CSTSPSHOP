
// app.js — 保留原始欄位對應 + 修正 JSON 錯誤 + debounce + loading + 數字分頁 + 跳轉
const SHEET_ID = '1bKWj9iSJvUtStbVAiBzY1M5D4BSJ5Uf0n9uhTJ4g3b8';
const SHOP_DATA_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&headers=1`;

// ✅ 每頁顯示 24 筆（依您的要求）
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

// 分頁新增的節點
const pageNumbers   = document.getElementById('pageNumbers');
const ellipsisSpan  = document.getElementById('ellipsis');
const lastPageBtn   = document.getElementById('lastPageBtn');
const jumpInput     = document.getElementById('jumpInput');
const jumpBtn       = document.getElementById('jumpBtn');
const totalPagesText= document.getElementById('totalPagesText');

/* -----------------------------
   安全版 Google Sheets JSON 解析
------------------------------ */
async function fetchSheetJson(url) {
  const res = await fetch(url, { cache: "no-cache" });
  const text = await res.text();
  const start = text.indexOf("setResponse(");
  if (start === -1) throw new Error("找不到 setResponse()");
  let jsonText = text.substring(start + "setResponse(".length);
  const end = jsonText.lastIndexOf(")");
  if (end === -1) throw new Error("找不到 JSON 結尾 )");
  jsonText = jsonText.substring(0, end);
  jsonText = jsonText.replace(/\n/g, "\\n");
  try {
    return JSON.parse(jsonText);
  } catch (e) {
    console.error("解析失敗片段：", jsonText.slice(0, 300));
    throw new Error("Google Sheets JSON 無法解析：" + e.message);
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
    const columns = parsed.table.cols.map(c => c.label);
    allShops = parsed.table.rows.map(row => {
      const shop = {};
      row.c.forEach((cell, i) => {
        shop[columns[i]] = cell?.v != null ? String(cell.v) : "";
      });
      return shop;
    });

    // 收集地區
    availableDistricts = new Set();
    allShops.forEach(shop => {
      shop.location?.split("、").forEach(d => {
        d = d?.trim();
        if (d) availableDistricts.add(d);
      });
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
  const keyword = keywordInput.value.toLowerCase().trim();
  const district = districtFilter.value;
  const activeBtn = categoryButtons.querySelector("button.active");
  const category = activeBtn ? activeBtn.dataset.cat : "all";

  filteredShops = allShops.filter(shop => {
    const matchCat = category === "all" || shop.category === category;
    const matchDist = district === "all" || shop.location?.includes(district);
    const matchKey =
      !keyword ||
      shop.name?.toLowerCase().includes(keyword) ||
      shop.discount?.toLowerCase().includes(keyword) ||
      shop.location?.toLowerCase().includes(keyword);

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
   數字分頁 + 跳轉框
------------------------------ */
function renderPager(totalPages) {
  // 邊界保護
  if (currentPage < 1) currentPage = 1;
  if (currentPage > totalPages) currentPage = totalPages;

  // 上/下一頁按鈕 (沿用既有 prevBtn / nextBtn)
  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage === totalPages;

  prevBtn.onclick = () => {
    if (currentPage > 1) {
      currentPage--;
      renderList();
    }
  };
  nextBtn.onclick = () => {
    const tp = Math.ceil(filteredShops.length / itemsPerPage) || 1;
    if (currentPage < tp) {
      currentPage++;
      renderList();
    }
  };

  // 清空頁碼容器
  pageNumbers.innerHTML = "";

  // 視窗一次顯示 10 個頁碼（仿附圖）
  const windowSize = 10;

  let start = Math.max(1, currentPage - Math.floor(windowSize / 2));
  let end   = start + windowSize - 1;
  if (end > totalPages) {
    end = totalPages;
    start = Math.max(1, end - windowSize + 1);
  }

  // 1..N 的數字按鈕
  for (let p = start; p <= end; p++) {
    const btn = document.createElement("button");
    btn.className = "page-number-btn";
    btn.textContent = String(p);
    if (p === currentPage) btn.classList.add("active");
    btn.setAttribute("aria-label", `第 ${p} 頁`);
    btn.onclick = () => {
      currentPage = p;
      renderList();
    };
    pageNumbers.appendChild(btn);
  }

  // 省略 + 最後一頁
  if (end < totalPages) {
    ellipsisSpan.style.display = "inline";
    lastPageBtn.style.display = "inline";
    lastPageBtn.textContent = String(totalPages);
    lastPageBtn.className = "btn small";
    lastPageBtn.setAttribute("aria-label", `跳至第 ${totalPages} 頁`);
    lastPageBtn.onclick = () => {
      currentPage = totalPages;
      renderList();
    };
  } else {
    ellipsisSpan.style.display = "none";
    lastPageBtn.style.display = "none";
  }

  // 跳轉框與總頁數
  totalPagesText.textContent = ` / ${totalPages}頁`;
  jumpInput.value = String(currentPage);
  jumpInput.min = 1;
  jumpInput.max = String(totalPages);

  // 跳轉動作（按鈕 + Enter）
  const doJump = () => {
    const val = parseInt(jumpInput.value, 10);
    if (!isNaN(val)) {
      const target = Math.min(Math.max(1, val), totalPages);
      if (target !== currentPage) {
        currentPage = target;
        renderList();
      }
    }
  };
  jumpBtn.onclick = doJump;
  jumpInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doJump();
  });
}

/* -----------------------------
   debounce for keyword search
------------------------------ */
function debounce(fn, delay = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
keywordInput.addEventListener("input", debounce(filterAndRender));
districtFilter.addEventListener("change", filterAndRender);
categoryButtons.addEventListener("click", e => {
  const btn = e.target.closest("button");
  if (!btn) return;
  categoryButtons.querySelectorAll("button").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  filterAndRender();
});

/* -----------------------------
   啟動程式
------------------------------ */
loadShops();
