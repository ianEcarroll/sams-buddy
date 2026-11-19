// Waiting list for the TALVO website: checks a sign-up, decides who gets the notification, and sets the CORS
// headers so the website (on its own address) can post to the API through the Worker. Pure, so it can be tested.

export const WAITLIST_ROLES = ['parent', 'therapist', 'school', 'other'];

// Returns { email, role, source }, { spam: true } when the hidden field was filled in, or { error }.
export function cleanSignup(body) {
  const b = body && typeof body === 'object' ? body : {};
  if (String(b.company || '').trim()) return { spam: true };
  const email = String(b.email || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: 'Please enter a valid email address.' };
  const role = WAITLIST_ROLES.includes(b.role) ? b.role : null;
  const source = String(b.source || 'website').replace(/[^\w.-]/g, '').slice(0, 40) || 'website';
  return { email, role, source };
}

// WAITLIST_ORIGINS: comma-separated website addresses allowed to post. Blank means any (no cookies are involved).
export function corsHeaders(origin, env = process.env) {
  const allowed = String(env.WAITLIST_ORIGINS || '').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
  const base = { 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' };
  if (!allowed.length) return { ...base, 'access-control-allow-origin': '*' };
  if (origin && allowed.includes(origin.replace(/\/$/, ''))) return { ...base, 'access-control-allow-origin': origin, vary: 'Origin' };
  return { vary: 'Origin' };
}

// Who is told about each new sign-up: WAITLIST_NOTIFY, else the platform admins.
export function notifyList(env = process.env) {
  const raw = env.WAITLIST_NOTIFY || env.PLATFORM_ADMINS || '';
  return String(raw).split(',').map((s) => s.trim()).filter((s) => s.includes('@'));
}

export function notificationEmail({ email, role, total }) {
  const who = role ? `${role}` : 'no role given';
  return {
    subject: `New TALVO waiting list sign-up (${total} so far)`,
    text: `${email} joined the TALVO waiting list (${who}).\n\n${total} ${total === 1 ? 'person has' : 'people have'} signed up so far.`,
  };
}
