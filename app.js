// app.js

// 🚨 關鍵設定：使用您的 Google Sheets ID 構建 API URL
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

// 新增：頁數跳轉元件
const pageJumpInput = document.getElementById('pageJumpInput');
const jumpBtn = document.getElementById('jumpBtn');


/**
 * 載入特約商店資料 (從 Google Sheets API 讀取並解析)
 */
async function loadShops() {
  try {
    const response = await fetch(SHOP_DATA_URL);
    
    // Google Sheets API 回傳的內容是帶有前綴的文字
    const text = await response.text();
    
    // 移除 Google Sheets API 特有的字串前綴和後綴，提取純 JSON 數據
    const jsonString = text.substring(47).slice(0, -2); 
    const json = JSON.parse(jsonString);

    // 提取商店資料
    const rows = json.table.rows;
    const cols = json.table.cols.map(col => col.label);
    
    allShops = rows.map(row => {
      let item = {};
      row.c.forEach((cell, index) => {
        // 確保單元格有值
        const value = cell && cell.v !== null ? cell.v : '';
        // 欄位名稱應對應 Google Sheets 的第一行標題
        if (index < cols.length) {
            item[cols[index]] = value;
        }
      });
      // 處理地區集合
      if (item.location && item.location !== '全台' && item.location !== '全省' && item.location !== '網路' && item.location !== '新增') {
        availableDistricts.add(item.location.split('、')[0]); // 只取第一個地區作為篩選選項
      }
      return item;
    });

    // 初始化地區篩選器
    initializeDistrictFilter();
    // 初始化渲染列表
    filterAndRender();

    document.getElementById('loading').style.display = 'none'; // 隱藏載入提示

  } catch (error) {
    console.error('載入資料失敗:', error);
    document.getElementById('loading').textContent = '資料載入失敗，請檢查網路或 Google Sheets 連結。';
  }
}


/**
 * 篩選並重新渲染列表
 */
function filterAndRender() {
    const activeCategory = document.querySelector('.category-buttons button.active').getAttribute('data-cat');
    const keyword = keywordInput.value.toLowerCase();
    const district = districtFilter.value;

    filteredShops = allShops.filter(item => {
        const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
        
        const matchesKeyword = !keyword || (
            (item.name && item.name.toLowerCase().includes(keyword)) ||
            (item.discount && item.discount.toLowerCase().includes(keyword))
        );

        const matchesDistrict = district === 'all' || (item.location && item.location.includes(district));

        return matchesCategory && matchesKeyword && matchesDistrict;
    });

    currentPage = 1; // 篩選後重設回第一頁
    renderList();
}


/**
 * 渲染商店列表 (含分頁邏輯)
 */
function renderList() {
    const totalPages = Math.ceil(filteredShops.length / itemsPerPage);
    shopListElement.innerHTML = '';

    if (filteredShops.length === 0) {
        shopListElement.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">未找到符合條件的特約商店。</p>';
    }

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedShops = filteredShops.slice(start, end);

    paginatedShops.forEach(item => {
      const card = document.createElement('div');
      card.className = 'card';
      
      // 恢復到原始的卡片顯示結構
      const body = document.createElement('div');
      body.className = 'card-body';
      body.innerHTML = `
        <h2 class="card-title">${item.name}</h2>
        <p class="card-location"><span class="location-icon">📍</span> ${item.location}</p>
        ${item.discount && item.discount !== '請洽店家或內部公告' 
            ? `<p class="card-discount" style="color:var(--brand); margin-top: 8px;"><strong>優惠內容：</strong>${item.discount}</p>` 
            : '<p style="color:#666; margin-top: 8px;">優惠內容：請洽店家或內部公告</p>'}
      `;
      card.appendChild(body);

      shopListElement.appendChild(card);
    });

    // 更新分頁資訊
    pageInfo.textContent = `第 ${currentPage} 頁 / 共 ${totalPages} 頁 (共 ${filteredShops.length} 筆)`;
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages || totalPages === 0;

    // 新增：同步跳轉輸入框的頁碼並設定狀態
    pageJumpInput.value = currentPage; 
    pageJumpInput.min = 1;
    const maxPages = totalPages > 0 ? totalPages : 1;
    pageJumpInput.max = maxPages; 
    pageJumpInput.disabled = maxPages <= 1;
    jumpBtn.disabled = maxPages <= 1;
}


/**
 * 初始化地區篩選器
 */
function initializeDistrictFilter() {
    districtFilter.innerHTML = '<option value="all">所有地區</option>';
    const sortedDistricts = Array.from(availableDistricts).sort();
    sortedDistricts.forEach(district => {
        const option = document.createElement('option');
        option.value = district;
        option.textContent = district;
        districtFilter.appendChild(option);
    });
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


/**
 * 新增：跳轉按鈕事件監聽器 (處理手動輸入的頁數)
 */
jumpBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredShops.length / itemsPerPage);
    const newPage = parseInt(pageJumpInput.value);

    if (isNaN(newPage) || newPage < 1) {
        alert('請輸入有效的頁數 (大於 0)。');
        pageJumpInput.value = currentPage; 
        return;
    }

    if (newPage > totalPages) {
        alert(`輸入頁數超過最大頁數 (${totalPages} 頁)。`);
        pageJumpInput.value = currentPage; 
        return;
    }

    if (newPage !== currentPage) {
        currentPage = newPage;
        renderList();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
});


// 啟動應用程式
loadShops();
