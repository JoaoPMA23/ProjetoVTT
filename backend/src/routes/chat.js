const express = require('express');
const { readChats } = require('../store');
const db = require('../db');

const router = express.Router();

router.get('/lobbies/:id/messages', async (req, res) => {
  try {
    const campaignId = String(req.params.id);
    const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 200);
    if (db.enabled) {
      const fromDb = await db.getChatsByCampaign(campaignId, limit);
      return res.json(fromDb);
    }
    const items = readChats().filter((m) => m.campaignId === campaignId);
    return res.json(items.slice(-limit));
  } catch (e) {
    console.error('Chat list error', e);
    res.status(500).json({ error: 'Falha ao listar mensagens' });
  }
});

module.exports = router;

