let wakeLock = null;
let refCount = 0;

async function acquire() {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (err) {
    // e.g. blocked by low-power mode — nothing we can do about it
  }
}

// Reference-counted so recording and exercise timers can both hold the lock
// at once without releasing it early when only one of them finishes.
export async function requestWakeLock() {
  refCount += 1;
  if (!wakeLock) await acquire();
}

export function releaseWakeLock() {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0 && wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

// The OS releases the wake lock whenever the page is hidden; re-acquire it
// when the user comes back while something still needs it.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && refCount > 0 && !wakeLock) {
    acquire();
  }
});
