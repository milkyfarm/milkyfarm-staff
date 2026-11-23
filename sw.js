// ミルキーファーム お知らせ（社員アプリ）の service worker（2026-11-19）
// 母艦（Python）から届いた Web プッシュを通知に出し、この端末の「お知らせ」の履歴（IndexedDB）にも残す。
const DB = 'mf-staff', STORE = 'notes';

function db() {
  return new Promise((ok, ng) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ng(r.error);
  });
}

async function keep(n) {
  const d = await db();
  await new Promise((ok) => { const t = d.transaction(STORE, 'readwrite'); t.objectStore(STORE).add(n); t.oncomplete = ok; t.onerror = ok; });
  const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  cs.forEach((c) => c.postMessage({ type: 'new' }));
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch (err) { p = { body: e.data ? e.data.text() : '' }; }
  const n = { title: p.title || 'ミルキーファーム', body: p.body || '', url: p.url || './', at: Date.now() };
  e.waitUntil(Promise.all([
    keep(n),
    self.registration.showNotification(n.title, { body: n.body, icon: 'icon-192.png', badge: 'icon-192.png', data: { url: n.url }, tag: p.tag || undefined }),
  ]));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // 2026-11-23 開いている画面は ?k= 付きで url と一致せず、iPhone では前の画面のまま出ていた → どの画面にも「読み直して」と伝えて前に出す
    const here = new URL(url).pathname;
    for (const c of cs) { if ('focus' in c && new URL(c.url).pathname === here) { c.postMessage({ type: 'open', url }); return c.focus(); } }
    return self.clients.openWindow(url);
  })());
});
