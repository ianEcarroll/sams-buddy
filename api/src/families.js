// Many families on one Buddy: who runs the platform, invite tokens, and a rough AI cost per family.
import crypto from 'node:crypto';

// Platform admins (Ian) are named by email in PLATFORM_ADMINS, comma separated. They see every family.
export function isPlatformAdmin(email, env = process.env) {
  const list = String(env.PLATFORM_ADMINS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return !!email && list.includes(String(email).toLowerCase());
}

export const newInviteToken = () => crypto.randomBytes(24).toString('base64url');
export const INVITE_DAYS = 14;

// List prices used for the estimate (USD). Rough, for spotting heavy use; not a bill.
export const COST_RATES = {
  ttsPer1kChars: 0.10,   // ElevenLabs Multilingual v2
  judgePerResponse: 0.011, // Claude Sonnet: ~3k tokens in, ~500 out per check
  sttPerResponse: 0.0006,  // ElevenLabs Scribe, ~10 s of speech
};
export function estimateCost({ buddyChars = 0, responses = 0 }, r = COST_RATES) {
  return Math.round(((buddyChars / 1000) * r.ttsPer1kChars + responses * (r.judgePerResponse + r.sttPerResponse)) * 100) / 100;
}

// Child's details on sign-up. Year of birth is optional and only used to pitch Buddy's language.
export function validateFamily({ learnerName, birthYear, ownerName, email, password }, now = new Date()) {
  const name = String(learnerName || '').trim();
  if (!name || name.length > 40) return { error: "Add your child's first name." };
  let by = null;
  if (birthYear !== undefined && birthYear !== null && String(birthYear).trim() !== '') {
    by = Number(birthYear);
    const y = now.getUTCFullYear();
    if (!Number.isInteger(by) || by < y - 30 || by > y - 4) return { error: 'Check the year of birth.' };
  }
  const mail = (String(email || '').match(/[^\s<>"]+@[^\s<>"]+\.[^\s<>"]+/) || [''])[0];
  if (!String(ownerName || '').trim() || !mail) return { error: 'Add your name and a valid email address.' };
  if (!password || String(password).length < 10) return { error: 'Choose a password of at least 10 characters.' };
  return { value: { learnerName: name, birthYear: by, ownerName: String(ownerName).trim(), email: mail.toLowerCase(), password: String(password) } };
}

export const ageFrom = (birthYear, now = new Date()) => (birthYear ? now.getUTCFullYear() - birthYear : null);
