import { addGratitude, getGratitudesByDay, deleteGratitude } from './db.js';
import { dayKeyOf } from './utils.js';

const btnGratitude = document.getElementById('btnGratitude');
const gratitudeCountEl = document.getElementById('gratitudeCount');
const modal = document.getElementById('gratitudeModal');
const listEl = document.getElementById('gratitudeList');
const input = document.getElementById('gratitudeInput');
const addBtn = document.getElementById('gratitudeAdd');
const closeBtn = document.getElementById('gratitudeClose');

function todayKey() {
  return dayKeyOf(new Date());
}

async function refreshCount() {
  const items = await getGratitudesByDay(todayKey());
  gratitudeCountEl.textContent = String(items.length);
  return items;
}

function renderList(items) {
  listEl.innerHTML = '';
  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'gratitude-empty';
    empty.textContent = 'עדיין אין הודיות היום';
    listEl.appendChild(empty);
    return;
  }
  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'gratitude-item';
    const span = document.createElement('span');
    span.textContent = item.text;
    const del = document.createElement('button');
    del.textContent = '🗑';
    del.setAttribute('aria-label', 'מחיקת הודיה');
    del.addEventListener('click', async () => {
      await deleteGratitude(item.id);
      const items = await refreshCount();
      renderList(items);
      document.dispatchEvent(new CustomEvent('recording-saved'));
    });
    row.appendChild(span);
    row.appendChild(del);
    listEl.appendChild(row);
  }
}

async function openModal() {
  const items = await refreshCount();
  renderList(items);
  modal.classList.remove('hidden');
  input.value = '';
  input.focus();
}

function closeModal() {
  modal.classList.add('hidden');
}

async function addEntry() {
  const text = input.value.trim();
  if (!text) return;
  await addGratitude(todayKey(), text);
  input.value = '';
  const items = await refreshCount();
  renderList(items);
  document.dispatchEvent(new CustomEvent('recording-saved'));
}

btnGratitude.addEventListener('click', openModal);
closeBtn.addEventListener('click', closeModal);
addBtn.addEventListener('click', addEntry);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addEntry();
});

refreshCount();
