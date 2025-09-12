const jwt = require('jsonwebtoken');
const { jwt: jwtCfg } = require('../config');
const { readUsers } = require('../store');

function signToken(user, opts = {}) {
  const exp = opts.remember ? jwtCfg.rememberExp : jwtCfg.defaultExp;
  return jwt.sign({ sub: user.id, email: user.email }, jwtCfg.secret, { expiresIn: exp });
}

function authRequired(req, res, next) {
  const h = req.headers && req.headers.authorization ? String(req.headers.authorization) : '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(token, jwtCfg.secret);
    const user = readUsers().find((u) => u.id === String(payload.sub));
    if (!user) return res.status(401).json({ error: 'Invalid token' });
    req.user = { id: user.id, email: user.email, name: user.name };
    next();
  } catch (_) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { signToken, authRequired };

