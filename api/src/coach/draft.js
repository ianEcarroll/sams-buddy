// Task Buddy: Buddy drafts one question per step for the team's chosen skill, with an example answer,
// a specific clue and a model. The team edits and approves them in the activity editor; nothing is used
// with a learner until the activity is saved.
import { STEP_SKILLS } from './modes.js';

const MOMENT = { before: 'before the learner does the step (Buddy has just said it)', after: 'after the learner has done the step' };
const MEMORY_MOMENT = 'before Buddy says the step, so the learner has to remember it';

export async function draftStepQuestions({ apiKey, model, workspaceId, task, steps, skill, run = 'learn', learner = {}, fetchImpl = fetch }) {
  const k = STEP_SKILLS[skill];
  if (!k) throw new Error('Choose a skill first.');
  const list = steps.map((s) => String(s || '').trim()).filter(Boolean).slice(0, 12);
  if (!list.length) throw new Error('Add the steps first.');
  const tool = {
    name: 'questions',
    description: 'One coaching question per step, in step order.',
    input_schema: {
      type: 'object',
      properties: {
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              question: { type: 'string', description: 'The question Buddy asks. One short, literal sentence.' },
              answer: { type: 'string', description: 'One good answer, a few words.' },
              clue: { type: 'string', description: 'A specific clue that helps without giving the whole answer.' },
              model: { type: 'string', description: 'A full model answer, as one sentence Buddy can say.' },
            },
            required: ['question', 'answer', 'clue', 'model'],
          },
        },
      },
      required: ['steps'],
    },
  };
  const who = Number(learner.age) > 0 ? `a ${learner.age}-year-old` : 'a young person aged 10 to 20';
  const user = [
    `Task: ${task || 'an everyday task'}`,
    `Steps, in order:\n${list.map((s, i) => `${i + 1}. ${s}`).join('\n')}`,
    `Skill being practised: ${k.label}: ${k.goal}.`,
    run === 'learn' ? 'Buddy has read out all the steps first; the learner is not doing the task, and answers each question from memory. Buddy says "Step N." before each question, so do not start the question with the step number.' : `Buddy asks each question ${skill === 'memory' ? MEMORY_MOMENT : MOMENT[k.when]}.`,
    `Write exactly ${list.length} entries, one per step, in order.`,
  ].join('\n\n');
  const system = `You write coaching questions for TALVO, a speech and language practice app for ${who} who may be autistic or have a language disorder. They are doing a real task with their hands, one step at a time. Use plain, literal British English: short sentences, no idioms, no sarcasm, nothing babyish. Each question is about that one step only and has one clear, sensible answer. For Memory, ask what the step is (e.g. "What do you need to do next?" or, when learning the steps, "What do you do at this step?"), never repeat the step itself in the question. For Understanding, ask about the key action or thing in the step Buddy just said. For Expressive language, ask them to tell you what they did. For Reasoning, ask why the step matters, or what to do if something goes wrong. For Checking my own work, ask how they know the step is finished. Clues must not give the whole answer. Always answer by calling the questions tool once.`;
  const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', ...(workspaceId ? { 'anthropic-workspace-id': workspaceId } : {}) },
    body: JSON.stringify({ model, max_tokens: 2500, system, tools: [tool], tool_choice: { type: 'auto' }, messages: [{ role: 'user', content: user }] }),
  });
  if (!res.ok) throw new Error(`Buddy could not draft the questions right now (${res.status}).`);
  const data = await res.json();
  const out = data.content?.find((b) => b.type === 'tool_use')?.input?.steps;
  if (!Array.isArray(out)) throw new Error('Buddy could not draft the questions right now.');
  const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  return list.map((_, i) => ({ question: clean(out[i]?.question), answer: clean(out[i]?.answer), clue: clean(out[i]?.clue), model: clean(out[i]?.model) }));
}
