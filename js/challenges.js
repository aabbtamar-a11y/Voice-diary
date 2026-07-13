import { getChallenge, setChallenge } from './db.js';
import { dayKeyOf, pad2 } from './utils.js';

const TIMER_SECONDS = 3 * 60;

function todayKey() {
  return dayKeyOf(new Date());
}

function playChime(times = 1) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  for (let i = 0; i < times; i++) {
    const start = ctx.currentTime + i * 0.35;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.12, start + 0.05);
    gain.gain.linearRampToValueAtTime(0, start + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.35);
  }
  setTimeout(() => ctx.close(), times * 350 + 200);
}

function formatMinSec(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${pad2(s)}`;
}

// States: idle -> running -> unlocked -> done -> unlocked -> done ...
function setupChallenge(key, card, btn) {
  let state = 'idle';
  let remaining = TIMER_SECONDS;
  let intervalId = null;

  function render() {
    card.classList.toggle('done', state === 'done');
    btn.classList.remove('running', 'unlocked', 'done');
    if (state === 'idle') {
      btn.textContent = `▶ ${formatMinSec(TIMER_SECONDS)}`;
    } else if (state === 'running') {
      btn.classList.add('running');
      btn.textContent = `⏹ ${formatMinSec(remaining)}`;
    } else if (state === 'unlocked') {
      btn.classList.add('unlocked');
      btn.textContent = '✓ סמני';
    } else if (state === 'done') {
      btn.classList.add('done');
      btn.textContent = '✓ בוצע!';
    }
  }

  function stopTimer() {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
  }

  function startTimer() {
    remaining = TIMER_SECONDS;
    state = 'running';
    render();
    intervalId = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        stopTimer();
        state = 'unlocked';
        render();
        playChime(2);
      } else {
        render();
        if (remaining % 60 === 0) playChime(1);
      }
    }, 1000);
  }

  btn.addEventListener('click', async () => {
    if (state === 'idle') {
      startTimer();
    } else if (state === 'running') {
      stopTimer();
      state = 'idle';
      render();
    } else if (state === 'unlocked') {
      state = 'done';
      render();
      await setChallenge(todayKey(), { [key]: true });
      document.dispatchEvent(new CustomEvent('recording-saved'));
    } else if (state === 'done') {
      state = 'unlocked';
      render();
      await setChallenge(todayKey(), { [key]: false });
      document.dispatchEvent(new CustomEvent('recording-saved'));
    }
  });

  return {
    async init() {
      const today = await getChallenge(todayKey());
      state = today[key] ? 'done' : 'idle';
      render();
    },
  };
}

const eyesController = setupChallenge('eye', document.getElementById('cardEyes'), document.getElementById('btnEyes'));
const fitnessController = setupChallenge('fitness', document.getElementById('cardFitness'), document.getElementById('btnFitness'));

eyesController.init();
fitnessController.init();
