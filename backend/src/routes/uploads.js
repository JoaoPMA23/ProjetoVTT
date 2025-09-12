const express = require('express');
const multer = require('multer');
const { pdfsDir, imagesDir } = require('../config');
const { readPDFs, writePDFs, readImages, writeImages, readCampaigns } = require('../store');
const { authRequired } = require('../services/auth');

const router = express.Router();

// PDFs
const storagePDF = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, pdfsDir),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const safeBase = file.originalname.replace(/[^a-zA-Z0-9_.-]+/g, '_');
    cb(null, ts + '_' + safeBase);
  },
});
const fileFilterPDF = (_req, file, cb) => { if (file.mimetype === 'application/pdf') cb(null, true); else cb(new Error('Only PDF files are allowed')); };
const uploadPDF = multer({ storage: storagePDF, fileFilter: fileFilterPDF, limits: { fileSize: 25 * 1024 * 1024 } });

router.get('/pdfs', (req, res) => {
  const items = readPDFs();
  const campaignId = (req.query && req.query.campaignId) ? String(req.query.campaignId) : '';
  const list = campaignId ? items.filter((i) => i.campaignId === campaignId) : items;
  res.json(list);
});

router.post('/pdfs', authRequired, uploadPDF.single('file'), (req, res) => {
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
  } catch (e) { console.error('Upload error', e); res.status(500).json({ error: 'Falha no upload' }); }
});

// Images
const storageImg = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, imagesDir),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const safeBase = file.originalname.replace(/[^a-zA-Z0-9_.-]+/g, '_');
    cb(null, ts + '_' + safeBase);
  },
});
const imageFilter = (_req, file, cb) => { const ok = ['image/png','image/jpeg','image/webp'].includes(file.mimetype); if (ok) cb(null, true); else cb(new Error('Only PNG/JPEG/WebP allowed')); };
const uploadImage = multer({ storage: storageImg, fileFilter: imageFilter, limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/images', (req, res) => {
  const items = readImages();
  const campaignId = (req.query && req.query.campaignId) ? String(req.query.campaignId) : '';
  const list = campaignId ? items.filter((i) => i.campaignId === campaignId) : items;
  res.json(list);
});

router.post('/images', authRequired, uploadImage.single('file'), (req, res) => {
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
  } catch (e) { console.error('Image upload error', e); res.status(500).json({ error: 'Falha no upload de imagem' }); }
});

module.exports = router;

