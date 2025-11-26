// app.js — 保留原始欄位對應 + 修正 JSON 錯誤 + debounce + loading

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

/* --------------------------
   顯示 / 隱藏 loading
--------------------------- */
function showLoading(show) {
    if (!loadingMessage) return;
    loadingMessage.style.display = show ? 'block' : 'none';
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

        // 收集地區
        availableDistricts = new Set();
        allShops.forEach(shop => {
            shop.location.split("、").forEach(d => {
                d = d.trim();
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

/* --------------------------
   地區下拉選單
--------------------------- */
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
        const matchDist = district === "all" || shop.location.includes(district);
        const matchKey =
            !keyword ||
            shop.name.toLowerCase().includes(keyword) ||
            shop.discount.toLowerCase().includes(keyword) ||
            shop.location.toLowerCase().includes(keyword);

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

            const badge = document.createElement("div");
            badge.className = "location-badge";
            badge.textContent = item.location;
            card.appendChild(badge);

            const title = document.createElement("h3");
            title.textContent = item.name;
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

    pageInfo.textContent = `第 ${currentPage} 頁 / 共 ${totalPages} 頁 (共 ${filteredShops.length} 筆)`;
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
}

/* --------------------------
   分頁按鈕
--------------------------- */
prevBtn.onclick = () => {
    if (currentPage > 1) {
        currentPage--;
        renderList();
    }
};
nextBtn.onclick = () => {
    const totalPages = Math.ceil(filteredShops.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderList();
    }
};

/* --------------------------
   debounce for keyword search
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
