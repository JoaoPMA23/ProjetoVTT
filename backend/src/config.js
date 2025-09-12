const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
const uploadsDir = path.join(__dirname, '..', 'uploads');
const pdfsDir = path.join(uploadsDir, 'pdfs');
const imagesDir = path.join(uploadsDir, 'images');

const files = {
  campaigns: path.join(dataDir, 'campaigns.json'),
  pdfs: path.join(dataDir, 'pdfs.json'),
  images: path.join(dataDir, 'images.json'),
  chats: path.join(dataDir, 'chats.json'),
  users: path.join(dataDir, 'users.json'),
};

function ensureData() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  if (!fs.existsSync(pdfsDir)) fs.mkdirSync(pdfsDir, { recursive: true });
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
  Object.values(files).forEach((f) => { if (!fs.existsSync(f)) fs.writeFileSync(f, '[]', 'utf8'); });
}

module.exports = {
  dataDir,
  uploadsDir,
  pdfsDir,
  imagesDir,
  files,
  ensureData,
  jwt: {
    secret: process.env.JWT_SECRET || 'dev_jwt_secret',
    defaultExp: process.env.JWT_DEFAULT_EXP || '7d',
    rememberExp: process.env.JWT_REMEMBER_EXP || '30d',
  },
  reset: {
    ttlMin: parseInt(process.env.RESET_TOKEN_TTL_MIN || '30', 10),
  },
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
  },
};

