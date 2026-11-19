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

// ---- Think: "something unexpected happens". Each situation names the problem, safe things to do, a reason, a plan B,
// and ideas that are NOT safe (flagged for the team if the learner says them).
const think = (id, title, tags, items) => ({
  id: `think-${id}`, mode: 'think', title,
  goal: 'Notice the problem, say a safe thing to do and why, and what to do if it does not work',
  plan_goal: 'unexpected', level: null, tags, age: '10–20', source: LIBRARY_SOURCE,
  content: { items },
});
const sit = (title, scenario, problem, good_actions, reason_example, backup_example, unsafe) => ({ title, scenario, problem, good_actions, reason_example, backup_example, unsafe });

LIBRARY.push(
  think('school', 'Think: surprises at school', ['school'], [
    sit('Different classroom', 'Your timetable says maths is in room 12. You get there and the room is empty.', 'the class is not where I expected', ['ask a teacher nearby', 'go to the school office and ask', 'check my timetable again', 'ask a classmate where the class is'], 'a teacher will know where my class is', 'go to the school office', ['leave the school', 'wait on my own for a long time']),
    sit('Lunch left at home', 'It is lunchtime. You open your bag and your lunch is not in it.', 'I do not have my lunch', ['tell a teacher or the lunch staff', 'ask the office if they can call home', 'ask what the school can do to help'], 'an adult at school can help me get something to eat', 'ask the office to phone my parent', ['take someone else’s lunch', 'leave school to go home on my own']),
    sit('A different teacher', 'You arrive for your lesson and there is a different teacher you do not know.', 'there is a new teacher instead of my usual one', ['listen to what the new teacher says', 'ask the teacher what to do if I am not sure', 'quietly ask a classmate'], 'the new teacher can tell me the plan for the lesson', 'ask another teacher or go to the office', ['leave the room', 'refuse to join in']),
    sit('The fire alarm', 'A loud alarm goes off in the middle of a lesson.', 'the fire alarm is ringing', ['stop and listen to the teacher', 'follow my class to the meeting place', 'stay with my class'], 'the teacher knows the safe way out', 'stay close to another adult', ['run off on my own', 'go back to get my things']),
  ]),
  think('home', 'Think: surprises at home', ['home'], [
    sit('The wifi stops', 'You are watching a video on your tablet and it suddenly stops. A message says there is no internet.', 'the internet has stopped working', ['check whether other devices still work', 'tell a parent', 'wait a minute and try again'], 'a parent may know how to fix it, and waiting can help', 'do something else I enjoy until it is fixed', ['pull cables out of the router', 'keep pressing every button on it']),
    sit('No key', 'You get home from school and your key is not in your bag.', 'I cannot get into the house', ['ring the doorbell or knock', 'call or message a parent', 'ask a neighbour my family trusts'], 'a parent can tell me what to do or come and let me in', 'ask a trusted adult nearby for help', ['climb in through a window', 'go off with someone I do not know']),
    sit('A burning smell', 'You are in your room and you smell something burning from the kitchen.', 'there is a burning smell', ['tell an adult straight away', 'go to where an adult is', 'leave the room if there is smoke and tell an adult'], 'an adult knows how to keep everyone safe', 'call for help from another adult or a neighbour', ['touch the hot things myself', 'ignore it']),
    sit('The doorbell', 'You are at home with an older sibling, and the doorbell rings. You are not expecting anyone.', 'someone is at the door and I do not know who', ['ask an adult at home to answer', 'tell my sibling or a parent', 'not open the door if I do not know them'], 'an adult can check who it is and keep us safe', 'call a parent and tell them', ['open the door to someone I do not know', 'let them in']),
  ]),
  think('out', 'Think: surprises when out and about', ['out and about'], [
    sit('Missed the bus', 'You are waiting at the bus stop, and the bus you wanted drives past without stopping.', 'I missed my bus', ['check the timetable for the next bus', 'call or message a parent', 'ask someone who works at the stop or station'], 'a parent can help me plan, and the timetable shows the next bus', 'ask a bus driver or staff member', ['walk off without telling anyone', 'accept a lift from someone I do not know']),
    sit('No wallet at the till', 'You are at the shop till and you cannot find your wallet.', 'I cannot pay', ['say sorry and explain to the person at the till', 'look carefully in my bag and pockets', 'ask the adult I am with', 'call a parent'], 'I can sort it out without taking anything', 'put the things back and ask for help to find my wallet', ['leave the shop with the things', 'run out of the shop']),
    sit('Wrong change', 'You pay in a shop. When you count your change, it is less than it should be.', 'I think I was given too little change', ['count the money again carefully', 'politely tell the person at the till', 'ask the adult I am with to check'], 'it may be a mistake, and they can fix it', 'ask to speak to another member of staff', ['shout at the person', 'walk away angry']),
    sit('Lost in a busy place', 'You are in a busy shopping centre. You look around and cannot see the people you came with.', 'I cannot see my group', ['stay where I am and call or message them', 'ask a person who works there for help', 'go to the information desk'], 'staying put makes it easier for them to find me', 'ask a staff member to call for my group', ['go off to look on my own', 'leave with someone I do not know']),
  ]),
  think('friends', 'Think: surprises with friends', ['friends', 'social'], [
    sit('Plans cancelled', 'You were looking forward to seeing a friend. They send you a message to say they cannot come.', 'my friend cancelled our plan', ['reply kindly and ask to meet another day', 'tell a parent I feel disappointed', 'do something else I enjoy'], 'being kind keeps the friendship strong', 'talk to a parent or another friend', ['send an angry message', 'turn up at their house anyway']),
    sit('Someone in my seat', 'You get to the lunch table and someone is sitting in your usual seat.', 'someone is in my seat', ['sit in another seat', 'politely ask if I can sit there', 'ask a teacher if I am not sure'], 'one different seat is not a big problem, and asking politely is kind', 'sit with another friend', ['shout at them', 'push them out of the seat']),
    sit('An unkind message', 'A classmate sends an unkind comment about you in a group chat.', 'someone has been unkind to me', ['not reply straight away', 'show a parent or a teacher', 'block or mute them'], 'an adult can help me deal with it safely', 'talk to another adult I trust', ['send an unkind message back', 'delete it so no one can see']),
    sit('A borrowed game breaks', 'You borrowed a friend’s game controller. It stops working while you are using it.', 'the thing I borrowed is broken', ['tell my friend honestly', 'say sorry', 'ask a parent how we could fix or replace it'], 'telling the truth keeps trust, and a parent can help', 'ask another adult for ideas', ['hide it and say nothing', 'blame someone else']),
  ]),
);

// ---- Talk: a short conversation about a topic. Foxy opens, then the learner comments and asks questions.
// The example comment and question are the model Foxy gives when the learner needs the most help.
const talk = (id, title, tags, items) => ({
  id: `talk-${id}`, mode: 'conversation', title,
  goal: 'Relevant comments, personal connections and follow-up questions',
  plan_goal: 'conversation', level: null, tags, age: '10–20', source: LIBRARY_SOURCE,
  content: { items },
});
const top = (topic, opener, example_comment, example_question) => ({ topic, opener, example_comment, example_question });

LIBRARY.push(
  talk('favourites', 'Talk: favourite things', ['favourites'], [
    top('food', 'I think pizza is delicious. What kind of food do you like?', 'I like pasta.', 'What is your favourite food?'),
    top('music', 'I like listening to music when I am happy. What music do you like?', 'I like listening to pop music.', 'What music do you like?'),
    top('films', 'I watched a really funny film. Do you like watching films?', 'I like funny films too.', 'What is your favourite film?'),
    top('animals', 'Animals are great. I like foxes, of course. What animals do you like?', 'I like dogs.', 'Do you have a pet?'),
  ]),
  talk('weekend', 'Talk: weekends and holidays', ['weekend', 'holidays'], [
    top('the weekend', 'The weekend is nearly here. What do you like to do at the weekend?', 'I like to relax at home.', 'What do you do at the weekend?'),
    top('holidays', 'I love holidays. Where would you like to go for a holiday?', 'I would like to go to the beach.', 'Where do you like to go on holiday?'),
    top('birthdays', 'Birthdays are fun. What do you like to do on your birthday?', 'I like having a cake.', 'When is your birthday?'),
    top('the weather', 'It is nice to know what the weather is like. What kind of weather do you like?', 'I like sunny days.', 'What is your favourite season?'),
  ]),
  talk('hobbies', 'Talk: hobbies and games', ['hobbies', 'games'], [
    top('video games', 'Some people love video games. Do you like playing games?', 'I like playing games with my friends.', 'What game do you like to play?'),
    top('sport', 'Sport is a good way to move and have fun. Do you like any sports?', 'I like to swim.', 'What sport do you like?'),
    top('drawing and making things', 'I like making things with my paws. Do you like drawing or making things?', 'I like drawing.', 'What do you like to make?'),
    top('playing an instrument', 'Playing music can be great fun. Have you ever played an instrument?', 'I like drums.', 'Which instrument would you like to play?'),
  ]),
  talk('school', 'Talk: school and learning', ['school'], [
    top('favourite subject', 'There are lots of subjects at school. Which one do you like best?', 'I like art best.', 'What is your favourite subject?'),
    top('lunch at school', 'Lunchtime is an important part of the day. What do you like to eat at lunch?', 'I like sandwiches.', 'What do you eat at lunch?'),
    top('clubs and activities', 'Some schools have clubs after lessons. Do you go to any clubs?', 'I go to a sports club.', 'Which club would you like to join?'),
    top('friends at school', 'It is nice to spend time with friends. What do you like to do with your friends?', 'We like to talk about games.', 'What do you do with your friends at break?'),
  ]),
  talk('out', 'Talk: out and about', ['out and about'], [
    top('shopping', 'I like looking in shops. Do you like going shopping?', 'I like buying snacks.', 'What do you like to buy?'),
    top('travelling', 'Trains and buses can take you to exciting places. Do you like travelling?', 'I like going on the train.', 'How do you like to travel?'),
    top('eating out', 'Going to a café can be nice. Do you like eating out?', 'I like having hot chocolate.', 'What do you like to eat at a café?'),
    top('the park', 'Parks are good places to relax. Do you like going to the park?', 'I like walking in the park.', 'What do you like to do at the park?'),
  ]),
);

export const libraryById = (id) => LIBRARY.find((x) => x.id === id) || null;

// What the Library page shows for each item: no questions or answers, just enough to choose.
const UNITS = { steps: 'steps', think: 'situations', conversation: 'topics' };
export function libraryLines(item) {
  const items = item.content.items;
  if (item.mode === 'steps') return items[0].steps.map((x) => x.text);
  if (item.mode === 'think') return items.map((x) => `${x.title}: ${x.scenario}`);
  return items.map((x) => `${x.topic}: ${x.opener}`);
}
export function libraryCard(item, added = null) {
  const lines = libraryLines(item);
  return {
    id: item.id, mode: item.mode, title: item.title, goal: item.goal, level: item.level, tags: item.tags, age: item.age, source: item.source,
    count: lines.length, unit: UNITS[item.mode] || 'items', lines,
    images: item.mode === 'steps' ? item.content.items[0].steps.map((x) => x.image_id) : [],
    added, // { id, status } of the learner's copy, or null
  };
}

// The activity row a family gets. Always a draft, linked back to the library item.
export function activityFromLibrary(item) {
  return { mode: item.mode, title: item.title, goal: item.goal, plan_goal: item.plan_goal, status: 'draft', content: { ...structuredClone(item.content), library_id: item.id } };
}

// Checks every item (used by the tests): ids unique, content complete, pictures exist. The Think and Talk checks match
// the ones the activity editor applies when a team saves one, so a library copy can always be saved again.
export function libraryProblems(symbolSlugs, items = LIBRARY) {
  const out = [];
  const ids = new Set();
  const text = (v) => typeof v === 'string' && v.trim().length > 0;
  for (const it of items) {
    if (ids.has(it.id)) out.push(`${it.id}: duplicate id`);
    ids.add(it.id);
    if (!it.tags?.length) out.push(`${it.id}: no tags`);
    if (!text(it.title)) out.push(`${it.id}: no title`);
    const list = it.content?.items || [];
    if (it.mode === 'steps') {
      const steps = list[0]?.steps || [];
      if (steps.length < 3 || steps.length > 7) out.push(`${it.id}: ${steps.length} steps (want 3 to 7)`);
      steps.forEach((st, i) => {
        const where = `${it.id} step ${i + 1}`;
        if (!text(st.text)) out.push(`${where}: no text`);
        if (!st.image_id?.startsWith('sym:') || !symbolSlugs.has(st.image_id.slice(4))) out.push(`${where}: picture ${st.image_id} not found`);
        const u = st.q?.understanding;
        if (!text(u?.question) || !text(u?.answer)) out.push(`${where}: missing understanding question or answer`);
      });
    } else if (it.mode === 'think') {
      if (list.length < 3 || list.length > 6) out.push(`${it.id}: ${list.length} situations (want 3 to 6)`);
      list.forEach((x, i) => {
        const where = `${it.id} situation ${i + 1}`;
        for (const k of ['title', 'scenario', 'problem', 'reason_example', 'backup_example']) if (!text(x[k])) out.push(`${where}: no ${k}`);
        if ((x.good_actions || []).filter(text).length < 2) out.push(`${where}: needs at least two safe things to do`);
        if ((x.unsafe || []).filter(text).length < 1) out.push(`${where}: needs at least one idea that is not safe`);
      });
    } else if (it.mode === 'conversation') {
      if (list.length < 3 || list.length > 6) out.push(`${it.id}: ${list.length} topics (want 3 to 6)`);
      list.forEach((x, i) => {
        const where = `${it.id} topic ${i + 1}`;
        for (const k of ['topic', 'opener', 'example_comment', 'example_question']) if (!text(x[k])) out.push(`${where}: no ${k}`);
        if (/^you could/i.test(x.example_comment || '')) out.push(`${where}: the example comment should be what the learner would say`);
      });
    } else {
      out.push(`${it.id}: unknown mode ${it.mode}`);
    }
  }
  return out;
}
