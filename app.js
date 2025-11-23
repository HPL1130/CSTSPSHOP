// app.js

// 關鍵修改 1: 檔案路徑使用明確的 './'，以確保網頁和 App 環境都能正確解析。
const SHOP_DATA_FILE = './shop_data.json'; 
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

/**
 * 載入特約商店資料
 * 關鍵修改 2: 替換成 XMLHttpRequest，以增強本地檔案載入的相容性。
 */
function loadShops() {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', SHOP_DATA_FILE, true);

    xhr.onload = function() {
        // 檢查狀態碼：200 是 HTTP 成功；0 是在 file:// 或 app:// 協定下本地載入成功的常見狀態碼
        if (xhr.status === 200 || (xhr.status === 0 && xhr.responseText)) { 
            try {
                allShops = JSON.parse(xhr.responseText);
                
                // 收集所有地區，並填入下拉選單
                allShops.forEach(shop => {
                    const locations = shop.location.split('、'); 
                    locations.forEach(loc => {
                        const trimmedLoc = loc.trim();
                        if (trimmedLoc) {
                            availableDistricts.add(trimmedLoc);
                        }
                    });
                });

                populateDistrictFilter();
                
                // 預設篩選「全部」
                filterAndRender();

            } catch (e) {
                console.error("Error parsing JSON data:", e);
                shopListElement.innerHTML = `<p style="text-align: center; color: var(--text);">載入商店資料失敗，JSON 格式錯誤。</p>`;
            }
        } else {
            // 處理非 200/0 狀態碼 (這會捕捉到 404 錯誤)
            console.error("Error loading shop data:", xhr.status, xhr.statusText);
            shopListElement.innerHTML = `<p style="text-align: center; color: var(--text);">載入商店資料失敗，請檢查 ${SHOP_DATA_FILE} 檔案路徑與內容。狀態碼: ${xhr.status}</p>`;
        }
    };
    
    xhr.onerror = function() {
        console.error("Network error attempting to load shop data.");
        shopListElement.innerHTML = `<p style="text-align: center; color: var(--text);">載入商店資料發生網路錯誤 (手機可能無法存取本地檔案)。</p>`;
    };
    
    xhr.send();
}


/**
 * 填充地區篩選下拉選單
 */
function populateDistrictFilter() {
    const sortedDistricts = Array.from(availableDistricts).sort((a, b) => {
        // 將「全台」或「全省」放在最前面
        if (a.includes('全')) return -1;
        if (b.includes('全')) return 1;
        // 將「網路」放在中間
        if (a.includes('網路')) return -1;
        if (b.includes('網路')) return 1;
        return a.localeCompare(b, 'zh-Hant'); 
    });
    
    // 清空除了「所有地區」以外的選項
    districtFilter.innerHTML = '<option value="all">所有地區</option>';
    
    sortedDistricts.forEach(district => {
        const option = document.createElement('option');
        option.value = district;
        option.textContent = district;
        districtFilter.appendChild(option);
    });
}

/**
 * 核心篩選函式：根據類別、地區、關鍵字過濾資料
 */
function filterAndRender() {
    // 檢查是否有 active 類別按鈕，如果沒有，預設為 'all'
    const activeCategoryElement = document.querySelector('.category-buttons .active');
    const activeCategory = activeCategoryElement ? activeCategoryElement.dataset.cat : 'all';
    
    const selectedDistrict = districtFilter.value;
    const keyword = keywordInput.value.toLowerCase().trim();
    
    filteredShops = allShops.filter(shop => {
        // 1. 類別篩選
        const categoryMatch = activeCategory === 'all' || shop.category === activeCategory;

        // 2. 地區篩選
        const districtMatch = selectedDistrict === 'all' || shop.location.includes(selectedDistrict);

        // 3. 關鍵字篩選 (包含店名、優惠內容、地點)
        const keywordMatch = !keyword || 
                                shop.name.toLowerCase().includes(keyword) ||
                                (shop.discount && shop.discount.toLowerCase().includes(keyword)) ||
                                shop.location.toLowerCase().includes(keyword);

        return categoryMatch && districtMatch && keywordMatch;
    });

    currentPage = 1;
    renderList();
}

/**
 * 渲染商店列表及分頁控制
 */
function renderList() {
    const totalPages = Math.ceil(filteredShops.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const shopsToDisplay = filteredShops.slice(start, end);

    shopListElement.innerHTML = '';
    
    if (shopsToDisplay.length === 0) {
        // 卡片式設計的 no-results 樣式
        shopListElement.innerHTML = `<p class="no-results">找不到符合條件的特約商店。</p>`;
    } else {
        shopsToDisplay.forEach(item => {
            const card = document.createElement('div');
            card.className = 'shop-card';
            
            // 商店名稱和地點
            const header = document.createElement('div');
            header.className = 'item-header';
            header.innerHTML = `
                <h2>${item.name}</h2>
                <span class="location-badge">${item.location}</span>
            `;
            card.appendChild(header);

            // 商店資訊 (包含優惠內容)
            const body = document.createElement('div'); 
            body.className = 'item-body';
            // 注意：這裡的 HTML 結構已經符合卡片式設計的要求
            body.innerHTML = `
                ${item.discount ? `<p style="color:var(--brand); margin-top: 8px;"><strong>優惠內容：</strong>${item.discount}</p>` : '<p style="color:#666; margin-top: 8px;">優惠內容：請洽店家或內部公告</p>'}
            `;
            card.appendChild(body);

            shopListElement.appendChild(card);
        });
    }

    // 更新分頁資訊
    pageInfo.textContent = `第 ${currentPage} 頁 / 共 ${totalPages} 頁 (共 ${filteredShops.length} 筆)`;
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages || totalPages === 0;
}

/**
 * 事件監聽器：切換類別
 */
categoryButtons.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (button) {
        // 移除所有按鈕的 active 狀態
        categoryButtons.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
        // 為被點擊的按鈕添加 active 狀態
        button.classList.add('active');
        filterAndRender();
    }
});

/**
 * 事件監聽器：分頁控制
 */
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

// 地區篩選器、關鍵字搜尋器變動時即時篩選
districtFilter.addEventListener('change', filterAndRender);
keywordInput.addEventListener('input', filterAndRender);

// 載入資料
loadShops();
