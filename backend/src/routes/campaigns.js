const express = require('express');
const { readCampaigns, writeCampaigns } = require('../store');
const db = require('../db');
const { authRequired } = require('../services/auth');

const router = express.Router();

router.get('/', authRequired, async (req, res) => {
  try {
    if (db.enabled) return res.json(await db.listCampaigns(req.user.id));
    return res.json(readCampaigns().filter((c) => c.createdBy === req.user.id));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Falha ao listar' }); }
});

router.post('/', authRequired, async (req, res) => {
  const { name, system, description } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'Field name is required.' });
  const now = new Date().toISOString();
  const isPrivate = !!(req.body && typeof req.body.isPrivate === 'boolean' ? req.body.isPrivate : false);
  const newItem = { id: Date.now().toString(), name: name.trim(), system: typeof system === 'string' ? system.trim() : '', description: typeof description === 'string' ? description.trim() : '', isPrivate, createdAt: now, updatedAt: now, createdBy: req.user.id };
  try {
    if (db.enabled) await db.createCampaign(newItem);
    else {
      const items = readCampaigns(); items.unshift(newItem); writeCampaigns(items);
    }
    res.status(201).json(newItem);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Falha ao criar' }); }
});

router.get('/:id', authRequired, async (req, res) => {
  try {
    if (db.enabled) {
      const it = await db.getCampaignById(String(req.params.id));
      if (!it || it.createdBy !== req.user.id) return res.status(404).json({ error: 'Not found' });
      return res.json(it);
    }
    const items = readCampaigns();
    const it = items.find((c) => c.id === String(req.params.id) && c.createdBy === req.user.id);
    if (!it) return res.status(404).json({ error: 'Not found' });
    res.json(it);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Falha ao buscar' }); }
});

router.put('/:id', authRequired, async (req, res) => {
  try {
    if (db.enabled) {
      const id = String(req.params.id);
      const existing = await db.getCampaignById(id);
      if (!existing || existing.createdBy !== req.user.id) return res.status(404).json({ error: 'Not found' });
      const fields = {};
      if (typeof req.body?.name === 'string') fields.name = req.body.name.trim();
      if (typeof req.body?.system === 'string') fields.system = req.body.system.trim();
      if (typeof req.body?.description === 'string') fields.description = req.body.description.trim();
      if (typeof req.body?.isPrivate === 'boolean') fields.isPrivate = req.body.isPrivate;
      if (typeof req.body?.coverImageId === 'string') fields.coverImageId = req.body.coverImageId;
      if (typeof req.body?.coverImageUrl === 'string') fields.coverImageUrl = req.body.coverImageUrl;
      const next = await db.updateCampaign(id, fields);
      if (!next) return res.status(404).json({ error: 'Not found' });
      return res.json(next);
    }
    const items = readCampaigns();
    const idx = items.findIndex((c) => c.id === String(req.params.id) && c.createdBy === req.user.id);
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
  } catch (e) { console.error(e); res.status(500).json({ error: 'Falha ao atualizar' }); }
});

module.exports = router;
