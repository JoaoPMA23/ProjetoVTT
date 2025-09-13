const express = require('express');
const bcrypt = require('bcryptjs');
const cfg = require('../config');
const db = require('../db');
const { signToken, authRequired } = require('../services/auth');
const { sendResetEmail } = require('../services/mailer');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, remember } = req.body || {};
    if (!email || typeof email !== 'string') return res.status(400).json({ error: 'Email é obrigatório' });
    if (!password || typeof password !== 'string' || password.length < 6) return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres' });
    if (db.enabled) {
      const existing = await db.getUserByEmail(email);
      if (existing) return res.status(400).json({ error: 'Email já cadastrado' });
    } else {
      const { readUsers } = require('../store');
      const users = readUsers();
      if (users.find((u) => u.email.toLowerCase() === String(email).toLowerCase())) return res.status(400).json({ error: 'Email já cadastrado' });
    }
    const hash = await bcrypt.hash(password, 10);
    const user = { id: Date.now().toString(), name: (name || '').trim(), email: String(email).toLowerCase(), passwordHash: hash, createdAt: new Date().toISOString() };
    if (db.enabled) {
      await db.createUser(user);
    } else {
      const { readUsers, writeUsers } = require('../store');
      const users = readUsers();
      users.push(user); writeUsers(users);
    }
    const token = signToken(user, { remember });
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Falha no cadastro' }); }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password, remember } = req.body || {};
    let user;
    if (db.enabled) user = await db.getUserByEmail(email);
    else {
      const { readUsers } = require('../store');
      user = readUsers().find((u) => u.email.toLowerCase() === String(email || '').toLowerCase());
    }
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });
    const ok = await bcrypt.compare(String(password || ''), user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });
    const token = signToken(user, { remember });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Falha no login' }); }
});

router.get('/me', authRequired, (req, res) => res.json({ user: req.user }));

router.post('/forgot', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email é obrigatório' });
    let u;
    if (db.enabled) u = await db.getUserByEmail(email);
    else {
      const { readUsers } = require('../store');
      const users = readUsers();
      u = users.find((x) => x.email.toLowerCase() === String(email).toLowerCase());
    }
    if (!u) return res.json({ ok: true });
    const token = Buffer.from(Date.now().toString() + ':' + Math.random().toString(36).slice(2)).toString('base64url');
    const resetExpires = Date.now() + cfg.reset.ttlMin * 60 * 1000;
    if (db.enabled) {
      await db.updateUserFields(u.id, { resetToken: token, resetExpires });
    } else {
      const { readUsers, writeUsers } = require('../store');
      const users = readUsers();
      const idx = users.findIndex((x) => x.id === u.id);
      if (idx !== -1) { users[idx].resetToken = token; users[idx].resetExpires = resetExpires; }
      writeUsers(users);
    }
    const link = cfg.appUrl + '/reset?token=' + token;
    await sendResetEmail(u.email, link);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Falha ao gerar reset' }); }
});

router.post('/reset', async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password || String(password).length < 6) return res.status(400).json({ error: 'Token/senha inválidos' });
    let u;
    if (db.enabled) {
      const rs = await db.client.execute({ sql: 'SELECT * FROM users WHERE resetToken = ?', args: [String(token)] });
      const r = rs.rows && rs.rows[0];
      u = r ? { id: String(r.id), name: r.name || '', email: String(r.email), passwordHash: r.passwordHash || '', createdAt: r.createdAt || '', resetToken: r.resetToken || undefined, resetExpires: r.resetExpires == null ? undefined : Number(r.resetExpires) } : null;
    } else {
      const { readUsers } = require('../store');
      const users = readUsers();
      u = users.find((x) => x.resetToken === token);
    }
    if (!u || !u.resetExpires || Date.now() > Number(u.resetExpires)) return res.status(400).json({ error: 'Token inválido ou expirado' });
    const hash = await bcrypt.hash(String(password), 10);
    if (db.enabled) {
      await db.updateUserFields(u.id, { passwordHash: hash, resetToken: null, resetExpires: null });
    } else {
      const { readUsers, writeUsers } = require('../store');
      const users = readUsers();
      const idx = users.findIndex((x) => x.id === u.id);
      if (idx !== -1) { users[idx].passwordHash = hash; delete users[idx].resetToken; delete users[idx].resetExpires; }
      writeUsers(users);
    }
    const jwtToken = signToken(u);
    res.json({ token: jwtToken, user: { id: u.id, name: u.name, email: u.email } });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Falha ao redefinir senha' }); }
});

module.exports = router;

