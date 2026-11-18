// Đăng nhập bằng tài khoản/mật khẩu lưu trong database riêng (auth-db.js).
// - Mật khẩu được băm bằng scrypt (có salt), không lưu dạng rõ.
// - Phiên đăng nhập là token ký HMAC, lưu trong cookie httpOnly.
const crypto = require('crypto');
const express = require('express');
const { authPool, ensureAuthDatabase } = require('./auth-db');

const COOKIE_NAME = 'nguard_session';
const SESSION_HOURS = Number(process.env.SESSION_HOURS) || 8;

let secretWarned = false;
function getSecret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (!getSecret.fallback) {
    getSecret.fallback = crypto.randomBytes(32).toString('hex');
    if (!secretWarned) {
      console.warn('⚠️ Chưa đặt AUTH_SECRET trong .env — dùng khóa tạm, mọi phiên sẽ mất khi khởi động lại server.');
      secretWarned = true;
    }
  }
  return getSecret.fallback;
}

// ---------- Băm mật khẩu ----------
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// Hash giả để thời gian phản hồi giống nhau dù username có tồn tại hay không.
const DUMMY_HASH = hashPassword(crypto.randomBytes(16).toString('hex'));

// ---------- Token phiên ----------
function sign(data) {
  return crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');
}

function createToken(user) {
  const payload = Buffer.from(JSON.stringify({
    uid: user.id,
    exp: Date.now() + SESSION_HOURS * 3600 * 1000,
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function readToken(token) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

function getCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index > -1 && part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }
  return null;
}

function setSessionCookie(req, res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    maxAge: SESSION_HOURS * 3600 * 1000,
    path: '/',
  });
}

function publicUser(row) {
  return { id: row.id, username: row.username, fullName: row.full_name, role: row.role };
}

// ---------- Middleware bảo vệ API ----------
async function requireAuth(req, res, next) {
  const session = readToken(getCookie(req, COOKIE_NAME));
  if (!session) return res.status(401).json({ error: 'Please sign in.' });
  try {
    const result = await authPool.query(
      'SELECT id, username, full_name, role FROM users WHERE id = $1 AND is_active = TRUE',
      [session.uid]
    );
    if (result.rowCount === 0) return res.status(401).json({ error: 'This account is no longer active.' });
    req.user = publicUser(result.rows[0]);
    next();
  } catch (err) {
    console.error('Lỗi kiểm tra phiên đăng nhập:', err);
    res.status(500).json({ error: 'Could not verify the session.' });
  }
}

// ---------- Chống dò mật khẩu: tối đa 5 lần sai / 15 phút / IP + username ----------
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const failedAttempts = new Map();

function attemptKey(req, username) {
  return `${req.ip}|${username.toLowerCase()}`;
}

function isLocked(key) {
  const entry = failedAttempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.first > LOCK_MS) {
    failedAttempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(key) {
  const entry = failedAttempts.get(key);
  if (!entry || Date.now() - entry.first > LOCK_MS) failedAttempts.set(key, { count: 1, first: Date.now() });
  else entry.count += 1;
}

// ---------- Routes ----------
const router = express.Router();

router.post('/login', async (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!username || !password) {
    return res.status(400).json({ error: 'Enter your username and password.' });
  }

  const key = attemptKey(req, username);
  if (isLocked(key)) {
    return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
  }

  try {
    const result = await authPool.query(
      'SELECT id, username, password_hash, full_name, role, is_active FROM users WHERE LOWER(username) = LOWER($1)',
      [username]
    );
    const user = result.rows[0];
    const valid = verifyPassword(password, user ? user.password_hash : DUMMY_HASH);

    if (!user || !valid || !user.is_active) {
      recordFailure(key);
      return res.status(401).json({ error: 'Incorrect username or password.' });
    }

    failedAttempts.delete(key);
    await authPool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
    setSessionCookie(req, res, createToken(user));
    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error('Lỗi đăng nhập:', err);
    res.status(500).json({ error: 'Could not sign in right now.' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ success: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post('/change-password', requireAuth, async (req, res) => {
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'The new password must be at least 8 characters.' });
  }
  try {
    const result = await authPool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!verifyPassword(currentPassword, result.rows[0]?.password_hash)) {
      return res.status(400).json({ error: 'The current password is incorrect.' });
    }
    await authPool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashPassword(newPassword), req.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Lỗi đổi mật khẩu:', err);
    res.status(500).json({ error: 'Could not change the password right now.' });
  }
});

// ---------- Khởi tạo: tạo DB/bảng, tạo admin đầu tiên nếu chưa có user ----------
async function initAuth() {
  await ensureAuthDatabase();
  const count = await authPool.query('SELECT COUNT(*)::int AS n FROM users');
  if (count.rows[0].n > 0) return;

  const username = process.env.ADMIN_USERNAME || 'admin';
  let password = process.env.ADMIN_PASSWORD;
  let generated = false;
  if (!password) {
    password = crypto.randomBytes(9).toString('base64url');
    generated = true;
  }
  await authPool.query(
    'INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4)',
    [username, hashPassword(password), 'Administrator', 'admin']
  );
  console.log(`👤 Đã tạo tài khoản quản trị đầu tiên: "${username}"`);
  if (generated) console.log(`🔑 Mật khẩu tạm thời: ${password}  (hãy đổi sau khi đăng nhập)`);
}

module.exports = { router, requireAuth, initAuth, hashPassword };
