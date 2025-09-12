const express = require('express');
const { readCampaigns, writeCampaigns } = require('../store');
const { authRequired } = require('../services/auth');

const router = express.Router();

router.get('/', (_req, res) => res.json(readCampaigns()));

router.post('/', authRequired, (req, res) => {
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

router.get('/:id', (req, res) => {
  const items = readCampaigns();
  const it = items.find((c) => c.id === String(req.params.id));
  if (!it) return res.status(404).json({ error: 'Not found' });
  res.json(it);
});

router.put('/:id', authRequired, (req, res) => {
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

module.exports = router;

