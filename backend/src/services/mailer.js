const nodemailer = require('nodemailer');
const cfg = require('../config');

function getTransport() {
  if (cfg.smtp.host && cfg.smtp.user) {
    return nodemailer.createTransport({
      host: cfg.smtp.host,
      port: cfg.smtp.port,
      secure: false,
      auth: { user: cfg.smtp.user, pass: cfg.smtp.pass },
    });
  }
  return null;
}

async function sendResetEmail(to, link) {
  const t = getTransport();
  if (t) {
    await t.sendMail({ from: cfg.smtp.from || cfg.smtp.user, to, subject: 'Reset de senha', text: `Para redefinir sua senha: ${link}`, html: `<p>Para redefinir sua senha: <a href="${link}">${link}</a></p>` });
  } else {
    console.log('Reset password link:', link);
  }
}

module.exports = { getTransport, sendResetEmail };

