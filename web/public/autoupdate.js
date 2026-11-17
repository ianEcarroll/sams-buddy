// Keeps an installed app up to date. On an iPad the app is put to sleep and woken again, never reloaded, so it
// keeps running the old code for days. This checks the app's own files when the app comes back to the front
// (and every 10 minutes while it is open). If they changed, it reloads: straight away when nothing is in
// progress, otherwise as soon as the person is back at a quiet screen.
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16) + s.length; };

export function watchForUpdates({ files, busy = () => false }) {
  const signature = async () => {
    const parts = await Promise.all(files.map(async (f) => { const r = await fetch(f, { cache: 'no-store' }); if (!r.ok) throw new Error(f); return hash(await r.text()); }));
    return parts.join('|');
  };
  let loaded = null;
  let waiting = false;
  const reloadWhenQuiet = () => {
    if (waiting) return;
    waiting = true;
    const t = setInterval(() => { if (!busy()) { clearInterval(t); location.reload(); } }, 3000);
  };
  const check = async () => {
    if (waiting || !navigator.onLine) return;
    try {
      const now = await signature();
      if (loaded == null) { loaded = now; return; }
      if (now !== loaded) busy() ? reloadWhenQuiet() : location.reload();
    } catch { /* offline or a blip: try again later */ }
  };
  // Remember what this page loaded with (before anything can change under it).
  signature().then((s) => { loaded = s; }).catch(() => {});
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  window.addEventListener('pageshow', (e) => { if (e.persisted) check(); });
  setInterval(() => { if (document.visibilityState === 'visible') check(); }, 10 * 60 * 1000);
}
