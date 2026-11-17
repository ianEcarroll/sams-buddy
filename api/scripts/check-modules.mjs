// Read-only: for each learner, which modules are switched on, and which activities are active per mode.
// Use it to see why a module tile (for example Think) is missing on a learner's home screen.
// Run where DATABASE_URL is set (for example in the Render shell for the API service):
//   node scripts/check-modules.mjs
import { many, pool } from '../src/db.js';

const learners = await many('select id, name, settings from learners order by name');
for (const l of learners) {
  const s = l.settings || {};
  const acts = await many('select mode, status, title from activities where learner_id=$1 order by mode, status, title', [l.id]);
  console.log(`\n=== ${l.name} ===`);
  console.log('Modules switched on (Practice plan):', (s.enabled_modes || []).join(', ') || '(none)');
  console.log('Think starter already added:', !!s.think_seeded);
  const byMode = {};
  for (const a of acts) (byMode[a.mode] ||= []).push(`${a.title} [${a.status}]`);
  for (const [mode, list] of Object.entries(byMode)) {
    const on = (s.enabled_modes || []).includes(mode);
    const active = list.filter((x) => x.endsWith('[active]')).length;
    console.log(`- ${mode}: ${on ? 'ON' : 'OFF'}, ${active} active of ${list.length}: ${list.join('; ')}`);
  }
  if (!byMode.think) console.log('- think: no activities at all');
}
await pool.end();
