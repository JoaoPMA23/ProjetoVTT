const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.options('*', cors());
app.use(express.json());

const dataDir = path.join(__dirname, '..', 'data');
const uploadsDir = path.join(__dirname, '..', 'uploads');
const pdfsDir = path.join(uploadsDir, 'pdfs');
const imagesDir = path.join(uploadsDir, 'images');
const campaignsFile = path.join(dataDir, 'campaigns.json');
const pdfsFile = path.join(dataDir, 'pdfs.json');
const imagesFile = path.join(dataDir, 'images.json');
const chatsFile = path.join(dataDir, 'chats.json');
const usersFile = path.join(dataDir, 'users.json');

function ensureData() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  if (!fs.existsSync(pdfsDir)) fs.mkdirSync(pdfsDir, { recursive: true });
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
  if (!fs.existsSync(campaignsFile)) fs.writeFileSync(campaignsFile, '[]', 'utf8');
  if (!fs.existsSync(pdfsFile)) fs.writeFileSync(pdfsFile, '[]', 'utf8');
  if (!fs.existsSync(imagesFile)) fs.writeFileSync(imagesFile, '[]', 'utf8');
  if (!fs.existsSync(chatsFile)) fs.writeFileSync(chatsFile, '[]', 'utf8');
  if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, '[]', 'utf8');
}
function readJSON(file) { ensureData(); try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; } }
function writeJSON(file, data) { ensureData(); fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8'); }

const readCampaigns = () => readJSON(campaignsFile);
const writeCampaigns = (d) => writeJSON(campaignsFile, d);
const readPDFs = () => readJSON(pdfsFile);
const writePDFs = (d) => writeJSON(pdfsFile, d);
const readImages = () => readJSON(imagesFile);
const writeImages = (d) => writeJSON(imagesFile, d);
const readChats = () => readJSON(chatsFile);
const writeChats = (d) => writeJSON(chatsFile, d);
const readUsers = () => readJSON(usersFile);
const writeUsers = (d) => writeJSON(usersFile, d);

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret';
const RESET_TOKEN_TTL_MIN = parseInt(process.env.RESET_TOKEN_TTL_MIN || '30', 10);
function getTransport() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' },
    });
  }
  return null; // fallback: console log link
}
function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}
function authRequired(req, res, next) {
  const h = req.headers && req.headers.authorization ? String(req.headers.authorization) : '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = readUsers().find((u) => u.id === String(payload.sub));
    if (!user) return res.status(401).json({ error: 'Invalid token' });
    req.user = { id: user.id, email: user.email, name: user.name };
    next();
  } catch (_) { return res.status(401).json({ error: 'Invalid token' }); }
}

app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, pdfsDir),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const safeBase = file.originalname.replace(/[^a-zA-Z0-9_.-]+/g, '_');
    cb(null, ts + '_' + safeBase);
  },
});
const fileFilter = (_req, file, cb) => {
  if (file.mimetype === 'application/pdf') cb(null, true); else cb(new Error('Only PDF files are allowed'));
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 25 * 1024 * 1024 } });

app.get('/', (_req, res) => res.send('ProjetoVTT API is running'));

// Auth
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!email || typeof email !== 'string') return res.status(400).json({ error: 'Email é obrigatório' });
    if (!password || typeof password !== 'string' || password.length < 6) return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres' });
    const users = readUsers();
    if (users.find((u) => u.email.toLowerCase() === String(email).toLowerCase())) return res.status(400).json({ error: 'Email já cadastrado' });
    const hash = await bcrypt.hash(password, 10);
    const user = { id: Date.now().toString(), name: (name || '').trim(), email: String(email).toLowerCase(), passwordHash: hash, createdAt: new Date().toISOString() };
    users.push(user); writeUsers(users);
    const token = signToken(user);
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (e) { res.status(500).json({ error: 'Falha no cadastro' }); }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = readUsers().find((u) => u.email.toLowerCase() === String(email || '').toLowerCase());
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });
    const ok = await bcrypt.compare(String(password || ''), user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });
    const token = signToken(user);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (e) { res.status(500).json({ error: 'Falha no login' }); }
});

app.get('/auth/me', authRequired, (req, res) => res.json({ user: req.user }));

// Forgot / Reset password
app.post('/auth/forgot', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email é obrigatório' });
    const users = readUsers();
    const u = users.find((x) => x.email.toLowerCase() === String(email).toLowerCase());
    if (!u) return res.json({ ok: true }); // não revela existência
    const token = Buffer.from(Date.now().toString() + ':' + Math.random().toString(36).slice(2)).toString('base64url');
    u.resetToken = token;
    u.resetExpires = Date.now() + RESET_TOKEN_TTL_MIN * 60 * 1000;
    writeUsers(users);
    const link = (process.env.APP_URL || 'http://localhost:3000') + '/reset?token=' + token;
    const transporter = getTransport();
    if (transporter) {
      await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: u.email, subject: 'Reset de senha', text: `Para redefinir sua senha acesse: ${link}`, html: `<p>Para redefinir sua senha, clique: <a href="${link}">${link}</a></p>` });
    } else {
      console.log('Reset password link:', link);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Falha ao gerar reset' }); }
});

app.post('/auth/reset', async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password || String(password).length < 6) return res.status(400).json({ error: 'Token/senha inválidos' });
    const users = readUsers();
    const u = users.find((x) => x.resetToken === token);
    if (!u || !u.resetExpires || Date.now() > Number(u.resetExpires)) return res.status(400).json({ error: 'Token inválido ou expirado' });
    const hash = await bcrypt.hash(String(password), 10);
    u.passwordHash = hash;
    delete u.resetToken; delete u.resetExpires;
    writeUsers(users);
    const jwtToken = signToken(u);
    res.json({ token: jwtToken, user: { id: u.id, name: u.name, email: u.email } });
  } catch (e) { res.status(500).json({ error: 'Falha ao redefinir senha' }); }
});

app.get('/campaigns', (_req, res) => res.json(readCampaigns()));

app.post('/campaigns', authRequired, (req, res) => {
  const { name, system, description } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'Field name is required.' });
  const items = readCampaigns();
  const now = new Date().toISOString();
  const isPrivate = !!(req.body && typeof req.body.isPrivate === 'boolean' ? req.body.isPrivate : false);
  const newItem = { id: Date.now().toString(), name: name.trim(), system: typeof system === 'string' ? system.trim() : '', description: typeof description === 'string' ? description.trim() : '', isPrivate, createdAt: now, updatedAt: now, createdBy: req.user.id };
  items.unshift(newItem);
  writeCampaigns(items);
  res.status(201).json(newItem);
});

// Get single campaign
app.get('/campaigns/:id', (req, res) => {
  const items = readCampaigns();
  const it = items.find((c) => c.id === String(req.params.id));
  if (!it) return res.status(404).json({ error: 'Not found' });
  res.json(it);
});

// Update campaign (name, system, description, isPrivate, coverImage)
app.put('/campaigns/:id', authRequired, (req, res) => {
  const items = readCampaigns();
  const idx = items.findIndex((c) => c.id === String(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const current = items[idx];
  const next = { ...current };
  if (typeof req.body?.name === 'string') next.name = req.body.name.trim();
  if (typeof req.body?.system === 'string') next.system = req.body.system.trim();
  if (typeof req.body?.description === 'string') next.description = req.body.description.trim();
  if (typeof req.body?.isPrivate === 'boolean') next.isPrivate = req.body.isPrivate;
  if (typeof req.body?.coverImageId === 'string') next.coverImageId = req.body.coverImageId;
  if (typeof req.body?.coverImageUrl === 'string') next.coverImageUrl = req.body.coverImageUrl;
  next.updatedAt = new Date().toISOString();
  items[idx] = next;
  writeCampaigns(items);
  res.json(next);
});

app.get('/pdfs', (req, res) => {
  const items = readPDFs();
  const campaignId = (req.query && req.query.campaignId) ? String(req.query.campaignId) : '';
  const list = campaignId ? items.filter((i) => i.campaignId === campaignId) : items;
  res.json(list);
});

app.post('/pdfs', authRequired, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Arquivo PDF é obrigatório.' });
    const campaignId = req.body && req.body.campaignId ? String(req.body.campaignId) : '';
    if (!campaignId) return res.status(400).json({ error: 'campaignId é obrigatório.' });
    const campaigns = readCampaigns();
    if (!campaigns.find((c) => c.id === campaignId)) return res.status(400).json({ error: 'Campanha não encontrada.' });
    const items = readPDFs();
    const now = new Date().toISOString();
    const id = Date.now().toString();
    const meta = { id, campaignId, originalName: req.file.originalname, fileName: req.file.filename, size: req.file.size, url: '/uploads/pdfs/' + req.file.filename, uploadedAt: now };
    items.unshift(meta);
    writePDFs(items);
    res.status(201).json(meta);
  } catch (e) {
    console.error('Upload error', e);
    res.status(500).json({ error: 'Falha no upload' });
  }
});

app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: err.message || 'Internal server error' }); });

// Chat messages REST (initial load)
app.get('/lobbies/:id/messages', (req, res) => {
  const campaignId = String(req.params.id);
  const items = readChats().filter((m) => m.campaignId === campaignId);
  const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 200);
  const slice = items.slice(-limit);
  res.json(slice);
});

// HTTP server + Socket.IO
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

io.on('connection', (socket) => {
  socket.on('join', ({ campaignId, name }) => {
    if (!campaignId) return;
    const room = 'camp:' + String(campaignId);
    socket.join(room);
    socket.emit('joined', { room });
  });

  socket.on('chat:send', (payload) => {
    const { campaignId, author, text } = payload || {};
    const cid = String(campaignId || '');
    if (!cid) return;
    if (!text || typeof text !== 'string') return;
    const now = new Date().toISOString();
    const msg = {
      id: Date.now().toString(),
      campaignId: cid,
      author: String(author || 'Anônimo'),
      text: String(text).slice(0, 1000),
      ts: now,
    };
    const items = readChats();
    items.push(msg);
    writeChats(items);
    io.to('camp:' + cid).emit('chat:new', msg);
  });

  socket.on('campaign:update', (payload) => {
    const { id, name, system, description, isPrivate, coverImageId, coverImageUrl } = payload || {};
    const cid = String(id || '');
    if (!cid) return;
    const items = readCampaigns();
    const idx = items.findIndex((c) => c.id === cid);
    if (idx === -1) return;
    const next = { ...items[idx] };
    if (typeof name === 'string') next.name = name.trim();
    if (typeof system === 'string') next.system = system.trim();
    if (typeof description === 'string') next.description = description.trim();
    if (typeof isPrivate === 'boolean') next.isPrivate = isPrivate;
    if (typeof coverImageId === 'string') next.coverImageId = coverImageId;
    if (typeof coverImageUrl === 'string') next.coverImageUrl = coverImageUrl;
    next.updatedAt = new Date().toISOString();
    items[idx] = next;
    writeCampaigns(items);
    io.to('camp:' + cid).emit('campaign:updated', next);
  });
});

server.listen(PORT, () => { console.log('API running on http://localhost:' + PORT); });

// Images endpoints (cover per campaign)
const storageImg = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, imagesDir),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const safeBase = file.originalname.replace(/[^a-zA-Z0-9_.-]+/g, '_');
    cb(null, ts + '_' + safeBase);
  },
});
const imageFilter = (_req, file, cb) => {
  const ok = ['image/png','image/jpeg','image/webp'].includes(file.mimetype);
  if (ok) cb(null, true); else cb(new Error('Only PNG/JPEG/WebP allowed'));
};
const uploadImage = multer({ storage: storageImg, fileFilter: imageFilter, limits: { fileSize: 10 * 1024 * 1024 } });

app.get('/images', (req, res) => {
  const items = readImages();
  const campaignId = (req.query && req.query.campaignId) ? String(req.query.campaignId) : '';
  const list = campaignId ? items.filter((i) => i.campaignId === campaignId) : items;
  res.json(list);
});

app.post('/images', authRequired, uploadImage.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Arquivo de imagem é obrigatório.' });
    const campaignId = req.body && req.body.campaignId ? String(req.body.campaignId) : '';
    if (!campaignId) return res.status(400).json({ error: 'campaignId é obrigatório.' });
    const campaigns = readCampaigns();
    if (!campaigns.find((c) => c.id === campaignId)) return res.status(400).json({ error: 'Campanha não encontrada.' });

    const items = readImages();
    const now = new Date().toISOString();
    const id = Date.now().toString();
    const meta = { id, campaignId, originalName: req.file.originalname, fileName: req.file.filename, size: req.file.size, url: '/uploads/images/' + req.file.filename, uploadedAt: now };
    items.unshift(meta);
    writeImages(items);
    res.status(201).json(meta);
  } catch (e) {
    console.error('Image upload error', e);
    res.status(500).json({ error: 'Falha no upload de imagem' });
  }
});
