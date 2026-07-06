import { getAllRecordings } from './db.js';
import { createRecItemElement } from './recItem.js';

const allList = document.getElementById('allList');
const emptyList = document.getElementById('emptyList');

export async function renderListView() {
  const recs = await getAllRecordings();
  allList.innerHTML = '';
  if (recs.length === 0) {
    emptyList.classList.remove('hidden');
    return;
  }
  emptyList.classList.add('hidden');
  for (const rec of recs) {
    allList.appendChild(createRecItemElement(rec));
  }
}
