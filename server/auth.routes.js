import { Router } from 'express';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

const scrypt = promisify(scryptCallback);
const router = Router();
const dbFile = path.join(process.cwd(), 'data', 'focuspulse-auth.json');
const sessions = new Map();
const rateBuckets = new Map();
const sessionLifetimeMs = 1000 * 60 * 60 * 24 * 7;

function readDb() {
  try {
    const parsed = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    return { users: Array.isArray(parsed.users) ? parsed.users : [] };
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('[auth] Could not read account store.');
    return { users: [] };
  }
}

function writeDb(db) {
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  const temp = `${dbFile}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(db), { mode: 0o600 });
  fs.renameSync(temp, dbFile);
}

function digest(value) { return createHash('sha256').update(value).digest('hex'); }
function cookieMap(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(part => part.trim().split(/=(.*)/s).slice(0,2)).filter(([key,value]) => key && value));
}
function cookieOptions(maxAge) {
  return `Path=/; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}
function setSession(res, userId) {
  const sessionId = randomBytes(32).toString('base64url');
  const csrf = randomBytes(24).toString('base64url');
  sessions.set(sessionId, { userId, csrf, expiresAt: Date.now() + sessionLifetimeMs });
  res.setHeader('Set-Cookie', [
    `fp_session=${sessionId}; HttpOnly; ${cookieOptions(sessionLifetimeMs / 1000)}`,
    `fp_csrf=${csrf}; ${cookieOptions(sessionLifetimeMs / 1000)}`
  ]);
}
function sessionFor(req) {
  const session = sessions.get(cookieMap(req).fp_session);
  if (!session || session.expiresAt < Date.now()) return null;
  return session;
}
function requireCsrf(req, res, next) {
  const session = sessionFor(req);
  if (!session || !req.headers['x-csrf-token'] || req.headers['x-csrf-token'] !== session.csrf) {
    return res.status(403).json({ message: 'Your session expired. Refresh the page and try again.' });
  }
  next();
}
function currentUser(req) {
  const session = sessionFor(req);
  return session && readDb().users.find(user => user.id === session.userId && user.verifiedAt) || null;
}
function publicUser(user) { return { id: user.id, email: user.email, name: user.email.split('@')[0], role: 'Student', avatar: user.email.slice(0,2).toUpperCase(), createdAt: user.createdAt }; }
function rateLimit(action, max = 8) {
  return (req, res, next) => {
    const key = `${action}:${req.ip}`;
    const now = Date.now();
    const hits = (rateBuckets.get(key) || []).filter(time => now - time < 15 * 60 * 1000);
    if (hits.length >= max) return res.status(429).json({ message: 'Too many attempts. Wait a little and try again.' });
    hits.push(now); rateBuckets.set(key, hits); next();
  };
}
function validEmail(value) { return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function validPassword(value) { return typeof value === 'string' && value.length >= 10 && value.length <= 128 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value); }
function hasMailConfig() { return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && process.env.APP_BASE_URL); }
async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `${salt.toString('hex')}:${Buffer.from(key).toString('hex')}`;
}
async function matchesPassword(password, encoded) {
  const [saltHex, keyHex] = (encoded || '').split(':');
  if (!saltHex || !keyHex) return false;
  const actual = Buffer.from(await scrypt(password, Buffer.from(saltHex, 'hex'), 64, { N: 16384, r: 8, p: 1 }));
  const expected = Buffer.from(keyHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
async function sendMail(to, subject, html) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const base = process.env.APP_BASE_URL;
  if (!apiKey || !from || !base) throw new Error('Email delivery is not configured. Set RESEND_API_KEY, EMAIL_FROM, and APP_BASE_URL in the server environment.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html })
  });
  if (!response.ok) throw new Error('The email provider could not deliver this message. Check the provider configuration.');
}
function makeToken() { return randomBytes(32).toString('base64url'); }

router.get('/me', (req, res) => {
  const session = sessionFor(req);
  if (session) {
    res.cookie('fp_csrf', session.csrf, { sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: sessionLifetimeMs });
    const user = readDb().users.find(record => record.id === session.userId && record.verifiedAt);
    return res.json({ user: user ? publicUser(user) : null });
  }
  res.json({ user: null });
});

router.post('/register', rateLimit('register', 5), async (req, res) => {
  if (!hasMailConfig()) return res.status(503).json({ message: 'Email verification is not configured. Set RESEND_API_KEY, EMAIL_FROM, and APP_BASE_URL on the server.' });
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = req.body.password;
  if (!validEmail(email) || !validPassword(password)) return res.status(400).json({ message: 'Enter a valid email and a password with 10+ characters, uppercase, lowercase, and a number.' });
  let db = readDb();
  if (db.users.some(user => user.email === email)) return res.status(202).json({ message: 'If this address is eligible, a verification email will arrive shortly.' });
  const token = makeToken();
  const base = process.env.APP_BASE_URL;
  const user = { id: `usr_${randomBytes(16).toString('hex')}`, email, passwordHash: await hashPassword(password), createdAt: new Date().toISOString(), verificationHash: digest(token), verificationExpiresAt: Date.now() + 1000 * 60 * 30, verifiedAt: null };
  db.users.push(user); writeDb(db);
  try {
    const link = `${base}/verify-email.html?token=${encodeURIComponent(token)}`;
    await sendMail(email, 'Verify your FocusPulse account', `<p>Welcome to FocusPulse.</p><p><a href="${link}">Verify your email address</a></p><p>This single-use link expires in 30 minutes.</p>`);
    return res.status(202).json({ message: 'Check your inbox for a verification link. It expires in 30 minutes.' });
  } catch (error) {
    db = readDb(); db.users = db.users.filter(record => record.id !== user.id); writeDb(db);
    return res.status(503).json({ message: error.message });
  }
});

router.post('/verify-email', rateLimit('verify', 20), (req, res) => {
  const token = typeof req.body.token === 'string' ? req.body.token : '';
  const db = readDb();
  const user = db.users.find(record => record.verificationHash && record.verificationHash === digest(token));
  if (!user || user.verificationExpiresAt < Date.now()) return res.status(400).json({ message: 'This verification link is invalid or has expired. Request a new one.' });
  user.verifiedAt = new Date().toISOString(); delete user.verificationHash; delete user.verificationExpiresAt; writeDb(db);
  return res.json({ message: 'Email verified. You can now sign in.' });
});

router.post('/resend-verification', rateLimit('resend', 4), async (req, res) => {
  if (!hasMailConfig()) return res.status(503).json({ message: 'Email verification is not configured on the server yet.' });
  const email = String(req.body.email || '').trim().toLowerCase();
  const db = readDb(); const user = db.users.find(record => record.email === email && !record.verifiedAt);
  if (user && validEmail(email)) {
    const token = makeToken(); user.verificationHash = digest(token); user.verificationExpiresAt = Date.now() + 30 * 60 * 1000; writeDb(db);
    const link = `${process.env.APP_BASE_URL}/verify-email.html?token=${encodeURIComponent(token)}`;
    try { await sendMail(email, 'Verify your FocusPulse account', `<p><a href="${link}">Verify your email address</a></p><p>This single-use link expires in 30 minutes.</p>`); }
    catch (error) { return res.status(503).json({ message: error.message }); }
  }
  return res.status(202).json({ message: 'If this address has a pending account, a new verification email will arrive shortly.' });
});

router.post('/login', rateLimit('login', 8), async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase(); const password = req.body.password;
  const user = validEmail(email) && typeof password === 'string' ? readDb().users.find(record => record.email === email) : null;
  if (!user || !(await matchesPassword(password, user.passwordHash))) return res.status(401).json({ message: 'Email or password is incorrect.' });
  if (!user.verifiedAt) return res.status(403).json({ code: 'email_unverified', message: 'Verify your email before signing in.', email: user.email });
  setSession(res, user.id); return res.json({ user: publicUser(user) });
});

router.post('/logout', requireCsrf, (req, res) => {
  const cookies = cookieMap(req); sessions.delete(cookies.fp_session);
  res.setHeader('Set-Cookie', [`fp_session=; HttpOnly; ${cookieOptions(0)}`, `fp_csrf=; ${cookieOptions(0)}`]);
  res.json({ message: 'Signed out.' });
});

router.post('/forgot-password', rateLimit('forgot', 4), async (req, res) => {
  if (!hasMailConfig()) return res.status(503).json({ message: 'Password recovery email is not configured on the server yet.' });
  const email = String(req.body.email || '').trim().toLowerCase(); const db = readDb();
  const user = validEmail(email) && db.users.find(record => record.email === email && record.verifiedAt);
  if (user) {
    const token = makeToken(); user.resetHash = digest(token); user.resetExpiresAt = Date.now() + 30 * 60 * 1000; writeDb(db);
    const link = `${process.env.APP_BASE_URL}/reset-password.html?token=${encodeURIComponent(token)}`;
    try { await sendMail(email, 'Reset your FocusPulse password', `<p><a href="${link}">Choose a new password</a></p><p>This single-use link expires in 30 minutes.</p>`); }
    catch (error) { return res.status(503).json({ message: error.message }); }
  }
  res.status(202).json({ message: 'If a verified account matches this address, password reset instructions will arrive shortly.' });
});

router.post('/reset-password', rateLimit('reset', 8), async (req, res) => {
  const { token, password } = req.body;
  if (!validPassword(password) || typeof token !== 'string') return res.status(400).json({ message: 'Choose a stronger password and use the link from your email.' });
  const db = readDb(); const user = db.users.find(record => record.resetHash && record.resetHash === digest(token));
  if (!user || user.resetExpiresAt < Date.now()) return res.status(400).json({ message: 'This reset link is invalid or has expired.' });
  user.passwordHash = await hashPassword(password); delete user.resetHash; delete user.resetExpiresAt;
  for (const [id, session] of sessions) if (session.userId === user.id) sessions.delete(id);
  writeDb(db); res.json({ message: 'Password updated. Please sign in again.' });
});

router.get('/protected', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ message: 'Sign in required.' });
  res.json({ user: publicUser(user) });
});

export default router;
