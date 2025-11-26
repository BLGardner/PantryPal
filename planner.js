// ===== Kitchen PantryPal - Weekly Planner Module =====
// This module handles the weekly meal planner

import { 
  $, recipes, planner,
  idbPut, idbDelete, idbClear, loadData,
  normalizeText,
  openModal, closeModal
} from 'app.js';

import { canMakeRecipe } from 'recipes.js';

// Local state
let currentPlanSlot = null;

// ===== WEEK CALCULATION =====
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

// ===== RENDER PLANNER =====
export function renderPlanner() {
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

// ===== PLAN MEAL MODAL =====
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

// ===== UI BINDINGS =====
export function bindPlannerUI() {
  $('btnClearPlanner').onclick = clearPlanner;
  $('btnConfirmPlanMeal').onclick = confirmPlanMeal;
  $('btnCancelPlanMeal').onclick = () => closeModal('modalPlanMeal');
  $('btnRemovePlanMeal').onclick = removePlannedMealFromModal;
  $('planMealSearch').oninput = filterPlanMealList;
}