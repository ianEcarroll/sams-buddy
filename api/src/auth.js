import crypto from 'node:crypto';
import { one } from './db.js';

const SECRET = process.env.SESSION_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET is required');
  return 'dev-only-secret';
})();

const b64 = (b) => Buffer.from(b).toString('base64url');

export function sign(payload, ttlSeconds) {
  const body = b64(JSON.stringify({ ...payload, exp: ttlSeconds ? Math.floor(Date.now() / 1000) + ttlSeconds : undefined }));
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

const bearer = (req) => (req.headers.authorization || '').replace(/^Bearer\s+/i, '');

export async function requireAdult(req, res, next) {
  const p = verify(bearer(req));
  if (!p || p.kind !== 'adult') return res.status(401).json({ error: 'Please sign in again.' });
  const adult = await one('select id, learner_id, name, email, role, is_owner from adults where id=$1', [p.sub]);
  if (!adult) return res.status(401).json({ error: 'This account no longer exists.' });
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
  req.device = d;
  req.learnerId = d.learner_id;
  next();
}

// Sam decides which roles can see his practice records.
export async function requireRecordAccess(req, res, next) {
  const c = await one('select agreed_at, can_view from consent where learner_id=$1', [req.learnerId]);
  if (!c?.agreed_at) return res.status(403).json({ error: 'Sam has not set up his privacy choices yet.' });
  if (!c.can_view?.[req.adult.role]) return res.status(403).json({ error: `Sam has chosen not to share practice records with ${req.adult.role.replace('_', ' ')}s.` });
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
