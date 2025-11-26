// ===== Kitchen PantryPal - Recipes Module =====
// This module handles all recipe-related functionality

import { 
  $, pantry, recipes, selectedRecipeId, shopping,
  idbPut, idbDelete, loadData, 
  normalizeText, parseIngredientLine,
  openModal, closeModal
} from 'app.js';

// Make selectedRecipeId mutable
let _selectedRecipeId = null;

export function setSelectedRecipeId(id) {
  _selectedRecipeId = id;
}

export function getSelectedRecipeId() {
  return _selectedRecipeId;
}

// ===== RECIPE MATCHING =====
export function canMakeRecipe(recipe) {
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

// ===== RENDER RECIPES =====
export function renderRecipes() {
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
    if (_selectedRecipeId === recipe.id) item.classList.add('active');
    
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
  _selectedRecipeId = id;
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
      <button class="button small secondary" onclick="window.editRecipe(${recipe.id})">Edit</button>
    </div>
    
    ${recipe.category ? `<div class="small-note" style="margin-bottom:16px;">Category: ${recipe.category}</div>` : ''}
    
    <div style="margin-bottom:20px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
      ${canMake ? 
        '<div class="badge ready" style="font-size:14px; padding:8px 12px;">✓ You can make this recipe!</div>' :
        '<div class="badge missing" style="font-size:14px; padding:8px 12px;">✗ Missing some ingredients</div><button class="button small secondary" onclick="window.addMissingToShopping('+recipe.id+')">→ Shop Missing</button>'
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

// ===== ADD MISSING TO SHOPPING =====
async function addMissingToShopping(recipeId) {
  const recipe = recipes.find(r => r.id === recipeId);
  if (!recipe) return;
  
  let added = 0;
  
  for (const ing of recipe.ingredients || []) {
    const ingName = normalizeText(ing.name);
    if (!ingName) continue;
    
    const inPantry = pantry.find(p => p.available && (
      normalizeText(p.name) === ingName || 
      normalizeText(p.name).includes(ingName) || 
      ingName.includes(normalizeText(p.name))
    ));
    
    if (inPantry) continue;
    
    const inShopping = shopping.find(s => normalizeText(s.name) === ingName);
    if (inShopping) continue;
    
    await idbPut('shopping', { name: ing.name });
    added++;
  }
  
  await loadData();
  
  // Import renderShopping and renderPantry from pantry module
  const { renderShopping, renderPantry } = await import('./pantry.js');
  renderShopping();
  renderPantry();
  
  if (added === 0) {
    alert('All missing items are already in your shopping list!');
  } else {
    alert(`Added ${added} missing ingredient${added > 1 ? 's' : ''} to shopping list!`);
  }
}

// Expose to window for onclick handlers
window.addMissingToShopping = addMissingToShopping;

// ===== RECIPE EDITOR =====
function openRecipeEditor(recipe = null) {
  _selectedRecipeId = recipe ? recipe.id : null;
  
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

// Expose to window for onclick handlers
window.editRecipe = editRecipe;

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
  
  if (_selectedRecipeId) {
    recipe.id = _selectedRecipeId;
  }
  
  await idbPut('recipes', recipe);
  await loadData();
  renderRecipes();
  closeModal('modalRecipeEditor');
  
  if (_selectedRecipeId) {
    displayRecipeDetail(_selectedRecipeId);
  }
}

async function deleteRecipe() {
  if (!_selectedRecipeId) return;
  if (!confirm('Delete this recipe?')) return;
  
  await idbDelete('recipes', _selectedRecipeId);
  _selectedRecipeId = null;
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

// ===== UI BINDINGS =====
export function bindRecipesUI() {
  $('recipeSearch').oninput = renderRecipes;
  $('recipeFilter').onchange = renderRecipes;
  $('btnListAll').onclick = () => { 
    $('recipeSearch').value = ''; 
    $('recipeFilter').value = 'all'; 
    renderRecipes(); 
  };
  $('btnAddRecipe').onclick = () => openRecipeEditor();
  $('btnImportRecipe').onclick = () => openModal('modalImportRecipe');
  $('btnSaveRecipe').onclick = saveRecipe;
  $('btnCancelRecipe').onclick = () => closeModal('modalRecipeEditor');
  $('btnDeleteRecipe').onclick = deleteRecipe;
  $('btnImportRecipeConfirm').onclick = importRecipeJson;
  $('btnCancelImportRecipe').onclick = () => closeModal('modalImportRecipe');
}