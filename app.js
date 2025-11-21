// === 全域狀態 ===
let data = {}; // {category: Item[]}
let currentCategory = 'all';
let currentPage = 1;
const itemsPerPage = 30; // 每頁固定 30 筆
let currentKeyword = '';
let currentDistrict = 'all';

// 資料來源，只讀取一個 JSON 檔案
const DATA_SOURCE = 'shop_data.json';

// 類別名稱對應表 (用於顯示中文名稱)
const CATEGORY_MAP = {
  'medical': '醫療保健',
  'food': '美食餐飲',
  'leisure': '休閒住宿',
  'daily': '生活用品',
  'learning': '學習教育',
  'moto': '機/腳踏車',
  '3c': '３Ｃ通訊',
  'car': '汽車服務',
  'finance': '金融保險',
  'other': '其他類',
};

/**
 * 從 JSON 載入資料並按類別分組
 */
async function loadData(){
  const groupedData = {};
  try{
    const res = await fetch(DATA_SOURCE);
    if (!res.ok) throw new Error('資料載入失敗');
    const shops = await res.json();
    
    // 將所有商店按 category 分組
    shops.forEach(item => {
      const catKey = item.category || 'other';
      groupedData[catKey] = groupedData[catKey] || [];
      groupedData[catKey].push(item);
    });
    
    data = groupedData;
  }catch(e){ 
    console.error('特約商店資料載入錯誤：', e); 
  }
}

/**
 * 動態渲染地區篩選下拉選單
 */
function renderDistrictOptions(){
  const districts = new Set(); 
  const allItems = Object.values(data).flat();
  allItems.forEach(i => { if (i.location) districts.add(i.location); });
  
  const sel = document.getElementById('districtFilter');
  // 移除舊選項，保留 "所有地區"
  sel.querySelectorAll('option:not([value="all"])').forEach(o => o.remove());
  
  // 添加新的地區選項
  Array.from(districts).sort().forEach(d => { 
    const opt = document.createElement('option'); 
    opt.value = d; 
    opt.textContent = d; 
    sel.appendChild(opt); 
  });
  sel.value = currentDistrict;
}

/**
 * 渲染商店列表
 */
function renderList(){
  const container = document.getElementById('shopList'); 
  container.innerHTML = '';
  
  // 1. 篩選資料
  let items = currentCategory === 'all' 
    ? Object.values(data).flat() 
    : (data[currentCategory] || []);
  
  const kw = (currentKeyword || '').trim().toLowerCase();
  if (kw){ 
    items = items.filter(i => 
      (i.name || '').toLowerCase().includes(kw) || 
      (i.location || '').toLowerCase().includes(kw)
    ); 
  }
  
  if (currentDistrict !== 'all'){ 
    items = items.filter(i => (i.location || '') === currentDistrict); 
  }

  // 2. 分頁計算
  const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * itemsPerPage; 
  const pageItems = items.slice(start, start + itemsPerPage);

  // 3. 渲染列表
  if (pageItems.length === 0) {
      container.innerHTML = `<p style="text-align: center; margin-top: 2rem; color: #777;">查無符合條件的特約商店。</p>`;
  }

  pageItems.forEach(item => {
    const card = document.createElement('div'); 
    card.className = 'shop-item';
    
    // 類別標籤
    const catLabel = document.createElement('span'); 
    catLabel.className = 'item-category';
    catLabel.textContent = CATEGORY_MAP[item.category] || '其他類';
    card.appendChild(catLabel);
    
    // 商店名稱
    const header = document.createElement('div'); 
    header.className = 'item-header';
    const nameEl = document.createElement('h2'); 
    nameEl.textContent = item.name || '未命名商店';
    header.appendChild(nameEl); 
    card.appendChild(header);

    // 商店資訊
    const body = document.createElement('div'); 
    body.className = 'item-body';
    body.innerHTML = `
      <p class="item-location"><strong>地區：</strong>${item.location || '-'}</p>
      ${item.address ? `<p><strong>地址：</strong>${item.address}</p>` : ''}
      ${item.phone ? `<p><strong>電話：</strong>${item.phone}</p>` : ''}
      ${item.discount ? `<p style="color:var(--brand); margin-top: 8px;"><strong>優惠內容：</strong>${item.discount}</p>` : ''}
    `;
    card.appendChild(body);

    // 連結動作 (搜尋導航)
    const actions = document.createElement('div'); 
    actions.className = 'item-actions';
    const query = encodeURIComponent(`${item.location} ${item.name}`);
    const navA = document.createElement('a'); 
    navA.className = 'btn'; 
    navA.href = `https://www.google.com/maps/search/?api=1&query=${query}`; 
    navA.target = '_blank'; 
    navA.rel = 'noopener'; 
    navA.textContent = '地圖搜尋';
    
    actions.appendChild(navA); 
    card.appendChild(actions);
    container.appendChild(card);
  });

  // 4. 更新分頁資訊
  document.getElementById('pageInfo').textContent = `${currentPage} / ${totalPages}`;
  const prev = document.getElementById('prevBtn'); 
  const next = document.getElementById('nextBtn');
  prev.disabled = currentPage <= 1; 
  next.disabled = currentPage >= totalPages;
}

/**
 * 綁定所有互動事件
 */
function bindEvents(){
  // 類別按鈕
  document.querySelectorAll('.category-buttons button').forEach(btn => {
    btn.addEventListener('click', () => { 
      document.querySelectorAll('.category-buttons button').forEach(b => b.classList.remove('active')); 
      btn.classList.add('active'); 
      currentCategory = btn.getAttribute('data-cat'); 
      currentPage = 1; 
      renderList(); 
    });
  });
  
  // 關鍵字輸入
  document.getElementById('keywordInput').addEventListener('input', e => { 
    currentKeyword = e.target.value; 
    currentPage = 1; 
    renderList(); 
  });
  
  // 地區篩選
  document.getElementById('districtFilter').addEventListener('change', e => { 
    currentDistrict = e.target.value; 
    currentPage = 1; 
    renderList(); 
  });
  
  // 上一頁/下一頁
  document.getElementById('prevBtn').addEventListener('click', () => { 
    if (currentPage > 1) { 
      currentPage--; 
      renderList(); 
    } 
  });
  document.getElementById('nextBtn').addEventListener('click', () => { 
    currentPage++; 
    renderList(); 
  });
}

// 應用程式初始化
(async function init(){ 
  await loadData(); 
  renderDistrictOptions(); 
  bindEvents(); 
  renderList(); 
})();
