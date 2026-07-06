import { updateRecording } from './db.js';
import { uploadRecording } from './drive.js';
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

  controls.appendChild(audio);
  controls.appendChild(uploadBtn);

  el.appendChild(header);
  el.appendChild(notes);
  el.appendChild(controls);

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
