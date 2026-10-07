// The four shared priorities from Sam's Functional Communication Plan (Rev 1),
// plus "other" for practice that isn't tied to one of them.
// Targets and cues are the team's wording; change them here if the plan is revised.

export const PLAN_GOALS = {
  unexpected: {
    n: 1,
    label: 'Unexpected situations',
    short: 'Unexpected',
    target: 'Notice a change, pause and ask a trusted adult for clarification — 4/5 safe role-plays on two separate dates, with no adult prompt.',
    cue: 'STOP → THINK → Is this expected? → If unsure, ASK',
    allowed: ['I'],
    modes: ['task'],
  },
  instructions: {
    n: 2,
    label: 'Following instructions',
    short: 'Instructions',
    target: 'Familiar 2-step tasks in order — 4/5 opportunities on two dates without adult prompts. Trial 3 steps when ready.',
    cue: '"Make a movie in your mind." Retell the steps, then do them.',
    allowed: ['I'],
    modes: ['task'],
  },
  narrative: {
    n: 3,
    label: 'Recall and narrative',
    short: 'Narrative',
    target: 'Retell an activity with who/where, two events in order and one detail or outcome — 4/5 retellings on two dates, no more than one general cue.',
    cue: 'Picture it → Who/where? → First/next → Detail',
    allowed: ['I', 'M'],
    modes: ['story'],
  },
  conversation: {
    n: 4,
    label: 'Reciprocal conversation',
    short: 'Conversation',
    target: 'At least 4 relevant alternating turns, including a related comment and a relevant question from Sam — 4/5 conversations on two dates, no more than one general cue.',
    cue: 'Comment → Bridge → Question → Continue',
    allowed: ['I', 'M'],
    modes: ['conversation'],
  },
  other: {
    n: 5,
    label: 'Other practice',
    short: 'Other',
    target: 'Not counted towards the four plan goals.',
    cue: '',
    allowed: null, // no success rule — shown as practice only
    modes: ['object', 'story', 'task', 'conversation'],
  },
};
export const GOAL_KEYS = Object.keys(PLAN_GOALS);

// Support codes, as defined in the plan.
export const SUPPORT_CODES = {
  I: 'No adult prompt',
  M: 'One cue',
  P: 'Several prompts',
  F: 'Full model / direct support',
};

/**
 * Support code for one practice item, from the cues Buddy gave.
 * Any model → F; two or more cues → P; one cue → M; none → I.
 * Cues Sam asked for himself still count as support (conservative), but asking is recorded as well.
 */
export function supportCode(supportGiven) {
  if (!supportGiven?.length) return 'I';
  if (supportGiven.some((s) => s.level === 3)) return 'F';
  return supportGiven.length === 1 ? 'M' : 'P';
}

/**
 * Did this opportunity meet the plan's criterion?
 * true / false for the four plan goals; null when the goal has no rule ("other")
 * or the item wasn't finished (it isn't counted as an opportunity).
 */
export function successFor(goalKey, { complete, code, stopped }) {
  const g = PLAN_GOALS[goalKey] || PLAN_GOALS.other;
  if (!g.allowed || stopped) return null;
  return !!complete && g.allowed.includes(code);
}
