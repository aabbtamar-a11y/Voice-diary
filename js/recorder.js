import { addRecording } from './db.js';
import { dayKeyOf, formatClock, autoTitle, toast } from './utils.js';

const btnRecord = document.getElementById('btnRecord');
const btnPause = document.getElementById('btnPause');
const btnStop = document.getElementById('btnStop');
const activeControls = document.getElementById('activeControls');
const timerDisplay = document.getElementById('timerDisplay');
const statusLine = document.getElementById('statusLine');

const postSave = document.getElementById('postSave');
const postSaveTitle = document.getElementById('postSaveTitle');
const postSaveNotes = document.getElementById('postSaveNotes');
const postSaveDone = document.getElementById('postSaveDone');

let mediaRecorder = null;
let chunks = [];
let stream = null;
let state = 'idle'; // idle | recording | paused
let accumulatedMs = 0;
let segmentStart = 0;
let tickHandle = null;
let recordStartDate = null;
let pendingRecordId = null;

function pickMimeType() {
  const candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];
  for (const c of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return '';
}

function currentElapsedMs() {
  if (state === 'recording') return accumulatedMs + (Date.now() - segmentStart);
  return accumulatedMs;
}

function renderTimer() {
  timerDisplay.textContent = formatClock(currentElapsedMs() / 1000);
}

function startTicking() {
  stopTicking();
  tickHandle = setInterval(renderTimer, 250);
}
function stopTicking() {
  if (tickHandle) clearInterval(tickHandle);
  tickHandle = null;
}

async function startRecording() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    toast('אין גישה למיקרופון');
    return;
  }
  chunks = [];
  const mimeType = pickMimeType();
  mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  mediaRecorder.onstop = onRecorderStop;
  mediaRecorder.start();

  recordStartDate = new Date();
  accumulatedMs = 0;
  segmentStart = Date.now();
  state = 'recording';

  btnRecord.classList.add('recording');
  activeControls.classList.remove('hidden');
  btnPause.textContent = 'השהה';
  statusLine.textContent = 'מקליטה…';
  startTicking();
  renderTimer();
}

function pauseOrResume() {
  if (state === 'recording') {
    mediaRecorder.pause();
    accumulatedMs += Date.now() - segmentStart;
    state = 'paused';
    stopTicking();
    renderTimer();
    btnPause.textContent = 'המשך';
    statusLine.textContent = 'בהשהיה';
    btnRecord.classList.remove('recording');
  } else if (state === 'paused') {
    mediaRecorder.resume();
    segmentStart = Date.now();
    state = 'recording';
    startTicking();
    btnPause.textContent = 'השהה';
    statusLine.textContent = 'מקליטה…';
    btnRecord.classList.add('recording');
  }
}

function stopRecording() {
  if (state === 'idle') return;
  if (state === 'recording') {
    accumulatedMs += Date.now() - segmentStart;
  }
  stopTicking();
  mediaRecorder.stop();
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
  }
}

async function onRecorderStop() {
  const durationSec = Math.round(accumulatedMs / 1000);
  const mimeType = mediaRecorder.mimeType || 'audio/webm';
  const blob = new Blob(chunks, { type: mimeType });

  const date = recordStartDate;
  const rec = {
    timestamp: date.getTime(),
    dayKey: dayKeyOf(date),
    title: autoTitle(date),
    notes: '',
    durationSec,
    mimeType,
    blob,
    uploaded: false,
    driveFileId: null,
    driveLink: null,
  };

  if (durationSec < 1) {
    resetToIdle();
    toast('ההקלטה קצרה מדי, לא נשמרה');
    return;
  }

  const id = await addRecording(rec);
  pendingRecordId = id;

  resetToIdle();
  document.dispatchEvent(new CustomEvent('recording-saved'));

  postSaveTitle.textContent = rec.title;
  postSaveNotes.value = '';
  postSave.classList.remove('hidden');
  postSaveNotes.focus();
}

function resetToIdle() {
  state = 'idle';
  accumulatedMs = 0;
  timerDisplay.textContent = '00:00';
  statusLine.textContent = 'מוכנה להקליט';
  btnRecord.classList.remove('recording');
  activeControls.classList.add('hidden');
  mediaRecorder = null;
  chunks = [];
}

btnRecord.addEventListener('click', () => {
  if (state === 'idle') startRecording();
});
btnPause.addEventListener('click', pauseOrResume);
btnStop.addEventListener('click', stopRecording);

postSaveDone.addEventListener('click', async () => {
  const { updateRecording } = await import('./db.js');
  const notes = postSaveNotes.value.trim();
  if (pendingRecordId != null && notes) {
    await updateRecording(pendingRecordId, { notes });
    document.dispatchEvent(new CustomEvent('recording-saved'));
  }
  pendingRecordId = null;
  postSave.classList.add('hidden');
});
