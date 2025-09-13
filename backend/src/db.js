const cfg = require('./config');

let client = null;
let enabled = false;

function toDbBool(v) { return v ? 1 : 0; }
function fromDbBool(v) { return Number(v) === 1; }

async function ensureTables() {
  if (!enabled) return;
  // Users
  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE NOT NULL,
      passwordHash TEXT,
      createdAt TEXT,
      resetToken TEXT,
      resetExpires INTEGER
    )
  `);
  // Campaigns
  await client.execute(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      system TEXT,
      description TEXT,
      isPrivate INTEGER DEFAULT 0,
      createdAt TEXT,
      updatedAt TEXT,
      createdBy TEXT,
      coverImageId TEXT,
      coverImageUrl TEXT
    )
  `);
  // PDFs
  await client.execute(`
    CREATE TABLE IF NOT EXISTS pdfs (
      id TEXT PRIMARY KEY,
      campaignId TEXT NOT NULL,
      originalName TEXT,
      fileName TEXT,
      url TEXT,
      size INTEGER,
      uploadedAt TEXT
    )
  `);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_pdfs_campaign ON pdfs(campaignId)`);
  // Images
  await client.execute(`
    CREATE TABLE IF NOT EXISTS images (
      id TEXT PRIMARY KEY,
      campaignId TEXT NOT NULL,
      originalName TEXT,
      fileName TEXT,
      url TEXT,
      size INTEGER,
      uploadedAt TEXT
    )
  `);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_images_campaign ON images(campaignId)`);
  // Chats (already in use)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      campaignId TEXT NOT NULL,
      author TEXT,
      text TEXT,
      ts TEXT NOT NULL
    )
  `);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_chats_campaign_ts ON chats(campaignId, ts)`);
}

function init() {
  if (!cfg.db.url) return { enabled, client };
  try {
    const { createClient } = require('@libsql/client');
    client = createClient({ url: cfg.db.url, authToken: cfg.db.authToken || undefined });
    enabled = true;
    // Fire and forget table ensure
    ensureTables().catch((e) => console.error('DB ensure tables error:', e));
  } catch (e) {
    console.error('DB init error:', e.message || e);
    enabled = false;
    client = null;
  }
  return { enabled, client };
}

// Chats
async function insertChat(msg) {
  if (!enabled) return;
  try {
    await ensureTables();
    await client.execute({
      sql: 'INSERT OR REPLACE INTO chats (id, campaignId, author, text, ts) VALUES (?, ?, ?, ?, ?)',
      args: [msg.id, msg.campaignId, msg.author || null, msg.text || null, msg.ts],
    });
  } catch (e) {
    console.error('DB insertChat error:', e.message || e);
  }
}

async function getChatsByCampaign(campaignId, limit) {
  if (!enabled) return [];
  try {
    await ensureTables();
    const lim = Math.max(1, Math.min(Number(limit) || 50, 200));
    // Fetch latest first, then reverse to keep ascending order like file store
    const rs = await client.execute({
      sql: 'SELECT id, campaignId, author, text, ts FROM chats WHERE campaignId = ? ORDER BY ts DESC LIMIT ?',
      args: [String(campaignId), lim],
    });
    const rows = (rs.rows || []).map((r) => ({
      id: String(r.id),
      campaignId: String(r.campaignId),
      author: r.author == null ? undefined : String(r.author),
      text: r.text == null ? undefined : String(r.text),
      ts: String(r.ts),
    }));
    return rows.reverse();
  } catch (e) {
    console.error('DB getChatsByCampaign error:', e.message || e);
    return [];
  }
}

// Users
async function getUserById(id) {
  if (!enabled) return null;
  const rs = await client.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [String(id)] });
  const r = rs.rows && rs.rows[0];
  return r ? { id: String(r.id), name: r.name || '', email: String(r.email), passwordHash: r.passwordHash || '', createdAt: r.createdAt || '', resetToken: r.resetToken || undefined, resetExpires: r.resetExpires == null ? undefined : Number(r.resetExpires) } : null;
}

async function getUserByEmail(email) {
  if (!enabled) return null;
  const rs = await client.execute({ sql: 'SELECT * FROM users WHERE lower(email) = lower(?)', args: [String(email)] });
  const r = rs.rows && rs.rows[0];
  return r ? { id: String(r.id), name: r.name || '', email: String(r.email), passwordHash: r.passwordHash || '', createdAt: r.createdAt || '', resetToken: r.resetToken || undefined, resetExpires: r.resetExpires == null ? undefined : Number(r.resetExpires) } : null;
}

async function createUser(user) {
  if (!enabled) return null;
  const id = user.id || String(Date.now());
  await client.execute({
    sql: 'INSERT OR REPLACE INTO users (id, name, email, passwordHash, createdAt, resetToken, resetExpires) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [id, user.name || '', String(user.email), user.passwordHash || null, user.createdAt || new Date().toISOString(), user.resetToken || null, user.resetExpires == null ? null : Number(user.resetExpires)],
  });
  return { ...user, id };
}

async function updateUserFields(id, fields) {
  if (!enabled) return null;
  const sets = [];
  const args = [];
  for (const [k, v] of Object.entries(fields)) {
    sets.push(`${k} = ?`);
    args.push(v == null ? null : v);
  }
  if (!sets.length) return getUserById(id);
  args.push(String(id));
  await client.execute({ sql: `UPDATE users SET ${sets.join(', ')} WHERE id = ?`, args });
  return getUserById(id);
}

// Campaigns
async function listCampaigns() {
  if (!enabled) return [];
  const rs = await client.execute('SELECT * FROM campaigns ORDER BY createdAt DESC');
  return (rs.rows || []).map((r) => ({
    id: String(r.id),
    name: r.name || '',
    system: r.system || '',
    description: r.description || '',
    isPrivate: fromDbBool(r.isPrivate),
    createdAt: r.createdAt || '',
    updatedAt: r.updatedAt || '',
    createdBy: r.createdBy || '',
    coverImageId: r.coverImageId || undefined,
    coverImageUrl: r.coverImageUrl || undefined,
  }));
}

async function getCampaignById(id) {
  if (!enabled) return null;
  const rs = await client.execute({ sql: 'SELECT * FROM campaigns WHERE id = ?', args: [String(id)] });
  const r = rs.rows && rs.rows[0];
  return r ? {
    id: String(r.id),
    name: r.name || '',
    system: r.system || '',
    description: r.description || '',
    isPrivate: fromDbBool(r.isPrivate),
    createdAt: r.createdAt || '',
    updatedAt: r.updatedAt || '',
    createdBy: r.createdBy || '',
    coverImageId: r.coverImageId || undefined,
    coverImageUrl: r.coverImageUrl || undefined,
  } : null;
}

async function createCampaign(c) {
  if (!enabled) return null;
  const id = c.id || String(Date.now());
  const now = new Date().toISOString();
  await client.execute({
    sql: `INSERT OR REPLACE INTO campaigns (id, name, system, description, isPrivate, createdAt, updatedAt, createdBy, coverImageId, coverImageUrl)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, c.name || '', c.system || '', c.description || '', toDbBool(!!c.isPrivate), c.createdAt || now, c.updatedAt || now, c.createdBy || '', c.coverImageId || null, c.coverImageUrl || null],
  });
  return getCampaignById(id);
}

async function updateCampaign(id, fields) {
  if (!enabled) return null;
  const sets = [];
  const args = [];
  for (const [k, v] of Object.entries(fields)) {
    if (k === 'isPrivate') { sets.push('isPrivate = ?'); args.push(toDbBool(!!v)); }
    else { sets.push(`${k} = ?`); args.push(v == null ? null : v); }
  }
  if (!sets.length) return getCampaignById(id);
  args.push(String(id));
  await client.execute({ sql: `UPDATE campaigns SET ${sets.join(', ')}, updatedAt = ? WHERE id = ?`, args: [...args.slice(0, -1), new Date().toISOString(), args[args.length - 1]] });
  return getCampaignById(id);
}

// PDFs
async function listPDFs(campaignId) {
  if (!enabled) return [];
  let rs;
  if (campaignId) {
    rs = await client.execute({ sql: 'SELECT * FROM pdfs WHERE campaignId = ? ORDER BY uploadedAt DESC', args: [String(campaignId)] });
  } else {
    rs = await client.execute('SELECT * FROM pdfs ORDER BY uploadedAt DESC');
  }
  return (rs.rows || []).map((r) => ({
    id: String(r.id),
    campaignId: String(r.campaignId),
    originalName: r.originalName || '',
    fileName: r.fileName || '',
    url: r.url || '',
    size: Number(r.size || 0),
    uploadedAt: r.uploadedAt || '',
  }));
}

async function insertPDF(meta) {
  if (!enabled) return null;
  const id = meta.id || String(Date.now());
  await client.execute({
    sql: 'INSERT OR REPLACE INTO pdfs (id, campaignId, originalName, fileName, url, size, uploadedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [id, String(meta.campaignId), meta.originalName || '', meta.fileName || '', meta.url || '', Number(meta.size || 0), meta.uploadedAt || new Date().toISOString()],
  });
  return id;
}

// Images
async function listImages(campaignId) {
  if (!enabled) return [];
  let rs;
  if (campaignId) {
    rs = await client.execute({ sql: 'SELECT * FROM images WHERE campaignId = ? ORDER BY uploadedAt DESC', args: [String(campaignId)] });
  } else {
    rs = await client.execute('SELECT * FROM images ORDER BY uploadedAt DESC');
  }
  return (rs.rows || []).map((r) => ({
    id: String(r.id),
    campaignId: String(r.campaignId),
    originalName: r.originalName || '',
    fileName: r.fileName || '',
    url: r.url || '',
    size: Number(r.size || 0),
    uploadedAt: r.uploadedAt || '',
  }));
}

async function insertImage(meta) {
  if (!enabled) return null;
  const id = meta.id || String(Date.now());
  await client.execute({
    sql: 'INSERT OR REPLACE INTO images (id, campaignId, originalName, fileName, url, size, uploadedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [id, String(meta.campaignId), meta.originalName || '', meta.fileName || '', meta.url || '', Number(meta.size || 0), meta.uploadedAt || new Date().toISOString()],
  });
  return id;
}

// Initialize on module load
init();

module.exports = {
  get enabled() { return enabled; },
  get client() { return client; },
  ensureTables,
  // Users
  getUserById,
  getUserByEmail,
  createUser,
  updateUserFields,
  // Campaigns
  listCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  // PDFs
  listPDFs,
  insertPDF,
  // Images
  listImages,
  insertImage,
  // Chats
  insertChat,
  getChatsByCampaign,
};
