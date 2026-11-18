// Update saved Task activities: the old "Checking my own work" questions that came with the Fold a jumper starter
// become the new "Problem solving" questions. Matches on the old question wording itself, so it works however the
// team has renamed the activity or reworded the steps. A question is only replaced while it still has the original
// wording; anything the team has edited is left alone.
//
// Run it where DATABASE_URL is set (for example in the Render shell for the API service):
//
//   node scripts/update-jumper-wording.mjs          # dry run: lists what would change, changes nothing
//   node scripts/update-jumper-wording.mjs --yes    # does it (the old content of each activity is saved in ./recovered/ first)
import fs from 'node:fs';
import { many, one, pool } from '../src/db.js';

const yes = process.argv.includes('--yes');
const NEW = [
  ['How will you know when you are ready for the next step?', 'What could you do if the jumper has wrinkles?', 'smooth it flat with my hands'],
  ['Are both sleeves folded? How can you tell?', 'What could you do if a sleeve slips out of place?', 'fold it across the middle again'],
  ['Look at your jumper. Does it look neatly folded?', 'What could you do if the jumper does not look neat?', 'fold it again so the edges line up'],
  ['How can you check whether your jumper is tidy?', 'What could you do if the folded jumper is crooked?', 'straighten the edges and smooth it'],
  ['How do you know you have found the right basket?', 'What could you do if no basket matches the jumper?', 'ask an adult'],
  ['How could you do this task next time without help?', 'What could you do if you forget a step next time?', 'look at the pictures or ask for help'],
];
const swap = new Map(NEW.map(([old, question, answer]) => [old, { question, answer }]));

try {
  fs.mkdirSync('recovered', { recursive: true });
  const acts = await many(`select id, learner_id, title, content from activities where mode = 'steps'`);
  console.log(`Task activities found: ${acts.map((a) => `"${a.title}"`).join(', ') || 'none'}\n`);
  let total = 0;
  for (const a of acts) {
    const content = JSON.parse(JSON.stringify(a.content || {}));
    let changed = 0;
    for (const it of content.items || []) {
      for (const [j, s] of (it.steps || []).entries()) {
        const have = s.q?.independence;
        const to = have && swap.get(String(have.question || '').trim());
        if (!to) continue;
        console.log(`  "${a.title}", step ${j + 1}: "${have.question}"  ->  "${to.question}"`);
        s.q.independence = { ...have, question: to.question, answer: to.answer };
        changed++;
      }
    }
    if (!changed) { console.log(`"${a.title}": nothing to update.`); continue; }
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
