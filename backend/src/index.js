const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

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

function ensureData() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  if (!fs.existsSync(pdfsDir)) fs.mkdirSync(pdfsDir, { recursive: true });
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
  if (!fs.existsSync(campaignsFile)) fs.writeFileSync(campaignsFile, '[]', 'utf8');
  if (!fs.existsSync(pdfsFile)) fs.writeFileSync(pdfsFile, '[]', 'utf8');
  if (!fs.existsSync(imagesFile)) fs.writeFileSync(imagesFile, '[]', 'utf8');
}
function readJSON(file) { ensureData(); try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; } }
function writeJSON(file, data) { ensureData(); fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8'); }

const readCampaigns = () => readJSON(campaignsFile);
const writeCampaigns = (d) => writeJSON(campaignsFile, d);
const readPDFs = () => readJSON(pdfsFile);
const writePDFs = (d) => writeJSON(pdfsFile, d);
const readImages = () => readJSON(imagesFile);
const writeImages = (d) => writeJSON(imagesFile, d);

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
  const newItem = { id: Date.now().toString(), name: name.trim(), system: typeof system === 'string' ? system.trim() : '', description: typeof description === 'string' ? description.trim() : '', createdAt: now, updatedAt: now };
  items.unshift(newItem);
  writeCampaigns(items);
  res.status(201).json(newItem);
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

app.listen(PORT, () => { console.log('API running on http://localhost:' + PORT); });

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
