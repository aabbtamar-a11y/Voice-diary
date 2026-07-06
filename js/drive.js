import { GOOGLE_CLIENT_ID, DRIVE_FOLDER_NAME } from './config.js';

let tokenClient = null;
let accessToken = null;
let tokenExpiry = 0;

function waitForGoogle(timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function poll() {
      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        reject(new Error('Google Identity Services לא נטען'));
      } else {
        setTimeout(poll, 100);
      }
    })();
  });
}

async function ensureTokenClient() {
  if (tokenClient) return tokenClient;
  await waitForGoogle();
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: () => {},
  });
  return tokenClient;
}

async function requestToken() {
  const client = await ensureTokenClient();
  return new Promise((resolve, reject) => {
    client.callback = (resp) => {
      if (resp.error) { reject(resp); return; }
      accessToken = resp.access_token;
      tokenExpiry = Date.now() + (resp.expires_in * 1000) - 60000;
      resolve(accessToken);
    };
    client.error_callback = (err) => reject(err);
    client.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
  });
}

async function getToken() {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;
  return requestToken();
}

async function getOrCreateFolder(token) {
  const cached = localStorage.getItem('driveFolderId');
  if (cached) return cached;

  const q = encodeURIComponent(
    `name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const searchJson = await searchRes.json();
  if (searchJson.files && searchJson.files.length) {
    localStorage.setItem('driveFolderId', searchJson.files[0].id);
    return searchJson.files[0].id;
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  if (!createRes.ok) throw new Error('יצירת תיקיה ב-Drive נכשלה');
  const createJson = await createRes.json();
  localStorage.setItem('driveFolderId', createJson.id);
  return createJson.id;
}

async function uploadFile(token, folderId, filename, blob, mimeType) {
  const metadata = { name: filename, parents: [folderId] };
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const metaPart = delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata);
  const mediaPartHeader = delimiter + `Content-Type: ${mimeType}\r\n\r\n`;

  const arrayBuffer = await blob.arrayBuffer();
  const body = new Blob([
    new TextEncoder().encode(metaPart),
    new TextEncoder().encode(mediaPartHeader),
    arrayBuffer,
    new TextEncoder().encode(closeDelim),
  ]);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error('העלאה ל-Drive נכשלה: ' + errText);
  }
  return res.json();
}

function safeFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, '');
}

function extensionFor(mimeType) {
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'audio';
}

export async function uploadRecording(rec) {
  if (GOOGLE_CLIENT_ID.startsWith('YOUR_CLIENT_ID')) {
    throw new Error('יש להגדיר קודם Google Client ID בקובץ js/config.js (ראו SETUP.md)');
  }
  const token = await getToken();
  const folderId = await getOrCreateFolder(token);
  const ext = extensionFor(rec.mimeType);
  const filename = safeFilename(`${rec.title}${rec.notes ? ' - ' + rec.notes : ''}.${ext}`);
  const result = await uploadFile(token, folderId, filename, rec.blob, rec.mimeType);
  return {
    fileId: result.id,
    webViewLink: result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`,
  };
}
