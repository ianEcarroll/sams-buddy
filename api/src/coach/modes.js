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

export const MODES = { object, story, task, conversation, listen };

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
