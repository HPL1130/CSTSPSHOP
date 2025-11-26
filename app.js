// app.js — 包含自動連結判斷與換行處理功能 + 分頁跳頁

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
const pageLinks = document.getElementById('pageLinks');
const jumpInput = document.getElementById('jumpInput');
const jumpBtn = document.getElementById('jumpBtn');

/* --------------------------
   安全版 Google Sheets JSON 解析
--------------------------- */
async function fetchSheetJson(url) {
    const noCacheUrl = `${url}&_t=${new Date().getTime()}`;
    const res = await fetch(noCacheUrl, { cache: "no-cache" });
    const text = await res.text();

    const start = text.indexOf("setResponse(");
    if (start === -1) throw new Error("找不到 setResponse()");

    let jsonText = text.substring(start + "setResponse(".length);
    const end = jsonText.lastIndexOf(")");
    if (end === -1) throw new Error("找不到 JSON 結尾 )");

    jsonText = jsonText.substring(0, end);
    jsonText = jsonText.replace(/\n/g, "\\n");

    return JSON.parse(jsonText);
}

/* --------------------------
   顯示 / 隱藏 loading
--------------------------- */
function showLoading(show) {
    if (!loadingMessage) return;
    loadingMessage.style.display = show ? 'block' : 'none';
}

/* --------------------------
   內容格式化工具
--------------------------- */
function formatContent(text) {
    if (!text) return "請洽店家或公告";
    if (text.includes("<a ") || text.includes("<br>")) return text;
    let formatted = text.replace(/\n/g, "<br>");
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
                shop[columns[i]] = cell?.v != null ? String(cell.v) : "";
            });
            return shop;
        });

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
        shopListElement.innerHTML = `<p class="no-results">無法載入商店資料：${err.message}</p>`;
    }
    showLoading(false);
}

/* --------------------------
   地區下拉選單
--------------------------- */
function populateDistrictFilter() {
    districtFilter.innerHTML = `<option value="all">所有地區</option>`;
    const sortedDistricts = Array.from(availableDistricts).sort((a, b) => a.localeCompare(b, "zh-TW"));
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
        const matchCat = category === "all" || shop.category === category;
        const locs = shop.location ? shop.location.split(/[,、]/).map(l => l.trim()) : [];
        const matchDist = district === "all" || locs.includes(district);
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
   渲染卡片 + 分頁
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
            card.innerHTML = `
                <div class="location-badge">${item.location || ""}</div>
                <h3>${item.name}</h3>
                <div class="item-body">
                  <p style="color:var(--brand); margin-top:8px; word-break: break-word;">
                  <strong>優惠內容：</strong>${formatContent(item.discount)}
                  </p>
                </div>
            `;
            shopListElement.appendChild(card);
        });
    }

    pageInfo.textContent = `第 ${currentPage} 頁 / 共 ${totalPages || 1} 頁`;
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages || totalPages === 0;

    renderPageLinks(totalPages);
}

/* --------------------------
   渲染頁碼按鈕
--------------------------- */
function renderPageLinks(totalPages) {
    pageLinks.innerHTML = '';
    const maxShow = 10;
    const showPages = Math.min(totalPages, maxShow);

    for (let i = 1; i <= showPages; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = 'page-btn' + (i === currentPage ? ' active' : '');
        btn.onclick = () => goToPage(i);
        pageLinks.appendChild(btn);
    }

    if (totalPages > maxShow) {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'ellipsis';
        ellipsis.textContent = '...';
        pageLinks.appendChild(ellipsis);

        const lastBtn = document.createElement('button');
        lastBtn.textContent = totalPages;
        lastBtn.className = 'page-btn';
        lastBtn.onclick = () => goToPage(totalPages);
        pageLinks.appendChild(lastBtn);
    }
}

/* --------------------------
   跳轉頁
