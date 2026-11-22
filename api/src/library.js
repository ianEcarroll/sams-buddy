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

// ---- More Think: work and clubs, and travelling.
LIBRARY.push(
  think('work', 'Think: surprises at work or a club', ['work', 'clubs'], [
    sit('The manager is not there', 'You arrive for your work experience and the person you usually report to is not there.', 'my manager is not there', ['ask someone else who works there', 'wait a few minutes, then ask at the desk', 'call or message my parent or my school contact'], 'someone there will know what I should do', 'ask my parent or teacher to call the workplace', ['go home without telling anyone', 'start jobs I was not asked to do']),
    sit('Kit left at home', 'You get to your club and realise you left your kit at home.', 'I do not have my kit', ['tell the leader or coach', 'ask if there is spare kit', 'call or message a parent'], 'the leader can help me join in safely', 'ask if I can watch today and join in next time', ['borrow someone else’s things without asking', 'leave without telling anyone']),
    sit('Not sure what to do', 'Your supervisor gives you a job, but you are not sure what to do.', 'I do not understand the job', ['ask the supervisor to say it again', 'ask what I should do first', 'ask a co-worker who knows'], 'it is better to ask than to do it wrong', 'ask another person on the team', ['pretend I understand', 'do something and hope it is right']),
    sit('The machine stops', 'The machine you are using suddenly stops and makes a strange noise.', 'the machine has stopped working', ['stop and step away', 'tell my supervisor straight away', 'not touch it'], 'a broken machine can be dangerous', 'ask another adult nearby to come and look', ['try to fix it myself', 'keep pressing buttons']),
  ]),
  think('travel', 'Think: surprises when travelling', ['travel', 'out and about'], [
    sit('The train is cancelled', 'You are at the station and the board says your train is cancelled.', 'my train is cancelled', ['ask a member of staff', 'look at the board for the next train', 'call or message a parent'], 'staff know which train I can take instead', 'go to the information desk', ['accept a lift from someone I do not know', 'walk off on my own']),
    sit('The wrong stop', 'You get off the bus and realise you are at the wrong stop.', 'I am at the wrong stop', ['stay somewhere safe and check my map', 'call or message a parent', 'ask a bus driver or someone who works nearby'], 'a parent or a driver can tell me the way', 'go into a shop and ask a member of staff', ['walk down a road I do not know', 'get into a car with someone I do not know']),
    sit('The phone battery dies', 'You are out and about and your phone battery has run out.', 'my phone has no battery', ['ask someone who works nearby to help me call a parent', 'go to an information desk', 'stay in a safe place with other people'], 'I need to tell my family where I am', 'ask a member of staff to phone for me', ['go off to find a charger on my own', 'tell my details to someone I do not know']),
    sit('A lost ticket', 'You are about to get on a train and you cannot find your ticket.', 'I cannot find my ticket', ['look carefully in my bag and pockets', 'ask a member of staff', 'ask the adult I am with'], 'staff can tell me what to do', 'call a parent', ['sneak on without a ticket', 'run through the gate']),
  ]),
);

// ---- More Talk: family and pets, and my day.
LIBRARY.push(
  talk('family', 'Talk: family and pets', ['family', 'pets'], [
    top('family meals', 'Family meals can be fun. Do you have a favourite meal to eat with your family?', 'I like having pizza with my family.', 'What is your favourite family meal?'),
    top('pets', 'I do not have a pet, because I live in a forest. Do you have a pet, or would you like one?', 'I would like a dog.', 'What animal would you like as a pet?'),
    top('helping at home', 'Some people help at home by tidying or cooking. How do you help at home?', 'I help by setting the table.', 'What jobs do you do at home?'),
    top('family trips', 'A trip with your family can be special. Where have you been with your family?', 'We went to the seaside.', 'Where did you go?'),
  ]),
  talk('my-day', 'Talk: my day', ['daily life'], [
    top('today', 'I would love to hear about your day. What was the best part of today?', 'The best part was lunch.', 'What was the best part of your day?'),
    top('something funny', 'Funny moments are great to share. Did anything make you laugh this week?', 'My friend told a funny joke.', 'What made you laugh?'),
    top('looking forward', 'It is nice to look forward to things. What are you looking forward to?', 'I am looking forward to the weekend.', 'What are you looking forward to?'),
    top('something new', 'Learning something new is exciting. Have you learned anything new lately?', 'I learned a new song.', 'What did you learn?'),
  ]),
);

// ---- Explain: "Tell me how you…". Each item has Foxy's question and the parts of a clear answer.
const explain = (id, title, tags, items) => ({
  id: `explain-${id}`, mode: 'explain', title,
  goal: 'Explain how I do something clearly and completely',
  plan_goal: 'other', level: null, tags, age: '10–20', source: LIBRARY_SOURCE,
  content: { items },
});
const pt = (text, question, starter, model) => ({ text, question, starter, model });

LIBRARY.push(
  explain('routines', 'Explain: everyday routines', ['daily living'], [
    { title: 'Making a hot chocolate', question: 'Tell me how you make a hot chocolate.', points: [
      pt('put the hot chocolate powder in a mug', 'What goes in the mug first?', 'First I put ___ in a mug.', 'First I put the hot chocolate powder in a mug.'),
      pt('heat the milk or boil the water, with an adult if needed', 'What do you heat?', 'Then I heat ___.', 'Then I heat the milk.'),
      pt('pour it into the mug and stir', 'What do you do with the hot milk?', 'Then I ___.', 'Then I pour it into the mug and stir.'),
      pt('let it cool a little before drinking', 'What do you do before you drink it?', 'Before I drink it I ___.', 'Before I drink it I let it cool down.'),
    ] },
    { title: 'Crossing the road safely', question: 'Tell me how you cross the road safely.', points: [
      pt('go to a crossing or a safe place to cross', 'Where do you cross?', 'First I go to ___.', 'First I go to the crossing.'),
      pt('stop at the kerb and look both ways', 'What do you do at the kerb?', 'Then I stop and ___.', 'Then I stop and look both ways.'),
      pt('wait until the cars have stopped or the green man shows', 'When do you start to cross?', 'I wait until ___.', 'I wait until the cars have stopped.'),
      pt('walk across, do not run, and keep looking', 'How do you cross?', 'I ___ across.', 'I walk across and keep looking.'),
    ] },
    { title: 'Getting ready for bed', question: 'Tell me how you get ready for bed.', points: [
      pt('put on pyjamas', 'What do you put on?', 'First I put on ___.', 'First I put on my pyjamas.'),
      pt('brush my teeth', 'What do you do in the bathroom?', 'Then I ___.', 'Then I brush my teeth.'),
      pt('put my phone on charge and set an alarm', 'What do you do with your phone?', 'I ___ my phone.', 'I put my phone on charge.'),
      pt('get into bed and turn off the light', 'What do you do last?', 'Last I ___.', 'Last I get into bed and turn off the light.'),
    ] },
  ]),
  explain('out', 'Explain: out and about', ['out and about'], [
    { title: 'Taking the bus', question: 'Tell me how you take the bus.', points: [
      pt('find the right bus stop and check the bus number', 'What do you check at the stop?', 'First I check ___.', 'First I check the bus number.'),
      pt('wait, then put my hand out when the bus comes', 'What do you do when the bus comes?', 'When it comes I ___.', 'When it comes I put my hand out.'),
      pt('tap my card or pay the driver', 'How do you pay?', 'I pay by ___.', 'I pay by tapping my card.'),
      pt('sit down or hold on, and press the bell before my stop', 'What do you do before your stop?', 'Before my stop I ___.', 'Before my stop I press the bell.'),
    ] },
    { title: 'Buying something in a shop', question: 'Tell me how you buy something in a shop.', points: [
      pt('choose what I want and pick it up', 'What do you do first?', 'First I ___.', 'First I choose what I want.'),
      pt('take it to the till and say hello', 'Where do you take it?', 'Then I take it to ___.', 'Then I take it to the till.'),
      pt('pay and take my change', 'What do you do at the till?', 'I ___.', 'I pay and take my change.'),
      pt('say thank you', 'What do you say at the end?', 'At the end I say ___.', 'At the end I say thank you.'),
    ] },
    { title: 'Asking for help in a shop', question: 'Tell me how you ask for help in a shop.', points: [
      pt('look for someone who works there, like a person with a name badge or uniform', 'Who do you look for?', 'First I look for ___.', 'First I look for someone with a name badge.'),
      pt('go up to them and say excuse me', 'What do you say first?', 'I say ___.', 'I say excuse me.'),
      pt('say clearly what I need help with', 'What do you tell them?', 'Then I say ___.', 'Then I say I cannot find the milk.'),
      pt('say thank you', 'What do you do at the end?', 'At the end I ___.', 'At the end I say thank you.'),
    ] },
  ]),
  explain('things', 'Explain: looking after my things', ['home', 'school'], [
    { title: 'Packing my school bag', question: 'Tell me how you pack your school bag.', points: [
      pt('look at the timetable to see what I need', 'What do you look at first?', 'First I look at ___.', 'First I look at my timetable.'),
      pt('put in the books and equipment for each lesson', 'What goes in the bag?', 'Then I put in ___.', 'Then I put in my books and pencil case.'),
      pt('add my lunch and a water bottle', 'What else do you add?', 'I also add ___.', 'I also add my lunch and my water bottle.'),
      pt('check I have my phone and keys, then zip the bag', 'What do you check at the end?', 'Last I check ___.', 'Last I check I have my phone and keys.'),
    ] },
    { title: 'Using the washing machine', question: 'Tell me how you put the washing on.', points: [
      pt('put the dirty clothes in the machine', 'What goes in the machine?', 'First I put ___ in the machine.', 'First I put the dirty clothes in the machine.'),
      pt('add washing powder or a tablet', 'What do you add?', 'Then I add ___.', 'Then I add a washing tablet.'),
      pt('choose the programme and press start', 'What do you press?', 'Then I ___.', 'Then I choose the programme and press start.'),
      pt('when it has finished, take the clothes out and hang them up to dry', 'What do you do when it finishes?', 'When it finishes I ___.', 'When it finishes I take the clothes out and hang them up.'),
    ] },
    { title: 'Tidying my room', question: 'Tell me how you tidy your room.', points: [
      pt('pick up things from the floor', 'What do you do first?', 'First I ___.', 'First I pick up things from the floor.'),
      pt('put dirty clothes in the basket and clean clothes away', 'What do you do with clothes?', 'I put ___.', 'I put dirty clothes in the basket.'),
      pt('put books and games back where they belong', 'Where do your things go?', 'I put my things ___.', 'I put my things back on the shelf.'),
      pt('make the bed', 'What is the last thing you do?', 'Last I ___.', 'Last I make the bed.'),
    ] },
  ]),
);

// ---- Memory: name things in a group, or add a word to a list. Any real member of the group is also accepted.
const VEG = ['carrot', 'potato', 'broccoli', 'peas', 'onion', 'tomato', 'cucumber', 'lettuce', 'cabbage', 'spinach', 'sweetcorn', 'pepper', 'cauliflower', 'mushroom', 'celery', 'beans', 'leek', 'parsnip'];
const DRINKS = ['water', 'milk', 'juice', 'orange juice', 'apple juice', 'tea', 'coffee', 'hot chocolate', 'lemonade', 'cola', 'squash', 'smoothie', 'milkshake', 'fizzy drink'];
const VEHICLES = ['car', 'bus', 'train', 'bike', 'bicycle', 'lorry', 'truck', 'van', 'taxi', 'motorbike', 'tram', 'plane', 'aeroplane', 'helicopter', 'boat', 'ship', 'ferry', 'scooter', 'tractor', 'ambulance'];
const SPORTS = ['football', 'basketball', 'tennis', 'swimming', 'running', 'cricket', 'rugby', 'golf', 'baseball', 'hockey', 'gymnastics', 'cycling', 'boxing', 'badminton', 'volleyball', 'skiing', 'netball', 'athletics', 'table tennis', 'martial arts'];
const INSTRUMENTS = ['guitar', 'piano', 'drums', 'violin', 'flute', 'trumpet', 'saxophone', 'clarinet', 'cello', 'trombone', 'keyboard', 'harp', 'tuba', 'ukulele', 'recorder', 'triangle', 'bass', 'banjo'];
const CLOTHES = ['t-shirt', 'shirt', 'jumper', 'jacket', 'coat', 'trousers', 'jeans', 'shorts', 'skirt', 'dress', 'socks', 'shoes', 'trainers', 'hat', 'scarf', 'gloves', 'pants', 'pyjamas', 'hoodie'];
const KITCHEN = ['kettle', 'toaster', 'fridge', 'oven', 'microwave', 'cooker', 'sink', 'saucepan', 'frying pan', 'plate', 'bowl', 'cup', 'mug', 'knife', 'fork', 'spoon', 'dishwasher', 'freezer', 'blender'];
const FURNITURE = ['chair', 'table', 'sofa', 'bed', 'wardrobe', 'desk', 'shelf', 'bookcase', 'cupboard', 'stool', 'drawers', 'armchair', 'bench', 'cabinet'];
const SCHOOL = ['pen', 'pencil', 'ruler', 'rubber', 'eraser', 'book', 'bag', 'calculator', 'scissors', 'glue', 'notebook', 'folder', 'sharpener', 'pencil case', 'laptop'];

const category = (id, title, tags, items) => ({
  id: `memory-${id}`, mode: 'category', title,
  goal: items[0].kind === 'add' ? 'Listen to a list of words and add one that fits' : 'Name things that belong in a group',
  plan_goal: 'other', level: null, tags, age: '10–20', source: LIBRARY_SOURCE,
  content: { items },
});
const nm = (group, accepted, target = 3) => ({ kind: 'name', group, target, accepted });
const ad = (group, given, accepted) => ({ kind: 'add', group, given, accepted });

LIBRARY.push(
  category('food-name', 'Memory test: food and drink', ['groups', 'food'], [nm('vegetables', VEG), nm('drinks', DRINKS), nm('things in a kitchen', KITCHEN)]),
  category('move-name', 'Memory test: things that move and play', ['groups'], [nm('vehicles', VEHICLES), nm('sports', SPORTS), nm('musical instruments', INSTRUMENTS)]),
  category('home-name', 'Memory test: at home and school', ['groups', 'home', 'school'], [nm('clothes', CLOTHES), nm('furniture', FURNITURE), nm('things for school', SCHOOL)]),
  category('food-add', 'Memory test: add a word (food and drink)', ['groups', 'food'], [ad('vegetables', ['carrot', 'potato', 'peas'], VEG), ad('drinks', ['water', 'milk', 'juice'], DRINKS), ad('things in a kitchen', ['kettle', 'toaster', 'fridge'], KITCHEN)]),
  category('everyday-add', 'Memory test: add a word (everyday things)', ['groups'], [ad('vehicles', ['car', 'bus', 'train'], VEHICLES), ad('musical instruments', ['guitar', 'piano', 'drums'], INSTRUMENTS), ad('things for school', ['pen', 'ruler', 'book'], SCHOOL)]),
);

// ---- Memory: listen to a short story, then answer questions about it.
const story = (id, title, tags, text, questions) => ({
  id: `story-${id}`, mode: 'listen', title,
  goal: 'Listen to a story and answer questions about it',
  plan_goal: 'other', level: null, tags, age: '10–20', source: LIBRARY_SOURCE,
  content: { items: [{ title, story: text, questions }] },
});
const qn = (question, answers, clue) => ({ question, answers, clue });

LIBRARY.push(
  story('drum-solo', 'Story: Ayo’s drum solo', ['music', 'school'],
    'Ayo had been practising the drums for weeks. On Friday evening the school held its music night in the big hall. Ayo felt nervous, so his teacher, Mr Patel, told him to take three slow breaths. When it was his turn, Ayo walked on stage and sat behind the drum kit. He counted to four and began to play. At first his hands shook, but soon the beat felt easy. When he finished, everyone clapped, and his sister cheered the loudest. Afterwards, Mr Patel gave Ayo a thumbs up and said he was proud of him.',
    [qn('Where was the music night?', ['hall', 'big hall', 'school hall'], 'It was a big room at his school.'),
     qn('What instrument does Ayo play?', ['drums', 'drum', 'drum kit'], 'You hit it with sticks.'),
     qn('What did Mr Patel tell Ayo to do when he felt nervous?', ['breathe', 'breaths', 'three slow breaths', 'take three slow breaths', 'slow breaths'], 'It is something you do with your lungs, slowly, three times.'),
     qn('Who cheered the loudest?', ['his sister', 'sister'], 'She is part of his family.'),
     qn('What did Mr Patel do at the end?', ['thumbs up', 'gave a thumbs up', 'said he was proud', 'proud'], 'He showed Ayo with his hand and said something kind.')]),
  story('wrong-platform', 'Story: the wrong platform', ['travel', 'out and about'],
    'Nina was taking the train to see her cousin in the next town. She checked her ticket and saw that the train left from platform 4. At the station, she followed the signs up the stairs. But when she reached the platform, a worker in a yellow jacket told her the train had been moved to platform 2. Nina said thank you and hurried back down the stairs. She got on the train just before the doors closed. She found a seat by the window and sent her cousin a message to say she was on her way.',
    [qn('Who was Nina going to see?', ['cousin', 'her cousin'], 'It is someone in her family, in the next town.'),
     qn('Which platform did her ticket say?', ['4', 'four', 'platform 4', 'platform four'], 'It is a number after three.'),
     qn('Who told her about the change?', ['worker', 'a worker', 'station worker', 'man in a yellow jacket', 'person in a yellow jacket'], 'This person wore a yellow jacket.'),
     qn('What colour was the jacket?', ['yellow'], 'It is the colour of a banana.'),
     qn('What did Nina do when she sat down?', ['sent a message', 'message', 'messaged her cousin', 'texted her cousin', 'text'], 'She told someone she was on her way.')]),
  story('market', 'Story: Sunday at the market', ['weekend', 'out and about'],
    'On Sunday morning, Tom and his dad went to the market. It was sunny, and the stalls were full of colour. First they bought a bag of red apples from a lady in a blue hat. Then Tom saw a stall that sold old records and spent ten minutes looking at them. He chose one with a picture of a lion on the cover. His dad paid for it. On the way home it started to rain, so they ran to the bus stop and waited under the shelter.',
    [qn('What day did they go to the market?', ['sunday'], 'It is the last day of the weekend.'),
     qn('What did they buy first?', ['apples', 'red apples', 'a bag of apples', 'bag of apples'], 'They were red, and they came in a bag.'),
     qn('What was the lady at the stall wearing?', ['blue hat', 'a blue hat', 'hat'], 'It was on her head, and it was blue.'),
     qn('What animal was on the cover of the record?', ['lion', 'a lion'], 'It is a big cat with a mane.'),
     qn('Why did they run to the bus stop?', ['rain', 'it rained', 'it started to rain', 'raining'], 'The weather changed on the way home.')]),
);

// ---- Memory: "Remember my day". Foxy asks about something the learner really did. Any real memory counts. A family can add
// the things he did, with clues and a photo, once the copy is in their activities; the library only holds the prompts.
const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five'];
const remember = (id, title, tags, items) => ({
  id: `remember-${id}`, mode: 'recall', title,
  goal: 'Remember real things I did, with as few clues as possible',
  plan_goal: 'narrative', level: null, tags, age: '10–20', source: LIBRARY_SOURCE,
  content: { items },
});
const day = (title, when, target = 3) => ({ title, when, target });

LIBRARY.push(
  remember('school-day', 'Remember my day: at school', ['school', 'daily life'], [
    day('This morning', 'this morning'),
    day('Lunchtime', 'at lunchtime', 2),
    day('This afternoon', 'this afternoon'),
    day('After school', 'after school', 2),
  ]),
  remember('weekend', 'Remember my day: the weekend', ['weekend', 'daily life'], [
    day('On Saturday', 'on Saturday'),
    day('On Sunday', 'on Sunday'),
    day('At the weekend', 'at the weekend', 4),
  ]),
  remember('out', 'Remember my day: trips and special days', ['out and about', 'holidays'], [
    day('A trip out', 'on our last trip out'),
    day('A special day', 'on a special day, like a birthday or a party', 3),
    day('In the holidays', 'in the holidays', 4),
  ]),
  remember('week', 'Remember my day: this week', ['daily life'], [
    day('Yesterday', 'yesterday'),
    day('Earlier this week', 'earlier this week', 4),
    day('Something new', 'this week that was new for you', 2),
  ]),
);

export const libraryById = (id) => LIBRARY.find((x) => x.id === id) || null;

// What the Library page shows for each item: no questions or answers, just enough to choose.
const recallPrompt = (x) => `Tell me ${NUM_WORDS[x.target] || x.target} thing${x.target === 1 ? '' : 's'} you did ${x.when}.`;
const UNITS = { steps: 'steps', think: 'situations', conversation: 'topics', explain: 'explanations', category: 'groups', listen: 'questions', recall: 'prompts' };
export function libraryLines(item) {
  const items = item.content.items;
  if (item.mode === 'steps') return items[0].steps.map((x) => x.text);
  if (item.mode === 'think') return items.map((x) => `${x.title}: ${x.scenario}`);
  if (item.mode === 'explain') return items.map((x) => `${x.title}: ${x.question}`);
  if (item.mode === 'category') return items.map((x) => (x.kind === 'add' ? `Add a word to: ${x.given.join(', ')} (${x.group})` : `Name ${x.target} ${x.group}`));
  if (item.mode === 'listen') return items[0].questions.map((x) => x.question);
  if (item.mode === 'recall') return items.map((x) => recallPrompt(x));
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

// The full activity for the read-only "View" panel: everything a therapist or parent would want to check before adding it
// (what Foxy says, the questions, the answers that are accepted, the examples). Nothing here can be edited; once an
// item is added to a learner's activities, the copy is theirs to change.
const SKILL_LABEL = { understanding: 'Question', reasoning: 'Why question', independence: 'What-if question', memory: 'Memory question', expressive: 'Say it question' };
export function libraryDetail(item) {
  const list = item.content.items;
  let parts;
  if (item.mode === 'steps') {
    parts = list[0].steps.map((x, i) => ({ heading: `Step ${i + 1}`, image: x.image_id, rows: [['Foxy says', x.text], ...Object.entries(x.q).flatMap(([k, v]) => [[SKILL_LABEL[k] || 'Question', v.question], ['Accepted answer', v.answer]])] }));
  } else if (item.mode === 'think') {
    parts = list.map((x) => ({ heading: x.title, rows: [['Situation', x.scenario], ['What is unexpected', x.problem], ['Safe things to do', x.good_actions], ['Example reason', x.reason_example], ['Example plan B', x.backup_example], ['Not safe (flagged for the team if said)', x.unsafe]] }));
  } else if (item.mode === 'conversation') {
    parts = list.map((x) => ({ heading: x.topic.charAt(0).toUpperCase() + x.topic.slice(1), rows: [['Foxy opens', x.opener], ['Example comment', x.example_comment], ['Example question', x.example_question]] }));
  } else if (item.mode === 'explain') {
    parts = list.map((x) => ({ heading: x.title, rows: [['Foxy asks', x.question], ...x.points.flatMap((p, i) => [[`Part ${i + 1} of a clear answer`, p.text], ['Question if needed', p.question], ['Sentence starter', p.starter], ['Model answer', p.model]])] }));
  } else if (item.mode === 'category') {
    parts = list.map((x) => ({ heading: x.group.charAt(0).toUpperCase() + x.group.slice(1), rows: [
      x.kind === 'add' ? ['Foxy says', x.given.join(', ')] : ['The task', `Name ${x.target} things that belong in this group`],
      ...(x.kind === 'add' ? [['The learner', 'adds a word that fits']] : []),
      ['Example words that are accepted (any real member of the group is also accepted)', x.accepted]] }));
  } else if (item.mode === 'recall') {
    parts = list.map((x) => ({ heading: x.title, rows: [['Foxy asks', recallPrompt(x)], ['How many things to remember', String(x.target)], ['Clues', 'Add the things he really did, with a broad clue, a specific clue and a photo, in your own copy. Until then, any real thing he remembers counts.']] }));
  } else if (item.mode === 'listen') {
    const it = list[0];
    parts = [{ heading: 'The story', rows: [['Foxy reads', it.story]] }, ...it.questions.map((x, i) => ({ heading: `Question ${i + 1}`, rows: [['Question', x.question], ['Accepted answers', x.answers], ['Clue if needed', x.clue]] }))];
  } else {
    parts = [];
  }
  const card = libraryCard(item);
  return { id: item.id, mode: item.mode, title: item.title, goal: item.goal, level: item.level, tags: item.tags, age: item.age, source: item.source, count: card.count, unit: card.unit, parts };
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
    } else if (it.mode === 'explain') {
      if (list.length < 2 || list.length > 5) out.push(`${it.id}: ${list.length} explanations (want 2 to 5)`);
      list.forEach((x, i) => {
        const where = `${it.id} explanation ${i + 1}`;
        if (!text(x.title) || !text(x.question)) out.push(`${where}: no title or question`);
        if ((x.points || []).length < 3) out.push(`${where}: needs at least three parts`);
        (x.points || []).forEach((p, j) => { for (const k of ['text', 'question', 'starter', 'model']) if (!text(p[k])) out.push(`${where} part ${j + 1}: no ${k}`); });
      });
    } else if (it.mode === 'category') {
      if (list.length < 2 || list.length > 6) out.push(`${it.id}: ${list.length} groups (want 2 to 6)`);
      list.forEach((x, i) => {
        const where = `${it.id} group ${i + 1}`;
        if (!text(x.group)) out.push(`${where}: no group name`);
        if ((x.accepted || []).filter(text).length < 8) out.push(`${where}: needs at least eight accepted words`);
        if (x.kind === 'add') { if ((x.given || []).filter(text).length < 2) out.push(`${where}: needs at least two given words`); }
        else if (!(Number.isInteger(x.target) && x.target >= 1 && x.target <= 8)) out.push(`${where}: target must be 1 to 8`);
      });
    } else if (it.mode === 'recall') {
      if (list.length < 2 || list.length > 6) out.push(`${it.id}: ${list.length} prompts (want 2 to 6)`);
      list.forEach((x, i) => {
        const where = `${it.id} prompt ${i + 1}`;
        if (!text(x.title) || !text(x.when)) out.push(`${where}: needs a title and when it happened`);
        if (!(Number.isInteger(x.target) && x.target >= 1 && x.target <= 5)) out.push(`${where}: target must be 1 to 5`);
      });
    } else if (it.mode === 'listen') {
      const x = list[0] || {};
      if (!text(x.story)) out.push(`${it.id}: no story`);
      const words = (x.story || '').split(/\s+/).length;
      if (words < 40 || words > 160) out.push(`${it.id}: story is ${words} words (want 40 to 160)`);
      if ((x.questions || []).length < 3) out.push(`${it.id}: needs at least three questions`);
      (x.questions || []).forEach((qq, j) => { if (!text(qq.question) || !(qq.answers || []).filter(text).length || !text(qq.clue)) out.push(`${it.id} question ${j + 1}: needs a question, an accepted answer and a clue`); });
    } else {
      out.push(`${it.id}: unknown mode ${it.mode}`);
    }
  }
  return out;
}
