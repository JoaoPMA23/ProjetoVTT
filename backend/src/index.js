const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const http = require('http');
const { Server } = require('socket.io');

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

function ensureData() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  if (!fs.existsSync(pdfsDir)) fs.mkdirSync(pdfsDir, { recursive: true });
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
  if (!fs.existsSync(campaignsFile)) fs.writeFileSync(campaignsFile, '[]', 'utf8');
  if (!fs.existsSync(pdfsFile)) fs.writeFileSync(pdfsFile, '[]', 'utf8');
  if (!fs.existsSync(imagesFile)) fs.writeFileSync(imagesFile, '[]', 'utf8');
  if (!fs.existsSync(chatsFile)) fs.writeFileSync(chatsFile, '[]', 'utf8');
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

app.get('/campaigns', (_req, res) => res.json(readCampaigns()));

app.post('/campaigns', (req, res) => {
  const { name, system, description } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'Field name is required.' });
  const items = readCampaigns();
  const now = new Date().toISOString();
  const isPrivate = !!(req.body && typeof req.body.isPrivate === 'boolean' ? req.body.isPrivate : false);
  const newItem = { id: Date.now().toString(), name: name.trim(), system: typeof system === 'string' ? system.trim() : '', description: typeof description === 'string' ? description.trim() : '', isPrivate, createdAt: now, updatedAt: now };
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

// Update campaign (name, system, description, isPrivate)
app.put('/campaigns/:id', (req, res) => {
  const items = readCampaigns();
  const idx = items.findIndex((c) => c.id === String(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const current = items[idx];
  const next = { ...current };
  if (typeof req.body?.name === 'string') next.name = req.body.name.trim();
  if (typeof req.body?.system === 'string') next.system = req.body.system.trim();
  if (typeof req.body?.description === 'string') next.description = req.body.description.trim();
  if (typeof req.body?.isPrivate === 'boolean') next.isPrivate = req.body.isPrivate;
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

app.post('/pdfs', upload.single('file'), (req, res) => {
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
    const { id, name, system, description, isPrivate } = payload || {};
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

app.post('/images', uploadImage.single('file'), (req, res) => {
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
