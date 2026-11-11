import { isPlatformAdmin } from './families.js';
import crypto from 'node:crypto';
import { one } from './db.js';

const SECRET = process.env.SESSION_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET is required');
  return 'dev-only-secret';
})();

const b64 = (b) => Buffer.from(b).toString('base64url');

export function sign(payload, ttlSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const body = b64(JSON.stringify({ ...payload, iat: now, exp: ttlSeconds ? now + ttlSeconds : undefined }));
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verify(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expect = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  const p = JSON.parse(Buffer.from(body, 'base64url').toString());
  if (p.exp && p.exp < Date.now() / 1000) return null;
  return p;
}

export const hmac = (s) => crypto.createHmac('sha256', SECRET).update(String(s)).digest('base64url').slice(0, 22);

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 32);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}
export function checkPassword(pw, stored) {
  const [, s, h] = String(stored).split('$');
  if (!s || !h) return false;
  const hash = crypto.scryptSync(pw, Buffer.from(s, 'base64'), 32);
  return crypto.timingSafeEqual(hash, Buffer.from(h, 'base64'));
}

// A sign-in from before the latest password change no longer counts (tokens from before this check have no iat).
export const signedInBeforePasswordChange = (payload, changedAt) =>
  !!changedAt && (payload.iat || 0) < Math.floor(new Date(changedAt).getTime() / 1000);

const bearer = (req) => (req.headers.authorization || '').replace(/^Bearer\s+/i, '');

export async function requireAdult(req, res, next) {
  const p = verify(bearer(req));
  if (!p || p.kind !== 'adult') return res.status(401).json({ error: 'Please sign in again.' });
  const adult = await one('select a.id, a.learner_id, a.name, a.email, a.role, a.is_owner, a.email_after_practice, a.password_changed_at, l.disabled_at from adults a join learners l on l.id=a.learner_id where a.id=$1', [p.sub]);
  if (!adult) return res.status(401).json({ error: 'This account no longer exists.' });
  if (signedInBeforePasswordChange(p, adult.password_changed_at)) return res.status(401).json({ error: 'Your password was changed. Please sign in again.' });
  delete adult.password_changed_at;
  if (adult.disabled_at && !isPlatformAdmin(adult.email)) return res.status(403).json({ error: 'This Buddy account is paused. Contact Buddy support to turn it back on.', paused: true });
  delete adult.disabled_at;
  req.adult = adult;
  req.learnerId = adult.learner_id;
  next();
}

export function requireOwner(req, res, next) {
  if (!req.adult?.is_owner) return res.status(403).json({ error: 'Only the main parent account can do this.' });
  next();
}

export async function requireDevice(req, res, next) {
  const p = verify(bearer(req));
  if (!p || p.kind !== 'device') return res.status(401).json({ error: 'This device is not connected. Ask your support team for a new code.' });
  const d = await one('update devices set last_seen_at=now() where id=$1 and revoked_at is null returning id, learner_id', [p.sub]);
  if (!d) return res.status(401).json({ error: 'This device was disconnected. Ask your support team for a new code.' });
  const l = await one('select disabled_at from learners where id=$1', [d.learner_id]);
  if (l?.disabled_at) return res.status(403).json({ error: 'Buddy is paused for now. Ask your support team.', paused: true });
  req.device = d;
  req.learnerId = d.learner_id;
  next();
}

// The learner decides which roles can see their practice records.
export async function requireRecordAccess(req, res, next) {
  const c = await one('select c.agreed_at, c.can_view, l.name from learners l left join consent c on c.learner_id = l.id where l.id=$1', [req.learnerId]);
  const name = c?.name || 'Your learner';
  if (!c?.agreed_at) return res.status(403).json({ error: `${name} has not made their privacy choices yet.` });
  if (!c.can_view?.[req.adult.role]) return res.status(403).json({ error: `${name} has chosen not to share practice records with ${req.adult.role.replace('_', ' ')}s.` });
  next();
}

// Tiny in-memory limiter for sign-in and pairing endpoints.
const hits = new Map();
export function rateLimit(max = 10, windowMs = 15 * 60_000) {
  return (req, res, next) => {
    const key = `${req.path}:${req.ip}`;
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    arr.push(now);
    hits.set(key, arr);
    if (arr.length > max) return res.status(429).json({ error: 'Too many attempts. Wait a few minutes and try again.' });
    next();
  };
}
