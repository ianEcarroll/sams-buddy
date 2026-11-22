# Model comparison: claude-haiku-5-5 vs claude-sonnet-5-5

2026-11-11 10:06 · 26 answers · learner "Sam", 15

| | claude-haiku-5-5 | claude-sonnet-5-5 |
|---|---|---|
| Matched the expected result | 24 / 26 | 24 / 26 |
| Average time per check | 2.7 s | 2.6 s |
| Tokens in / out (all checks) | 48,081 / 14,353 | 48,081 / 8,848 |
| API errors | 0 | 0 |


## Story questions (accepted answers)

| Answer | Why it's here | Expected | claude-haiku-5-5 | claude-sonnet-5-5 |
|---|---|---|---|---|
| Q1: "it was on that island, Neverland" | answer inside a sentence | right | ✅ right | ✅ right |
| Q1: "never never land" | near miss of an accepted answer | right | ✅ right | ✅ right |
| Q2: "the little silver thing you put on your finger for sewing" | describes a thimble without the word | right | ✅ right | ✅ right |
| Q2: "a ring" | plausible but wrong | wrong | ✅ wrong | ✅ wrong |
| Q3: "the boy who never grows up" | describes Peter Pan without the name | right | ✅ right | ✅ right |
| Q3: "Wendy" | a character, but the wrong one | wrong | ✅ wrong | ✅ wrong |
| Q4: "a big black bird" | accepted via "bird" | right | ✅ right | ✅ right |
| Q4: "a raven" | synonym not in the list | right | ✅ right | ✅ right |
| Q4: "a cat" | wrong animal | wrong | ✅ wrong | ✅ wrong |
| Q5: "she goes all sparkly and bright" | same meaning, different words | right | ✅ right | ✅ right |
| Q5: "she cries" | wrong | wrong | ✅ wrong | ✅ wrong |
| Q3: "I don't know" | no answer | wrong | ✅ wrong | ✅ wrong |

## Think Buddy (safety)

| Answer | Why it's here | Expected | claude-haiku-5-5 | claude-sonnet-5-5 |
|---|---|---|---|---|
| "I'd ask the lady at the front desk where he is" | starter good action, own words | safe action | ✅ safe action | ✅ safe action |
| "I'd ask for help" | asking for help always counts | safe action | ✅ safe action | ✅ safe action |
| "wait a bit, and if he still doesn't come I'd ring my mum because she can sort it out" | action + reason + plan B | safe action | ✅ safe action | ✅ safe action |
| "I'd just walk home by myself" | leaving alone | unsafe | ✅ unsafe | ✅ unsafe |
| "I'd go with the man in the car park, he said he knows my trainer" | going with a stranger | unsafe | ✅ unsafe | ✅ unsafe |
| "I'd do my workout on my own on the big machines" | not in the unsafe list: needs judgement | unsafe | ✅ unsafe | ✅ unsafe |
| "I dunno" | no answer | no action | ✅ no action | ✅ no action |

## Explain Buddy (parts of an answer)

| Answer | Why it's here | Expected | claude-haiku-5-5 | claude-sonnet-5-5 |
|---|---|---|---|---|
| "you get two bits of bread, put cheese on, then the other bread on top and eat it" | all four parts | 1,2,3,4 | ✅ 1,2,3,4 | ✅ 1,2,3,4 |
| "bread and ham" | very short | 1,2 | ❌ 2 | ❌ 2 |
| "you put the stuff in the middle" | vague but has the filling | 2 | ✅ 2 | ✅ 2 |
| "I like sandwiches" | no parts | none | ✅ none | ✅ none |

## Chat Buddy (reply quality: read these)

| Answer | Why it's here | Expected | claude-haiku-5-5 | claude-sonnet-5-5 |
|---|---|---|---|---|
| "yeah I go on tuesdays with my coach" | on topic, personal | on topic | ✅ on topic | ✅ on topic |
| "I did drumming yesterday" | changes topic to an interest | off topic | ❌ on topic | ❌ on topic |
| "yes" | very short | on topic | ✅ on topic | ✅ on topic |

## What Buddy would say back in Chat Buddy

**Sam: "yeah I go on tuesdays with my coach"**

- claude-haiku-5-5: Nice, a regular Tuesday session sounds like a good routine. What do you usually do when you're there?
- claude-sonnet-5-5: Nice, Tuesdays with your coach sounds like a good routine! I like gym days that get me moving. What do you like doing most when you're there?

**Sam: "I did drumming yesterday"**

- claude-haiku-5-5: Drumming yesterday sounds like a proper workout too! Do you like the drums more than the gym, or both?
- claude-sonnet-5-5: Nice, drumming is a great workout for your arms! I like going to the gym to stay active too. Do you ever do both in one week?

**Sam: "yes"**

- claude-haiku-5-5: Oh, so you're a gym regular! I'm more of a couch person, so I'm impressed. What's your favourite part of the workout?
- claude-sonnet-5-5: Nice, I love a good gym session! What's your favourite thing to do there?


Expected results are judgement calls: a ❌ on a borderline case (e.g. the big machines) is worth a look, not automatically a failure.