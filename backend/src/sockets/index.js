const { readChats, writeChats, readCampaigns, writeCampaigns } = require('../store');

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

  return io;
}

module.exports = { initSockets };

