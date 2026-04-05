'use strict';

self.addEventListener('install',  ()  => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));

let reminders   = [];
let loopRunning = false;

// ─── Message bus ─────────────────────────────────────────────────────────────
self.addEventListener('message', (e) => {
  if (!e.data) return;
  if (e.data.type === 'SYNC_REMINDERS') {
    reminders = e.data.reminders || [];
    e.waitUntil(ensureLoopRunning());
  }
  if (e.data.type === 'PING') {
    e.waitUntil(Promise.resolve());
  }
});

// ─── Background notification loop ────────────────────────────────────────────
async function ensureLoopRunning() {
  if (loopRunning) return;
  loopRunning = true;
  try   { await runLoop(); }
  finally { loopRunning = false; }
}

async function runLoop() {
  while (hasPending()) {
    const now = Date.now();
    for (const r of reminders) {
      const limit = r.repeat || 3;   // respect per-reminder repeat count
      if (r.time <= now && (r.triggerCount || 0) < limit) {
        await self.registration.showNotification('⏰ ' + r.title, {
          body:             'Tap to open the app',
          vibrate:          [300, 100, 300, 100, 300],
          requireInteraction: true,
          tag:              'r_' + r.id,
          renotify:         true,
          badge:            '/badge.png'
        });
        r.triggerCount = (r.triggerCount || 0) + 1;
        const tabs = await clients.matchAll({ type: 'window' });
        tabs.forEach(t => t.postMessage({ type: 'SPEAK', title: r.title }));
      }
    }
    await sleep(5000);
  }
}

function hasPending() {
  const now = Date.now();
  return reminders.some(r => r.time > now && (r.triggerCount || 0) < (r.repeat || 3));
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Notification click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length) return list[0].focus();
      return clients.openWindow('./');
    })
  );
});
