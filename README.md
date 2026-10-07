# Sam's Buddy

Therapist-guided practice between sessions. Sam practises the goals his speech therapist and teachers set;
Buddy follows their wording, cues and targets, and keeps a short, honest record of what Sam did on his own
and what he did after support.

```
api/   Node + Express + Postgres (Render). Coaching engine, ElevenLabs voice, Claude judge, records.
web/   Cloudflare Worker + static PWA. Sam's app at /, support-team area at /adult/.
render.yaml   Render Blueprint (API + database)
```

## How the coaching works

`api/src/coach/engine.js` is a deterministic state machine:

**Prompt → wait → listen → recognise what Sam supplied → one cue for one missing part → another attempt.**

- Support ladder per element: reminder → specific cue → sentence starter → model. Wording is editable per activity.
- After a model, Sam gets one more attempt; if the part is still missing it is noted and Buddy moves on.
- Support fades on later items (starts one level lighter than last time).
- A concise, complete answer ends the item. No extra questions once the goal is met.
- Silence is never a failure. Empty audio → "Take your time." Unsure speech recognition → "Did you say …?" (not counted as an attempt).
- Asking for help ("Could you repeat that?", "I don't understand", "I need help", "I need to check with my job coach") is recorded as a successful response.
- "Make a movie in your mind." is used word for word before stories and task retelling.

`api/src/coach/judge.js` decides only *what Sam supplied* against the team's answer key.
With `ANTHROPIC_API_KEY` it uses Claude (forced tool call, structured output); without it, or if Claude fails,
a keyword judge keeps the app working. The judge never chooses what Buddy says next.

`api/src/coach/modes.js` holds the four modes: Describe a Picture (Name → Group → Use), Tell a Story
(Where → First → Next → Last + target words), Practise a Task (retell steps; optional deliberately unclear
instruction to practise clarification) and Have a Conversation (comment or personal connection = valid turn;
optional follow-up question goal).

## The six demonstrations

`npm test` in `api/` runs them with no API keys:

1. Accepts a complete concise answer and moves on
2. Gives one cue for one missing element (and escalates one step at a time)
3. Recognises a relevant personal connection in conversation
4. Responds appropriately when Sam asks for help, and counts it as success
5. Keeps independent answers separate from supported answers
6. Sam can pause, repeat or stop at any point

Plus: uncertain transcription check, silence handling, story order, support fading.

## Run locally

```bash
# Postgres running locally, then:
cd api
cp .env.example .env        # fill in what you have; voice + Claude are optional locally
npm install
npm test
set -a; . ./.env; set +a
npm run dev                  # http://localhost:8787  (Sam)   http://localhost:8787/adult/  (team)
```

Without `ELEVENLABS_API_KEY`, Sam types his answers instead of speaking; everything else works.

## Deploy

**1. Render (API + Postgres)**
- New → Blueprint → point at this repo. `render.yaml` creates `sams-buddy-db` and `sams-buddy-api` in Frankfurt.
- In the service's Environment tab set: `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`,
  and `PROXY_SECRET` (any long random string). `SESSION_SECRET` and `SETUP_TOKEN` are generated for you.
- Migrations run automatically on start.

**2. Cloudflare (app + proxy)**
```bash
cd web
npm install
# edit wrangler.toml → API_ORIGIN = your Render URL
npx wrangler secret put PROXY_SECRET     # same value as on Render
npx wrangler deploy
```
Add a custom domain in the Cloudflare dashboard if you want one.

**3. First run**
- Open `https://<your-domain>/adult/`, enter the `SETUP_TOKEN` from Render, create the main parent account.
- Team & privacy → add the speech therapist, teachers, job coach (each gets a role).
- Activities → add the therapist's pictures, words and cues. Practice plan → choose what Start My Practice opens.
- Team & privacy → Create a connection code. On Sam's iPad: open the site, Add to Home Screen, enter the code.
- Sam makes his own privacy choices on first launch.

## Privacy model

- Sam (18) decides which roles can read his records, and whether audio is saved (off by default). Only his device can change this.
- Adults without his permission get a clear "Sam has chosen not to share…" message.
- Export (JSON) from Sam's settings or the team area; deletion by Sam or the main parent account.
- Records describe practice only: no scores, no diagnoses, no claims about what Sam visualised.
- The Render API only accepts requests from the Worker (`x-proxy-secret`).

## Not in v1 (by design, per the brief)

- Approved scenario bank for unexpected situations (safety role-play) — add once the team has reviewed v1.
- Shared professional dashboard beyond the role-based team area.
- Conversation mode is built but off by default (Practice plan → Practice types).

## Before going live

- Test recording on Sam's actual iPad and on the phone used for testing (iOS Safari records `audio/mp4`; Scribe accepts it).
- Tune `STT_WORD_THRESHOLD` / `STT_AVG_THRESHOLD` with Sam's real speech so the "Did you say…?" check is helpful, not frequent.
- Pick a calm ElevenLabs voice with Sam and set its ID in Practice plan.
