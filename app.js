// ===== Kitchen PantryPal - Main App Module =====
// This module handles: DB, initialization, state, utilities, import/export

// Database configuration
const DB_NAME = 'kitchenpantrypal-db';
const DB_VERSION = 3;

// Global state (exported for other modules)
export let db = null;
export let pantry = [];
export let recipes = [];
export let shopping = [];
export let planner = {};
export let selectedRecipeId = null;
export let editingPantryId = null;
export let currentPlanSlot = null;

// Utility shorthand
export const $ = id => document.getElementById(id);

// ===== INDEXEDDB FUNCTIONS =====
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

export function idbGetAll(storeName) {
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

export function idbPut(storeName, obj) {
  return new Promise((resolve,reject) => {
    const tx = db.transaction(storeName,'readwrite');
    const store = tx.objectStore(storeName);
    const rq = store.put(obj);
    rq.onsuccess = (e) => resolve(e.target.result);
    rq.onerror = (e) => reject(e.target.error);
  });
}

export function idbDelete(storeName, key) {
  return new Promise((resolve,reject) => {
    const tx = db.transaction(storeName,'readwrite');
    const store = tx.objectStore(storeName);
    const rq = store.delete(key);
    rq.onsuccess = () => resolve();
    rq.onerror = e => reject(e.target.error);
  });
}

export function idbClear(storeName) {
  return new Promise((resolve,reject) => {
    const tx = db.transaction(storeName,'readwrite');
    const store = tx.objectStore(storeName);
    const rq = store.clear();
    rq.onsuccess = () => resolve();
    rq.onerror = e => reject(e.target.error);
  });
}

// ===== LOAD DATA =====
export async function loadData() {
  pantry = await idbGetAll('pantry');
  recipes = await idbGetAll('recipes');
  shopping = await idbGetAll('shopping');
  const plannerArr = await idbGetAll('planner');
  planner = {};
  plannerArr.forEach(p => planner[p.slot] = p);
}

// ===== UTILITY FUNCTIONS =====
export function normalizeText(text) {
  return String(text || '').trim().toLowerCase();
}

export function parseIngredientLine(line) {
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

export function openModal(modalId) {
  $(modalId).classList.add('active');
}

export function closeModal(modalId) {
  $(modalId).classList.remove('active');
}

export function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');
  $(`tab-${tabName}`).classList.add('active');
}

// ===== IMPORT/EXPORT =====
export function exportAllData() {
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
  a.download = `kitchen-pantrypal-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importAllData() {
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
      
      // Import these from other modules
      const { renderRecipes } = await import('./recipes.js');
      const { renderPantry } = await import('./pantry.js');
      const { renderPlanner } = await import('./planner.js');
      
      renderRecipes();
      renderPantry();
      renderPlanner();
      
      alert('Data imported successfully!');
      
    } catch (err) {
      alert('Error importing data. Please check the file format.');
      console.error(err);
    }
  };
  
  input.click();
}

// ===== INITIALIZATION =====
export async function init() {
  try {
    await openDB();
    await loadData();
    
    // Import and initialize all modules
    const { bindRecipesUI, renderRecipes } = await import('/recipes.js');
    const { bindPantryUI, renderPantry } = await import('/pantry.js');
    const { bindPlannerUI, renderPlanner } = await import('/planner.js');
    
    bindUI();
    bindRecipesUI();
    bindPantryUI();
    bindPlannerUI();
    
    renderRecipes();
    renderPantry();
    renderPlanner();
    
    console.log('Kitchen PantryPal initialized successfully');
  } catch (err) {
    console.error('Initialization error:', err);
  }
}

function bindUI() {
  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

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

// Start the app
init();