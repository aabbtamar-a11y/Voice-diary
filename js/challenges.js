import { getChallenge, setChallenge } from './db.js';
import { dayKeyOf } from './utils.js';

const toggleEyes = document.getElementById('toggleEyes');
const toggleFitness = document.getElementById('toggleFitness');

function todayKey() {
  return dayKeyOf(new Date());
}

function renderToggle(btn, active) {
  btn.classList.toggle('active', active);
}

async function init() {
  const today = await getChallenge(todayKey());
  renderToggle(toggleEyes, today.eye);
  renderToggle(toggleFitness, today.fitness);
}

toggleEyes.addEventListener('click', async () => {
  const key = todayKey();
  const current = await getChallenge(key);
  const updated = await setChallenge(key, { eye: !current.eye });
  renderToggle(toggleEyes, updated.eye);
  document.dispatchEvent(new CustomEvent('recording-saved'));
});

toggleFitness.addEventListener('click', async () => {
  const key = todayKey();
  const current = await getChallenge(key);
  const updated = await setChallenge(key, { fitness: !current.fitness });
  renderToggle(toggleFitness, updated.fitness);
  document.dispatchEvent(new CustomEvent('recording-saved'));
});

init();
