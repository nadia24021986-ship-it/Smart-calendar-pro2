const crypto = require('crypto');

const SESSION_SECRET = process.env.SESSION_SECRET || 'ganti-secret-ini-di-environment-variable';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function makeSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

function createToken(payload) {
  const header = base64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = base64url(
    Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + SESSION_TTL_MS }))
  );
  const sig = base64url(
    crypto.createHmac('sha256', SESSION_SECRET).update(`${header}.${body}`).digest()
  );
  return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
  if (!token || token.split('.').length !== 3) return null;
  const [header, body, sig] = token.split('.');
  const expectedSig = base64url(
    crypto.createHmac('sha256', SESSION_SECRET).update(`${header}.${body}`).digest()
  );
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(base64urlDecode(body).toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function getUserFromRequest(req) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const payload = verifyToken(token);
  if (!payload) return null;
  return { id: payload.sub, username: payload.username };
}

module.exports = { hashPassword, makeSalt, createToken, verifyToken, getUserFromRequest };
