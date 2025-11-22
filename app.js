// app.js

// 關鍵修改 1: 檔案路徑使用明確的 './'，確保網頁和 App 環境都能正確解析。
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
 * 關鍵修改 2: 將 fetch 替換為 XMLHttpRequest，以增強本地檔案 (file:// 或 app://) 載入的相容性。
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
                    // 如果 location 包含多個地區，需要拆分並個別加入
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
            // 處理非 200/0 狀態碼
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
        return a.localeCompare(b, 'zh-Hant'); // 依照中文筆畫排序
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
    const activeCategory = document.querySelector('.category-buttons .active').dataset.cat;
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
 * 渲染商店列表及分頁
