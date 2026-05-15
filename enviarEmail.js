// mail/service.js (o como se llame tu archivo de enviarEmail)
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587, // 👈 Si no existe en el .env, usa 587
  secure: process.env.SMTP_SECURE === "true", // Para el puerto 587 esto debe ser false
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Añadimos "attachments" a los parámetros destructurados 👇
async function sendMail({
  to,
  subject,
  html,
  text,
  from = `"Oficina Agroquímicos" <${process.env.SMTP_USER}>`,
  attachments = [] // 👈 Valor por defecto un array vacío
}) {
  try {
    // Pasamos attachments a la configuración de nodemailer 👇
    const info = await transporter.sendMail({ from, to, subject, html, text, attachments });
    return info;
  } catch (err) {
    throw err;
  }
}

module.exports = { sendMail };