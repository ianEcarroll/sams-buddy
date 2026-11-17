// Find earlier versions of an activity (for example a Talk set that was overwritten), using the copy of the
// activity that every practice run saves in practice_sessions.activity_snapshot.
//
// Read-only by default. Run it where DATABASE_URL is set (for example in the Render shell for the API service):
//
//   node scripts/find-activity-versions.mjs                 # activities with "fall" in the title, and their saved versions
//   node scripts/find-activity-versions.mjs "fall"          # any other word from the title
//   node scripts/find-activity-versions.mjs --restore <activity-id> <version-number>          # dry run: shows what would change
//   node scripts/find-activity-versions.mjs --restore <activity-id> <version-number> --yes    # does it
//
// Every version is also written to ./recovered/ as JSON. A restore first saves the current content to
// ./recovered/backup-<activity-id>-<time>.json, then puts back only the activity's content (its topics, opening
// lines and examples). The title, goal and plan goal are left as they are.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { many, one, pool } from '../src/db.js';

const args = process.argv.slice(2);
const yes = args.includes('--yes');
const flagless = args.filter((a) => a !== '--yes');
const restoreAt = flagless.indexOf('--restore');
const term = restoreAt === -1 ? (flagless[0] || 'fall') : null;

const hash = (content) => crypto.createHash('md5').update(JSON.stringify(content ?? {})).digest('hex');
const items = (content) => (Array.isArray(content?.items) ? content.items : []);
const show = (content) => {
  const list = items(content);
  if (!list.length) return '    (no items)';
  return list.map((it, i) => `    ${i + 1}. ${[it.topic, it.title, it.story_title, it.scenario].find(Boolean) || '(empty)'}${it.opener ? `  |  opener: ${it.opener}` : ''}`).join('\n');
};

// Every saved copy of one activity, oldest first, one entry per different content.
async function versionsOf(activityId) {
  const rows = await many(
    `select id, started_at, activity_snapshot from practice_sessions where activity_id = $1 order by started_at asc`, [activityId]);
  const seen = new Map();
  for (const r of rows) {
    const content = r.activity_snapshot?.content ?? {};
    const key = hash(content);
    if (!seen.has(key)) seen.set(key, { key, first: r.started_at, last: r.started_at, runs: 0, title: r.activity_snapshot?.title, content });
    const v = seen.get(key);
    v.last = r.started_at; v.runs++;
  }
  return [...seen.values()];
}

try {
  fs.mkdirSync('recovered', { recursive: true });

  if (restoreAt !== -1) {
    const [id, n] = [flagless[restoreAt + 1], Number(flagless[restoreAt + 2])];
    if (!id || !n) throw new Error('Usage: --restore <activity-id> <version-number> [--yes]');
    const act = await one('select id, title, mode, content from activities where id = $1', [id]);
    if (!act) throw new Error(`No activity with id ${id}.`);
    const versions = await versionsOf(id);
    const v = versions[n - 1];
    if (!v) throw new Error(`Version ${n} not found. This activity has ${versions.length} saved version(s).`);
    console.log(`Activity: "${act.title}" (${act.mode})\n\nNow:\n${show(act.content)}\n\nVersion ${n} (practised ${v.runs}x, ${new Date(v.first).toISOString().slice(0, 16)} to ${new Date(v.last).toISOString().slice(0, 16)}):\n${show(v.content)}\n`);
    if (!yes) { console.log('Dry run: nothing changed. Add --yes to put this version back.'); process.exit(0); }
    const backup = `recovered/backup-${id}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(backup, JSON.stringify({ id, title: act.title, content: act.content }, null, 2));
    await one('update activities set content = $2, updated_at = now() where id = $1 returning id', [id, JSON.stringify(v.content)]);
    console.log(`Done. The previous content is saved in ${backup}.`);
  } else {
    const acts = await many(`select id, title, mode, status, updated_at, content from activities where title ilike $1 order by updated_at desc`, [`%${term}%`]);
    // Activities that were deleted (or renamed) still have their copies in practice_sessions.
    const orphans = await many(
      `select distinct activity_snapshot->>'title' as title, activity_id from practice_sessions
        where activity_snapshot->>'title' ilike $1 and (activity_id is null or activity_id <> all($2::uuid[]))`, [`%${term}%`, acts.map((a) => a.id)]);
    if (!acts.length && !orphans.length) console.log(`No activity or practice record with "${term}" in the title.`);
    for (const a of acts) {
      const versions = await versionsOf(a.id);
      console.log(`\n=== "${a.title}"  (${a.mode}, ${a.status})  id ${a.id}\n    last edited ${new Date(a.updated_at).toISOString().slice(0, 16)}\nNow:\n${show(a.content)}`);
      if (!versions.length) console.log('  No practice runs saved for this activity, so no earlier copy exists in the records.');
      versions.forEach((v, i) => {
        const same = hash(a.content) === v.key ? '  <- same as now' : '';
        console.log(`\n  Version ${i + 1}: practised ${v.runs}x, ${new Date(v.first).toISOString().slice(0, 16)} to ${new Date(v.last).toISOString().slice(0, 16)}${same}\n${show(v.content)}`);
        fs.writeFileSync(`recovered/${a.id}-v${i + 1}.json`, JSON.stringify({ title: v.title, content: v.content }, null, 2));
      });
    }
    for (const o of orphans) console.log(`\nA practice record exists for "${o.title}" but the activity itself is gone or has a different id (${o.activity_id ?? 'none'}). Re-run with a word from that title to see it.`);
    console.log('\nVersions are saved in ./recovered/. To put one back: node scripts/find-activity-versions.mjs --restore <activity-id> <version-number>');
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
