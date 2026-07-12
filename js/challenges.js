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
        playChime();
      } else {
        render();
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
