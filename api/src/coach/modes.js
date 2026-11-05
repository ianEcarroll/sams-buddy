// Practice mode definitions.
// Each mode is one of the Buddy modules the learner sees (Chat Buddy, Story Buddy …): `label` is the module name,
// `tagline` what it helps with, `activityName` the plain description the team sees beside it.
// Each mode turns an activity item into a list of "elements" Sam is aiming to supply,
// a default support ladder per element, and plain feedback phrases.
// The therapist/parent can override any cue wording in the activity's `cues` field.

export const TEAM_PHRASE = 'Make a movie in your mind.'; // agreed wording – do not paraphrase

// Support ladder: 0 reminder, 1 specific cue, 2 sentence starter, 3 model
export const LEVELS = ['reminder', 'specific cue', 'sentence starter', 'model'];

export const DEFAULT_CLARIFY_PHRASES = [
  'Could you repeat that?',
  'Can you show me the first step?',
  "I don't understand.",
  'I need help.',
  'I need to check with my job coach.',
];

const ORDINALS = ['first', 'next', 'last'];
export function ordinal(i, total) {
  if (total <= 1) return 'first';
  if (i === 0) return 'first';
  if (i === total - 1) return 'last';
  return 'next';
}
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function fill(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
}

// ---------- OBJECT ----------
const object = {
  label: 'Explain Buddy',
  tagline: 'Say it clearly',
  activityName: 'Describe a Picture',
  defaultGoal: 'Name, group and use in one sentence',
  cueCard: () => ['Name', 'Group', 'Use'],
  elements: () => ['name', 'category', 'function'],
  elementLabel: { name: 'Name', category: 'Group', function: 'Use' },
  cueCardIndex: (el) => ({ name: 0, category: 1, function: 2 }[el]),
  prompt: (item) => item.prompt || "What is this? Tell me what it's called, what group it belongs to, and what it's used for.",
  simplePrompt: (item) => item.simple_prompt || "Look at the picture. What is it? What do we use it for?",
  defaultCues: {
    name: ['Start with its name.', 'What is it called?', 'It is a ___.', 'It is a {name}.'],
    category: ['Remember: name, group, use.', 'What group does it belong to?', 'It is a kind of ___.', 'A {name} is a kind of {category}.'],
    function: ['Remember to say what it is for.', 'What do we use it for?', 'We use it to ___.', 'We use a {name} to {function}.'],
  },
  vars: (item) => ({ name: item.name, category: item.category, function: item.function }),
  achieved: { name: 'named the object', category: 'said what group it belongs to', function: 'explained its use' },
  evidenceLabel: { name: 'Named', category: 'Group', function: 'Use' },
  itemLabel: (item) => item.name || 'object',
};

// ---------- STORY ----------
function storyElements(item) {
  const els = ['where'];
  (item.events || []).forEach((_, i) => els.push(`event_${i}`));
  if ((item.events || []).length >= 2) els.push('order');
  if ((item.target_words || []).length) els.push('vocabulary');
  return els;
}
const story = {
  label: 'Story Buddy',
  tagline: 'Organise my thoughts',
  activityName: 'Tell a Story',
  defaultGoal: 'Setting, events in order and precise words',
  movie: true,
  cueCard: (item) => ['Where', ...(item.events || []).map((_, i, a) => cap(ordinal(i, a.length)))],
  elements: storyElements,
  elementLabel: new Proxy({ where: 'Where', order: 'Order', vocabulary: 'Words' }, {
    get: (t, k) => t[k] ?? (String(k).startsWith('event_') ? `Event ${Number(String(k).slice(6)) + 1}` : k),
  }),
  cueCardIndex: (el) => (el === 'where' ? 0 : el.startsWith('event_') ? Number(el.slice(6)) + 1 : null),
  prompt: (item) => item.prompt || 'When you are ready, tell me the story. Say where it happens, then what happens first, next and last.',
  simplePrompt: (item) => item.simple_prompt || 'Look at the pictures. Tell me what happens.',
  defaultCues: {
    where: ['Remember to say where it happens.', 'Where does the story happen?', 'It happens at the ___.', 'It happens at the {setting}.'],
    event: ['Think about what happens {ordinal}.', 'What happens {ordinal}?', '{Ordinal}, ___.', '{Ordinal}, {event}.'],
    order: ['Tell it in order: first, next, last.', 'What happened first?', 'First … then … last …', '{orderedModel}'],
    vocabulary: ['Think about a word that fits what is happening.', 'Which word fits best: {words}?', 'You could use the word "{word}".', '{vocabModel}'],
  },
  vars: (item, el) => {
    const evs = item.events || [];
    const i = el?.startsWith('event_') ? Number(el.slice(6)) : 0;
    const o = ordinal(i, evs.length);
    return {
      setting: item.setting,
      event: evs[i],
      ordinal: o,
      Ordinal: cap(o),
      words: (item.target_words || []).join(', '),
      word: (item.target_words || [])[0],
      vocabModel: item.vocabulary_model || `One word that fits is "${(item.target_words || [])[0]}".`,
      orderedModel: evs.map((e, k) => `${cap(ordinal(k, evs.length))}, ${e}.`).join(' '),
    };
  },
  cueKey: (el) => (el.startsWith('event_') ? 'event' : el),
  achieved: { where: 'said where the story happened', order: 'told the events in order', vocabulary: 'used a precise word' },
  achievedFor: (el, item) => (el.startsWith('event_') ? `told what happened ${ordinal(Number(el.slice(6)), (item.events || []).length)}` : null),
  evidenceLabel: { where: 'Where', order: 'Order', vocabulary: 'Word' },
  itemLabel: (item) => item.title || 'story',
};

// ---------- TASK ----------
function taskElements(item) {
  const els = (item.steps || []).map((_, i) => `step_${i}`);
  if ((item.steps || []).length >= 2) els.push('order');
  return els;
}
const task = {
  label: 'Listen Buddy',
  tagline: 'Understand and follow instructions',
  activityName: 'Practise a Task',
  defaultGoal: 'Retell the job instructions in order; ask for clarification when needed',
  movie: true,
  cueCard: (item) => (item.steps || []).map((_, i, a) => cap(ordinal(i, a.length))),
  elements: taskElements,
  elementLabel: new Proxy({ order: 'Order', clarify: 'Ask' }, {
    get: (t, k) => t[k] ?? (String(k).startsWith('step_') ? `Step ${Number(String(k).slice(5)) + 1}` : k),
  }),
  cueCardIndex: (el) => (el.startsWith('step_') ? Number(el.slice(5)) : null),
  instruction: (item) => item.instruction || (item.steps || []).map((s, i, a) => `${cap(ordinal(i, a.length))}, ${s}.`).join(' '),
  prompt: () => 'Now tell me the instructions back, in order.',
  simplePrompt: (item) => item.simple_prompt || 'What is the first thing you do?',
  defaultCues: {
    step: ['Think about the {ordinal} step.', 'What do you do {ordinal}?', '{Ordinal}, I ___.', '{Ordinal}, I {step}.'],
    order: ['Tell me the steps in order: first, next, last.', 'What do you do first?', 'First I … then I … last I …', '{orderedModel}'],
    clarify: ['Was anything about that instruction unclear?', 'If something is unclear, you can ask me. What could you say?', 'You could say: "Could you ___?"', 'You could say: "{phrase}"'],
  },
  vars: (item, el) => {
    const steps = item.steps || [];
    const i = el?.startsWith('step_') ? Number(el.slice(5)) : 0;
    const o = ordinal(i, steps.length);
    return {
      step: steps[i], ordinal: o, Ordinal: cap(o),
      orderedModel: steps.map((s, k) => `${cap(ordinal(k, steps.length))}, I ${s}.`).join(' '),
      phrase: (item.clarify_phrases || DEFAULT_CLARIFY_PHRASES)[0],
    };
  },
  cueKey: (el) => (el.startsWith('step_') ? 'step' : el),
  achieved: { order: 'kept the steps in order', clarify: 'asked for the instruction to be made clear' },
  achievedFor: (el, item) => (el.startsWith('step_') ? `told the ${ordinal(Number(el.slice(5)), (item.steps || []).length)} step` : null),
  evidenceLabel: { order: 'Order', clarify: 'Asked' },
  itemLabel: (item) => item.title || 'job instructions',
};

// ---------- CONVERSATION ----------
const conversation = {
  label: 'Chat Buddy',
  tagline: 'Keep the conversation going',
  activityName: 'Have a Conversation',
  defaultGoal: 'Relevant comments, personal connections and follow-up questions',
  cueCard: (item, activity) => (activity?.content?.practise_questions ? ['Answer', 'Add', 'Ask'] : ['Answer', 'Add']),
  elements: () => ['turn'],
  elementLabel: { turn: 'Comment', question: 'Question' },
  cueCardIndex: () => null,
  prompt: (item) => item.opener,
  simplePrompt: (item) => item.simple_prompt || `We're talking about ${item.topic}. What do you think about it?`,
  defaultCues: {
    turn: ["Let's keep talking about {topic}.", 'What do you think about {topic}?', 'I think ___.', '{example}'],
    // Levels 0–1 hold several wordings; one is picked at random each time so the invitation doesn't sound repetitive.
    question: [
      [
        'You could ask me something too.',
        'Your turn. What would you like to know?',
        'Is there anything you want to find out from me?',
        "I wonder what you'd like to know about me.",
        'Anything you are curious about?',
        "I'd love to hear your question.",
      ],
      [
        'What could you ask me about {topic}?',
        'What would you like to know about my {topic}?',
        'Is there something about {topic} you want to ask me?',
        'You could find out what I think about {topic}.',
      ],
      'Do you ___?',
      'You could ask: "{exampleQuestion}"',
    ],
  },
  vars: (item) => ({
    topic: item.topic,
    example: item.example_comment || `You could say: "I like ${item.topic} too."`,
    exampleQuestion: item.example_question || `What do you like about ${item.topic}?`,
  }),
  achieved: { turn: 'made a comment that fits the topic', question: 'asked a follow-up question', connection: 'connected it to your own experience' },
  evidenceLabel: { turn: 'Comment', question: 'Question', connection: 'Connection' },
  itemLabel: (item) => item.topic || 'conversation',
};

// ---------- LISTEN (story read aloud, then questions) ----------
const listen = {
  label: 'Memory Buddy',
  tagline: 'Remember and recall',
  activityName: 'Listen to a Story',
  defaultGoal: 'Listen to a story and answer questions about it',
  cueCard: () => null,
  elements: (item) => (item.questions || []).map((_, i) => `q_${i}`),
  elementLabel: new Proxy({}, { get: (t, k) => (String(k).startsWith('q_') ? `Question ${Number(String(k).slice(2)) + 1}` : k) }),
  cueCardIndex: () => null,
  prompt: () => "When you're ready to answer some questions about the story, press I'm ready.",
  simplePrompt: (item) => item.simple_prompt || 'Think back to the story.',
  defaultCues: {},
  vars: () => ({}),
  achieved: {},
  evidenceLabel: {},
  itemLabel: (item) => item.title || 'story',
};

// ---------- THINK (problem solving: a real-life situation, then "what would you do?") ----------
// Buddy describes a situation. The learner says what is wrong and what they would do. If they don't say why,
// or what they'd do if that didn't work, Buddy asks those as ordinary follow-up questions (not counted as support).
export const THINK_FOLLOW_UPS = {
  reason: 'Why do you think that would be a good idea?',
  backup: "What could you do if that doesn't work?",
};
const think = {
  label: 'Think Buddy',
  tagline: 'Solve the problem',
  activityName: 'Solve a Problem',
  defaultGoal: 'Notice the problem, say a safe thing to do and why, and what to do if it does not work',
  movie: true,
  cueCard: () => ['Problem', 'What I’d do', 'Why', 'If not'],
  elements: () => ['problem', 'action', 'reason', 'backup'],
  elementLabel: { problem: 'Problem', action: 'What to do', reason: 'Why', backup: 'If that does not work' },
  cueCardIndex: (el) => ({ problem: 0, action: 1, reason: 2, backup: 3 }[el]),
  followUps: THINK_FOLLOW_UPS,
  followUp: (el, it) => (it.met.action ? THINK_FOLLOW_UPS[el] || null : null),
  prompt: (item) => item.question || 'What would you do?',
  simplePrompt: (item) => item.simple_prompt || 'Something is not how you expected. What could you do?',
  defaultCues: {
    problem: ['Stop and think. Is this what you expected?', 'What is different from what you expected?', 'The problem is ___.', 'The problem is {problem}.'],
    action: ['STOP. THINK. Is this expected? If unsure, ASK.', 'What could you do, or who could you ask?', 'I would ___.', 'I would {action}.'],
    reason: ['Why do you think that would be a good idea?', 'How would that help you?', 'That would help because ___.', 'That would help because {reason}.'],
    backup: ["What could you do if that doesn't work?", 'If that does not work, who else could you ask?', "If that doesn't work, I would ___.", "If that doesn't work, I would {backup}."],
  },
  vars: (item) => ({
    problem: item.problem || 'something is not as expected',
    action: (item.good_actions || [])[0] || 'ask an adult I trust',
    reason: item.reason_example || 'they can help me find out what to do',
    backup: item.backup_example || 'ask another adult I trust',
  }),
  achieved: { problem: 'noticed the problem', action: 'said a safe thing to do', reason: 'explained why it would help', backup: 'had a plan if it did not work' },
  evidenceLabel: { problem: 'Problem', action: 'Would do', reason: 'Why', backup: 'Plan B' },
  itemLabel: (item) => item.title || 'situation',
};

// ---------- RECALL (Memory Buddy: real experiences, e.g. "Tell me three things you did at the weekend") ----------
// The family lists a few things the learner really did, each with a broad clue, a specific clue and an optional photo.
// Any real thing the learner remembers counts, listed or not. After the first answer Buddy asks "What else do you
// remember?" once per memory as a plain follow-up; after that it gives clues, broad → specific → photo.
const NUM = ['zero', 'one', 'two', 'three', 'four', 'five'];
// The family's list is only used while it is recent; an old list would give clues about the wrong weekend.
// "at the weekend" → "the weekend", for clues like "Think about the weekend."
export const whenNoun = (when) => String(when || 'the last few days').replace(/^(at|on|in|during|over|from)\s+/i, '');
export const RECALL_FRESH_DAYS = 7;
const listed = (item) => (item?.memories || []).filter((m) => m?.event);
export function freshMemories(item, now = Date.now()) {
  const at = Date.parse(item?.memories_updated_at || '');
  return Number.isFinite(at) && now - at <= RECALL_FRESH_DAYS * 86_400_000 ? listed(item) : [];
}
// On save: stamp each Remember My Day item whose list changed. The stamp comes from the server, never the browser.
export function stampMemories(mode, content, oldContent, now = new Date()) {
  if (mode !== 'recall' || !content?.items) return content;
  const old = oldContent?.items || [];
  const key = (it) => JSON.stringify(listed(it).map((m) => [m.event, m.broad_clue || '', m.specific_clue || '', m.image_id || '']));
  content.items = content.items.map((it, i) => {
    const prev = old[i];
    const same = prev && key(prev) === key(it) && prev.memories_updated_at;
    const out = { ...it };
    if (same) out.memories_updated_at = prev.memories_updated_at;
    else if (listed(it).length) out.memories_updated_at = now.toISOString();
    else delete out.memories_updated_at;
    return out;
  });
  return content;
}
export const recallTarget = (item) => Math.min(5, Math.max(1, Number(item?.target) || 3));
const WHAT_ELSE = ['What else do you remember doing?', 'Anything else you remember?', 'What else did you do?'];
const recall = {
  label: 'Memory Buddy',
  tagline: 'Remember and recall',
  activityName: 'Remember My Day',
  defaultGoal: 'Remember real things I did, with as few clues as possible',
  movie: true,
  cueCard: (item) => Array.from({ length: recallTarget(item) }, (_, i) => String(i + 1)),
  elements: (item) => Array.from({ length: recallTarget(item) }, (_, i) => `memory_${i}`),
  elementLabel: new Proxy({}, { get: (t, k) => (String(k).startsWith('memory_') ? `Memory ${Number(String(k).slice(7)) + 1}` : k) }),
  cueCardIndex: (el) => (String(el).startsWith('memory_') ? Number(el.slice(7)) : null),
  cueKey: () => 'memory',
  followUp: (el, it) => {
    const n = Object.keys(it.met).length;
    return n ? WHAT_ELSE[(n - 1) % WHAT_ELSE.length] : null;
  },
  prompt: (item) => item.prompt || `Tell me ${NUM[recallTarget(item)] || recallTarget(item)} thing${recallTarget(item) === 1 ? '' : 's'} you did ${item.when || 'recently'}.`,
  simplePrompt: (item) => item.simple_prompt || `Think about ${whenNoun(item.when)}. What did you do?`,
  // Level 0 only; levels 1–3 come from the family's clues for one thing not yet remembered (see engine recallCue).
  defaultCues: { memory: ['Think about {when}. What did you do?', '{broad}', '{specific}', '{photo}'] },
  vars: (item) => ({ when: whenNoun(item.when) }),
  achieved: {},
  evidenceLabel: new Proxy({}, { get: (t, k) => (String(k).startsWith('memory_') ? `Memory ${Number(String(k).slice(7)) + 1}` : undefined) }),
  itemLabel: (item) => item.title || 'my day',
};

export const MODES = { object, story, task, conversation, listen, think, recall };

// Three everyday situations every learner starts with in Think Buddy. The team should check them with the
// therapist and can edit, archive or add their own in Activities.
export const STARTER_SCENARIOS = {
  title: 'Everyday surprises',
  goal: 'Notice the problem, say a safe thing to do and why, and what to do if it does not work',
  items: [
    {
      title: 'Trainer not at the gym',
      scenario: "You arrive at the gym for your session, but your trainer isn't there.",
      problem: 'the trainer is not there',
      good_actions: ['ask the person at the front desk', 'wait a few minutes, then ask a member of staff', 'call or message my parent', 'check whether the session time changed'],
      reason_example: 'the staff can find out where my trainer is',
      backup_example: 'call my mum or dad and tell them',
      unsafe: ['leave on my own without telling anyone', 'go off with someone I do not know'],
    },
    {
      title: 'Library door locked',
      scenario: 'Your teacher says the class is going to the library. When you get there, the door is locked and nobody is there.',
      problem: 'the library is locked and the class is not there',
      good_actions: ['go back to the classroom', 'ask a teacher', 'go to the school office and ask', 'ask a classmate where the class went'],
      reason_example: 'a teacher will know where my class is',
      backup_example: 'go to the school office',
      unsafe: ['leave the school', 'wander around on my own for a long time'],
    },
    {
      title: 'Wrong drink at the café',
      scenario: 'You order a hot chocolate at a café, but they bring you an orange juice.',
      problem: 'they brought the wrong drink',
      good_actions: ['politely tell the person who served me', 'say "Excuse me, I ordered a hot chocolate"', 'ask the staff at the counter'],
      reason_example: 'they can swap it for the right drink',
      backup_example: 'ask someone else who works there, or ask the adult I am with',
      unsafe: ['shout at the staff', 'take someone else’s drink'],
    },
  ],
};

// Two stories every learner starts with. The team can edit them or add more in Activities.
export const STARTER_STORIES = [
  {
    title: 'Tinker Bell and the lost thimble',
    goal: 'Listen to a story and answer questions about it',
    items: [{
      title: 'Tinker Bell and the lost thimble',
      story: "It was a windy evening in Neverland. Tinker Bell, the tiny fairy whose voice sounds like a little bell, woke up in her bedroom inside a tree. She stretched her wings and looked for her favourite thing, a shiny silver thimble that Wendy had given her. But the thimble was gone! Tinker Bell flew straight to Peter Pan. \"Someone has taken my thimble,\" she jingled crossly. Peter and Tinker Bell searched the Lost Boys' home under the ground, but they found nothing. Then they heard a splash down by the lagoon. A big black crow was sitting on a rock with something shiny in its beak. Tinker Bell sprinkled a little fairy dust, and the crow sneezed. The thimble dropped into Peter's hand. Tinker Bell glowed bright gold, which is what she does when she is happy, and she hung the thimble by her bed so she could see it every morning.",
      questions: [
        { question: 'Where does the story happen?', answers: ['Neverland', 'Never land'], clue: 'It is the magical island where Peter Pan lives.' },
        { question: "What was Tinker Bell's favourite thing?", answers: ['thimble'], clue: 'Wendy gave it to her. It was shiny and silver.' },
        { question: 'Who did Tinker Bell ask for help?', answers: ['Peter Pan', 'Peter'], clue: 'He is the boy who never grows up.' },
        { question: 'What animal had the thimble?', answers: ['crow', 'bird', 'blackbird'], clue: 'It was big and black, and it was sitting on a rock.' },
        { question: 'What does Tinker Bell do when she is happy?', answers: ['glow', 'glowed', 'gold', 'lit up', 'light up', 'shine', 'shines'], clue: 'Think about the colour she turned at the end.' },
      ],
    }],
  },
  {
    title: "Leo's first day at the café",
    goal: 'Listen to a story and answer questions about it',
    items: [{
      title: "Leo's first day at the café",
      story: "On Saturday morning, Leo started his new job at the Corner Café. His manager, Maria, showed him where to hang his coat and gave him a green apron. Leo's first job was to wipe the tables and put out the menus. At ten o'clock, a family came in with a little girl holding a red balloon. The girl asked for a hot chocolate with marshmallows, and Leo carried it carefully to the table. Later, a man knocked over a glass of orange juice. Leo stayed calm, said \"Don't worry, I'll clean it up,\" and fetched a cloth. At the end of the day, Maria told Leo he had done a brilliant job and gave him a blueberry muffin to take home.",
      questions: [
        { question: 'What was the name of the café?', answers: ['Corner Café', 'Corner Cafe', 'Corner'], clue: 'It is named after where it is on the street.' },
        { question: "What colour was Leo's apron?", answers: ['green'], clue: 'It is the colour of grass.' },
        { question: 'What did the little girl ask for?', answers: ['hot chocolate', 'chocolate'], clue: 'It was a hot drink with marshmallows.' },
        { question: 'What did the man knock over?', answers: ['orange juice', 'juice', 'glass'], clue: 'It was a drink made from fruit.' },
        { question: 'What did Maria give Leo at the end of the day?', answers: ['muffin', 'blueberry muffin', 'cake'], clue: 'It was something to eat, with blueberries in it.' },
      ],
    }],
  },
];

export function cueLadder(mode, activity, item, el) {
  const m = MODES[mode];
  const key = m.cueKey ? m.cueKey(el) : el;
  const custom = activity?.content?.cues?.[key];
  const ladder = (Array.isArray(custom) && custom.filter((c) => (Array.isArray(c) ? c.some(Boolean) : c)).length === 4) ? custom : m.defaultCues[key];
  const vars = m.vars(item, el);
  return ladder.map((t) => fill(pickWording(t, key), vars));
}

// A cue can be a single string or a list of alternative wordings. Pick one, avoiding the wording used last time.
const lastWording = {};
function pickWording(t, key) {
  if (!Array.isArray(t)) return t;
  const opts = t.filter(Boolean);
  if (opts.length <= 1) return opts[0] || '';
  const fresh = opts.filter((o) => o !== lastWording[key]);
  const pick = fresh[Math.floor(Math.random() * fresh.length)];
  lastWording[key] = pick;
  return pick;
}

export function achievedPhrase(mode, el, item) {
  const m = MODES[mode];
  return (m.achievedFor && m.achievedFor(el, item)) || m.achieved[el] || `supplied ${el}`;
}

export function joinPhrases(ps) {
  if (ps.length <= 1) return ps[0] || '';
  return `${ps.slice(0, -1).join(', ')} and ${ps[ps.length - 1]}`;
}

export function labelFor(mode, el) {
  return MODES[mode].elementLabel[el] ?? el;
}

// Brief, specific feedback for a set of elements, e.g.
// "named the object and explained its use" / "said where it happened and told what happened first, next and last, in order".
export function describe(mode, els, item) {
  if (mode === 'recall') {
    const n = els.filter((e) => e.startsWith('memory_')).length;
    return n === 1 ? 'remembered one thing you did' : `remembered ${NUM[n] || n} things you did`;
  }
  const seq = els.filter((e) => e.startsWith('event_') || e.startsWith('step_'));
  const total = mode === 'story' ? (item.events || []).length : (item.steps || []).length;
  const rest = els.filter((e) => !seq.includes(e) && e !== 'order');
  const parts = [];
  for (const e of rest) parts.push(achievedPhrase(mode, e, item));
  if (seq.length) {
    const ords = seq.map((e) => ordinal(Number(e.split('_')[1]), total));
    const list = joinPhrases([...new Set(ords)]);
    let p = mode === 'story' ? `told what happened ${list}` : `told the ${list} step${ords.length > 1 ? 's' : ''}`;
    if (els.includes('order') && seq.length > 1) p += ', in order';
    parts.push(p);
  } else if (els.includes('order')) {
    parts.push(achievedPhrase(mode, 'order', item));
  }
  return joinPhrases(parts);
}
