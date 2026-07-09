import { getDailyTotals, getRecordingsByDay } from './db.js';
import { createRecItemElement } from './recItem.js';
import {
  WEEKDAY_NAMES, WEEKDAY_SHORT, MONTH_NAMES,
  dayKeyOf, pad2, formatDurationShort, dayLevel,
} from './utils.js';

const calModeMonth = document.getElementById('calModeMonth');
const calModeWeek = document.getElementById('calModeWeek');
const calPrev = document.getElementById('calPrev');
const calNext = document.getElementById('calNext');
const calLabel = document.getElementById('calLabel');
const calGrid = document.getElementById('calGrid');

const dayDetail = document.getElementById('dayDetail');
const dayDetailTitle = document.getElementById('dayDetailTitle');
const dayDetailSummary = document.getElementById('dayDetailSummary');
const dayDetailList = document.getElementById('dayDetailList');
const dayDetailClose = document.getElementById('dayDetailClose');
const dayDetailPrev = document.getElementById('dayDetailPrev');
const dayDetailNext = document.getElementById('dayDetailNext');

let mode = 'month';
let anchorDate = new Date();
let selectedDate = null;

function startOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

async function render() {
  const totals = await getDailyTotals();
  if (mode === 'month') renderMonth(totals);
  else renderWeek(totals);
}

function renderMonth(totals) {
  calGrid.className = 'cal-grid';
  calLabel.textContent = `${MONTH_NAMES[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`;

  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = firstDay.getDay();

  calGrid.innerHTML = '';
  for (const label of WEEKDAY_SHORT) {
    const wd = document.createElement('div');
    wd.className = 'cal-weekday-label';
    wd.textContent = label;
    calGrid.appendChild(wd);
  }

  for (let i = 0; i < leadingBlanks; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day empty';
    calGrid.appendChild(empty);
  }

  const today = dayKeyOf(new Date());
  const selectedKey = selectedDate ? dayKeyOf(selectedDate) : null;

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const key = dayKeyOf(date);
    const total = totals[key] || 0;
    const cell = document.createElement('button');
    cell.className = `cal-day ${dayLevel(total)}`;
    if (key === today) cell.classList.add('today');
    if (key === selectedKey) cell.classList.add('selected');
    cell.textContent = String(day);
    cell.addEventListener('click', () => openDayDetail(date));
    calGrid.appendChild(cell);
  }
}

function renderWeek(totals) {
  calGrid.className = 'cal-grid week-row';
  const start = startOfWeek(anchorDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  calLabel.textContent = `${pad2(start.getDate())}/${pad2(start.getMonth() + 1)} - ${pad2(end.getDate())}/${pad2(end.getMonth() + 1)}`;

  calGrid.innerHTML = '';
  const today = dayKeyOf(new Date());
  const selectedKey = selectedDate ? dayKeyOf(selectedDate) : null;

  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = dayKeyOf(date);
    const total = totals[key] || 0;
    const level = dayLevel(total);

    const card = document.createElement('div');
    card.className = 'week-day-card';
    if (key === today) card.classList.add('today');
    if (key === selectedKey) card.classList.add('selected');

    const bar = document.createElement('div');
    bar.className = `bar ${level}`;

    const info = document.createElement('div');
    info.className = 'info';
    const name = document.createElement('div');
    name.className = 'wd-name';
    name.textContent = WEEKDAY_NAMES[date.getDay()];
    const dateEl = document.createElement('div');
    dateEl.className = 'wd-date';
    dateEl.textContent = `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
    info.appendChild(name);
    info.appendChild(dateEl);

    const totalEl = document.createElement('div');
    totalEl.className = 'wd-total';
    totalEl.textContent = total > 0 ? formatDurationShort(total) : 'לא הוקלט';

    card.appendChild(bar);
    card.appendChild(info);
    card.appendChild(totalEl);
    card.addEventListener('click', () => openDayDetail(date));
    calGrid.appendChild(card);
  }
}

async function renderSheetBody(date) {
  const key = dayKeyOf(date);
  const recs = await getRecordingsByDay(key);
  const total = recs.reduce((sum, r) => sum + r.durationSec, 0);

  dayDetailTitle.textContent = `יום ${WEEKDAY_NAMES[date.getDay()]}, ${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
  dayDetailSummary.textContent = recs.length
    ? `סה"כ ${formatDurationShort(total)} · ${recs.length} הקלטות`
    : 'לא הוקלט ביום הזה';

  dayDetailList.innerHTML = '';
  for (const rec of recs) {
    dayDetailList.appendChild(createRecItemElement(rec));
  }
}

async function openDayDetail(date) {
  selectedDate = date;
  render();
  await renderSheetBody(date);
  dayDetail.classList.remove('hidden');
}

async function navigateDay(delta) {
  if (!selectedDate) return;
  const newDate = new Date(selectedDate);
  newDate.setDate(newDate.getDate() + delta);
  selectedDate = newDate;
  anchorDate = new Date(newDate);
  render();
  await renderSheetBody(newDate);
}

function closeDayDetail() {
  dayDetail.classList.add('hidden');
}

calModeMonth.addEventListener('click', () => {
  mode = 'month';
  calModeMonth.classList.add('active');
  calModeWeek.classList.remove('active');
  render();
});
calModeWeek.addEventListener('click', () => {
  mode = 'week';
  calModeWeek.classList.add('active');
  calModeMonth.classList.remove('active');
  render();
});
calPrev.addEventListener('click', () => {
  if (mode === 'month') anchorDate.setMonth(anchorDate.getMonth() - 1);
  else anchorDate.setDate(anchorDate.getDate() - 7);
  anchorDate = new Date(anchorDate);
  render();
});
calNext.addEventListener('click', () => {
  if (mode === 'month') anchorDate.setMonth(anchorDate.getMonth() + 1);
  else anchorDate.setDate(anchorDate.getDate() + 7);
  anchorDate = new Date(anchorDate);
  render();
});
dayDetailClose.addEventListener('click', closeDayDetail);
dayDetail.querySelector('.sheet-backdrop').addEventListener('click', closeDayDetail);
dayDetailPrev.addEventListener('click', () => navigateDay(-1));
dayDetailNext.addEventListener('click', () => navigateDay(1));

document.addEventListener('recording-saved', () => {
  if (selectedDate && !dayDetail.classList.contains('hidden')) {
    renderSheetBody(selectedDate);
  }
});

export function initCalendarView() {
  render();
}

export function refreshCalendarView() {
  render();
}
