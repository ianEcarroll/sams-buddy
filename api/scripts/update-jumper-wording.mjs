// Update the saved "Fold a jumper" task for every family: the old "Checking my own work" questions become the new
// "Problem solving" questions. A question is only replaced while it still has the original wording, so anything the
// team has edited is left alone.
//
// Run it where DATABASE_URL is set (for example in the Render shell for the API service):
//
//   node scripts/update-jumper-wording.mjs          # dry run: lists what would change, changes nothing
//   node scripts/update-jumper-wording.mjs --yes    # does it (the old content of each activity is saved in ./recovered/ first)
import fs from 'node:fs';
import { many, one, pool } from '../src/db.js';
import { STARTER_STEPS } from '../src/coach/modes.js';

const yes = process.argv.includes('--yes');
const OLD = new Set([
  'How will you know when you are ready for the next step?',
  'Are both sleeves folded? How can you tell?',
  'Look at your jumper. Does it look neatly folded?',
  'How can you check whether your jumper is tidy?',
  'How do you know you have found the right basket?',
  'How could you do this task next time without help?',
]);
const starter = STARTER_STEPS.find((a) => a.title === 'Fold a jumper').items[0];

try {
  fs.mkdirSync('recovered', { recursive: true });
  const acts = await many(`select id, learner_id, title, content from activities where mode = 'steps' and title = 'Fold a jumper'`);
  if (!acts.length) console.log('No "Fold a jumper" activity found.');
  let total = 0;
  for (const a of acts) {
    const content = JSON.parse(JSON.stringify(a.content || {}));
    let changed = 0, kept = 0;
    for (const it of content.items || []) {
      if (it.title !== starter.title) continue;
      (it.steps || []).forEach((s, j) => {
        const want = starter.steps[j]?.q?.independence;
        const have = s.q?.independence;
        if (!want || !have) return;
        if (OLD.has(have.question)) { s.q.independence = { ...want }; changed++; }
        else if (have.question !== want.question) kept++;
      });
    }
    console.log(`"${a.title}" (learner ${a.learner_id}): ${changed} question(s) to update${kept ? `, ${kept} edited by the team, left alone` : ''}.`);
    if (!changed) continue;
    total += changed;
    if (!yes) continue;
    fs.writeFileSync(`recovered/jumper-${a.id}-${Date.now()}.json`, JSON.stringify({ id: a.id, title: a.title, content: a.content }, null, 2));
    await one('update activities set content = $2, updated_at = now() where id = $1 returning id', [a.id, JSON.stringify(content)]);
  }
  console.log(yes ? `\nDone: ${total} question(s) updated.` : `\nDry run: nothing changed. Add --yes to update ${total} question(s).`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
