// Activity library: ready-made activities a family can add to their learner's activities with one tap.
// Items live in code, like the starters, so they are reviewed and versioned with everything else; nothing to migrate.
// An added item becomes a normal activity, saved as a DRAFT (the therapist checks it, then makes it ready), and is
// personalised in Activities afterwards. The original is never changed.
//
// Text is TALVO's own. Pictures are Mulberry Symbols (CC BY-SA 4.0, © Steve Lee), stored as "sym:<name>".
import { FOLLOW_OBJECTS, FOLLOW_PLACES, FOLLOW_STEP_TYPES, followBoxCount, followPlaces, isFollowToken, followInstruction, tokenName } from './coach/modes.js';

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
  age: '13–20',
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
  goal: 'Notice something is not as expected and say a safe thing to do (asking a trusted adult counts)',
  plan_goal: 'unexpected', level: null, tags, age: '13–20', source: LIBRARY_SOURCE,
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
  plan_goal: 'conversation', level: null, tags, age: '13–20', source: LIBRARY_SOURCE,
  content: { items },
});
const top = (topic, opener, example_comment, example_question) => ({ topic, opener, example_comment, example_question });

LIBRARY.push(
  talk('favourites', 'Talk: favourite things', ['favourites'], [
    top('food', 'I think pizza is delicious. What kind of food do you like?', 'I like pasta.', 'What is your favourite food?'),
    top('music', 'I like listening to music when I am happy. What music do you like?', 'I like listening to pop music.', 'What music do you like?'),
    top('films', 'I watched a really funny film last night. What kind of films do you watch?', 'I like funny films too.', 'What is your favourite film?'),
    top('animals', 'I like watching animal documentaries. What animals do you find interesting?', 'I like dogs.', 'Do you have a pet?'),
  ]),
  talk('weekend', 'Talk: weekends and holidays', ['weekend', 'holidays'], [
    top('the weekend', 'The weekend is nearly here. What do you like to do at the weekend?', 'I like to relax at home.', 'What do you do at the weekend?'),
    top('holidays', 'I love holidays. Where would you like to go for a holiday?', 'I would like to go to the beach.', 'Where do you like to go on holiday?'),
    top('birthdays', 'My birthday is in the summer. What do you like to do on your birthday?', 'I like having a cake.', 'When is your birthday?'),
    top('the weather', 'It is nice to know what the weather is like. What kind of weather do you like?', 'I like sunny days.', 'What is your favourite season?'),
  ]),
  talk('hobbies', 'Talk: hobbies and games', ['hobbies', 'games'], [
    top('video games', 'A lot of people play video games to relax. What games do you play at the moment?', 'I like playing games with my friends.', 'What game do you like to play?'),
    top('sport', 'I like watching football on TV. What sports do you play or watch?', 'I like to swim.', 'What sport do you like?'),
    top('drawing and making things', 'I like drawing in my spare time. What do you like to make or create?', 'I like drawing.', 'What do you like to make?'),
    top('playing an instrument', 'I always wanted to learn the guitar. What instrument would you like to play?', 'I like drums.', 'Which instrument would you like to play?'),
  ]),
  talk('school', 'Talk: school and learning', ['school'], [
    top('favourite subject', 'There are lots of subjects at school. Which one do you like best?', 'I like art best.', 'What is your favourite subject?'),
    top('lunch at school', 'Lunchtime is an important part of the day. What do you like to eat at lunch?', 'I like sandwiches.', 'What do you eat at lunch?'),
    top('clubs and activities', 'Lots of people go to a club or group after school or work. What clubs or groups do you go to?', 'I go to a sports club.', 'Which club would you like to join?'),
    top('friends at school', 'It is nice to spend time with friends. What do you like to do with your friends?', 'We like to talk about games.', 'What do you do with your friends at break?'),
  ]),
  talk('out', 'Talk: out and about', ['out and about'], [
    top('shopping', 'I went to the shops yesterday to buy some trainers. What do you like to buy when you go shopping?', 'I like buying snacks.', 'What do you like to buy?'),
    top('travelling', 'I took the train to the city last week. How do you usually get around?', 'I like going on the train.', 'How do you like to travel?'),
    top('eating out', 'There is a café near me that makes great chips. Where do you like to eat out?', 'I like having hot chocolate.', 'What do you like to eat at a café?'),
    top('the park', 'I went for a walk in the park on Sunday. What do you like to do outside?', 'I like walking in the park.', 'What do you like to do at the park?'),
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
    top('family meals', 'In my family we always have pasta on Fridays. What is your favourite meal at home?', 'I like having pizza with my family.', 'What is your favourite family meal?'),
    top('pets', 'My neighbour has a really friendly dog. What animal would you like to have as a pet?', 'I would like a dog.', 'What animal would you like as a pet?'),
    top('helping at home', 'Some people help at home by tidying or cooking. How do you help at home?', 'I help by setting the table.', 'What jobs do you do at home?'),
    top('family trips', 'A trip with your family can be special. Where have you been with your family?', 'We went to the seaside.', 'Where did you go?'),
  ]),
  talk('my-day', 'Talk: my day', ['daily life'], [
    top('today', 'I would love to hear about your day. What was the best part of today?', 'The best part was lunch.', 'What was the best part of your day?'),
    top('something funny', 'I saw a really funny video this week. What made you laugh this week?', 'My friend told a funny joke.', 'What made you laugh?'),
    top('looking forward', 'It is nice to look forward to things. What are you looking forward to?', 'I am looking forward to the weekend.', 'What are you looking forward to?'),
    top('something new', 'I learned how to cook a new recipe this week. What is something new you learned recently?', 'I learned a new song.', 'What did you learn?'),
  ]),
);

// ---- Explain: "Tell me how you…". Each item has Foxy's question and the parts of a clear answer.
const explain = (id, title, tags, items) => ({
  id: `explain-${id}`, mode: 'explain', title,
  goal: 'Explain how I do something clearly and completely',
  plan_goal: 'other', level: null, tags, age: '13–20', source: LIBRARY_SOURCE,
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
  plan_goal: 'other', level: null, tags, age: '13–20', source: LIBRARY_SOURCE,
  content: { items },
});
const nm = (group, accepted, target = 3) => ({ kind: 'name', group, target, accepted });
const ad = (group, given, accepted) => ({ kind: 'add', group, given, accepted });

LIBRARY.push(
  category('food-name', 'Word groups: food and drink', ['groups', 'food'], [nm('vegetables', VEG), nm('drinks', DRINKS), nm('things in a kitchen', KITCHEN)]),
  category('move-name', 'Word groups: things that move and play', ['groups'], [nm('vehicles', VEHICLES), nm('sports', SPORTS), nm('musical instruments', INSTRUMENTS)]),
  category('home-name', 'Word groups: at home and school', ['groups', 'home', 'school'], [nm('clothes', CLOTHES), nm('furniture', FURNITURE), nm('things for school', SCHOOL)]),
  category('food-add', 'Word groups: add a word (food and drink)', ['groups', 'food'], [ad('vegetables', ['carrot', 'potato', 'peas'], VEG), ad('drinks', ['water', 'milk', 'juice'], DRINKS), ad('things in a kitchen', ['kettle', 'toaster', 'fridge'], KITCHEN)]),
  category('everyday-add', 'Word groups: add a word (everyday things)', ['groups'], [ad('vehicles', ['car', 'bus', 'train'], VEHICLES), ad('musical instruments', ['guitar', 'piano', 'drums'], INSTRUMENTS), ad('things for school', ['pen', 'ruler', 'book'], SCHOOL)]),
);

// ---- Memory: listen to a short story, then answer questions about it.
const story = (id, title, tags, text, questions) => ({
  id: `story-${id}`, mode: 'listen', title,
  goal: 'Listen to a story and answer questions about it',
  plan_goal: 'other', level: null, tags, age: '13–20', source: LIBRARY_SOURCE,
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
  plan_goal: 'narrative', level: null, tags, age: '13–20', source: LIBRARY_SOURCE,
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
    day('A trip out', 'on your last trip out'),
    day('A special day', 'on a special day, like a birthday or a party', 3),
    day('In the holidays', 'in the holidays', 4),
  ]),
  remember('week', 'Remember my day: this week', ['daily life'], [
    day('Yesterday', 'yesterday'),
    day('Earlier this week', 'earlier this week', 4),
    day('Something new', 'this week that was new for you', 2),
  ]),
);

// ---- Story: "Tell a story". The learner looks at a short row of pictures and tells it: who, where, what happened first, next,
// then and finally, and how it ended. One picture for each event. Easy sets have three events; Medium sets have four and a
// few words Foxy listens for. Added copies can be changed or given the family's own photos.
const tell = (id, title, level, tags, items) => ({
  id: `tell-${id}`, mode: 'story', title,
  goal: 'Who and where, events in order (First → Next → Then → Finally) and how it ended',
  plan_goal: 'narrative', level, tags, age: '13–20', source: LIBRARY_SOURCE,
  content: { items },
});
const pic = (title, who, setting, events, pictures, outcome, target_words = []) => ({
  title, who, setting, events, image_ids: pictures.map((x) => `sym:${x}`), outcome,
  ...(target_words.length ? { target_words, vocabulary_model: `One word that fits is "${target_words[0]}".` } : {}),
});

LIBRARY.push(
  tell('easy', 'Tell a story: three pictures', 'Easy', ['pictures', 'first, next, then'], [
    pic('A rainy walk', 'Mia', 'street', ['it starts to rain', 'Mia opens her umbrella', 'Mia walks to school'], ['rain', 'umbrella', 'school'], 'Mia stays dry'),
    pic('Feeding the dog', 'Dan, the dog', 'kitchen', ['Dan gets the dog food', 'Dan puts the food in the bowl', 'the dog eats it'], ['dog-food', 'food-bowl-dog', 'dog'], 'the dog is happy'),
    pic('A birthday cake', 'Mum, Ben', 'kitchen', ['Mum puts a candle on the cake', 'Ben makes a wish', 'everyone eats the cake'], ['cake', 'candle-2', 'celebrate-birthday'], 'it was a happy birthday'),
  ]),
  tell('out', 'Tell a story: out and about', 'Medium', ['pictures', 'out and about'], [
    pic('A day at the beach', 'Zara, Leo', 'beach', ['Zara and Leo go to the beach', 'they play with the ball', 'they eat a picnic', 'they go home on the bus'], ['beach', 'ball-beach', 'picnic', 'bus'], 'they had a lovely day', ['picnic', 'delicious']),
    pic('At the park', 'Jo', 'park', ['Jo goes to the park', 'Jo goes on the swing', 'Jo goes down the slide', 'Jo goes back home'], ['park-to', 'swing', 'slide', 'house'], 'Jo was tired and happy', ['swing', 'tired']),
    pic('Catching the bus', 'Ali', 'bus stop', ['Ali waits for the bus', 'the bus arrives', 'Ali gets on the bus', 'Ali sits down'], ['wait-to', 'bus', 'get-on-bus-to', 'sit-to'], 'Ali is on his way', ['wait', 'arrives']),
    pic('A football match', 'Max, the team', 'football pitch', ['Max kicks the ball', 'Max shoots at the goal', 'Max scores', 'the team claps'], ['kick-ball-to', 'football', 'score-goal-to', 'clap-hands-to'], 'the team won', ['score', 'cheer']),
  ]),
  tell('home', 'Tell a story: at home and in the cold', 'Medium', ['pictures', 'home'], [
    pic('Making a pizza', 'Tom, his family', 'kitchen', ['Tom makes the pizza', 'Tom cooks it on the cooker', 'Tom cuts the pizza', 'the family eats it'], ['pizza', 'cooker', 'pizza-cutter', 'plate'], 'everyone enjoyed the pizza', ['delicious', 'slice']),
    pic('A snow day', 'Lily', 'garden', ['it snows in the night', 'Lily puts on her hat, scarf and gloves', 'Lily goes on the sledge', 'Lily has a hot chocolate'], ['snow', 'scarf', 'sledge', 'hot-chocolate'], 'Lily felt warm and happy', ['freezing', 'warm']),
  ]),
);

// ---- Describe a picture: name it, say what group it belongs to, and say what it is for. "alts" are other names that count;
// the groups and use words are what Foxy listens for. Any sensible answer is also accepted.
const object = (id, title, tags, items) => ({
  id: `describe-${id}`, mode: 'object', title,
  goal: 'Name, group and use in one sentence',
  plan_goal: 'other', level: null, tags, age: '13–20', source: LIBRARY_SOURCE,
  content: { items },
});
const obj = (pic, name, alts, category, categories, use, keywords) => ({ image_id: `sym:${pic}`, name, name_alternatives: alts, category, category_alternatives: categories, function: use, function_keywords: keywords });
const WASH = ['things for washing', 'things for keeping clean', 'personal care', 'hygiene'];
const EAT = ['kitchen things', 'things for eating', 'things for cooking'];
const SCHOOL_CATS = ['school', 'stationery', 'things for school'];
const WEAR = ['things you wear', 'clothing', 'things to put on'];
const TRAVEL = ['vehicles', 'ways to travel', 'ways to get around'];

LIBRARY.push(
  object('bathroom', 'Describe: in the bathroom', ['bathroom', 'daily living'], [
    obj('toothbrush', 'toothbrush', ['tooth brush'], 'bathroom things', ['bathroom', ...WASH], 'brush your teeth', ['teeth', 'tooth', 'brush', 'clean']),
    obj('toothpaste', 'toothpaste', [], 'bathroom things', ['bathroom', ...WASH], 'clean your teeth', ['teeth', 'tooth', 'brush', 'clean']),
    obj('soap', 'soap', ['bar of soap'], 'bathroom things', ['bathroom', ...WASH], 'wash your hands', ['wash', 'hands', 'clean', 'germs']),
    obj('towel', 'towel', [], 'bathroom things', ['bathroom', ...WASH], 'dry yourself after a bath or shower', ['dry', 'wet', 'bath', 'shower', 'hands']),
    obj('comb', 'comb', ['hair comb'], 'bathroom things', ['bathroom', 'grooming', 'things for hair', 'personal care'], 'tidy your hair', ['hair', 'tidy', 'brush', 'neat']),
    obj('shampoo', 'shampoo', ['hair wash'], 'bathroom things', ['bathroom', ...WASH], 'wash your hair', ['hair', 'wash', 'clean', 'shower']),
  ]),
  object('kitchen', 'Describe: in the kitchen', ['kitchen', 'food'], [
    obj('fridge', 'fridge', ['refrigerator'], 'kitchen things', ['kitchen', 'appliances', 'electrical things'], 'keep food cold and fresh', ['cold', 'food', 'fresh', 'keep']),
    obj('spoon', 'spoon', ['teaspoon'], 'cutlery', ['kitchen things', 'things for eating', 'knives and forks'], 'eat soup or cereal', ['soup', 'cereal', 'eat', 'stir']),
    obj('fork', 'fork', [], 'cutlery', ['kitchen things', 'things for eating', 'knives and forks'], 'pick up food to eat', ['eat', 'food', 'pick', 'spear']),
    obj('knife', 'knife', [], 'cutlery', ['kitchen things', 'things for eating', 'knives and forks', 'tools'], 'cut food', ['cut', 'food', 'slice', 'chop']),
    obj('plate', 'plate', ['dinner plate'], 'tableware', EAT, 'put your food on', ['food', 'eat', 'dinner', 'meal']),
    obj('saucepan', 'saucepan', ['pan', 'pot'], 'kitchen things', ['pots and pans', 'cooking things', ...EAT], 'cook food on the hob', ['cook', 'boil', 'hob', 'food', 'pasta']),
  ]),
  object('school', 'Describe: school things', ['school'], [
    obj('pencil', 'pencil', [], 'school things', SCHOOL_CATS, 'write or draw', ['write', 'draw', 'pencil']),
    obj('pen', 'pen', ['biro'], 'school things', [...SCHOOL_CATS, 'writing things'], 'write with ink', ['write', 'ink', 'writing']),
    obj('scissors', 'scissors', [], 'school things', [...SCHOOL_CATS, 'craft things'], 'cut paper', ['cut', 'paper', 'card']),
    obj('glue', 'glue', ['glue stick'], 'school things', [...SCHOOL_CATS, 'craft things'], 'stick paper together', ['stick', 'paper', 'join']),
    obj('calculator', 'calculator', [], 'school things', [...SCHOOL_CATS, 'maths things', 'technology'], 'work out sums', ['sum', 'sums', 'maths', 'add', 'numbers', 'count']),
    obj('school-bag', 'school bag', ['bag', 'backpack', 'rucksack'], 'school things', [...SCHOOL_CATS, 'things you carry', 'bags'], 'carry your books to school', ['carry', 'books', 'school']),
  ]),
  object('clothes', 'Describe: clothes', ['clothes', 'daily living'], [
    obj('coat', 'coat', ['jacket'], 'clothes', [...WEAR, 'winter clothes', 'outdoor clothes'], 'keep you warm and dry outside', ['warm', 'dry', 'cold', 'rain', 'outside']),
    obj('socks', 'socks', ['sock'], 'clothes', WEAR, 'keep your feet warm and comfy in shoes', ['feet', 'warm', 'shoes', 'comfy']),
    obj('t-shirt', 't-shirt', ['tee shirt', 'shirt', 'top'], 'clothes', WEAR, 'wear on the top half of your body', ['wear', 'top', 'body', 'summer']),
    obj('trousers', 'trousers', ['pants', 'jeans'], 'clothes', WEAR, 'cover your legs', ['legs', 'wear', 'cover']),
    obj('shoe-mans', 'shoes', ['shoe', 'trainers'], 'clothes', [...WEAR, 'footwear'], 'protect your feet when you walk', ['feet', 'walk', 'protect']),
    obj('gloves', 'gloves', ['glove'], 'clothes', [...WEAR, 'winter clothes'], 'keep your hands warm', ['hands', 'warm', 'cold']),
  ]),
  object('transport', 'Describe: getting around', ['transport', 'out and about'], [
    obj('bus', 'bus', [], 'transport', [...TRAVEL, 'public transport'], 'travel with lots of other people', ['travel', 'people', 'ride', 'go', 'public']),
    obj('train', 'train', [], 'transport', [...TRAVEL, 'public transport'], 'travel a long way on rails', ['travel', 'rails', 'track', 'station', 'far']),
    obj('bicycle', 'bike', ['bicycle'], 'transport', [...TRAVEL, 'sports things'], 'ride to get somewhere', ['ride', 'cycle', 'travel', 'go', 'get']),
    obj('car', 'car', [], 'transport', TRAVEL, 'drive to places', ['drive', 'travel', 'road', 'go']),
    obj('aeroplane', 'plane', ['aeroplane', 'airplane'], 'transport', TRAVEL, 'fly to faraway places', ['fly', 'air', 'travel', 'holiday', 'far']),
    obj('boat', 'boat', ['ship'], 'transport', TRAVEL, 'travel across water', ['water', 'sea', 'sail', 'travel', 'river']),
  ]),
);

// ---- Follow on screen: listen to the whole instruction, then move shapes or pictures into boxes in order. Easy sets have two
// steps, Medium three, Harder four. Uses the same shapes, pictures and step types as the activity editor.
const follow = (id, title, level, tags, items) => ({
  id: `follow-${id}`, mode: 'follow', title,
  goal: 'Listen to the whole instruction, then follow the steps in order',
  plan_goal: 'instructions', level, tags, age: '13–20', source: LIBRARY_SOURCE,
  content: { items },
});
const fo = (title, tokens, steps) => ({ title, tokens, steps });
// The same, with real places instead of numbered boxes ("put the milk in the fridge").
const fp = (title, places, tokens, steps) => ({ title, places, tokens, steps });
const box = (token, n) => ({ type: 'box', token, box: n });
const touch = (token) => ({ type: 'touch', token });
const nextTo = (token, target) => ({ type: 'next_to', token, target });
const leftOf = (token, target) => ({ type: 'left_of', token, target });
const rightOf = (token, target) => ({ type: 'right_of', token, target });

LIBRARY.push(
  follow('shapes-2', 'Follow on screen: two steps with shapes', 'Easy', ['shapes', 'two steps'], [
    fo('Yellow star, green square', ['yellow-star', 'green-square'], [box('yellow-star', 2), box('green-square', 4)]),
    fo('Touch, then move', ['blue-triangle', 'red-heart'], [touch('red-heart'), box('red-heart', 1)]),
    fo('Purple circle and orange square', ['purple-circle', 'orange-square', 'green-star'], [box('purple-circle', 3), nextTo('orange-square', 'purple-circle')]),
    fo('Red star on the left', ['red-star', 'blue-heart'], [box('red-star', 4), leftOf('blue-heart', 'red-star')]),
  ]),
  follow('pictures-2', 'Follow on screen: two steps with pictures', 'Easy', ['pictures', 'two steps'], [
    fo('Apple and mug', ['obj-apple', 'obj-mug'], [box('obj-apple', 1), box('obj-mug', 3)]),
    fo('Touch the key', ['obj-phone', 'obj-key'], [touch('obj-key'), box('obj-key', 2)]),
    fo('Pencil and scissors', ['obj-pencil', 'obj-scissors', 'obj-clock'], [box('obj-pencil', 2), nextTo('obj-scissors', 'obj-pencil')]),
    fo('Banana and sandwich', ['obj-sandwich', 'obj-banana'], [box('obj-banana', 4), leftOf('obj-sandwich', 'obj-banana')]),
  ]),
  follow('three', 'Follow on screen: three steps', 'Medium', ['shapes', 'pictures', 'three steps'], [
    fo('Red circle, blue square', ['red-circle', 'blue-square', 'yellow-star'], [touch('red-circle'), box('red-circle', 2), nextTo('blue-square', 'red-circle')]),
    fo('Green triangle and purple heart', ['green-triangle', 'purple-heart', 'orange-square'], [box('green-triangle', 1), rightOf('purple-heart', 'green-triangle'), { type: 'say_right' }]),
    fo('Money in box four', ['obj-umbrella', 'obj-bus', 'obj-money'], [touch('obj-money'), box('obj-money', 4), { type: 'say_box', box: 4 }]),
    fo('Guitar and drum', ['obj-guitar', 'obj-drum', 'obj-headphones'], [box('obj-guitar', 1), nextTo('obj-drum', 'obj-guitar'), { type: 'say_left' }]),
  ]),
  follow('four', 'Follow on screen: four steps', 'Harder', ['shapes', 'pictures', 'four steps'], [
    fo('Four shapes', ['red-circle', 'blue-square', 'green-triangle', 'yellow-star'], [box('red-circle', 1), box('blue-square', 2), rightOf('green-triangle', 'blue-square'), { type: 'say_box', box: 2 }]),
    fo('Key, phone and wallet', ['obj-key', 'obj-phone', 'obj-wallet'], [touch('obj-phone'), box('obj-phone', 1), box('obj-key', 3), { type: 'say_box', box: 3 }]),
  ]),
);

// ---- Real places instead of numbered boxes: putting shopping away, packing a bag, sorting washing.
LIBRARY.push(
  follow('places-2', 'Follow on screen: putting things away', 'Easy', ['real life', 'two steps', 'home'], [
    fp('Shopping away', ['fridge', 'cupboard', 'freezer'], ['obj-milk', 'obj-cereal', 'obj-tin'], [box('obj-milk', 1), box('obj-cereal', 2)]),
    fp('Pack for college', ['bag', 'desk', 'drawer'], ['obj-laptop', 'obj-charger', 'obj-lunchbox'], [box('obj-laptop', 1), box('obj-lunchbox', 2)]),
    fp('Sort the washing', ['washing_machine', 'wardrobe', 'drawer'], ['obj-tshirt', 'obj-jumper', 'obj-socks'], [box('obj-socks', 1), box('obj-jumper', 2)]),
    fp('Touch, then put away', ['fridge', 'cupboard', 'table'], ['obj-cheese', 'obj-bread', 'obj-crisps'], [touch('obj-cheese'), box('obj-cheese', 1)]),
  ]),
  follow('places-3', 'Follow on screen: three steps in real places', 'Medium', ['real life', 'three steps', 'home', 'work'], [
    fp('Unpack the shopping', ['fridge', 'cupboard', 'freezer', 'table'], ['obj-milk', 'obj-eggs', 'obj-tin', 'obj-bread'], [box('obj-milk', 1), box('obj-tin', 2), box('obj-bread', 4)]),
    fp('Get ready for the gym', ['bag', 'table', 'locker'], ['obj-towel', 'obj-shoes', 'obj-phone'], [box('obj-towel', 1), box('obj-shoes', 3), { type: 'say_box', box: 1 }]),
    fp('Tidy the desk', ['desk', 'drawer', 'bin'], ['obj-pencil', 'obj-scissors', 'obj-laptop'], [touch('obj-scissors'), box('obj-scissors', 2), box('obj-laptop', 1)]),
    fp('Pack for a trip', ['suitcase', 'bag', 'table'], ['obj-tshirt', 'obj-soap', 'obj-headphones'], [box('obj-tshirt', 1), box('obj-soap', 2), box('obj-headphones', 3)]),
  ]),
);

// ---- Harder sets: five-picture stories and longer explanations for learners who have done the Easy and Medium ones.
LIBRARY.push(
  tell('harder', 'Tell a story: five pictures', 'Harder', ['pictures', 'five events'], [
    pic('A flat tyre', 'Ravi', 'the road', ['Ravi rides his bike to the shop', 'the tyre goes flat', 'Ravi pushes the bike home', 'Dad mends the tyre', 'Ravi puts on his helmet and rides again'], ['bicycle', 'flat-tyre', 'walk-to', 'mend', 'helmet'], 'the bike works again', ['flat', 'repair']),
    pic('Growing a flower', 'Amy', 'the garden', ['Amy gets the seeds', 'Amy plants them in the soil', 'Amy waters the plants every day', 'a small plant grows', 'a flower opens'], ['seeds', 'plant-to', 'water-plants-to', 'seedling', 'flower'], 'Amy is proud of her flower', ['patient', 'grow']),
    pic('A fall at the park', 'Jo, a kind boy', 'the park', ['Jo runs across the park', 'Jo trips and falls over', 'a boy comes to help him up', 'Jo gets a plaster', 'Jo goes back on the swing'], ['run-to', 'fall-over-to', 'help-to', 'plaster', 'swing'], 'Jo felt better', ['trip', 'helpful']),
  ]),
  explain('life', 'Explain: looking after myself', ['daily living', 'independence'], [
    { title: 'Washing my clothes', question: 'Tell me how you wash your clothes.', points: [
      pt('put the dirty clothes in the laundry basket', 'Where do dirty clothes go?', 'First I put the dirty clothes in ___.', 'First I put the dirty clothes in the laundry basket.'),
      pt('put them in the washing machine, with washing powder, and choose the setting', 'What do you do at the machine?', 'Then I put them in the ___.', 'Then I put them in the washing machine with the powder and choose the setting.'),
      pt('take them out when the machine has finished', 'When do you take them out?', 'I take them out when ___.', 'I take them out when the machine has finished.'),
      pt('hang them up to dry or put them in the dryer', 'How do they get dry?', 'Then I ___.', 'Then I hang them up to dry.'),
      pt('fold them and put them away', 'What do you do last?', 'Last I ___.', 'Last I fold them and put them away.'),
    ] },
    { title: 'Feeling ill at school', question: 'Tell me what you do if you feel ill at school.', points: [
      pt('tell my teacher or an adult straight away', 'Who do you tell?', 'First I tell ___.', 'First I tell my teacher.'),
      pt('say what is wrong, such as a sore tummy or a headache', 'What do you say?', 'I say ___.', 'I say I have a headache.'),
      pt('go to the school office or the nurse if they say so', 'Where might you go?', 'They might send me to ___.', 'They might send me to the school office.'),
      pt('wait for a grown-up to phone home', 'What happens next?', 'Then ___.', 'Then a grown-up phones home.'),
    ] },
    { title: 'Asking for help in a shop', question: 'Tell me how you ask for help in a shop when you cannot find something.', points: [
      pt('look around for a person who works there', 'Who do you look for?', 'First I look for ___.', 'First I look for a person who works there.'),
      pt('say excuse me and wait for them to look at me', 'What do you say first?', 'I say ___.', 'I say excuse me.'),
      pt('say what I am looking for', 'What do you tell them?', 'I say I am looking for ___.', 'I say I am looking for the milk.'),
      pt('listen to where it is and say thank you', 'What do you say at the end?', 'At the end I say ___.', 'At the end I say thank you.'),
    ] },
  ]),
);

// Levels are a first guide only: the therapist decides what is easy or hard for each learner.
const SET_LEVELS = {
  'think-home': 'Easy', 'think-school': 'Easy', 'think-out': 'Medium', 'think-friends': 'Medium', 'think-travel': 'Harder', 'think-work': 'Harder',
  'talk-favourites': 'Easy', 'talk-my-day': 'Easy', 'talk-weekend': 'Medium', 'talk-hobbies': 'Medium', 'talk-family': 'Medium', 'talk-school': 'Medium', 'talk-out': 'Medium',
  'explain-routines': 'Easy', 'explain-things': 'Medium', 'explain-out': 'Medium', 'explain-life': 'Harder',
};
for (const it of LIBRARY) if (SET_LEVELS[it.id]) it.level = SET_LEVELS[it.id];

// ---- Sets written for 13 to 20 year olds (student review, 27 Nov): college, work, phones, money and friends.
// Think situations describe what the learner sees or hears without naming what is wrong, and give the team a concrete
// first clue ("What does the screen say?").
const sitc = (first_clue, ...rest) => ({ ...sit(...rest), first_clue });
LIBRARY.push(
  think('college-work', 'Think: surprises at college and work', ['work', 'college'], [
    sitc('What did your manager say about the rota?', 'Shift changed', 'You arrive at work at 9 for your Saturday shift. Your manager looks surprised and says, "You’re on the rota for Sunday this week."', 'my shift was changed and I did not know', ['ask my manager to show me the rota', 'ask what I should do today', 'check my messages for a new rota', 'call a parent to tell them'], 'my manager can tell me when I need to work', 'ask another member of staff or my job coach', ['walk out without saying anything', 'argue loudly with my manager']),
    sitc('What does the sign on the door say?', 'Room changed', 'You go to room B4 for your Tuesday class. There is a sign on the door: "Today: room C12".', 'my class has moved to another room', ['go to room C12', 'ask a member of staff where C12 is', 'check the college app or my timetable'], 'the sign tells me where my class is today', 'ask at reception', ['go home without telling anyone', 'wait outside B4 for the whole lesson']),
    sitc('Do you know what "the cages" are?', 'An instruction I do not understand', 'Your supervisor says, "Can you sort the stock in the back, then do the cages?" Then she walks away. You have never heard of the cages.', 'I do not understand part of the instruction', ['ask what the cages are', 'ask my supervisor to show me', 'say: could you explain that again, please?'], 'asking means I do the job right', 'ask another colleague or my job coach', ['guess and do something that might be wrong', 'pretend I understood and do nothing']),
    sitc('What does the screen say?', 'Card does not work', 'You are buying lunch in the canteen. You tap your bank card. The machine beeps and the screen says "Declined".', 'my card did not work', ['try once more', 'pay with cash if I have some', 'politely tell the person at the till and put the food back', 'message a parent'], 'the person at the till sees this a lot and can help', 'ask a member of staff or a friend to help', ['keep tapping again and again while people wait', 'walk off with the food']),
    sitc('Look at your phone. What does the battery say?', 'Phone almost dead', 'You are in town and need to get home later. You look at your phone. The battery says 3%.', 'my phone is about to run out', ['message a parent now with my plan', 'ask a shop or café if I can charge it', 'turn on low power mode'], 'my family will know my plan even if the phone dies', 'ask a member of staff to help me call home', ['give my phone to a stranger to charge', 'go somewhere new without telling anyone']),
  ]),
  think('phones-messages', 'Think: surprises with phones and messages', ['technology', 'friends', 'social'], [
    sitc('Would a real company ask for your bank details by text?', 'A prize message', 'You get a text from a number you do not know. It says you have won a £500 prize and asks for your bank details.', 'it could be a scam', ['do not reply', 'show a parent or a trusted adult', 'delete or block the number'], 'a trusted adult can check if it is real', 'ask someone at college or my job coach', ['send my bank details', 'click the link']),
    sitc('Where does the last message say to meet?', 'Plan changed in the group chat', 'Your friends planned to meet at the cinema at 7. At 6 you see new messages in the group chat. The last one says, "See you at the bowling place instead."', 'the meeting place has changed', ['read the messages again', 'ask the group where and when we are meeting now', 'tell my parent the new plan'], 'I need to know where to go', 'call one friend to check', ['go to the cinema anyway without checking', 'go somewhere without telling my family']),
    sitc('What colour did you order, and what colour is it?', 'Wrong order', 'You ordered a black hoodie online. The parcel arrives. You open it and the hoodie inside is grey.', 'they sent the wrong colour', ['check my order on my phone', 'ask a parent to help me contact the shop', 'use the returns form in the parcel'], 'the shop can send the right one', 'take it back to the shop with the receipt', ['throw it away', 'write angry comments online']),
    sitc('Have you ever met this person in real life?', 'Someone online wants to meet', 'You play an online game with someone you have never met. Today they ask to meet you in town on Saturday.', 'I do not know this person in real life', ['say no for now', 'tell a parent or a trusted adult', 'block or report them if they keep asking'], 'a trusted adult can help me stay safe', 'report them in the game', ['meet them on my own', 'give them my address']),
  ]),
  task('cafe-order', 'Order at a café counter', 'Easy', ['out and about', 'food', 'social'], [
    s('Join the queue. Look at the menu.', 'queue-to', 'What do you look at while you wait?', 'the menu'),
    s('Decide what you want before it is your turn.', 'menu', 'When do you decide?', 'before it is my turn', { reasoning: ['Why do you decide before your turn?', 'so I am ready and the queue keeps moving'] }),
    s('Say hello. Say what you would like.', 'cafe', 'What do you say?', 'hello and what I would like', { independence: ['What could you do if they do not hear you?', 'say it again a bit louder'] }),
    s('Pay with your card or cash.', 'card', 'How do you pay?', 'with my card or cash'),
    s('Wait for your order. Say thank you.', 'tray', 'What do you say when you get your order?', 'thank you'),
  ]),
  task('self-checkout', 'Pay at a self-checkout', 'Medium', ['out and about', 'money', 'independence'], [
    s('Take your basket to a free self-checkout.', 'basket', 'Where do you take your basket?', 'a free self-checkout'),
    s('Scan each item. Wait for the beep.', 'shop', 'What do you wait for after each scan?', 'the beep', { independence: ['What could you do if an item will not scan?', 'ask the assistant for help'] }),
    s('Put each item in the bagging area.', 'basket-2', 'Where do the items go?', 'the bagging area'),
    s('Press Pay. Tap your card or put in cash.', 'card', 'How do you pay?', 'tap my card or put in cash', { reasoning: ['Why do you check the total before you pay?', 'to make sure it is right'] }),
    s('Take your receipt and your shopping.', 'shop-2', 'What do you take at the end?', 'my receipt and my shopping'),
  ]),
  task('running-late', 'Tell work I am running late', 'Medium', ['work', 'technology', 'independence'], [
    s('Open your messages. Find your manager’s name.', 'mobile-phone', 'Whose name do you find?', 'my manager'),
    s('Write: Sorry, I am running late.', 'mobile-phone-text-message', 'What do you write first?', 'sorry, I am running late', { reasoning: ['Why do you tell them straight away?', 'so they can plan without me'] }),
    s('Say what time you will arrive.', 'clock', 'What else do you say?', 'what time I will arrive'),
    s('Read it again. Then press Send.', 'text-mobile-message-to', 'What do you do before you press Send?', 'read it again', { independence: ['What could you do if they do not reply?', 'call them, or tell another member of staff when I arrive'] }),
  ]),
  explain('getting-things-done', 'Explain: getting things done', ['independence', 'out and about', 'work'], [
    { title: 'Booking an appointment by phone', question: 'Tell me how you book an appointment on the phone.', points: [
      pt('say who I am', 'What do you say first?', 'First I say ___.', 'First I say my name.'),
      pt('say what appointment I need', 'What do you ask for?', 'Then I say I need ___.', 'Then I say I need an appointment with the doctor.'),
      pt('listen to the times and choose one', 'How do you pick a time?', 'I listen and ___.', 'I listen to the times and choose one that works.'),
      pt('repeat the time back and write it down', 'How do you remember it?', 'At the end I ___.', 'At the end I say the time back and write it down.'),
    ] },
    { title: 'Using a self-checkout', question: 'Tell me how you use a self-checkout.', points: [
      pt('scan each item', 'What do you do with each item?', 'First I ___ each item.', 'First I scan each item.'),
      pt('put the items in the bagging area', 'Where do the items go?', 'Then I put them ___.', 'Then I put them in the bagging area.'),
      pt('press pay and use a card or cash', 'How do you pay?', 'Then I press ___.', 'Then I press Pay and tap my card.'),
      pt('ask the assistant if a message comes up', 'What if something goes wrong?', 'If a message comes up, I ___.', 'If a message comes up, I ask the assistant.'),
    ] },
    { title: 'Telling a manager I am running late', question: 'Tell me what you do if you are going to be late for work.', points: [
      pt('message or call as soon as I know', 'When do you tell them?', 'I tell them ___.', 'I tell them as soon as I know.'),
      pt('say that I am running late', 'What do you say?', 'I say that ___.', 'I say that I am running late.'),
      pt('say what time I will arrive', 'What else do they need to know?', 'I say I will be there at ___.', 'I say I will be there at ten past nine.'),
      pt('say sorry when I get there', 'What do you do when you arrive?', 'When I arrive I ___.', 'When I arrive I say sorry.'),
    ] },
    { title: 'Ordering food at a counter', question: 'Tell me how you order food at a counter.', points: [
      pt('wait in the queue and look at the menu', 'What do you do while you wait?', 'While I wait I ___.', 'While I wait I look at the menu.'),
      pt('decide before it is my turn', 'When do you decide?', 'I decide ___.', 'I decide before it is my turn.'),
      pt('say clearly what I would like', 'What do you say?', 'I say, "Can I have ___, please?"', 'I say, "Can I have a chicken wrap, please?"'),
      pt('pay and wait for my order', 'What do you do after you pay?', 'After I pay I ___.', 'After I pay I wait for my order.'),
    ] },
  ]),
  story('first-shift', 'Story: Jordan’s first shift', ['work'],
    'On Saturday, Jordan started work at the garden centre. His supervisor, Kate, gave him a green T-shirt and a name badge. His first job was to water the plants in the greenhouse. At eleven o’clock, a customer asked where the compost was. Jordan did not know, so he said, "I’ll find out for you," and asked Kate. She showed him aisle 3. At lunch, Jordan ate a cheese sandwich in the staff room. At the end of the day, Kate said he had worked hard, and she put him on the rota for next Saturday.',
    [qn('Where did Jordan start work?', ['garden centre', 'the garden centre', 'garden center'], 'It is a shop that sells plants.'),
     qn('What was his supervisor called?', ['Kate'], 'Her name starts with K.'),
     qn('What was his first job?', ['water the plants', 'watering the plants', 'watering', 'water'], 'He did it in the greenhouse.'),
     qn('What did Jordan do when he did not know where the compost was?', ['asked Kate', 'asked', 'find out', 'asked his supervisor', 'he asked'], 'He said he would find out, and went to someone.'),
     qn('Which aisle was the compost in?', ['3', 'three', 'aisle 3', 'aisle three'], 'It is a number between two and four.')]),
  story('change-of-plan', 'Story: a change of plan', ['friends', 'social'],
    'Maya and her friends planned to meet outside the cinema at seven o’clock. At six, Maya’s phone buzzed. Her friend Leo wrote in the group chat that the film was sold out. The group decided to go bowling instead. Maya felt a bit annoyed, because she had wanted to see the film. She took a deep breath, told her mum about the new plan and caught the bus to the bowling alley. In the end she got the highest score, and the friends agreed to see the film next week.',
    [qn('Where did they plan to meet?', ['cinema', 'outside the cinema', 'the cinema'], 'It is where you go to watch a film.'),
     qn('Why did the plan change?', ['sold out', 'the film was sold out', 'no tickets'], 'There were no tickets left.'),
     qn('Where did they go instead?', ['bowling', 'bowling alley', 'the bowling alley'], 'You roll a heavy ball there.'),
     qn('Who did Maya tell about the new plan?', ['her mum', 'mum', 'mom', 'her mom', 'her mother'], 'Someone in her family.'),
     qn('What happened at the bowling?', ['highest score', 'she got the highest score', 'she won', 'won'], 'Think about her score.')]),
  story('interview', 'Story: the job interview', ['work'],
    'Priya had an interview for a job at the library. The night before, she ironed her shirt and wrote down two questions to ask. She arrived ten minutes early and told the receptionist her name. The manager, Mr Hughes, asked why she wanted the job. Priya said she liked books and helping people. When he asked a question she did not understand, she said, "Could you say that another way, please?" He smiled and explained. At the end, Priya asked what the hours would be. Two days later, she got a phone call. She had the job.',
    [qn('Where was the job?', ['library', 'the library', 'at the library'], 'It is a place full of books.'),
     qn('How early did Priya arrive?', ['ten minutes', '10 minutes', 'ten minutes early'], 'It was a number of minutes, more than five.'),
     qn('Why did Priya want the job?', ['books', 'likes books', 'she liked books', 'helping people', 'help people'], 'She said two things she likes.'),
     qn('What did Priya say when she did not understand?', ['say that another way', 'could you say that another way', 'another way', 'asked him to explain', 'explain'], 'She asked him to say it differently.'),
     qn('How did she find out she had the job?', ['phone call', 'a phone call', 'call', 'phoned', 'phone'], 'Her phone rang two days later.')]),
);

for (const [id, level] of [['think-college-work', 'Medium'], ['think-phones-messages', 'Medium'], ['explain-getting-things-done', 'Medium']]) LIBRARY.find((x) => x.id === id).level = level;

export const libraryById = (id) => LIBRARY.find((x) => x.id === id) || null;

// What the Library page shows for each item: no questions or answers, just enough to choose.
const recallPrompt = (x) => `Tell me ${NUM_WORDS[x.target] || x.target} thing${x.target === 1 ? '' : 's'} you did ${x.when}.`;
const UNITS = { steps: 'steps', think: 'situations', conversation: 'topics', explain: 'explanations', category: 'groups', listen: 'questions', recall: 'prompts', story: 'stories', object: 'pictures', follow: 'instructions' };
export function libraryLines(item) {
  const items = item.content.items;
  if (item.mode === 'steps') return items[0].steps.map((x) => x.text);
  if (item.mode === 'think') return items.map((x) => `${x.title}: ${x.scenario}`);
  if (item.mode === 'explain') return items.map((x) => `${x.title}: ${x.question}`);
  if (item.mode === 'category') return items.map((x) => (x.kind === 'add' ? `Add a word to: ${x.given.join(', ')} (${x.group})` : `Name ${x.target} ${x.group}`));
  if (item.mode === 'listen') return items[0].questions.map((x) => x.question);
  if (item.mode === 'recall') return items.map((x) => recallPrompt(x));
  if (item.mode === 'story') return items.map((x) => `${x.title}: ${x.events[0]}…`);
  if (item.mode === 'object') return items.map((x) => x.name);
  if (item.mode === 'follow') return items.map((x) => followInstruction(x));
  return items.map((x) => `${x.topic}: ${x.opener}`);
}
export function libraryCard(item, added = null) {
  const lines = libraryLines(item);
  return {
    id: item.id, mode: item.mode, title: item.title, goal: item.goal, level: item.level, tags: item.tags, age: item.age, source: item.source,
    count: lines.length, unit: UNITS[item.mode] || 'items', lines,
    images: item.mode === 'steps' ? item.content.items[0].steps.map((x) => x.image_id) : item.mode === 'story' ? item.content.items.map((x) => x.image_ids[0]) : item.mode === 'object' ? item.content.items.map((x) => x.image_id) : [],
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
  } else if (item.mode === 'object') {
    parts = list.map((x) => ({ heading: x.name.charAt(0).toUpperCase() + x.name.slice(1), image: x.image_id, rows: [['Name', [x.name, ...x.name_alternatives].join(', ')], ['Group', [x.category, ...x.category_alternatives]], ['What it is for', x.function], ['Words that show the use', x.function_keywords]] }));
  } else if (item.mode === 'follow') {
    parts = list.map((x) => ({ heading: x.title, images: x.tokens.filter((k) => k.startsWith('obj-')).map((k) => `sym:${FOLLOW_OBJECTS[k.slice(4)].file}`), rows: [['Foxy says', followInstruction(x)], ['Shapes or pictures on screen', x.tokens.map(tokenName)], ...(followPlaces(x).length ? [['Places', followPlaces(x).map((p) => FOLLOW_PLACES[p].name)]] : [])] }));
  } else if (item.mode === 'story') {
    parts = list.map((x) => ({ heading: x.title, images: x.image_ids, rows: [['Who', x.who], ['Where', x.setting], ['What happens, in order', x.events], ['How it ended', x.outcome], ...(x.target_words?.length ? [['Words Foxy listens for', x.target_words]] : [])] }));
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
    } else if (it.mode === 'object') {
      if (list.length < 3 || list.length > 8) out.push(`${it.id}: ${list.length} pictures (want 3 to 8)`);
      list.forEach((x, i) => {
        const where = `${it.id} picture ${i + 1}`;
        for (const k of ['name', 'category', 'function']) if (!text(x[k])) out.push(`${where}: no ${k}`);
        if (!x.image_id?.startsWith('sym:') || !symbolSlugs.has(x.image_id.slice(4))) out.push(`${where}: picture ${x.image_id} not found`);
        if (!(x.category_alternatives || []).length || !(x.function_keywords || []).length) out.push(`${where}: needs other accepted groups and use words`);
      });
    } else if (it.mode === 'follow') {
      if (list.length < 2 || list.length > 6) out.push(`${it.id}: ${list.length} instructions (want 2 to 6)`);
      list.forEach((x, i) => {
        const where = `${it.id} instruction ${i + 1}`;
        const toks = x.tokens || [];
        if (toks.length < 2 || toks.length > 4 || !toks.every(isFollowToken) || new Set(toks).size !== toks.length) out.push(`${where}: choose 2 to 4 different shapes or objects`);
        const steps = x.steps || [];
        if (!steps.length || steps.length > 4) out.push(`${where}: ${steps.length} steps (want 1 to 4)`);
        steps.forEach((st, k) => {
          if (!FOLLOW_STEP_TYPES.includes(st?.type)) out.push(`${where} step ${k + 1}: needs a type`);
          else if (!st.type.startsWith('say_') && !toks.includes(st.token)) out.push(`${where} step ${k + 1}: not one of this instruction's shapes or objects`);
          if (['box', 'say_box'].includes(st?.type) && !(Number(st.box) >= 1 && Number(st.box) <= followBoxCount(x))) out.push(`${where} step ${k + 1}: box must be 1 to ${followBoxCount(x)}`);
          if (['next_to', 'left_of', 'right_of'].includes(st?.type) && (!toks.includes(st.target) || st.target === st.token)) out.push(`${where} step ${k + 1}: needs a different one to put it next to`);
        });
        if (x.places && (followPlaces(x).length !== x.places.length || x.places.length < 2)) out.push(`${where}: places must be 2 to 4 known places`);
        if (new Set(steps.filter((st) => st.type === 'box').map((st) => st.box)).size !== steps.filter((st) => st.type === 'box').length) out.push(`${where}: two steps use the same box`);
      });
    } else if (it.mode === 'story') {
      if (list.length < 2 || list.length > 5) out.push(`${it.id}: ${list.length} stories (want 2 to 5)`);
      list.forEach((x, i) => {
        const where = `${it.id} story ${i + 1}`;
        for (const k of ['title', 'who', 'setting', 'outcome']) if (!text(x[k])) out.push(`${where}: no ${k}`);
        const n = (x.events || []).length;
        if (n < 3 || n > 5 || !(x.events || []).every(text)) out.push(`${where}: ${n} events (want 3 to 5, all with words)`);
        if ((x.image_ids || []).length !== n) out.push(`${where}: needs one picture for each event`);
        for (const id of x.image_ids || []) if (!id.startsWith('sym:') || !symbolSlugs.has(id.slice(4))) out.push(`${where}: picture ${id} not found`);
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
