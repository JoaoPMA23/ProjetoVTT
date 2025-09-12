const fs = require('fs');
const { files, ensureData } = require('./config');

function readJSON(file) { ensureData(); try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; } }
function writeJSON(file, data) { ensureData(); fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8'); }

const readCampaigns = () => readJSON(files.campaigns);
const writeCampaigns = (d) => writeJSON(files.campaigns, d);
const readPDFs = () => readJSON(files.pdfs);
const writePDFs = (d) => writeJSON(files.pdfs, d);
const readImages = () => readJSON(files.images);
const writeImages = (d) => writeJSON(files.images, d);
const readChats = () => readJSON(files.chats);
const writeChats = (d) => writeJSON(files.chats, d);
const readUsers = () => readJSON(files.users);
const writeUsers = (d) => writeJSON(files.users, d);

module.exports = {
  readJSON, writeJSON,
  readCampaigns, writeCampaigns,
  readPDFs, writePDFs,
  readImages, writeImages,
  readChats, writeChats,
  readUsers, writeUsers,
};

