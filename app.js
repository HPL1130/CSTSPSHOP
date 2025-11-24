// app.js

// 🚨 關鍵修改：使用您的 Google Sheets ID 構建 API URL
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


/**
 * 載入特約商店資料 (從 Google Sheets API 讀取並解析)
 */
async function loadShops() {
  try {
    const response = await fetch(SHOP_DATA_URL);
    
    // Google Sheets API 回傳的內容是帶有前綴的文字
    const text = await response.text();
    
    // 移除 Google Sheets API 特有的字串前綴 (如 "google.visualization.Query.setResponse(") 和後綴
    // [47] 和 [2] 是 Google API 固定的長度，用於提取純 JSON 數據
    const jsonString = text.substring(47).slice(0, -2);
    const data = JSON.parse(jsonString);

    // 取得欄位名稱 (headers=1 確保第一列為標題)
    const columns = data.table.cols.map(col => col.label);
    
    // 轉換為您的網站需要的 JSON 陣列格式
    allShops = data.table.rows.map(row => {
      const shop = {};
      row.c.forEach((cell, index) => {
        // 確保 cell.v 存在，如果為空則給予空字串
        const cellValue = cell && cell.v !== null ? cell.v : '';
        shop[columns[index]] = String(cellValue); // 確保所有值都是字串
      });
      return shop;
    });

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
    filterAndRender();

  } catch (error) {
    console.error("Error loading shop data from Google Sheets:", error);
    // 顯示錯誤訊息
    shopListElement.innerHTML = `<p class="no-results">無法載入商店資料。請檢查 Google Sheets ID、公開發布設定或網路連線。</p>`;
  }
}

/**
 * 填充地區篩選下拉選單
 */
function populateDistrictFilter() {
  // 清空現有的選項，並加入 '所有地區'
  districtFilter.innerHTML = '<option value="all">所有地區</option>'; 
  
  // 按照地區名稱排序後加入下拉選單
  const sortedDistricts = Array.from(availableDistricts).sort((a, b) => a.localeCompare(b, 'zh-TW'));
  
  sortedDistricts.forEach(district => {
    const option = document.createElement('option');
    option.value = district;
    option.textContent = district;
    districtFilter.appendChild(option);
  });
}

/**
 * 根據所有篩選條件過濾資料並重新渲染
 */
function filterAndRender() {
  currentPage = 1; // 篩選條件改變時，回到第一頁
  const keyword = keywordInput.value.toLowerCase().trim();
  const district = districtFilter.value;
  
  // 獲取當前選中的類別按鈕
  const activeCategoryButton = categoryButtons.querySelector('button.active');
  const category = activeCategoryButton ? activeCategoryButton.dataset.cat : 'all';

  filteredShops = allShops.filter(shop => {
    const matchesCategory = category === 'all' || shop.category === category;
    
    const matchesDistrict = district === 'all' || shop.location.split('、').some(loc => loc.trim() === district);
    
    const matchesKeyword = !keyword || 
      shop.name.toLowerCase().includes(keyword) || 
      shop.discount.toLowerCase().includes(keyword) ||
      shop.location.toLowerCase().includes(keyword);

    return matchesCategory && matchesDistrict && matchesKeyword;
  });

  renderList();
}


/**
 * 渲染當前頁面的列表和分頁控制
 */
function renderList() {
  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const shopsToRender = filteredShops.slice(start, end);
  const totalPages = Math.ceil(filteredShops.length / itemsPerPage);

  shopListElement.innerHTML = ''; // 清空列表

  if (shopsToRender.length === 0) {
    shopListElement.innerHTML = '<p class="no-results">找不到符合條件的特約商店。</p>';
  } else {
    shopsToRender.forEach(item => {
      // 創建卡片容器
      const card = document.createElement('div');
      card.className = 'shop-card';

      // 創建地區標籤 (Location Badge)
      const badge = document.createElement('div');
      badge.className = 'location-badge';
      badge.textContent = item.location || 'N/A';
      card.appendChild(badge);

      // 創建標題/名稱
      const title = document.createElement('h3');
      title.textContent = item.name;
      card.appendChild(title);

      // 創建優惠內容區塊
      const body = document.createElement('div');
      body.className = 'item-body';
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
 * 事件監聽器：切換類別、關鍵字、地區
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

keywordInput.addEventListener('input', filterAndRender);
districtFilter.addEventListener('change', filterAndRender);


/**
 * 事件監聽器：分頁控制
 */
prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderList();
        // 滾動到頁面頂部
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
});

nextBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredShops.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderList();
        // 滾動到頁面頂部
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
});


// 確保執行 loadShops 以啟動應用程式
loadShops();
