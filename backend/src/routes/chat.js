const express = require('express');
const { readChats } = require('../store');

const router = express.Router();

router.get('/lobbies/:id/messages', (req, res) => {
  const campaignId = String(req.params.id);
  const items = readChats().filter((m) => m.campaignId === campaignId);
  const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 200);
  res.json(items.slice(-limit));
});

module.exports = router;

