import './recorder.js';
import './challenges.js';
import './gratitude.js';
import { initCalendarView, refreshCalendarView } from './calendarView.js';
import { renderListView } from './listView.js';

const tabs = document.querySelectorAll('.tab');
const views = document.querySelectorAll('.view');
const pageTitle = document.getElementById('pageTitle');

const TITLES = { record: 'הקלטה', calendar: 'לוח שנה', list: 'כל ההקלטות' };

function switchView(name) {
  tabs.forEach((t) => t.classList.toggle('active', t.dataset.view === name));
  views.forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
  pageTitle.textContent = TITLES[name];
  if (name === 'calendar') refreshCalendarView();
  if (name === 'list') renderListView();
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => switchView(tab.dataset.view));
});

document.addEventListener('recording-saved', () => {
  refreshCalendarView();
  renderListView();
});

initCalendarView();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
