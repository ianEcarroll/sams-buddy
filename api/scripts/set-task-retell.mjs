// Switch "At the end, ask for all the steps in order" back on for saved Task activities (default: the ones with
// "jumper" in the title, since that is the one Ray is testing). Other tasks are left alone unless you pass --all.
//
//   node scripts/set-task-retell.mjs          # dry run: lists what would change
//   node scripts/set-task-retell.mjs --yes    # does it (old content saved in ./recovered/ first)
import fs from 'node:fs';
import { many, one, pool } from '../src/db.js';

const yes = process.argv.includes('--yes');
const all = process.argv.includes('--all');
try {
  fs.mkdirSync('recovered', { recursive: true });
  const acts = await many(`select id, title, content from activities where mode = 'steps'`);
  console.log(`Task activities found: ${acts.map((a) => `"${a.title}" (end retell ${a.content?.ask_end === false ? 'off' : a.content?.ask_end === true ? 'on' : 'not set'})`).join(', ') || 'none'}\n`);
  let n = 0;
  for (const a of acts) {
    if (!all && !/jumper/i.test(a.title || '')) continue;
    if (a.content?.ask_end === true) { console.log(`"${a.title}": already on.`); continue; }
    n++;
    console.log(`"${a.title}": will switch the end retell on.`);
    if (!yes) continue;
    fs.writeFileSync(`recovered/retell-${a.id}-${Date.now()}.json`, JSON.stringify({ id: a.id, title: a.title, content: a.content }, null, 2));
    await one('update activities set content = $2, updated_at = now() where id = $1 returning id', [a.id, JSON.stringify({ ...a.content, ask_end: true })]);
  }
  console.log(yes ? `\nDone: ${n} activity(ies) updated.` : `\nDry run: nothing changed. Add --yes to update ${n}.`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
