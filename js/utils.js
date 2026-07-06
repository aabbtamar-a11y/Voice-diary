export const WEEKDAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const WEEKDAY_SHORT = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
export const MONTH_NAMES = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

export function pad2(n) { return String(n).padStart(2, '0'); }

export function dayKeyOf(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${pad2(m)}:${pad2(s)}`;
}

export function formatDurationShort(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  if (m === 0) return `${s} שנ'`;
  return `${m}:${pad2(s)} דק'`;
}

// e.g. "יום שני, 06/07/2026, 14:32"
export function autoTitle(date) {
  const weekday = WEEKDAY_NAMES[date.getDay()];
  const dateStr = `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
  const timeStr = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  return `יום ${weekday}, ${dateStr}, ${timeStr}`;
}

export function dayLevel(totalSeconds) {
  if (totalSeconds >= 300) return 'green';
  if (totalSeconds > 0) return 'yellow';
  return 'red';
}

export function toast(msg, ms = 2200) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), ms);
}
