import { getChallenge, setChallenge } from './db.js';
import { dayKeyOf, pad2 } from './utils.js';

const TIMER_SECONDS = 5 * 60;

function todayKey() {
  return dayKeyOf(new Date());
}

function playChime() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.08);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.9);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.95);
  osc.onended = () => ctx.close();
}

function formatMinSec(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${pad2(s)}`;
}

function setupChallenge(key, switchBtn, timerBtn) {
  let remaining = TIMER_SECONDS;
  let intervalId = null;
  let unlockedToday = false;

  function renderIdle() {
    timerBtn.textContent = '▶ הפעילי טיימר 5 דק׳';
    timerBtn.disabled = false;
    timerBtn.classList.remove('hidden');
  }

  function renderRunning() {
    timerBtn.textContent = `⏱ ${formatMinSec(remaining)}`;
    timerBtn.disabled = true;
  }

  function renderUnlocked() {
    timerBtn.classList.add('hidden');
  }

  function lockSwitch(locked) {
    switchBtn.disabled = locked;
  }

  function unlock() {
    unlockedToday = true;
    lockSwitch(false);
    renderUnlocked();
  }

  function startTimer() {
    if (intervalId) return;
    remaining = TIMER_SECONDS;
    renderRunning();
    intervalId = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(intervalId);
        intervalId = null;
        unlock();
        playChime();
      } else {
        renderRunning();
      }
    }, 1000);
  }

  timerBtn.addEventListener('click', startTimer);

  switchBtn.addEventListener('click', async () => {
    const isActive = switchBtn.classList.toggle('active');
    await setChallenge(todayKey(), { [key]: isActive });
    document.dispatchEvent(new CustomEvent('recording-saved'));
  });

  return {
    async init() {
      const today = await getChallenge(todayKey());
      const done = !!today[key];
      switchBtn.classList.toggle('active', done);
      if (done) {
        unlock();
      } else {
        lockSwitch(true);
        renderIdle();
      }
    },
  };
}

const eyesController = setupChallenge(
  'eye',
  document.getElementById('switchEyes'),
  document.getElementById('timerEyes')
);
const fitnessController = setupChallenge(
  'fitness',
  document.getElementById('switchFitness'),
  document.getElementById('timerFitness')
);

eyesController.init();
fitnessController.init();
