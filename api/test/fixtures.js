export const spoonActivity = {
  id: 'a-object', mode: 'object', title: 'Kitchen objects', goal: 'Name, category and function',
  content: { items: [
    { name: 'spoon', category: 'utensil', category_alternatives: ['cutlery'], function: 'eat soup or cereal', function_keywords: ['eat', 'eating', 'stir', 'soup'] },
    { name: 'cup', category: 'container', category_alternatives: ['dish'], function: 'drink', function_keywords: ['drink', 'drinking'] },
  ] },
};

export const storyActivity = {
  id: 'a-story', mode: 'story', title: 'At the park', goal: 'Setting, events in order, precise words',
  content: { items: [
    { title: 'The kite', setting: 'park', events: ['the boy builds a kite', 'the wind lifts the kite', 'the kite spins in the sky'],
      keywords: [['build', 'builds', 'made', 'make'], ['wind', 'lift', 'flies', 'fly'], ['spin', 'spins', 'spinning', 'twirl']],
      target_words: ['spin', 'build', 'construct'], word_alternatives: ['twirl'] },
  ] },
};

export const taskActivity = {
  id: 'a-task', mode: 'task', title: 'Café shift', goal: 'Retell the instructions; ask for clarification',
  content: { items: [
    { title: 'Wipe the tables', unclear_instruction: 'Sort out the tables before the rush.',
      steps: ['get the cloth and spray', 'wipe each table', 'put the chairs in'],
      keywords: [['cloth', 'spray'], ['wipe'], ['chairs', 'chair']] },
  ] },
};

export const convActivity = {
  id: 'a-conv', mode: 'conversation', title: 'Weekend chat', goal: 'Comments, connections and questions',
  content: { practise_questions: true, items: [
    { topic: 'films', opener: 'I watched Toy Story at the weekend. The toys were funny.', keywords: ['film', 'movie', 'toy', 'story', 'cinema', 'watched'], buddy_lines: ['That sounds fun.'] },
  ] },
};
