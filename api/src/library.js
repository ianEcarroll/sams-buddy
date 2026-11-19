// Activity library: ready-made activities a family can add to their learner's activities with one tap.
// Items live in code, like the starters, so they are reviewed and versioned with everything else; nothing to migrate.
// An added item becomes a normal activity, saved as a DRAFT (the therapist checks it, then makes it ready), and is
// personalised in Activities afterwards. The original is never changed.
//
// Text is TALVO's own. Pictures are Mulberry Symbols (CC BY-SA 4.0, © Steve Lee), stored as "sym:<name>".
export const LIBRARY_SOURCE = 'Text written for TALVO';
export const LIBRARY_PICTURE_CREDIT = 'Pictures: Mulberry Symbols © Steve Lee, CC BY-SA 4.0 (mulberrysymbols.org)';

// One step: what Foxy says, the picture, and the "understanding" question with its answer.
// `more` adds questions for other skills: { reasoning: [question, answer], independence: [question, answer] }.
const s = (text, image, question, answer, more = {}) => ({
  text, image_id: `sym:${image}`,
  q: {
    understanding: { question, answer },
    ...Object.fromEntries(Object.entries(more).map(([k, [qq, aa]]) => [k, { question: qq, answer: aa }])),
  },
});

const task = (id, title, level, tags, steps) => ({
  id: `task-${id}`,
  mode: 'steps',
  title,
  goal: 'Follow a real task step by step and explain what they did',
  plan_goal: 'instructions',
  level, // a first guide only; the therapist decides what is easy or hard for each learner
  tags,
  age: '10–20',
  source: LIBRARY_SOURCE,
  content: { items: [{ title, steps }], skill: 'understanding', run: 'learn' },
});

export const LIBRARY = [
  task('wash-hands', 'Wash my hands', 'Easy', ['daily living', 'hygiene'], [
    s('Turn on the tap and wet your hands.', 'tap', 'What do you turn on?', 'the tap'),
    s('Put soap on your hands.', 'soap', 'What do you put on your hands?', 'soap', { reasoning: ['Why do we use soap?', 'to get rid of germs and dirt'] }),
    s('Rub your hands together for 20 seconds. Wash the backs of your hands and between your fingers.', 'clean-hands', 'How long do you rub your hands?', '20 seconds', { reasoning: ['Why do we rub for a long time?', 'so the soap cleans every part'] }),
    s('Rinse the soap off under the water. Then turn off the tap.', 'wash-hands-to', 'What do you do with the soap?', 'rinse it off', { independence: ['What could you do if there is still soap on your hands?', 'rinse them again'] }),
    s('Dry your hands with a towel.', 'dry-hands-to', 'What do you dry your hands with?', 'a towel'),
  ]),
  task('brush-teeth', 'Brush my teeth', 'Easy', ['daily living', 'hygiene', 'morning'], [
    s('Wet your toothbrush. Put a small blob of toothpaste on it.', 'toothpaste', 'What do you put on your toothbrush?', 'a small blob of toothpaste'),
    s('Brush your teeth for two minutes. Do the front, the back and the top.', 'toothbrush', 'How long do you brush?', 'two minutes', { reasoning: ['Why do we brush for two minutes?', 'so every tooth gets clean'] }),
    s('Spit the toothpaste into the sink.', 'tap', 'Where do you spit the toothpaste?', 'into the sink'),
    s('Rinse your toothbrush under the tap. Put it away.', 'toothbrush', 'What do you do with your toothbrush at the end?', 'rinse it and put it away', { independence: ['What could you do if you cannot find your toothbrush?', 'look in the usual place or ask an adult'] }),
  ]),
  task('get-dressed', 'Get dressed', 'Medium', ['daily living', 'morning'], [
    s('Choose clean clothes for today. Put them on your bed.', 'get-dressed-to', 'What do you put on your bed?', 'clean clothes', { independence: ['What could you do if you cannot find a clean top?', 'ask an adult or look in the wash basket'] }),
    s('Put on your top.', 't-shirt', 'What do you put on first?', 'my top'),
    s('Put on your trousers.', 'trousers', 'What goes on after your top?', 'my trousers'),
    s('Put on your socks.', 'socks', 'What do you put on your feet first?', 'my socks', { reasoning: ['Why do socks go on before shoes?', 'so shoes are comfy and stay clean inside'] }),
    s('Put on your shoes. Do up the laces or straps.', 'shoe-mans', 'What goes on last?', 'my shoes'),
  ]),
  task('put-on-coat', 'Put on my coat', 'Easy', ['daily living', 'going out'], [
    s('Hold your coat open in front of you.', 'coat', 'How do you hold your coat?', 'open in front of me'),
    s('Put one arm in a sleeve. Then put the other arm in.', 'put-on-coat-to', 'What do you put in the sleeves?', 'my arms'),
    s('Pull the coat across the front of your body. Line up the bottom of the zip.', 'coat', 'What do you line up?', 'the bottom of the zip', { independence: ['What could you do if the zip will not line up?', 'try again slowly or ask for help'] }),
    s('Push the zip together at the bottom. Pull it up to your chest.', 'zip', 'Which way do you pull the zip?', 'up', { reasoning: ['Why do we zip up our coat?', 'to keep warm and dry'] }),
  ]),
  task('make-bed', 'Make my bed', 'Medium', ['daily living', 'morning', 'tidying'], [
    s('Pull the covers back. Check that nothing is stuck in the bed.', 'single-bed', 'What do you pull back?', 'the covers'),
    s('Smooth the bottom sheet so it is flat.', 'make-the-bed-to', 'What do you smooth flat?', 'the bottom sheet'),
    s('Pull the duvet up to the top of the bed.', 'make-the-bed-to', 'Where does the duvet go?', 'up to the top of the bed'),
    s('Smooth the duvet with your hands.', 'make-the-bed-to', 'How do you make the duvet flat?', 'smooth it with my hands', { reasoning: ['Why do we make our bed?', 'so the room looks tidy and the bed is ready'] }),
    s('Put the pillow at the top of the bed.', 'single-bed', 'Where does the pillow go?', 'at the top of the bed'),
  ]),
  task('cereal', 'Make a bowl of cereal', 'Easy', ['food', 'kitchen', 'morning'], [
    s('Get a bowl and a spoon. Put them on the table.', 'bowl', 'What do you put on the table?', 'a bowl and a spoon'),
    s('Pour cereal into the bowl. Stop when the bowl is about half full.', 'cereal-box-bran', 'When do you stop pouring the cereal?', 'when the bowl is half full', { reasoning: ['Why do we stop at half full?', 'so there is room for the milk'] }),
    s('Pour in the milk. Stop before the bowl is full.', 'milk-carton', 'When do you stop pouring the milk?', 'before the bowl is full', { independence: ['What could you do if you pour too much milk?', 'eat some and leave a little or ask for help'] }),
    s('Put the milk back in the fridge.', 'fridge', 'Where does the milk go?', 'in the fridge', { reasoning: ['Why does milk go back in the fridge?', 'so it stays cold and fresh'] }),
    s('Eat your cereal with the spoon.', 'spoon', 'What do you eat it with?', 'a spoon'),
  ]),
  task('sandwich', 'Make a cheese sandwich', 'Medium', ['food', 'kitchen'], [
    s('Put two slices of bread on a plate.', 'bread-slice', 'How many slices of bread do you need?', 'two', { independence: ['What could you do if the bread has gone mouldy?', 'throw it away and ask an adult'] }),
    s('Spread butter on one slice with the knife. Take care with the knife.', 'butter', 'What do you spread on the bread?', 'butter', { reasoning: ['Why do we take care with the knife?', 'it is sharp and could hurt us'] }),
    s('Put a slice of cheese on the buttered bread.', 'cheese-slices', 'What goes on the buttered bread?', 'cheese'),
    s('Put the other slice of bread on top.', 'sandwich-cheese', 'What goes on top?', 'the other slice of bread'),
    s('Put the butter and the cheese back in the fridge.', 'fridge', 'Where do the butter and cheese go?', 'back in the fridge'),
  ]),
  task('washing-up', 'Do the washing up', 'Medium', ['kitchen', 'chores'], [
    s('Fill the bowl with warm water. Add a little washing-up liquid.', 'washing-up-bowl', 'What do you put in the bowl?', 'warm water and washing-up liquid', { independence: ['What could you do if the water is too hot?', 'add cold water or ask an adult'] }),
    s('Wash each plate and cup with the dish cloth.', 'dish-cloth', 'What do you wash with?', 'the dish cloth'),
    s('Rinse each one under the tap.', 'tap', 'What do you do after washing each one?', 'rinse it under the tap', { reasoning: ['Why do we rinse things?', 'to get the soap off'] }),
    s('Dry each one with a tea towel. Put it away.', 'tea-towel', 'What do you dry things with?', 'a tea towel'),
  ]),
  task('rubbish', 'Take out the rubbish', 'Medium', ['chores', 'home'], [
    s('Tie the top of the bin bag.', 'bin-bag', 'What do you tie?', 'the top of the bin bag'),
    s('Lift the bag out of the bin.', 'put-out-rubbish-to', 'What do you lift out?', 'the bin bag', { independence: ['What could you do if the bag is too heavy?', 'ask an adult to help'] }),
    s('Carry it to the outside bin. Put it in.', 'put-out-rubbish-to', 'Where do you take the bag?', 'to the outside bin'),
    s('Put a new bag in the kitchen bin.', 'bin-bag', 'What goes in the empty bin?', 'a new bag', { reasoning: ['Why do we put in a new bag?', 'so the bin is ready for the next rubbish'] }),
    s('Wash your hands.', 'wash-hands-to', 'What do you do at the end?', 'wash my hands'),
  ]),
  task('water-plant', 'Water a plant', 'Easy', ['chores', 'home', 'garden'], [
    s('Fill the watering can with water from the tap.', 'watering-can', 'What do you fill with water?', 'the watering can'),
    s('Carry the watering can to the plant.', 'potted-plant', 'Where do you carry the watering can?', 'to the plant'),
    s('Pour a little water on the soil. Try not to pour on the leaves.', 'water-plants-to', 'Where do you pour the water?', 'on the soil', { reasoning: ['Why do plants need water?', 'to stay alive and grow'] }),
    s('Stop when the soil is damp. Put the watering can back.', 'watering-can', 'When do you stop pouring?', 'when the soil is damp', { independence: ['What could you do if you pour too much?', 'stop and let it drain or ask for help'] }),
  ]),
  task('charge-phone', 'Charge my phone', 'Easy', ['technology', 'home'], [
    s('Find your charger. Plug the plug into the wall socket.', 'charger-electric', 'What do you plug into the wall?', 'the charger', { independence: ['What could you do if the wire looks broken?', 'do not use it and tell an adult'] }),
    s('Plug the other end into your phone.', 'mobile-phone', 'What do you plug into your phone?', 'the other end of the charger'),
    s('Check that the screen shows your phone is charging.', 'charge', 'What do you check?', 'that the phone is charging', { reasoning: ['Why do we check it is charging?', 'so the battery will not run out'] }),
    s('Leave your phone to charge. Put it somewhere safe.', 'mobile-phone', 'What do you do while it charges?', 'leave it somewhere safe'),
  ]),
  task('shop', 'Buy something at a shop', 'Medium', ['out and about', 'social', 'money'], [
    s('Choose what you want to buy. Pick it up.', 'shop', 'What do you do first?', 'choose what I want and pick it up'),
    s('Take it to the person at the till. Say hello.', 'shop', 'Who do you take it to?', 'the person at the till', { reasoning: ['Why do we say hello?', 'it is polite and friendly'] }),
    s('Listen to the price. Get your money or card ready.', 'money', 'What do you listen for?', 'the price', { independence: ['What could you do if you did not hear the price?', 'ask them to say it again'] }),
    s('Pay and take your change.', 'purse', 'What do you do after you hear the price?', 'pay'),
    s('Say thank you. Put your things in your bag.', 'school-bag', 'What do you say at the end?', 'thank you'),
  ]),
];

export const libraryById = (id) => LIBRARY.find((x) => x.id === id) || null;

// What the Library page shows for each item: no questions, just enough to choose.
export function libraryCard(item, added = null) {
  const steps = item.content.items[0].steps;
  return {
    id: item.id, mode: item.mode, title: item.title, goal: item.goal, level: item.level, tags: item.tags, age: item.age, source: item.source,
    stepCount: steps.length, steps: steps.map((x) => x.text), images: steps.map((x) => x.image_id),
    added, // { id, status } of the learner's copy, or null
  };
}

// The activity row a family gets. Always a draft, linked back to the library item.
export function activityFromLibrary(item) {
  return { mode: item.mode, title: item.title, goal: item.goal, plan_goal: item.plan_goal, status: 'draft', content: { ...structuredClone(item.content), library_id: item.id } };
}

// Checks every item (used by the tests): ids unique, steps complete, questions present, pictures exist.
export function libraryProblems(symbolSlugs, items = LIBRARY) {
  const out = [];
  const ids = new Set();
  for (const it of items) {
    if (ids.has(it.id)) out.push(`${it.id}: duplicate id`);
    ids.add(it.id);
    const steps = it.content?.items?.[0]?.steps || [];
    if (steps.length < 3 || steps.length > 7) out.push(`${it.id}: ${steps.length} steps (want 3 to 7)`);
    if (!it.tags?.length) out.push(`${it.id}: no tags`);
    steps.forEach((st, i) => {
      const where = `${it.id} step ${i + 1}`;
      if (!st.text?.trim()) out.push(`${where}: no text`);
      if (!st.image_id?.startsWith('sym:') || !symbolSlugs.has(st.image_id.slice(4))) out.push(`${where}: picture ${st.image_id} not found`);
      const u = st.q?.understanding;
      if (!u?.question?.trim() || !u?.answer?.trim()) out.push(`${where}: missing understanding question or answer`);
    });
  }
  return out;
}
