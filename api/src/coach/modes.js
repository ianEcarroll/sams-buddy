// Practice mode definitions.
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
  label: 'Describe a Picture',
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
  label: 'Tell a Story',
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
  label: 'Practise a Task',
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
  label: 'Have a Conversation',
  defaultGoal: 'Relevant comments, personal connections and follow-up questions',
  cueCard: (item, activity) => (activity?.content?.practise_questions ? ['Answer', 'Add', 'Ask'] : ['Answer', 'Add']),
  elements: () => ['turn'],
  elementLabel: { turn: 'Comment', question: 'Question' },
  cueCardIndex: () => null,
  prompt: (item) => item.opener,
  simplePrompt: (item) => item.simple_prompt || `We're talking about ${item.topic}. What do you think about it?`,
  defaultCues: {
    turn: ["Let's keep talking about {topic}.", 'What do you think about {topic}?', 'I think ___.', '{example}'],
    question: ['You could ask me something too.', 'What could you ask me about {topic}?', 'Do you ___?', 'You could ask: "{exampleQuestion}"'],
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

export const MODES = { object, story, task, conversation };

export function cueLadder(mode, activity, item, el) {
  const m = MODES[mode];
  const key = m.cueKey ? m.cueKey(el) : el;
  const custom = activity?.content?.cues?.[key];
  const ladder = (Array.isArray(custom) && custom.filter(Boolean).length === 4) ? custom : m.defaultCues[key];
  const vars = m.vars(item, el);
  return ladder.map((t) => fill(t, vars));
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
