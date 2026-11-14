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
// Story Buddy's organiser words: First → Next → Then → Finally (Ray's framework).
export function storyOrdinal(i, total) {
  if (total <= 1 || i === 0) return 'first';
  if (i === total - 1) return 'finally';
  return i === 1 ? 'next' : 'then';
}
export { whoList };
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
// Who was there and how it ended are optional parts the team can add (plan goal 3: who/where + events + detail/outcome).
const whoList = (item) => (Array.isArray(item.who) ? item.who : String(item.who || '').split(',')).map((w) => w.trim()).filter(Boolean);
function storyElements(item) {
  const els = [];
  if (whoList(item).length) els.push('who');
  els.push('where');
  (item.events || []).forEach((_, i) => els.push(`event_${i}`));
  if (item.outcome?.trim()) els.push('ending');
  if ((item.events || []).length >= 2) els.push('order');
  if ((item.target_words || []).length) els.push('vocabulary');
  return els;
}
// The organiser on screen: [Who] → Where → First → Next → Then → Finally → [Ending]
function storyCard(item) {
  const evs = item.events || [];
  return [
    ...(whoList(item).length ? ['Who'] : []), 'Where',
    ...evs.map((_, i) => cap(storyOrdinal(i, evs.length))),
    ...(item.outcome?.trim() ? ['How it ended'] : []),
  ];
}
function storyCardIndex(el, item) {
  const hasWho = whoList(item || {}).length ? 1 : 0;
  const n = (item?.events || []).length;
  if (el === 'who') return 0;
  if (el === 'where') return hasWho;
  if (String(el).startsWith('event_')) return hasWho + 1 + Number(el.slice(6));
  if (el === 'ending') return hasWho + 1 + n;
  return null;
}
const story = {
  label: 'Story Buddy',
  tagline: 'Organise my thoughts',
  activityName: 'Tell a Story',
  defaultGoal: 'Who and where, events in order (First → Next → Then → Finally) and how it ended',
  movie: true,
  organiser: true, // the cue card is a First → Next → Then → Finally organiser the team can fade out
  cueCard: storyCard,
  elements: storyElements,
  elementLabel: new Proxy({ who: 'Who', where: 'Where', ending: 'How it ended', order: 'Order', vocabulary: 'Words' }, {
    get: (t, k) => t[k] ?? (String(k).startsWith('event_') ? `Event ${Number(String(k).slice(6)) + 1}` : k),
  }),
  cueCardIndex: storyCardIndex,
  prompt: (item) => item.prompt || `When you are ready, tell me the story. Say ${whoList(item).length ? 'who was there, ' : ''}where it happens, then what happens first, next, then and finally${item.outcome?.trim() ? ', and how it ended' : ''}.`,
  simplePrompt: (item) => item.simple_prompt || 'Look at the pictures. Tell me what happens.',
  defaultCues: {
    who: ['Remember to say who was there.', 'Who was there?', '___ was there.', '{whoModel} {whoVerb} there.'],
    where: ['Remember to say where it happens.', 'Where does the story happen?', 'It happens at the ___.', 'It happens at the {setting}.'],
    ending: ['Remember to say how it ended.', 'What happened at the end?', 'At the end, ___.', 'At the end, {outcome}.'],
    event: ['Think about what happens {ordinal}.', 'What happens {ordinal}?', '{Ordinal}, ___.', '{Ordinal}, {event}.'],
    order: ['Tell it in order: first, next, then, finally.', 'What happened first?', 'First … next … then … finally …', '{orderedModel}'],
    vocabulary: ['Think about a word that fits what is happening.', 'Which word fits best: {words}?', 'You could use the word "{word}".', '{vocabModel}'],
  },
  vars: (item, el) => {
    const evs = item.events || [];
    const i = el?.startsWith('event_') ? Number(el.slice(6)) : 0;
    const o = storyOrdinal(i, evs.length);
    const who = whoList(item);
    return {
      whoModel: who.length > 1 ? `${who.slice(0, -1).join(', ')} and ${who.at(-1)}` : who[0],
      whoVerb: who.length > 1 ? 'were' : 'was',
      outcome: item.outcome,
      setting: item.setting,
      event: evs[i],
      ordinal: o,
      Ordinal: cap(o),
      words: (item.target_words || []).join(', '),
      word: (item.target_words || [])[0],
      vocabModel: item.vocabulary_model || `One word that fits is "${(item.target_words || [])[0]}".`,
      orderedModel: evs.map((e, k) => `${cap(storyOrdinal(k, evs.length))}, ${e}.`).join(' '),
    };
  },
  cueKey: (el) => (el.startsWith('event_') ? 'event' : el),
  achieved: { who: 'said who was there', where: 'said where the story happened', ending: 'said how it ended', order: 'told the events in order', vocabulary: 'used a precise word' },
  achievedFor: (el, item) => (el.startsWith('event_') ? `told what happened ${storyOrdinal(Number(el.slice(6)), (item.events || []).length)}` : null),
  evidenceLabel: { who: 'Who', where: 'Where', ending: 'Ending', order: 'Order', vocabulary: 'Word' },
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

// ---------- EXPLAIN (Explain Buddy: "Tell me how you make…") ----------
// The learner explains how they do something. The team lists the parts a clear explanation includes; any wording
// with the same meaning counts. A short answer gets the smallest useful cue for ONE missing part, never a rewrite.
const pointsOf = (item) => (item.points || []).filter((p) => p?.text);
const explain = {
  label: 'Explain Buddy',
  tagline: 'Say it clearly',
  activityName: 'How Do You…?',
  defaultGoal: 'Explain how I do something clearly and completely',
  movie: true,
  cueCard: (item) => pointsOf(item).map((_, i) => String(i + 1)),
  elements: (item) => pointsOf(item).map((_, i) => `point_${i}`),
  elementLabel: new Proxy({}, { get: (t, k) => (String(k).startsWith('point_') ? `Part ${Number(String(k).slice(6)) + 1}` : k) }),
  cueCardIndex: (el) => (String(el).startsWith('point_') ? Number(el.slice(6)) : null),
  cueKey: () => 'point',
  prompt: (item) => item.question || 'Tell me how you do it.',
  simplePrompt: (item) => item.simple_prompt || 'What is the first thing you do?',
  defaultCues: {
    point: ['Can you tell me more about how you do it?', '{pointQuestion}', '{pointStarter}', 'You could say: "{pointModel}"'],
  },
  vars: (item, el) => {
    const p = pointsOf(item)[Number(String(el || '').slice(6)) || 0] || {};
    return {
      pointQuestion: p.question || 'What else do you do?',
      pointStarter: p.starter || 'Then I ___.',
      pointModel: p.model || `I ${p.text}.`,
    };
  },
  achieved: {},
  evidenceLabel: new Proxy({}, { get: (t, k) => (String(k).startsWith('point_') ? `Part ${Number(String(k).slice(6)) + 1}` : undefined) }),
  itemLabel: (item) => item.title || item.question || 'explanation',
};

// Describe a Picture starters: everyday objects with Mulberry Symbols pictures ("sym:<name>", served from /symbols).
// Name, group and use are the team's answer key; Buddy accepts the alternatives and anything with the same meaning.
// Added as drafts so the therapist can check the wording before the learner sees them.
const obj = (pic, name, names, category, categories, fn, keywords) => ({ image_id: `sym:${pic}`, name, name_alternatives: names, category, category_alternatives: categories, function: fn, function_keywords: keywords });
export const STARTER_OBJECTS = [
  {
    title: 'Around the house',
    goal: 'Name, group and use in one sentence',
    items: [
      obj('toothbrush', 'toothbrush', ['tooth brush', 'electric toothbrush'], 'bathroom things', ['bathroom', 'things for washing', 'things for keeping clean', 'personal care', 'hygiene'], 'brush your teeth', ['teeth', 'tooth', 'brush', 'clean']),
      obj('kettle', 'kettle', [], 'kitchen things', ['kitchen', 'appliances', 'electrical things', 'things for cooking'], 'boil water for tea or coffee', ['boil', 'water', 'tea', 'coffee', 'hot']),
      obj('frying-pan', 'frying pan', ['pan', 'skillet'], 'kitchen things', ['kitchen', 'things for cooking', 'cooking things', 'pots and pans'], 'cook food like eggs on the hob', ['cook', 'fry', 'eggs', 'food']),
      obj('washing-machine', 'washing machine', ['washer'], 'appliances', ['appliance', 'electrical things', 'machine', 'machines', 'household things', 'laundry things'], 'wash dirty clothes', ['wash', 'clean', 'clothes', 'laundry']),
      obj('toaster', 'toaster', [], 'kitchen things', ['kitchen', 'appliances', 'electrical things'], 'make toast from bread', ['toast', 'bread', 'heat']),
      obj('torch', 'torch', ['flashlight'], 'tools', ['tool', 'things that make light', 'lights', 'household things'], 'see in the dark', ['dark', 'light', 'see', 'shine']),
      obj('hammer', 'hammer', [], 'tools', ['tool', 'DIY things', 'building things'], 'bang nails into wood', ['nail', 'nails', 'bang', 'hit', 'wood', 'build']),
      obj('plaster', 'plaster', ['band-aid', 'bandage', 'sticking plaster'], 'first aid', ['first aid things', 'medical things', 'things for when you are hurt'], 'cover a small cut', ['cut', 'cover', 'hurt', 'wound', 'bleeding']),
    ],
  },
  {
    title: 'Out and about',
    goal: 'Name, group and use in one sentence',
    items: [
      obj('mobile-phone', 'phone', ['mobile', 'mobile phone', 'smartphone', 'cell phone'], 'technology', ['electronics', 'gadget', 'gadgets', 'device', 'devices', 'things for talking to people'], 'call or message people', ['call', 'ring', 'message', 'text', 'talk']),
      obj('headphones', 'headphones', ['earphones', 'headset'], 'technology', ['electronics', 'music things', 'gadget', 'gadgets'], 'listen to music without other people hearing', ['listen', 'music', 'hear']),
      obj('wallet', 'wallet', ['purse'], 'things you carry', ['accessories', 'accessory', 'things for money', 'personal things'], 'keep your money and cards safe', ['money', 'cards', 'cash', 'keep', 'carry']),
      obj('umbrella', 'umbrella', ['brolly'], 'things for the weather', ['weather', 'rain things', 'accessories', 'things you carry'], 'keep you dry in the rain', ['rain', 'dry', 'wet']),
      obj('bicycle', 'bike', ['bicycle'], 'transport', ['vehicles', 'ways to travel', 'sports things'], 'ride to get somewhere', ['ride', 'cycle', 'travel', 'go', 'get']),
      obj('calculator', 'calculator', [], 'school things', ['school', 'maths things', 'stationery', 'technology'], 'work out sums', ['sum', 'sums', 'maths', 'math', 'add', 'numbers', 'count']),
      obj('scissors', 'scissors', [], 'school things', ['school', 'stationery', 'craft things', 'tools', 'tool'], 'cut paper', ['cut', 'paper', 'card']),
      obj('guitar', 'guitar', ['electric guitar', 'acoustic guitar'], 'musical instruments', ['instrument', 'instruments', 'music things'], 'play music', ['play', 'music', 'song', 'strum']),
    ],
  },
];

// Three everyday explanations every learner starts with. The team can edit them or add their own (e.g. from the
// child's interests: "Tell me how you make one of your paper characters").
export const STARTER_EXPLAIN = {
  title: 'How do you…?',
  goal: 'Explain how I do something clearly and completely',
  items: [
    {
      title: 'Making a sandwich',
      question: 'Tell me how you make a sandwich.',
      points: [
        { text: 'get two slices of bread', question: 'What do you start with?', starter: 'First I get ___.', model: 'First I get two slices of bread.' },
        { text: 'put a filling on the bread, like butter, ham or cheese', question: 'What do you put on the bread?', starter: 'Then I put ___ on the bread.', model: 'Then I put some cheese on the bread.' },
        { text: 'put the other slice on top', question: 'What do you do with the other slice?', starter: 'Then I put ___ on top.', model: 'Then I put the other slice on top.' },
        { text: 'cut it or eat it', question: 'What do you do at the end?', starter: 'Finally I ___ it.', model: 'Finally I cut it in half.' },
      ],
    },
    {
      title: 'Brushing teeth',
      question: 'Tell me how you brush your teeth.',
      points: [
        { text: 'put toothpaste on the toothbrush', question: 'What do you put on the toothbrush?', starter: 'First I put ___ on my toothbrush.', model: 'First I put toothpaste on my toothbrush.' },
        { text: 'brush all the teeth, top and bottom, for about two minutes', question: 'Which teeth do you brush, and for how long?', starter: 'I brush ___.', model: 'I brush all my teeth for two minutes.' },
        { text: 'spit and rinse', question: 'What do you do when you have finished brushing?', starter: 'Then I ___.', model: 'Then I spit out the toothpaste and rinse.' },
      ],
    },
    {
      title: 'Getting ready to go out',
      question: 'Tell me how you get ready to go out.',
      points: [
        { text: 'put on shoes and a coat or jacket', question: 'What do you put on?', starter: 'First I put on ___.', model: 'First I put on my shoes and coat.' },
        { text: 'take what is needed, like keys, phone, money or a bag', question: 'What do you take with you?', starter: 'I take ___.', model: 'I take my phone and my keys.' },
        { text: 'tell someone at home where they are going', question: 'Who do you tell, and what do you tell them?', starter: 'I tell ___ where I am going.', model: 'I tell my mum where I am going.' },
      ],
    },
  ],
};

// ---------- FOLLOW (Listen Buddy: follow a spoken instruction on screen) ----------
// A row of numbered boxes and a few of Buddy's own coloured shapes. Buddy gives the whole instruction once; the learner
// taps a shape, then a box. The last step can be spoken ("tell me which one is on the left"). When a step goes wrong,
// Buddy finds out why: says it back correctly → did something different (doing); needed to hear it again → remembering;
// needed to see it → understanding.
export const FOLLOW_COLOURS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
export const FOLLOW_SHAPES = ['circle', 'square', 'triangle', 'star', 'heart'];
export const FOLLOW_BOXES = 4;
// Everyday objects (Mulberry Symbols, served by the web app from /symbols) can be used instead of, or with, shapes.
// Token id "obj-<key>". `words` are what the learner might say for it.
export const FOLLOW_OBJECTS = {
  key: { name: 'key', file: 'key-1', words: ['key', 'keys'] },
  phone: { name: 'phone', file: 'mobile-phone', words: ['phone', 'mobile'] },
  mug: { name: 'mug', file: 'mug-2', words: ['mug', 'cup'] },
  apple: { name: 'apple', file: 'apple', words: ['apple'] },
  banana: { name: 'banana', file: 'banana', words: ['banana'] },
  ball: { name: 'ball', file: 'football', words: ['ball', 'football'] },
  pencil: { name: 'pencil', file: 'pencil', words: ['pencil'] },
  scissors: { name: 'scissors', file: 'scissors', words: ['scissors'] },
  toothbrush: { name: 'toothbrush', file: 'toothbrush', words: ['toothbrush', 'tooth brush', 'brush'] },
  watch: { name: 'watch', file: 'watch', words: ['watch'] },
  sandwich: { name: 'sandwich', file: 'sandwich', words: ['sandwich'] },
  bus: { name: 'bus', file: 'bus', words: ['bus'] },
  money: { name: 'money', file: 'money', words: ['money', 'cash'] },
  umbrella: { name: 'umbrella', file: 'umbrella', words: ['umbrella'] },
  cap: { name: 'cap', file: 'cap', words: ['cap', 'hat'] },
  headphones: { name: 'headphones', file: 'headphones', words: ['headphones', 'headphone'] },
  drum: { name: 'drum', file: 'drum', words: ['drum'] },
  glasses: { name: 'glasses', file: 'glasses', words: ['glasses'] },
  wallet: { name: 'wallet', file: 'wallet', words: ['wallet'] },
  guitar: { name: 'guitar', file: 'guitar', words: ['guitar'] },
  camera: { name: 'camera', file: 'camera', words: ['camera'] },
  clock: { name: 'clock', file: 'clock', words: ['clock'] },
};
const objectOf = (id) => (String(id || '').startsWith('obj-') ? FOLLOW_OBJECTS[String(id).slice(4)] || null : null);
export const isFollowToken = (id) => {
  if (objectOf(id)) return true;
  const [c, sh] = String(id || '').split('-');
  return FOLLOW_COLOURS.includes(c) && FOLLOW_SHAPES.includes(sh);
};
export const tokenName = (id) => objectOf(id)?.name || String(id || '').replace('-', ' ');
export const tokenImage = (id) => (objectOf(id) ? `/symbols/${objectOf(id).file}.svg` : null);
// The words that name a token: its colour and shape ("red", "circle"), or the object's words ("phone", "mobile").
export const tokenWords = (id) => objectOf(id)?.words || String(id || '').split('-').filter(Boolean);
// "shape" when an instruction only has shapes, otherwise "picture".
export const followThing = (item) => ((item?.tokens || []).some((t) => objectOf(t)) ? 'picture' : 'shape');
export const FOLLOW_STEP_TYPES = ['touch', 'box', 'next_to', 'left_of', 'right_of', 'say_left', 'say_right', 'say_box'];
// One step in words. `prevToken` lets "Then put it in box 3" follow "touch the green triangle".
export function followStepText(step, prevToken = null) {
  const t = step.token && step.token === prevToken ? 'it' : `the ${tokenName(step.token)}`;
  switch (step.type) {
    case 'touch': return `touch the ${tokenName(step.token)}`;
    case 'box': return `put ${t} in box ${step.box}`;
    case 'next_to': return `put ${t} next to the ${tokenName(step.target)}`;
    case 'left_of': return `put ${t} on the left of the ${tokenName(step.target)}`;
    case 'right_of': return `put ${t} on the right of the ${tokenName(step.target)}`;
    case 'say_left': return 'tell me which one is on the left';
    case 'say_right': return 'tell me which one is on the right';
    case 'say_box': return `tell me which one is in box ${step.box}`;
    default: return '';
  }
}
// Ray's wording for instructions: First … Then … Finally (two steps: First … Then).
const followOrdinal = (i, n) => (i === 0 ? 'first' : i === n - 1 && n > 2 ? 'finally' : 'then');
export const followSteps = (item) => (item.steps || []).filter((st) => FOLLOW_STEP_TYPES.includes(st?.type));
export function followInstruction(item) {
  const steps = followSteps(item);
  return steps.map((st, i) => `${cap(followOrdinal(i, steps.length))}, ${followStepText(st, i ? steps[i - 1].token : null)}.`).join(' ');
}
const follow = {
  label: 'Listen Buddy',
  tagline: 'Follow instructions',
  activityName: 'Follow on Screen',
  defaultGoal: 'Listen to the whole instruction, then follow the steps in order',
  cueCard: (item) => followSteps(item).map((_, i, a) => cap(followOrdinal(i, a.length))),
  elements: (item) => followSteps(item).map((_, i) => `step_${i}`),
  elementLabel: new Proxy({}, { get: (t, k) => (String(k).startsWith('step_') ? `Step ${Number(String(k).slice(5)) + 1}` : k) }),
  cueCardIndex: (el) => (String(el).startsWith('step_') ? Number(el.slice(5)) : null),
  prompt: () => 'Now you do it.',
  simplePrompt: (item) => `Touch a ${followThing(item)}, then touch a box.`,
  defaultCues: {},
  achieved: {},
  evidenceLabel: new Proxy({}, { get: (t, k) => (String(k).startsWith('step_') ? `Step ${Number(String(k).slice(5)) + 1}` : undefined) }),
  itemLabel: (item) => item.title || followInstruction(item).slice(0, 60),
};

// Starter instructions: two 2-step (plan goal 2's target), one 3-step trial like Ray's example, and one with everyday objects.
export const STARTER_FOLLOW = {
  title: 'Shapes and boxes',
  goal: 'Listen to the whole instruction, then follow the steps in order',
  items: [
    { title: 'Red circle, blue square', tokens: ['red-circle', 'blue-square', 'green-triangle'],
      steps: [{ type: 'box', token: 'red-circle', box: 1 }, { type: 'next_to', token: 'blue-square', target: 'red-circle' }] },
    { title: 'Touch, then move', tokens: ['green-triangle', 'yellow-star', 'purple-heart'],
      steps: [{ type: 'touch', token: 'green-triangle' }, { type: 'box', token: 'green-triangle', box: 3 }] },
    { title: 'Three steps', tokens: ['red-circle', 'blue-square', 'yellow-star'], start: { 'blue-square': 3 },
      steps: [{ type: 'touch', token: 'red-circle' }, { type: 'left_of', token: 'red-circle', target: 'blue-square' }, { type: 'say_left' }] },
    { title: 'Key and phone', tokens: ['obj-key', 'obj-phone', 'obj-wallet'],
      steps: [{ type: 'box', token: 'obj-key', box: 2 }, { type: 'next_to', token: 'obj-phone', target: 'obj-key' }] },
  ],
};

// ---------- STEPS (Task Buddy: Step by Step) ----------
// The learner does a real task with their hands, one step at a time, with Buddy coaching.
// The team picks ONE skill to practise for the whole activity; Buddy asks one question per step for that skill
// (before or after the learner does the step), and at the end asks them to explain all the steps.
// This module has its own five-level support ladder: 1 independent → 2 broad clue → 3 specific clue →
// 4 visual support (the step shown on screen) → 5 model. Levels 2–5 are stored as 0–3, like the other modules,
// so support codes work the same way (a model = F).
export const STEP_SKILLS = {
  understanding: {
    label: 'Understanding',
    goal: 'Understand and follow spoken instructions',
    when: 'before', // Buddy says the step, asks the question, then the learner does it
    question: () => 'What did I ask you to do?',
    clues: (s) => ['Think about what I just said.', `Here it is again. ${s.text}`, 'Look at the screen.', `I asked you to ${lowerFirst(firstSentence(s.text))}`],
  },
  memory: {
    label: 'Memory',
    goal: 'Remember the steps of a task without being told',
    when: 'before', // Buddy asks for the step before saying it
    question: (s, i) => (i === 0 ? 'What is the first thing you need to do?' : 'What do you need to do next?'),
    clues: (s, i, prev) => [i === 0 ? 'Think about how this task starts.' : `Think about what you just did: ${lowerFirst(firstSentence(prev?.text || 'the last step'))}.`, `It starts like this: ${firstWords(s.text, 3)}…`, 'Look at the screen.', `The next step is: ${s.text}`],
  },
  expressive: {
    label: 'Expressive language',
    goal: 'Describe what they did in a complete sentence',
    when: 'after',
    question: () => 'Tell me what you just did.',
    clues: (s) => ['Think about what your hands did.', 'Start with: I…', 'Look at the screen. What did you do?', `You could say: I ${lowerFirst(firstSentence(s.text))}`],
  },
  reasoning: {
    label: 'Reasoning',
    goal: 'Explain why a step matters, and what to do when something goes wrong',
    when: 'after',
    question: () => 'Why do we do that step?',
    clues: (s) => ['Think about what would happen if you skipped it.', 'It helps because…', 'Look at the screen. What does that step help with?', 'One reason is that it makes the next step easier.'],
  },
  independence: {
    label: 'Checking my own work',
    goal: 'Check their own work and know when a step is finished',
    when: 'after',
    question: () => 'How do you know that step is finished?',
    clues: () => ['Look at what you have done.', 'What should it look like now?', 'Look at the screen. Does yours look like this?', 'I know it is finished because it looks like the picture.'],
  },
};
export const STEP_LEVELS = ['broad clue', 'specific clue', 'visual support', 'model'];
export const DEFAULT_STEP_SKILL = 'understanding';
export const stepSkillOf = (activity) => (STEP_SKILLS[activity?.content?.skill] ? activity.content.skill : DEFAULT_STEP_SKILL);
function firstSentence(t) { return String(t || '').split(/(?<=[.!?])\s/)[0].replace(/[.!?]+$/, '').trim(); }
function firstWords(t, n) { return String(t || '').split(/\s+/).slice(0, n).join(' ').replace(/[.,;:!?]+$/, ''); }
function lowerFirst(t) { const x = String(t || ''); return /^[A-Z][a-z]/.test(x) && !/^I\b/.test(x) ? x[0].toLowerCase() + x.slice(1) : x; }
/** The question, example answer, clues and model for one step under the activity's chosen skill. Team wording wins. */
export function stepCoach(activity, item, i) {
  const skill = stepSkillOf(activity);
  const k = STEP_SKILLS[skill];
  const steps = item.steps || [];
  const s = steps[i] || {};
  const own = s.q?.[skill] || {};
  const ladder = k.clues(s, i, steps[i - 1]);
  if (own.broad) ladder[0] = own.broad;
  if (own.clue) ladder[1] = own.clue;
  if (own.model) ladder[3] = own.model;
  else if (skill === 'reasoning' && own.answer) ladder[3] = `One reason: ${own.answer}.`;
  return { skill, when: k.when, question: own.question?.trim() || k.question(s, i), answer: own.answer || null, ladder };
}

const steps = {
  label: 'Task Buddy',
  tagline: 'Do it step by step',
  activityName: 'Step by Step',
  defaultGoal: 'Follow a real task step by step and explain what they did',
  movie: false,
  cueCard: () => null,
  elements: () => ['answer'],
  elementLabel: { answer: 'Answer', retell: 'Steps' },
  cueCardIndex: () => null,
  prompt: () => 'Press Done when you have finished this step.',
  simplePrompt: () => 'Do this step, then press Done.',
  defaultCues: {},
  vars: () => ({}),
  cueKey: (el) => el,
  achieved: {},
  evidenceLabel: { answer: 'Answer' },
  itemLabel: (item) => item.title || 'task',
};

// Ready-made tasks (Mulberry Symbols). Added once per family as drafts, so the therapist can check the wording
// first. Families can swap in photos of their own things, which helps the learner carry the task over to real life.
// "Fold a jumper" follows the testers' plan and has questions for every skill; the others use Buddy's own questions
// for most skills.
const st = (text, image, q = {}) => ({ text, image_id: `sym:${image}`, q });
export const STARTER_STEPS = [
  {
    title: 'Fold a jumper',
    goal: 'Follow a real task step by step and explain what they did',
    items: [{
      title: 'Fold a jumper and put it away',
      steps: [
        st('Put the jumper on the table with the front facing up. Smooth out any wrinkles.', 'jumper', {
          understanding: { question: 'Where should you put the jumper?', answer: 'on the table, front facing up' },
          reasoning: { question: 'Why should the jumper be flat before folding it?', answer: 'so it folds neatly without creases' },
          independence: { question: 'How will you know when you are ready for the next step?', answer: 'it is flat with no wrinkles' },
        }),
        st('Fold one sleeve across the middle. Then fold the other sleeve across.', 'fold-clothes-to', {
          understanding: { question: 'Which part of the jumper do you fold?', answer: 'the sleeves' },
          reasoning: { question: 'Why do we fold the sleeves towards the middle?', answer: 'so they do not hang out and the jumper is neat' },
          independence: { question: 'Are both sleeves folded? How can you tell?', answer: 'both sleeves are across the middle' },
        }),
        st('Take the bottom of the jumper and fold it up towards the neck.', 'fold-clothes-to', {
          understanding: { question: 'Which part of the jumper do you lift?', answer: 'the bottom' },
          reasoning: { question: 'Why is it helpful to make the jumper smaller?', answer: 'it takes less space and fits in the basket' },
          independence: { question: 'Look at your jumper. Does it look neatly folded?', answer: 'the edges line up' },
        }),
        st('Straighten the edges and smooth the jumper so it looks neat.', 'tidy-up-to', {
          understanding: { question: 'What do you need to straighten?', answer: 'the edges' },
          reasoning: { question: 'Why is it important to fold clothes neatly?', answer: 'so they do not get creased and are easy to find' },
          independence: { question: 'How can you check whether your jumper is tidy?', answer: 'the edges are straight and it is smooth' },
        }),
        st('Find the size label inside the jumper. Tell me what size it says.', 'jumper', {
          understanding: { question: 'Where can you find the size label?', answer: 'inside the jumper, near the neck' },
          reasoning: { question: 'Why do you need to check the size?', answer: 'to find the right basket' },
          independence: { question: 'What could you do if you cannot find the label?', answer: 'look at the other side or ask an adult' },
        }),
        st('Look at the labels on the baskets. Find the one that matches the size of your jumper.', 'basket', {
          understanding: { question: 'Where does the jumper go?', answer: 'in the basket with the same size', broad: "Think about the jumper's size.", clue: 'Look for the basket with the same size label.', model: 'The jumper is size M, so it goes in the M basket.' },
          reasoning: { question: 'Why should the jumper go in the matching basket?', answer: 'so it is easy to find the right size' },
          independence: { question: 'How do you know you have found the right basket?', answer: 'the basket label matches the jumper label' },
        }),
        st('Put the folded jumper neatly in the basket with the matching size.', 'basket-2', {
          understanding: { question: 'Where should you put the jumper?', answer: 'in the basket with the matching size' },
          reasoning: { question: 'Why is it important to put the jumper in the right place?', answer: 'so you can find it next time' },
          independence: { question: 'How could you do this task next time without help?', answer: 'remember the steps or look at the pictures' },
        }),
      ],
    }],
  },
  {
    title: 'Pack my bag',
    goal: 'Follow a real task step by step and explain what they did',
    items: [{ title: 'Pack my bag', steps: [
      st('Open your bag.', 'school-bag', { understanding: { question: 'What do you open?', answer: 'my bag' } }),
      st('Put your pencil case in the bag.', 'pencil-case', { understanding: { question: 'What goes in the bag first?', answer: 'the pencil case' }, reasoning: { question: 'Why do you need your pencil case?', answer: 'to write and draw' } }),
      st('Put your lunch box in the bag.', 'lunch-box', { understanding: { question: 'What do you put in next?', answer: 'the lunch box' }, reasoning: { question: 'Why do you pack your lunch box?', answer: 'so I have food for lunch' } }),
      st('Close the zip.', 'zip', { understanding: { question: 'What do you close?', answer: 'the zip' }, reasoning: { question: 'Why do you close the zip?', answer: 'so nothing falls out' } }),
    ] }],
  },
  {
    title: 'Make a glass of squash',
    goal: 'Follow a real task step by step and explain what they did',
    items: [{ title: 'Make a glass of squash', steps: [
      st('Get a clean glass and put it on the table.', 'glass', { understanding: { question: 'What do you need to get?', answer: 'a clean glass' } }),
      st('Pour a little squash into the glass.', 'squash', { understanding: { question: 'How much squash do you pour?', answer: 'a little' }, reasoning: { question: 'Why only a little squash?', answer: 'so it is not too strong' } }),
      st('Fill the glass with cold water from the tap. Stop before it gets to the top.', 'tap', { understanding: { question: 'When do you stop filling the glass?', answer: 'before it gets to the top' }, reasoning: { question: 'Why do you stop before the top?', answer: 'so it does not spill' } }),
      st('Stir it with a spoon.', 'spoon', { understanding: { question: 'What do you stir it with?', answer: 'a spoon' }, reasoning: { question: 'Why do you stir it?', answer: 'to mix the squash and water' } }),
    ] }],
  },
  {
    title: 'Pair the socks',
    goal: 'Follow a real task step by step and explain what they did',
    items: [{ title: 'Pair the socks', steps: [
      st('Take the socks out of the laundry basket.', 'laundry-basket', { understanding: { question: 'Where are the socks?', answer: 'in the laundry basket' } }),
      st('Find two socks that match.', 'socks', { understanding: { question: 'What are you looking for?', answer: 'two socks that match' }, reasoning: { question: 'Why do the socks need to match?', answer: 'so you wear a pair' } }),
      st('Fold one sock over the other to keep them together.', 'socks', { understanding: { question: 'What do you do with the two socks?', answer: 'fold them together' } }),
      st('Put the pair of socks in the drawer.', 'drawer', { understanding: { question: 'Where do the socks go?', answer: 'in the drawer' }, reasoning: { question: 'Why do they go in the drawer?', answer: 'so you can find them' } }),
    ] }],
  },
  {
    title: 'Set the table',
    goal: 'Follow a real task step by step and explain what they did',
    items: [{ title: 'Set the table for one', steps: [
      st('Put a plate on the table in front of a chair.', 'plate', { understanding: { question: 'Where does the plate go?', answer: 'in front of a chair' } }),
      st('Put the fork on the left of the plate.', 'fork', { understanding: { question: 'Which side does the fork go?', answer: 'the left' } }),
      st('Put the knife on the right of the plate.', 'knife', { understanding: { question: 'Which side does the knife go?', answer: 'the right' } }),
      st('Put a glass above the knife.', 'glass', { understanding: { question: 'Where does the glass go?', answer: 'above the knife' }, reasoning: { question: 'Why do we set the table before eating?', answer: 'so everything is ready for the meal' } }),
    ] }],
  },
];

export const MODES = { object, story, task, conversation, listen, think, recall, explain, follow, steps };

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
  if (mode === 'follow') {
    const n = els.filter((e) => e.startsWith('step_')).length;
    const total = followSteps(item).length;
    return n && n === total ? `followed ${total === 1 ? 'the step' : `all ${NUM[total] || total} steps`}` : `did ${n === 1 ? 'one step' : `${NUM[n] || n} steps`}`;
  }
  if (mode === 'explain') {
    const n = els.filter((e) => e.startsWith('point_')).length;
    const total = pointsOf(item).length;
    if (n && n === total) return 'explained every part clearly';
    return n === 1 ? 'made a good start' : `explained ${NUM[n] || n} parts`;
  }
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
    const ords = seq.map((e) => (mode === 'story' ? storyOrdinal : ordinal)(Number(e.split('_')[1]), total));
    const list = joinPhrases([...new Set(ords)]);
    let p = mode === 'story' ? `told what happened ${list}` : `told the ${list} step${ords.length > 1 ? 's' : ''}`;
    if (els.includes('order') && seq.length > 1) p += ', in order';
    parts.push(p);
  } else if (els.includes('order')) {
    parts.push(achievedPhrase(mode, 'order', item));
  }
  return joinPhrases(parts);
}
