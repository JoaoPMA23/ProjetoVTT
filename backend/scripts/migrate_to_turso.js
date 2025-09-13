/*
  Migrates JSON store data (users, campaigns, pdfs, images) into Turso/libSQL.
*/
const path = require('path');
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const db = require('../src/db');
const store = require('../src/store');

async function upsertUsers() {
  const users = store.readUsers();
  if (!users || !users.length) return 0;
  for (const u of users) {
    await db.client.execute({
      sql: 'INSERT OR REPLACE INTO users (id, name, email, passwordHash, createdAt, resetToken, resetExpires) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [String(u.id), u.name || '', String(u.email), u.passwordHash || null, u.createdAt || new Date().toISOString(), u.resetToken || null, u.resetExpires == null ? null : Number(u.resetExpires)],
    });
  }
  return users.length;
}

async function upsertCampaigns() {
  const items = store.readCampaigns();
  if (!items || !items.length) return 0;
  for (const c of items) {
    await db.client.execute({
      sql: `INSERT OR REPLACE INTO campaigns (id, name, system, description, isPrivate, createdAt, updatedAt, createdBy, coverImageId, coverImageUrl)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [String(c.id), c.name || '', c.system || '', c.description || '', c.isPrivate ? 1 : 0, c.createdAt || new Date().toISOString(), c.updatedAt || c.createdAt || new Date().toISOString(), c.createdBy || '', c.coverImageId || null, c.coverImageUrl || null],
    });
  }
  return items.length;
}

async function upsertPDFs() {
  const items = store.readPDFs();
  if (!items || !items.length) return 0;
  for (const p of items) {
    await db.client.execute({
      sql: 'INSERT OR REPLACE INTO pdfs (id, campaignId, originalName, fileName, url, size, uploadedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [String(p.id), String(p.campaignId), p.originalName || '', p.fileName || '', p.url || '', Number(p.size || 0), p.uploadedAt || new Date().toISOString()],
    });
  }
  return items.length;
}

async function upsertImages() {
  const items = store.readImages();
  if (!items || !items.length) return 0;
  for (const p of items) {
    await db.client.execute({
      sql: 'INSERT OR REPLACE INTO images (id, campaignId, originalName, fileName, url, size, uploadedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [String(p.id), String(p.campaignId), p.originalName || '', p.fileName || '', p.url || '', Number(p.size || 0), p.uploadedAt || new Date().toISOString()],
    });
  }
  return items.length;
}

async function main() {
  if (!db.enabled) {
    console.error('Turso/libSQL not configured. Set LIBSQL_URL and LIBSQL_AUTH_TOKEN.');
    process.exit(1);
  }
  await db.ensureTables();
  const results = {};
  results.users = await upsertUsers();
  results.campaigns = await upsertCampaigns();
  results.pdfs = await upsertPDFs();
  results.images = await upsertImages();
  console.log('Migration complete:', results);
}

main().catch((e) => { console.error('Migration failed:', e); process.exit(1); });
