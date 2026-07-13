import { getChallenge, setChallenge } from './db.js';
import { dayKeyOf, pad2 } from './utils.js';
import { requestWakeLock, releaseWakeLock } from './wakeLock.js';

const TIMER_SECONDS = 3 * 60;

function todayKey() {
  return dayKeyOf(new Date());
}

// Created lazily inside a real click handler (a user gesture) so iOS/Safari
// allows it to play later from setInterval callbacks too. Reused across
// both challenges and every chime instead of making a fresh context per beep.
let sharedAudioCtx = null;

function unlockAudio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  if (!sharedAudioCtx) sharedAudioCtx = new AudioCtx();
  if (sharedAudioCtx.state === 'suspended') sharedAudioCtx.resume();
  // Play a near-silent blip right now, inside the click gesture — some iOS
  // versions only fully unlock audio once a sound has actually started,
  // not just when the context is created/resumed.
  const osc = sharedAudioCtx.createOscillator();
  const gain = sharedAudioCtx.createGain();
  gain.gain.value = 0.0001;
  osc.connect(gain);
  gain.connect(sharedAudioCtx.destination);
  osc.start();
  osc.stop(sharedAudioCtx.currentTime + 0.01);
}

function playChime(times = 1) {
  const ctx = sharedAudioCtx;
  if (!ctx) return;
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
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      releaseWakeLock();
    }
  }

  function startTimer() {
    unlockAudio();
    remaining = TIMER_SECONDS;
    state = 'running';
    render();
    requestWakeLock();
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
