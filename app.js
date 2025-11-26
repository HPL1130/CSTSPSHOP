// app.js — 包含自動連結判斷與換行處理功能

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

/* --------------------------
   安全版 Google Sheets JSON 解析
--------------------------- */
async function fetchSheetJson(url) {
    // 加入 timestamp 防止 iOS 快取舊資料
    const noCacheUrl = `${url}&_t=${new Date().getTime()}`;
    const res = await fetch(noCacheUrl, { cache: "no-cache" });
    const text = await res.text();

    const start = text.indexOf("setResponse(");
    if (start === -1) throw new Error("找不到 setResponse()");

    let jsonText = text.substring(start + "setResponse(".length);
    const end = jsonText.lastIndexOf(")");
    if (end === -1) throw new Error("找不到 JSON 結尾 )");

    jsonText = jsonText.substring(0, end);
    // 處理換行符號，避免 JSON 解析錯誤
    jsonText = jsonText.replace(/\n/g, "\\n");

    try {
        return JSON.parse(jsonText);
    } catch (e) {
        console.error("解析失敗片段：", jsonText.slice(0, 300));
        throw new Error("Google Sheets JSON 無法解析：" + e.message);
    }
}

/* --------------------------
   顯示 / 隱藏 loading
--------------------------- */
function showLoading(show) {
    if (!loadingMessage) return;
    loadingMessage.style.display = show ? 'block' : 'none';
}

/* --------------------------
   內容格式化工具 (新增)
   處理：HTML連結、自動網址連結、換行
--------------------------- */
function formatContent(text) {
    if (!text) return "請洽店家或公告";

    // 1. 如果內容已經包含 HTML 標籤 (例如 <a href=...>)，則直接回傳，不重複處理
    if (text.includes("<a ") || text.includes("<br>")) {
        return text;
    }

    // 2. 處理換行符號 (將 \n 轉為 <br>)
    let formatted = text.replace(/\n/g, "<br>");

    // 3. 自動偵測網址並轉為連結 (針對純網址 https://...)
    // Regex 抓取 http/https 開頭的網址
    const urlRegex = /(https?:\/\/[^\s<]+)/g;
    formatted = formatted.replace(urlRegex, (url) => {
        return `<a href="${url}" target="_blank" style="text-decoration:underline; color:#0066cc;">${url}</a>`;
    });

    return formatted;
}

/* --------------------------
   載入並解析資料
--------------------------- */
async function loadShops() {
    showLoading(true);
    try {
        const parsed = await fetchSheetJson(SHOP_DATA_URL);

        const columns = parsed.table.cols.map(c => c.label);
        allShops = parsed.table.rows.map(row => {
            const shop = {};
            row.c.forEach((cell, i) => {
                // 確保數值轉為字串，若為 null 則轉為空字串
                shop[columns[i]] = cell?.v != null ? String(cell.v) : "";
            });
            return shop;
        });

        // 收集地區 (過濾掉空值)
        availableDistricts = new Set();
        allShops.forEach(shop => {
            if (shop.location) {
                shop.location.split(/[,、]/).forEach(d => {
                    d = d.trim();
                    if (d) availableDistricts.add(d);
                });
            }
        });

        populateDistrictFilter();
        filterAndRender();
    } catch (err) {
        console.error(err);
        shopListElement.innerHTML = `<p class="no-results" style="padding:20px;">
            無法載入商店資料，請確認網路連線或稍後再試。<br>
            <small style="color:#999;">錯誤代碼：${err.message}</small>
        </p>`;
    }
    showLoading(false);
}

/* --------------------------
   地區下拉選單
--------------------------- */
function populateDistrictFilter() {
    districtFilter.innerHTML = `<option value="all">所有地區</option>`;
    
    // 自定義排序：全台/網路優先，其餘筆畫排序
    const sortedDistricts = Array.from(availableDistricts).sort((a, b) => {
        if (a === '全台' || a === '全省') return -1;
        if (b === '全台' || b === '全省') return 1;
        if (a === '網路') return -1;
        if (b === '網路') return 1;
        return a.localeCompare(b, "zh-TW");
    });

    sortedDistricts.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = d;
        districtFilter.appendChild(opt);
    });
}

/* --------------------------
   篩選資料
--------------------------- */
function filterAndRender() {
    currentPage = 1;

    const keyword = keywordInput.value.toLowerCase().trim();
    const district = districtFilter.value;

    const activeBtn = categoryButtons.querySelector("button.active");
    const category = activeBtn ? activeBtn.dataset.cat : "all";

    filteredShops = allShops.filter(shop => {
        // 類別篩選
        const matchCat = category === "all" || shop.category === category;
        
        // 地區篩選 (支援多地區)
        const locs = shop.location ? shop.location.split(/[,、]/).map(l => l.trim()) : [];
        const matchDist = district === "all" || locs.includes(district);
        
        // 關鍵字篩選
        const matchKey =
            !keyword ||
            (shop.name && shop.name.toLowerCase().includes(keyword)) ||
            (shop.discount && shop.discount.toLowerCase().includes(keyword)) ||
            (shop.location && shop.location.toLowerCase().includes(keyword));

        return matchCat && matchDist && matchKey;
    });

    renderList();
}

/* --------------------------
   渲染卡片
--------------------------- */
function renderList() {
    const start = (currentPage - 1) * itemsPerPage;
    const shopsToRender = filteredShops.slice(start, start + itemsPerPage);
    const totalPages = Math.ceil(filteredShops.length / itemsPerPage);

    shopListElement.innerHTML = "";

    if (!shopsToRender.length) {
        shopListElement.innerHTML = `<p class="no-results">找不到符合條件的特約商店。</p>`;
    } else {
        shopsToRender.forEach(item => {
            const card = document.createElement("div");
            card.className = "shop-card";

            // 地區標籤
            const badge = document.createElement("div");
            badge.className = "location-badge";
            badge.textContent = item.location || "";
            card.appendChild(badge);

            // 標題
            const title = document.createElement("h3");
            title.textContent = item.name;
            card.appendChild(title);

            // 優惠內容 (使用 formatContent 處理連結)
            const body = document.createElement("div");
            body.className = "item-body";
            body.innerHTML = `
                <p style="color:var(--brand); margin-top:8px; word-break: break-word;">
                <strong>優惠內容：</strong>${formatContent(item.discount)}
                </p>
            `;
            card.appendChild(body);

            shopListElement.appendChild(card);
        });
    }

    // 更新分頁資訊
    pageInfo.textContent = `第 ${currentPage} 頁 / 共 ${totalPages || 1} 頁`;
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages || totalPages === 0;
}

/* --------------------------
   分頁按鈕事件
--------------------------- */
prevBtn.onclick = () => {
    if (currentPage > 1) {
        currentPage--;
        renderList();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};
nextBtn.onclick = () => {
    const totalPages = Math.ceil(filteredShops.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderList();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

/* --------------------------
   Debounce & Event Listeners
--------------------------- */
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

/* --------------------------
   啟動程式
--------------------------- */
loadShops();
