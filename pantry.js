// ===== Kitchen PantryPal - Pantry & Shopping Module =====
// This module handles pantry items and shopping list

import { 
  $, pantry, shopping,
  idbPut, idbDelete, idbClear, loadData, 
  normalizeText,
  openModal, closeModal
} from 'app.js';

import { renderRecipes } from 'recipes.js';

// Local state for editing
let editingPantryId = null;

// ===== RENDER PANTRY =====
export function renderPantry() {
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

// ===== PANTRY CRUD =====
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

// ===== RENDER SHOPPING =====
export function renderShopping() {
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

// ===== SHOPPING CRUD =====
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

// ===== UI BINDINGS =====
export function bindPantryUI() {
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
}