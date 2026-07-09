import { updateRecording, deleteRecording } from './db.js';
import { uploadRecording } from './drive.js';
import { trimAudioBlob } from './trim.js';
import { formatDurationShort, toast } from './utils.js';

export function createRecItemElement(rec) {
  const el = document.createElement('div');
  el.className = 'rec-item';

  const header = document.createElement('div');
  header.className = 'rec-item-header';

  const title = document.createElement('div');
  title.className = 'rec-title';
  title.textContent = rec.title;

  const duration = document.createElement('div');
  duration.className = 'rec-duration';
  duration.textContent = formatDurationShort(rec.durationSec);

  header.appendChild(title);
  header.appendChild(duration);

  const notes = document.createElement('input');
  notes.className = 'rec-notes';
  notes.type = 'text';
  notes.placeholder = 'כותרת / הערה';
  notes.value = rec.notes || '';
  let saveTimer = null;
  notes.addEventListener('input', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      rec.notes = notes.value.trim();
      await updateRecording(rec.id, { notes: rec.notes });
    }, 500);
  });

  const controls = document.createElement('div');
  controls.className = 'rec-controls';

  const audio = document.createElement('audio');
  audio.controls = true;
  audio.src = URL.createObjectURL(rec.blob);
  audio.preload = 'none';

  const uploadBtn = document.createElement('button');
  uploadBtn.className = 'btn-upload';
  renderUploadBtn(uploadBtn, rec);

  uploadBtn.addEventListener('click', async (ev) => {
    if (rec.uploaded) {
      if (rec.driveLink) window.open(rec.driveLink, '_blank');
      return;
    }
    uploadBtn.textContent = 'מעלה…';
    uploadBtn.className = 'btn-upload uploading';
    uploadBtn.disabled = true;
    try {
      const { fileId, webViewLink } = await uploadRecording(rec);
      rec.uploaded = true;
      rec.driveFileId = fileId;
      rec.driveLink = webViewLink;
      await updateRecording(rec.id, { uploaded: true, driveFileId: fileId, driveLink: webViewLink });
      renderUploadBtn(uploadBtn, rec);
      toast('הועלה לדרייב ✓');
    } catch (err) {
      console.error(err);
      uploadBtn.textContent = 'שגיאה, נסי שוב';
      uploadBtn.className = 'btn-upload';
      uploadBtn.disabled = false;
      toast('ההעלאה נכשלה');
    }
  });

  const trimBtn = document.createElement('button');
  trimBtn.className = 'btn-trim';
  trimBtn.textContent = '✂️';
  trimBtn.setAttribute('aria-label', 'חיתוך הקלטה');

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-delete';
  deleteBtn.textContent = '🗑';
  deleteBtn.setAttribute('aria-label', 'מחיקת הקלטה');
  deleteBtn.addEventListener('click', async () => {
    const ok = window.confirm(`למחוק את ההקלטה "${rec.title}"? לא ניתן לשחזר.`);
    if (!ok) return;
    await deleteRecording(rec.id);
    URL.revokeObjectURL(audio.src);
    el.remove();
    toast('ההקלטה נמחקה');
    document.dispatchEvent(new CustomEvent('recording-saved'));
  });

  controls.appendChild(audio);
  controls.appendChild(uploadBtn);
  controls.appendChild(trimBtn);
  controls.appendChild(deleteBtn);

  const trimPanel = document.createElement('div');
  trimPanel.className = 'trim-panel hidden';

  const startRow = document.createElement('div');
  startRow.className = 'trim-row';
  const startLabel = document.createElement('label');
  startLabel.textContent = 'שמרי מ־(שנ׳)';
  const startInput = document.createElement('input');
  startInput.type = 'number';
  startInput.min = '0';
  startInput.step = '1';
  startInput.value = '0';
  startRow.appendChild(startLabel);
  startRow.appendChild(startInput);

  const endRow = document.createElement('div');
  endRow.className = 'trim-row';
  const endLabel = document.createElement('label');
  endLabel.textContent = 'עד־(שנ׳)';
  const endInput = document.createElement('input');
  endInput.type = 'number';
  endInput.min = '0';
  endInput.step = '1';
  endInput.value = String(rec.durationSec);
  endRow.appendChild(endLabel);
  endRow.appendChild(endInput);

  const trimActions = document.createElement('div');
  trimActions.className = 'trim-actions';
  const trimApplyBtn = document.createElement('button');
  trimApplyBtn.className = 'btn-primary';
  trimApplyBtn.textContent = 'בצע חיתוך';
  const trimCancelBtn = document.createElement('button');
  trimCancelBtn.className = 'btn-secondary';
  trimCancelBtn.textContent = 'ביטול';
  trimActions.appendChild(trimApplyBtn);
  trimActions.appendChild(trimCancelBtn);

  trimPanel.appendChild(startRow);
  trimPanel.appendChild(endRow);
  trimPanel.appendChild(trimActions);

  trimBtn.addEventListener('click', () => {
    startInput.value = '0';
    endInput.value = String(Math.round(rec.durationSec));
    trimPanel.classList.toggle('hidden');
  });
  trimCancelBtn.addEventListener('click', () => {
    trimPanel.classList.add('hidden');
  });
  trimApplyBtn.addEventListener('click', async () => {
    const startSec = Number(startInput.value);
    const endSec = Number(endInput.value);
    if (!(startSec >= 0) || !(endSec > startSec) || endSec > rec.durationSec + 1) {
      toast('טווח לא תקין');
      return;
    }
    trimApplyBtn.disabled = true;
    trimApplyBtn.textContent = 'חותכת…';
    try {
      const { blob: newBlob, durationSec: newDuration } = await trimAudioBlob(rec.blob, startSec, endSec);
      rec.blob = newBlob;
      rec.durationSec = newDuration;
      rec.mimeType = 'audio/wav';
      rec.uploaded = false;
      rec.driveFileId = null;
      rec.driveLink = null;
      await updateRecording(rec.id, {
        blob: newBlob,
        durationSec: newDuration,
        mimeType: 'audio/wav',
        uploaded: false,
        driveFileId: null,
        driveLink: null,
      });

      URL.revokeObjectURL(audio.src);
      audio.src = URL.createObjectURL(newBlob);
      duration.textContent = formatDurationShort(newDuration);
      renderUploadBtn(uploadBtn, rec);
      trimPanel.classList.add('hidden');
      toast('ההקלטה נחתכה ✓');
      document.dispatchEvent(new CustomEvent('recording-saved'));
    } catch (err) {
      console.error(err);
      toast('החיתוך נכשל');
    } finally {
      trimApplyBtn.disabled = false;
      trimApplyBtn.textContent = 'בצע חיתוך';
    }
  });

  el.appendChild(header);
  el.appendChild(notes);
  el.appendChild(controls);
  el.appendChild(trimPanel);

  return el;
}

function renderUploadBtn(btn, rec) {
  btn.disabled = false;
  if (rec.uploaded) {
    btn.className = 'btn-upload uploaded';
    btn.textContent = '✓ פתח בדרייב';
  } else {
    btn.className = 'btn-upload';
    btn.textContent = 'העלה לדרייב';
  }
}
