// mail/service.js
const nodemailer = require("nodemailer");

// Configurar el transporter de nodemailer con los datos del entorno
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure:
    process.env.SMTP_SECURE === "true" || Number(process.env.SMTP_PORT) === 465, // true si 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Función para enviar un correo electrónico
async function sendMail({
  to,
  subject,
  html,
  text,
  from = `"Oficina Agroquímicos" <${process.env.SMTP_USER}>`,
}) {
  try {
    // Enviar el correo
    const info = await transporter.sendMail({ from, to, subject, html, text });
    return info;
  } catch (err) {
    // Re-lanzar para que el caller (controller) lo maneje
    throw err;
  }
}

module.exports = { sendMail };