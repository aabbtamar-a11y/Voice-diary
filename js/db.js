const DB_NAME = 'voiceDiaryDB';
const DB_VERSION = 3;
const STORE = 'recordings';
const CHALLENGES_STORE = 'challenges';
const GRATITUDE_STORE = 'gratitudes';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('dayKey', 'dayKey', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains(CHALLENGES_STORE)) {
        db.createObjectStore(CHALLENGES_STORE, { keyPath: 'dayKey' });
      }
      if (!db.objectStoreNames.contains(GRATITUDE_STORE)) {
        const store = db.createObjectStore(GRATITUDE_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('dayKey', 'dayKey', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function withStore(mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const result = fn(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}

export function addRecording(rec) {
  return new Promise(async (resolve, reject) => {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.add(rec);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllRecordings() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => b.timestamp - a.timestamp));
    req.onerror = () => reject(req.error);
  });
}

export async function getRecordingsByDay(dayKey) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const idx = store.index('dayKey');
    const req = idx.getAll(dayKey);
    req.onsuccess = () => resolve(req.result.sort((a, b) => a.timestamp - b.timestamp));
    req.onerror = () => reject(req.error);
  });
}

// Returns a map: dayKey -> total seconds recorded that day
export async function getDailyTotals() {
  const all = await getAllRecordings();
  const totals = {};
  for (const r of all) {
    totals[r.dayKey] = (totals[r.dayKey] || 0) + r.durationSec;
  }
  return totals;
}

export async function updateRecording(id, changes) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const rec = getReq.result;
      if (!rec) { reject(new Error('not found')); return; }
      Object.assign(rec, changes);
      const putReq = store.put(rec);
      putReq.onsuccess = () => resolve(rec);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function getRecording(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteRecording(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getChallenge(dayKey) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHALLENGES_STORE, 'readonly');
    const req = tx.objectStore(CHALLENGES_STORE).get(dayKey);
    req.onsuccess = () => resolve(req.result || { dayKey, eye: false, fitness: false });
    req.onerror = () => reject(req.error);
  });
}

export async function setChallenge(dayKey, changes) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHALLENGES_STORE, 'readwrite');
    const store = tx.objectStore(CHALLENGES_STORE);
    const getReq = store.get(dayKey);
    getReq.onsuccess = () => {
      const current = getReq.result || { dayKey, eye: false, fitness: false };
      const updated = { ...current, ...changes };
      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve(updated);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

// Returns a map: dayKey -> { eye, fitness }
export async function getAllChallenges() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHALLENGES_STORE, 'readonly');
    const req = tx.objectStore(CHALLENGES_STORE).getAll();
    req.onsuccess = () => {
      const map = {};
      for (const c of req.result) map[c.dayKey] = c;
      resolve(map);
    };
    req.onerror = () => reject(req.error);
  });
}

export function addGratitude(dayKey, text) {
  return new Promise(async (resolve, reject) => {
    const db = await openDB();
    const tx = db.transaction(GRATITUDE_STORE, 'readwrite');
    const req = tx.objectStore(GRATITUDE_STORE).add({ dayKey, text, timestamp: Date.now() });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getGratitudesByDay(dayKey) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(GRATITUDE_STORE, 'readonly');
    const idx = tx.objectStore(GRATITUDE_STORE).index('dayKey');
    const req = idx.getAll(dayKey);
    req.onsuccess = () => resolve(req.result.sort((a, b) => a.timestamp - b.timestamp));
    req.onerror = () => reject(req.error);
  });
}

export async function deleteGratitude(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(GRATITUDE_STORE, 'readwrite');
    const req = tx.objectStore(GRATITUDE_STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Returns a map: dayKey -> gratitude count
export async function getAllGratitudeCounts() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(GRATITUDE_STORE, 'readonly');
    const req = tx.objectStore(GRATITUDE_STORE).getAll();
    req.onsuccess = () => {
      const counts = {};
      for (const g of req.result) counts[g.dayKey] = (counts[g.dayKey] || 0) + 1;
      resolve(counts);
    };
    req.onerror = () => reject(req.error);
  });
}
