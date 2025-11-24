const DB_NAME = 'kitchenpantrypal-db';
const DB_VERSION = 3;
let db = null;

// State
let pantry = [];
let recipes = [];
let shopping = [];
let planner = {};
let selectedRecipeId = null;
let editingPantryId = null;
let currentPlanSlot = null;

const $ = id => document.getElementById(id);

// ===== INDEXEDDB =====
function openDB() {
  return new Promise((resolve, reject) => {
    const rq = indexedDB.open(DB_NAME, DB_VERSION);
    rq.onupgradeneeded = (e) => {
      const idb = e.target.result;
      if (!idb.objectStoreNames.contains('pantry')) {
        idb.createObjectStore('pantry', {keyPath:'id', autoIncrement:true});
      }
      if (!idb.objectStoreNames.contains('recipes')) {
        idb.createObjectStore('recipes', {keyPath:'id', autoIncrement:true});
      }
      if (!idb.objectStoreNames.contains('shopping')) {
        idb.createObjectStore('shopping', {keyPath:'id', autoIncrement:true});
      }
      if (!idb.objectStoreNames.contains('planner')) {
        idb.createObjectStore('planner', {keyPath:'slot'});
      }
    };
    rq.onsuccess = (e) => { db = e.target.result; resolve(db); };
    rq.onerror = (e) => reject(e.target.error);
  });
}

function idbGetAll(storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName,'readonly');
    const store = tx.objectStore(storeName);
    const out = [];
    const c = store.openCursor();
    c.onsuccess = e => { 
      const cur = e.target.result; 
      if (cur){ out.push(cur.value); cur.continue(); } 
      else resolve(out); 
    };
    c.onerror = e => reject(e.target.error);
  });
}

function idbPut(storeName, obj) {
  return new Promise((resolve,reject) => {
    const tx = db.transaction(storeName,'readwrite');
    const store = tx.objectStore(storeName);
    const rq = store.put(obj);
    rq.onsuccess = (e) => resolve(e.target.result);
    rq.onerror = (e) => reject(e.target.error);
  });
}

function idbDelete(storeName, key) {
  return new Promise((resolve,reject) => {
    const tx = db.transaction(storeName,'readwrite');
    const store = tx.objectStore(storeName);
    const rq = store.delete(key);
    rq.onsuccess = () => resolve();
    rq.onerror = e => reject(e.target.error);
  });
}

function idbClear(storeName) {
  return new Promise((resolve,reject) => {
    const tx = db.transaction(storeName,'readwrite');
    const store = tx.objectStore(storeName);
    const rq = store.clear();
    rq.onsuccess = () => resolve();
    rq.onerror = e => reject(e.target.error);
  });
}

// ===== INIT =====
async function init() {
  try {
    await openDB();
    await loadData();
    bindUI();
    renderRecipes();
    renderPantry();
    renderShopping();
    renderPlanner();
    console.log('Kitchen PantryPal initialized successfully');
  } catch (err) {
    console.error('Initialization error:', err);
  }
}

async function loadData() {
  pantry = await idbGetAll('pantry');
  recipes = await idbGetAll('recipes');
  shopping = await idbGetAll('shopping');
  const plannerArr = await idbGetAll('planner');
  planner = {};
  plannerArr.forEach(p => planner[p.slot] = p);
}

function bindUI() {
  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Recipes
  $('recipeSearch').oninput = renderRecipes;
  $('recipeFilter').onchange = renderRecipes;
  $('btnListAll').onclick = () => { $('recipeSearch').value = ''; $('recipeFilter').value = 'all'; renderRecipes(); };
  $('btnAddRecipe').onclick = () => openRecipeEditor();
  $('btnImportRecipe').onclick = () => openModal('modalImportRecipe');
  $('btnSaveRecipe').onclick = saveRecipe;
  $('btnCancelRecipe').onclick = () => closeModal('modalRecipeEditor');
  $('btnDeleteRecipe').onclick = deleteRecipe;
  $('btnImportRecipeConfirm').onclick = importRecipeJson;
  $('btnCancelImportRecipe').onclick = () => closeModal('modalImportRecipe');

  // Pantry
  $('pantrySearch').oninput = renderPantry;
  $('pantrySort').onchange = renderPantry;
  $('btnAddPantryItem').onclick = () => openModal('modalAddPantry');
  $('btnImportPantryList').onclick = importPantryList;
  $('btnSavePantry').onclick = savePantryItem;
  $('btnCancelPantry').onclick = () => closeModal('modalAddPantry');
  $('btnUpdatePantry').onclick = updatePantryItem;
  $('btnCancelEditPantry').onclick = () => closeModal('modalEditPantry');

  // Shopping
  $('btnAddShoppingItem').onclick = () => openModal('modalAddShopping');
  $('btnSaveShopping').onclick = saveShoppingItem;
  $('btnCancelShopping').onclick = () => closeModal('modalAddShopping');
  $('btnMarkAllPurchased').onclick = markAllPurchased;
  $('btnClearShopping').onclick = clearShopping;

  // Planner
  $('btnClearPlanner').onclick = clearPlanner;
  $('btnConfirmPlanMeal').onclick = confirmPlanMeal;
  $('btnCancelPlanMeal').onclick = () => closeModal('modalPlanMeal');
  $('btnRemovePlanMeal').onclick = removePlannedMealFromModal;
  $('planMealSearch').oninput = filterPlanMealList;

  // Import/Export
  $('btnExport').onclick = exportAllData;
  $('btnImport').onclick = importAllData;

  // Modal close on outside click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal.id);
    });
  });
}

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');
  $(`tab-${tabName}`).classList.add('active');
}

function openModal(modalId) {
  $(modalId).classList.add('active');
}

function closeModal(modalId) {
  $(modalId).classList.remove('active');
}

// ===== UTILITY =====
function normalizeText(text) {
  return String(text || '').trim().toLowerCase();
}

function parseIngredientLine(line) {
  line = line.trim();
  if (!line) return null;
  
  if (line.includes('|')) {
    const parts = line.split('|').map(s => s.trim());
    return { name: parts[0] || '', qty: parts[1] || '', unit: parts[2] || '' };
  } else {
    const match = line.match(/^([\d\/\.]+)\s*([a-zA-Z]+)?\s+(.*)$/);
    if (match) {
      return { name: match[3] || line, qty: match[1] || '', unit: match[2] || '' };
    }
    return { name: line, qty: '', unit: '' };
  }
}

// ===== RECIPES =====
function canMakeRecipe(recipe) {
  if (!recipe.ingredients || recipe.ingredients.length === 0) return true;
  
  for (const ing of recipe.ingredients) {
    const ingName = normalizeText(ing.name);
    if (!ingName) continue;
    
    const found = pantry.find(p => {
      if (!p.available) return false;
      const pName = normalizeText(p.name);
      return pName === ingName || pName.includes(ingName) || ingName.includes(pName);
    });
    
    if (!found) return false;
  }
  return true;
}

function renderRecipes() {
  const list = $('recipesList');
  list.innerHTML = '';
  
  const searchTerm = normalizeText($('recipeSearch').value);
  const filterType = $('recipeFilter').value;
  
  let filtered = recipes.slice();
  
  if (searchTerm) {
    filtered = filtered.filter(r => {
      const nameMatch = normalizeText(r.name).includes(searchTerm);
      const ingMatch = (r.ingredients || []).some(ing => 
        normalizeText(ing.name).includes(searchTerm)
      );
      return nameMatch || ingMatch;
    });
  }
  
  if (filterType === 'available') {
    filtered = filtered.filter(r => canMakeRecipe(r));
  }
  
  filtered.sort((a, b) => a.name.localeCompare(b.name));
  
  if (filtered.length === 0) {
    list.innerHTML = '<div class="small-note" style="padding:20px; text-align:center;">No recipes found</div>';
    return;
  }
  
  filtered.forEach(recipe => {
    const item = document.createElement('div');
    item.className = 'list-item';
    if (selectedRecipeId === recipe.id) item.classList.add('active');
    
    const canMake = canMakeRecipe(recipe);
    const icon = canMake ? 
      '<span class="status-icon ready">✓</span>' : 
      '<span class="status-icon missing">✗</span>';
    
    item.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
        <div style="flex:1; min-width:0;">
          <div style="font-weight:600;">${recipe.name}</div>
          <div class="small-note">${recipe.category || 'Uncategorized'}</div>
        </div>
        ${icon}
      </div>
    `;
    
    item.onclick = () => selectRecipe(recipe.id);
    list.appendChild(item);
  });
}

function selectRecipe(id) {
  selectedRecipeId = id;
  renderRecipes();
  displayRecipeDetail(id);
}

function displayRecipeDetail(id) {
  const recipe = recipes.find(r => r.id === id);
  if (!recipe) return;
  
  const detail = $('recipeDetail');
  const canMake = canMakeRecipe(recipe);
  
  const ingredientsList = (recipe.ingredients || []).map(ing => {
    const ingName = normalizeText(ing.name);
    const available = pantry.find(p => p.available && (
      normalizeText(p.name) === ingName || 
      normalizeText(p.name).includes(ingName) || 
      ingName.includes(normalizeText(p.name))
    ));
    
    const checkmark = available ? '✓' : '✗';
    const color = available ? '#86efac' : '#fca5a5';
    
    return `<div style="padding:4px 0; display:flex; gap:8px;">
      <span style="color:${color}; font-weight:600;">${checkmark}</span>
      <span>${ing.qty} ${ing.unit} ${ing.name}</span>
    </div>`;
  }).join('');
  
  const instructions = Array.isArray(recipe.instructions) ? 
    recipe.instructions.join('\n\n') : 
    (recipe.instructions || 'No instructions provided');
  
  detail.innerHTML = `
    <div class="hstack" style="margin-bottom:20px; flex-wrap:wrap;">
      <h2 style="margin:0; flex:1;">${recipe.name}</h2>
      <button class="button small secondary" onclick="editRecipe(${recipe.id})">Edit</button>
    </div>
    
    ${recipe.category ? `<div class="small-note" style="margin-bottom:16px;">Category: ${recipe.category}</div>` : ''}
    
    <div style="margin-bottom:20px;">
      ${canMake ? 
        '<div class="badge ready" style="font-size:14px; padding:8px 12px;">✓ You can make this recipe!</div>' :
        '<div class="badge missing" style="font-size:14px; padding:8px 12px;">✗ Missing some ingredients</div>'
      }
    </div>
    
    <h3>Ingredients</h3>
    <div style="margin-bottom:24px;">
      ${ingredientsList}
    </div>
    
    <h3>Instructions</h3>
    <div style="white-space:pre-wrap; line-height:1.6;">
      ${instructions}
    </div>
  `;
}

function openRecipeEditor(recipe = null) {
  selectedRecipeId = recipe ? recipe.id : null;
  
  if (recipe) {
    $('recipeEditorTitle').textContent = 'Edit Recipe';
    $('editRecipeName').value = recipe.name || '';
    $('editRecipeCategory').value = recipe.category || '';
    
    const ings = (recipe.ingredients || []).map(i => 
      `${i.name}|${i.qty}|${i.unit}`
    ).join('\n');
    $('editRecipeIngredients').value = ings;
    
    const instr = Array.isArray(recipe.instructions) ? 
      recipe.instructions.join('\n\n') : 
      (recipe.instructions || '');
    $('editRecipeInstructions').value = instr;
    
    $('btnDeleteRecipe').style.display = 'inline-block';
  } else {
    $('recipeEditorTitle').textContent = 'Add Recipe';
    $('editRecipeName').value = '';
    $('editRecipeCategory').value = '';
    $('editRecipeIngredients').value = '';
    $('editRecipeInstructions').value = '';
    $('btnDeleteRecipe').style.display = 'none';
  }
  
  openModal('modalRecipeEditor');
}

function editRecipe(id) {
  const recipe = recipes.find(r => r.id === id);
  if (recipe) openRecipeEditor(recipe);
}

async function saveRecipe() {
  const name = $('editRecipeName').value.trim();
  if (!name) return alert('Please enter a recipe name');
  
  const category = $('editRecipeCategory').value.trim();
  const ingredientsText = $('editRecipeIngredients').value;
  const instructionsText = $('editRecipeInstructions').value.trim();
  
  const ingredients = ingredientsText.split('\n')
    .map(l => parseIngredientLine(l))
    .filter(Boolean);
  
  const recipe = {
    name,
    category,
    ingredients,
    instructions: instructionsText,
    created: new Date().toISOString()
  };
  
  if (selectedRecipeId) {
    recipe.id = selectedRecipeId;
  }
  
  await idbPut('recipes', recipe);
  await loadData();
  renderRecipes();
  closeModal('modalRecipeEditor');
  
  if (selectedRecipeId) {
    displayRecipeDetail(selectedRecipeId);
  }
}

async function deleteRecipe() {
  if (!selectedRecipeId) return;
  if (!confirm('Delete this recipe?')) return;
  
  await idbDelete('recipes', selectedRecipeId);
  selectedRecipeId = null;
  await loadData();
  renderRecipes();
  closeModal('modalRecipeEditor');
  $('recipeDetail').innerHTML = '<div style="text-align:center; padding:40px; color:var(--muted);"><p>Select a recipe to view details</p></div>';
}

async function importRecipeJson() {
  const jsonText = $('importRecipeJson').value.trim();
  if (!jsonText) return alert('Please paste JSON data');
  
  try {
    const data = JSON.parse(jsonText);
    const recipesToImport = Array.isArray(data) ? data : [data];
    
    let imported = 0;
    let skipped = 0;
    
    for (const recipeData of recipesToImport) {
      const recipe = {
        name: recipeData.title || recipeData.name || 'Untitled Recipe',
        category: recipeData.category || '',
        ingredients: [],
        instructions: '',
        created: new Date().toISOString()
      };
      
      const exists = recipes.find(r => normalizeText(r.name) === normalizeText(recipe.name));
      if (exists) {
        skipped++;
        continue;
      }
      
      if (Array.isArray(recipeData.ingredients)) {
        recipe.ingredients = recipeData.ingredients.map(ing => {
          if (typeof ing === 'string') {
            return parseIngredientLine(ing) || { name: ing, qty: '', unit: '' };
          } else if (typeof ing === 'object') {
            return {
              name: ing.name || ing.ingredient || '',
              qty: ing.qty || ing.quantity || ing.amount || '',
              unit: ing.unit || ''
            };
          }
          return { name: '', qty: '', unit: '' };
        }).filter(i => i.name);
      }
      
      if (Array.isArray(recipeData.directions)) {
        recipe.instructions = recipeData.directions.join('\n\n');
      } else if (Array.isArray(recipeData.instructions)) {
        recipe.instructions = recipeData.instructions.join('\n\n');
      } else if (typeof recipeData.directions === 'string') {
        recipe.instructions = recipeData.directions;
      } else if (typeof recipeData.instructions === 'string') {
        recipe.instructions = recipeData.instructions;
      }
      
      await idbPut('recipes', recipe);
      imported++;
    }
    
    await loadData();
    renderRecipes();
    closeModal('modalImportRecipe');
    $('importRecipeJson').value = '';
    
    if (recipesToImport.length === 1) {
      alert('Recipe imported successfully!');
    } else {
      alert(`Import complete!\nImported: ${imported} recipes\nSkipped (already exist): ${skipped} recipes`);
    }
    
  } catch (err) {
    alert('Invalid JSON format. Please check your data.');
    console.error(err);
  }
}

// ===== PANTRY =====
function renderPantry() {
  const list = $('pantryList');
  list.innerHTML = '';
  
  const searchTerm = normalizeText($('pantrySearch').value);
  const sortType = $('pantrySort').value;
  
  let filtered = pantry.slice();
  
  if (searchTerm) {
    filtered = filtered.filter(p => normalizeText(p.name).includes(searchTerm));
  }
  
  if (sortType === 'alpha') {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortType === 'available') {
    filtered.sort((a, b) => {
      if (a.available && !b.available) return -1;
      if (!a.available && b.available) return 1;
      return a.name.localeCompare(b.name);
    });
  }
  
  if (filtered.length === 0) {
    list.innerHTML = '<div class="small-note" style="padding:20px; text-align:center;">No pantry items. Click "+ Add Item" to get started.</div>';
    return;
  }
  
  filtered.forEach(item => {
    const div = document.createElement('div');
    div.className = 'checkbox-item';
    
    const isInShopping = shopping.some(s => normalizeText(s.name) === normalizeText(item.name));
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `pantry-${item.id}`;
    checkbox.checked = item.available || false;
    checkbox.onchange = async () => {
      item.available = checkbox.checked;
      await idbPut('pantry', item);
      renderRecipes();
    };
    
    const label = document.createElement('label');
    label.htmlFor = `pantry-${item.id}`;
    label.textContent = item.name;
    
    const actions = document.createElement('div');
    actions.className = 'item-actions';
    
    if (isInShopping) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.style.fontSize = '10px';
      badge.textContent = 'In Shopping';
      actions.appendChild(badge);
    } else {
      const shopBtn = document.createElement('button');
      shopBtn.className = 'button small secondary';
      shopBtn.textContent = '→ Shop';
      shopBtn.onclick = () => addPantryToShopping(item.id);
      actions.appendChild(shopBtn);
    }
    
    const editBtn = document.createElement('button');
    editBtn.className = 'button small secondary';
    editBtn.textContent = 'Edit';
    editBtn.onclick = () => openEditPantry(item.id);
    actions.appendChild(editBtn);
    
    const delBtn = document.createElement('button');
    delBtn.className = 'button small danger';
    delBtn.textContent = 'Delete';
    delBtn.onclick = () => deletePantryItem(item.id);
    actions.appendChild(delBtn);
    
    div.appendChild(checkbox);
    div.appendChild(label);
    div.appendChild(actions);
    list.appendChild(div);
  });
}

async function savePantryItem() {
  const name = $('newPantryName').value.trim();
  if (!name) return alert('Please enter an item name');
  
  const exists = pantry.find(p => normalizeText(p.name) === normalizeText(name));
  if (exists) {
    alert('This item already exists in your pantry');
    return;
  }
  
  const item = {
    name,
    available: true
  };
  
  await idbPut('pantry', item);
  await loadData();
  renderPantry();
  closeModal('modalAddPantry');
  $('newPantryName').value = '';
}

function openEditPantry(id) {
  const item = pantry.find(p => p.id === id);
  if (!item) return;
  
  editingPantryId = id;
  $('editPantryName').value = item.name;
  openModal('modalEditPantry');
}

async function updatePantryItem() {
  if (!editingPantryId) return;
  
  const name = $('editPantryName').value.trim();
  if (!name) return alert('Please enter an item name');
  
  const item = pantry.find(p => p.id === editingPantryId);
  if (!item) return;
  
  const exists = pantry.find(p => p.id !== editingPantryId && normalizeText(p.name) === normalizeText(name));
  if (exists) {
    alert('An item with this name already exists');
    return;
  }
  
  item.name = name;
  await idbPut('pantry', item);
  await loadData();
  renderPantry();
  renderRecipes();
  closeModal('modalEditPantry');
  editingPantryId = null;
}

async function deletePantryItem(id) {
  if (!confirm('Delete this pantry item?')) return;
  
  await idbDelete('pantry', id);
  await loadData();
  renderPantry();
  renderRecipes();
}

async function addPantryToShopping(pantryId) {
  const item = pantry.find(p => p.id === pantryId);
  if (!item) return;
  
  const exists = shopping.find(s => normalizeText(s.name) === normalizeText(item.name));
  if (exists) return;
  
  await idbPut('shopping', { name: item.name });
  await loadData();
  renderPantry();
  renderShopping();
}

async function importPantryList() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.txt';
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      if (lines.length === 0) {
        alert('No items found in file');
        return;
      }
      
      let imported = 0;
      let skipped = 0;
      
      for (const name of lines) {
        const exists = pantry.find(p => normalizeText(p.name) === normalizeText(name));
        if (exists) {
          skipped++;
          continue;
        }
        
        await idbPut('pantry', { name, available: true });
        imported++;
      }
      
      await loadData();
      renderPantry();
      
      alert(`Import complete!\nImported: ${imported} items\nSkipped (already exist): ${skipped} items`);
      
    } catch (err) {
      alert('Error reading file. Please make sure it\'s a text file with one item per line.');
      console.error(err);
    }
  };
  
  input.click();
}

// ===== SHOPPING LIST =====
function renderShopping() {
  const list = $('shoppingList');
  list.innerHTML = '';
  
  if (shopping.length === 0) {
    list.innerHTML = '<div class="small-note" style="padding:20px; text-align:center;">No items in shopping list</div>';
    return;
  }
  
  shopping.forEach(item => {
    const div = document.createElement('div');
    div.className = 'checkbox-item';
    
    const label = document.createElement('label');
    label.style.flex = '1';
    label.textContent = item.name;
    
    const actions = document.createElement('div');
    actions.className = 'item-actions';
    
    const purchaseBtn = document.createElement('button');
    purchaseBtn.className = 'button small';
    purchaseBtn.textContent = 'Purchased';
    purchaseBtn.onclick = () => markPurchased(item.id);
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'button small danger';
    removeBtn.textContent = 'Remove';
    removeBtn.onclick = () => deleteShoppingItem(item.id);
    
    actions.appendChild(purchaseBtn);
    actions.appendChild(removeBtn);
    div.appendChild(label);
    div.appendChild(actions);
    list.appendChild(div);
  });
}

async function saveShoppingItem() {
  const name = $('newShoppingName').value.trim();
  if (!name) return alert('Please enter an item name');
  
  await idbPut('shopping', { name });
  await loadData();
  renderShopping();
  closeModal('modalAddShopping');
  $('newShoppingName').value = '';
}

async function deleteShoppingItem(id) {
  await idbDelete('shopping', id);
  await loadData();
  renderShopping();
  renderPantry();
}

async function markPurchased(id) {
  const item = shopping.find(s => s.id === id);
  if (!item) return;
  
  let pantryItem = pantry.find(p => normalizeText(p.name) === normalizeText(item.name));
  
  if (pantryItem) {
    pantryItem.available = true;
    await idbPut('pantry', pantryItem);
  } else {
    await idbPut('pantry', { name: item.name, available: true });
  }
  
  await idbDelete('shopping', id);
  await loadData();
  renderShopping();
  renderPantry();
  renderRecipes();
}

async function markAllPurchased() {
  if (shopping.length === 0) return;
  if (!confirm('Mark all items as purchased?')) return;
  
  for (const item of shopping) {
    let pantryItem = pantry.find(p => normalizeText(p.name) === normalizeText(item.name));
    
    if (pantryItem) {
      pantryItem.available = true;
      await idbPut('pantry', pantryItem);
    } else {
      await idbPut('pantry', { name: item.name, available: true });
    }
  }
  
  await idbClear('shopping');
  await loadData();
  renderShopping();
  renderPantry();
  renderRecipes();
}

async function clearShopping() {
  if (shopping.length === 0) return;
  if (!confirm('Clear entire shopping list?')) return;
  
  await idbClear('shopping');
  await loadData();
  renderShopping();
  renderPantry();
}

// ===== WEEKLY PLANNER =====
function getWeekDays() {
  const today = new Date();
  const day = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - day);
  
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push({
      date: d.toISOString().split('T')[0],
      name: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]
    });
  }
  return days;
}

function renderPlanner() {
  const calendar = $('plannerCalendar');
  calendar.innerHTML = '';
  
  const days = getWeekDays();
  const meals = ['Breakfast', 'Lunch', 'Dinner'];
  
  days.forEach(day => {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'day';
    
    const header = document.createElement('div');
    header.className = 'day-header';
    header.textContent = `${day.name} ${day.date.split('-')[2]}`;
    dayDiv.appendChild(header);
	meals.forEach(meal => {
  const slotKey = `${day.date}_${meal}`;
  const planned = planner[slotKey];
  
  const slot = document.createElement('div');
  slot.className = 'meal-slot';
  if (planned) slot.classList.add('filled');
  
  if (planned) {
    const recipe = recipes.find(r => r.id === planned.recipeId);
    slot.textContent = recipe ? recipe.name : 'Deleted recipe';
  } else {
    slot.textContent = meal;
  }
  
  slot.onclick = () => openPlanMealModal(slotKey);
  
  dayDiv.appendChild(slot);
});

calendar.appendChild(dayDiv);
});
}
function openPlanMealModal(slotKey) {
currentPlanSlot = slotKey;
const existing = planner[slotKey];
if (existing) {
$('planMealTitle').textContent = 'Change Meal';
$('btnRemovePlanMeal').style.display = 'inline-block';
} else {
$('planMealTitle').textContent = 'Add Meal';
$('btnRemovePlanMeal').style.display = 'none';
}
$('planMealSearch').value = '';
populatePlanMealList();
openModal('modalPlanMeal');
}
function populatePlanMealList(filter = '') {
const select = $('planMealSelect');
select.innerHTML = '';
const filterLower = normalizeText(filter);
let sorted = recipes.slice();
const makeable = [];
const notMakeable = [];
sorted.forEach(r => {
if (filter && !normalizeText(r.name).includes(filterLower)) return;
if (canMakeRecipe(r)) {
  makeable.push(r);
} else {
  notMakeable.push(r);
}
});
makeable.sort((a, b) => a.name.localeCompare(b.name));
notMakeable.sort((a, b) => a.name.localeCompare(b.name));
makeable.forEach(r => {
const option = document.createElement('option');
option.value = r.id;
option.textContent = `✓ ${r.name}`;
option.style.color = '#86efac';
select.appendChild(option);
});
if (makeable.length > 0 && notMakeable.length > 0) {
const separator = document.createElement('option');
separator.disabled = true;
separator.textContent = '─────────────';
select.appendChild(separator);
}
notMakeable.forEach(r => {
const option = document.createElement('option');
option.value = r.id;
option.textContent = `  ${r.name}`;
select.appendChild(option);
});
}
function filterPlanMealList() {
const filter = $('planMealSearch').value;
populatePlanMealList(filter);
}
async function confirmPlanMeal() {
const select = $('planMealSelect');
const selectedId = parseInt(select.value);
if (!selectedId || !currentPlanSlot) return;
planner[currentPlanSlot] = { slot: currentPlanSlot, recipeId: selectedId };
await idbPut('planner', planner[currentPlanSlot]);
renderPlanner();
closeModal('modalPlanMeal');
currentPlanSlot = null;
}
async function removePlannedMealFromModal() {
if (!currentPlanSlot || !planner[currentPlanSlot]) return;
await idbDelete('planner', currentPlanSlot);
delete planner[currentPlanSlot];
renderPlanner();
closeModal('modalPlanMeal');
currentPlanSlot = null;
}
async function clearPlanner() {
if (Object.keys(planner).length === 0) return;
if (!confirm('Clear all planned meals for this week?')) return;
await idbClear('planner');
planner = {};
renderPlanner();
}
// ===== IMPORT/EXPORT =====
function exportAllData() {
const data = {
pantry,
recipes,
shopping,
planner: Object.values(planner),
exported: new Date().toISOString()
};
const json = JSON.stringify(data, null, 2);
const blob = new Blob([json], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'kitchen-pantrypal-${Date.now()}.json';
a.click();
URL.revokeObjectURL(url);
}
async function importAllData() {
const input = document.createElement('input');
input.type = 'file';
input.accept = '.json';
input.onchange = async (e) => {
const file = e.target.files[0];
if (!file) return;
try {
  const text = await file.text();
  const data = JSON.parse(text);
  
  if (!confirm('This will replace all your current data. Continue?')) return;
  
  await idbClear('pantry');
  await idbClear('recipes');
  await idbClear('shopping');
  await idbClear('planner');
  
  if (Array.isArray(data.pantry)) {
    for (const item of data.pantry) {
      delete item.id;
      await idbPut('pantry', item);
    }
  }
  
  if (Array.isArray(data.recipes)) {
    for (const recipe of data.recipes) {
      delete recipe.id;
      await idbPut('recipes', recipe);
    }
  }
  
  if (Array.isArray(data.shopping)) {
    for (const item of data.shopping) {
      delete item.id;
      await idbPut('shopping', item);
    }
  }
  
  if (Array.isArray(data.planner)) {
    for (const plan of data.planner) {
      await idbPut('planner', plan);
    }
  }
  
  await loadData();
  renderRecipes();
  renderPantry();
  renderShopping();
  renderPlanner();
  
  alert('Data imported successfully!');
  
} catch (err) {
  alert('Error importing data. Please check the file format.');
  console.error(err);
}
};
input.click();
}
// Start the app
init();