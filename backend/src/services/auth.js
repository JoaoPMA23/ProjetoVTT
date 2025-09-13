const jwt = require('jsonwebtoken');
const { jwt: jwtCfg } = require('../config');
const db = require('../db');

function signToken(user, opts = {}) {
  const exp = opts.remember ? jwtCfg.rememberExp : jwtCfg.defaultExp;
  return jwt.sign({ sub: user.id, email: user.email }, jwtCfg.secret, { expiresIn: exp });
}

async function authRequired(req, res, next) {
  const h = req.headers && req.headers.authorization ? String(req.headers.authorization) : '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(token, jwtCfg.secret);
    let user = null;
    if (db.enabled) user = await db.getUserById(String(payload.sub));
    else {
      const { readUsers } = require('../store');
      user = readUsers().find((u) => u.id === String(payload.sub));
    }
    if (!user) return res.status(401).json({ error: 'Invalid token' });
    req.user = { id: user.id, email: user.email, name: user.name };
    next();
  } catch (_) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { signToken, authRequired };

