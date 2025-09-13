const { readChats, writeChats, readCampaigns, writeCampaigns } = require('../store');
const db = require('../db');

function initSockets(server) {
  const { Server } = require('socket.io');
  const io = new Server(server, { cors: { origin: '*', methods: ['GET','POST'] } });

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
      const msg = { id: Date.now().toString(), campaignId: cid, author: String(author || 'Anônimo'), text: String(text).slice(0,1000), ts: now };
      const items = readChats();
      items.push(msg);
      writeChats(items);
      // Also persist to DB if configured (fire-and-forget)
      if (db.enabled) db.insertChat(msg).catch(() => {});
      io.to('camp:' + cid).emit('chat:new', msg);
    });

    socket.on('campaign:update', async (payload) => {
      const { id, name, system, description, isPrivate, coverImageId, coverImageUrl } = payload || {};
      const cid = String(id || '');
      if (!cid) return;
      let next;
      if (db.enabled) {
        const fields = {};
        if (typeof name === 'string') fields.name = name.trim();
        if (typeof system === 'string') fields.system = system.trim();
        if (typeof description === 'string') fields.description = description.trim();
        if (typeof isPrivate === 'boolean') fields.isPrivate = isPrivate;
        if (typeof coverImageId === 'string') fields.coverImageId = coverImageId;
        if (typeof coverImageUrl === 'string') fields.coverImageUrl = coverImageUrl;
        next = await db.updateCampaign(cid, fields);
        if (!next) return;
      } else {
        const items = readCampaigns();
        const idx = items.findIndex((c) => c.id === cid);
        if (idx === -1) return;
        next = { ...items[idx] };
        if (typeof name === 'string') next.name = name.trim();
        if (typeof system === 'string') next.system = system.trim();
        if (typeof description === 'string') next.description = description.trim();
        if (typeof isPrivate === 'boolean') next.isPrivate = isPrivate;
        if (typeof coverImageId === 'string') next.coverImageId = coverImageId;
        if (typeof coverImageUrl === 'string') next.coverImageUrl = coverImageUrl;
        next.updatedAt = new Date().toISOString();
        items[idx] = next;
        writeCampaigns(items);
      }
      io.to('camp:' + cid).emit('campaign:updated', next);
    });
  });

  return io;
}

module.exports = { initSockets };

