// Activity library: every ready-made item is complete, uses pictures that exist, and copies into a draft activity.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LIBRARY, libraryById, libraryCard, libraryDetail, activityFromLibrary, libraryProblems } from '../src/library.js';

const slugs = new Set(JSON.parse(readFileSync(new URL('../../web/public/symbols/index.json', import.meta.url), 'utf8')).map(([slug]) => slug));

test('every library item is complete and every picture exists', () => {
  assert.ok(LIBRARY.length >= 30);
  for (const mode of ['steps', 'think', 'conversation', 'explain', 'category', 'listen', 'recall', 'story']) assert.ok(LIBRARY.some((i) => i.mode === mode), `no ${mode} items`);
  assert.deepEqual(libraryProblems(slugs), []);
});

test('the checker catches missing pictures, missing questions and too few steps', () => {
  const bad = [{ id: 'x', mode: 'steps', title: 'X', tags: ['a'], content: { items: [{ steps: [{ text: 'Do it', image_id: 'sym:no-such-picture', q: {} }] }] } }];
  const p = libraryProblems(slugs, bad).join(' | ');
  assert.match(p, /1 steps/);
  assert.match(p, /no-such-picture not found/);
  assert.match(p, /missing understanding/);
});

test('an added item is a draft linked to the library and the original stays unchanged', () => {
  const item = libraryById('task-wash-hands');
  const before = JSON.stringify(item);
  const a = activityFromLibrary(item);
  assert.equal(a.status, 'draft');
  assert.equal(a.mode, 'steps');
  assert.equal(a.plan_goal, 'instructions');
  assert.equal(a.content.library_id, 'task-wash-hands');
  assert.equal(a.content.run, 'learn');
  a.content.items[0].steps[0].text = 'changed';
  assert.equal(JSON.stringify(item), before, 'editing the copy must not touch the library');
});

test('library cards show the title, step count and pictures but not the answers', () => {
  const c = libraryCard(libraryById('task-cereal'), { id: 'abc', status: 'draft' });
  assert.equal(c.count, 5);
  assert.equal(c.unit, 'steps');
  assert.equal(c.images.length, 5);
  assert.deepEqual(c.added, { id: 'abc', status: 'draft' });
  assert.ok(!JSON.stringify(c).includes('"answer"'));
  assert.equal(libraryById('nope'), null);
});

test('questions use one skill key set the coach understands', () => {
  for (const it of LIBRARY.filter((i) => i.mode === 'steps')) for (const st of it.content.items[0].steps) {
    for (const k of Object.keys(st.q)) assert.ok(['understanding', 'reasoning', 'independence', 'memory', 'expressive'].includes(k), `${it.id}: unknown skill ${k}`);
  }
});

test('the checker catches incomplete Think and Talk items', () => {
  const think = { id: 't', mode: 'think', title: 'T', tags: ['a'], content: { items: [{ title: 'a', scenario: 's', problem: '', good_actions: ['one'], reason_example: 'r', backup_example: 'b', unsafe: [] }, {}, {}] } };
  const talk = { id: 'c', mode: 'conversation', title: 'C', tags: ['a'], content: { items: [{ topic: 'food', opener: 'Hi', example_comment: 'You could say hi', example_question: '' }, {}, {}] } };
  const p = libraryProblems(slugs, [think, talk]).join(' | ');
  assert.match(p, /situation 1: no problem/);
  assert.match(p, /at least two safe things/);
  assert.match(p, /at least one idea that is not safe/);
  assert.match(p, /topic 1: no example_question/);
  assert.match(p, /should be what the learner would say/);
});

test('Think and Talk items copy into drafts with the right plan goal and no steps-only settings', () => {
  const t = activityFromLibrary(libraryById('think-school'));
  assert.deepEqual([t.mode, t.status, t.plan_goal, t.content.library_id], ['think', 'draft', 'unexpected', 'think-school']);
  assert.equal(t.content.run, undefined);
  const c = activityFromLibrary(libraryById('talk-weekend'));
  assert.deepEqual([c.mode, c.plan_goal], ['conversation', 'conversation']);
});

test('Think and Talk cards list their situations and topics, with no level', () => {
  const t = libraryCard(libraryById('think-home'));
  assert.equal(t.unit, 'situations'); assert.equal(t.level, null); assert.deepEqual(t.images, []);
  assert.match(t.lines[0], /^The wifi stops: /);
  const c = libraryCard(libraryById('talk-hobbies'));
  assert.equal(c.unit, 'topics'); assert.match(c.lines[0], /^video games: /);
});

test('the read-only view shows the full activity, including questions and accepted answers', () => {
  for (const it of LIBRARY) {
    const d = libraryDetail(it);
    assert.ok(d.parts.length > 0, `${it.id}: nothing to view`);
    for (const p of d.parts) {
      assert.ok(p.heading && p.rows.length, `${it.id}: empty part`);
      for (const [label, value] of p.rows) assert.ok(label && (Array.isArray(value) ? value.length : String(value).trim()), `${it.id}: empty row ${label}`);
    }
  }
  const steps = JSON.stringify(libraryDetail(libraryById('task-wash-hands')));
  assert.match(steps, /Accepted answer/);
  assert.match(steps, /the tap/);
  const story = libraryDetail(libraryById('story-market'));
  assert.equal(story.parts.length, 6);
  assert.match(JSON.stringify(story), /Accepted answers/);
});

test('viewing never changes a library item', () => {
  const before = JSON.stringify(LIBRARY);
  for (const it of LIBRARY) { libraryDetail(it); libraryCard(it); activityFromLibrary(it); }
  assert.equal(JSON.stringify(LIBRARY), before);
});

test('every item copies into a draft linked back to the library', () => {
  for (const it of LIBRARY) {
    const a = activityFromLibrary(it);
    assert.equal(a.status, 'draft');
    assert.ok(a.content.items.length > 0);
    assert.equal(a.content.library_id, it.id);
  }
});

test('the checker catches incomplete Explain, Memory and Story items', () => {
  const bad = [
    { id: 'e', mode: 'explain', title: 'E', tags: ['a'], content: { items: [{ title: 'x', question: 'q', points: [{ text: 't' }] }, { title: 'y', question: 'q', points: [] }] } },
    { id: 'c', mode: 'category', title: 'C', tags: ['a'], content: { items: [{ kind: 'name', group: 'animals', target: 20, accepted: ['dog'] }, { kind: 'add', group: 'fruit', given: ['apple'], accepted: ['apple'] }] } },
    { id: 's', mode: 'listen', title: 'S', tags: ['a'], content: { items: [{ story: 'Too short.', questions: [{ question: 'Who?', answers: [], clue: '' }] }] } },
  ];
  const p = libraryProblems(slugs, bad).join(' | ');
  assert.match(p, /needs at least three parts/);
  assert.match(p, /part 1: no question/);
  assert.match(p, /at least eight accepted words/);
  assert.match(p, /target must be 1 to 8/);
  assert.match(p, /at least two given words/);
  assert.match(p, /story is 2 words/);
  assert.match(p, /at least three questions/);
  assert.match(p, /needs a question, an accepted answer and a clue/);
});

test('Remember my day prompts read naturally and stay within what the activity editor allows', () => {
  const r = LIBRARY.filter((i) => i.mode === 'recall');
  assert.ok(r.length >= 4);
  for (const it of r) for (const x of it.content.items) { assert.ok(x.target >= 1 && x.target <= 5); assert.ok(x.when.trim()); }
  const d = JSON.stringify(libraryDetail(libraryById('remember-weekend')));
  assert.match(d, /Tell me four things you did at the weekend\./);
  assert.match(d, /Tell me three things you did on Saturday\./);
  const bad = [{ id: 'r', mode: 'recall', title: 'R', tags: ['a'], content: { items: [{ title: 'x', when: '', target: 9 }, { title: 'y', when: 'today', target: 3 }] } }];
  const p = libraryProblems(slugs, bad).join(' | ');
  assert.match(p, /needs a title and when it happened/);
  assert.match(p, /target must be 1 to 5/);
});

test('Tell a story sets have one picture per event, real pictures, and show them on the card and in the view', () => {
  const sets = LIBRARY.filter((i) => i.mode === 'story');
  assert.ok(sets.length >= 3);
  for (const s of sets) for (const x of s.content.items) assert.equal(x.image_ids.length, x.events.length);
  const c = libraryCard(libraryById('tell-easy'));
  assert.equal(c.images.length, 3);
  assert.equal(c.unit, 'stories');
  const d = libraryDetail(libraryById('tell-out'));
  assert.equal(d.parts.length, 4);
  assert.equal(d.parts[0].images.length, 4);
  assert.match(JSON.stringify(d), /What happens, in order/);
  const bad = [{ id: 's', mode: 'story', title: 'S', tags: ['a'], content: { items: [{ title: 'x', who: 'Al', setting: 'park', events: ['one', 'two'], image_ids: ['sym:no-such-picture'], outcome: '' }, { title: 'y', who: '', setting: 's', events: ['a', 'b', 'c'], image_ids: ['sym:tap', 'sym:tap', 'sym:tap'], outcome: 'o' }] } }];
  const p = libraryProblems(slugs, bad).join(' | ');
  assert.match(p, /2 events/);
  assert.match(p, /one picture for each event/);
  assert.match(p, /no-such-picture not found/);
  assert.match(p, /no outcome/);
  assert.match(p, /no who/);
});
