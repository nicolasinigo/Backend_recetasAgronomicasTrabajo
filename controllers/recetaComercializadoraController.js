const axios = require('axios');
const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');
const { guardarEnGoogleSheetsComercializadora } = require('./../googleSheets');
const { sendMail } = require('./../enviarEmail'); // Tu servicio de correo

const generarRecetaComercializadoraPdf = async (req, res) => {
  console.log('Datos recibidos en el backend:', req.body);
  try {
    const { captchaToken, ...datosFormulario } = req.body;

    // Validar el token de captcha con Cloudflare Turnstile
    if (!captchaToken) {
      return res.status(400).json({
        ok: false,
        mensaje: "Captcha requerido"
      });
    }

    // Validar el token de captcha con Cloudflare Turnstile
    const response = await axios.post(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET,
        response: captchaToken
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    // Verificar la respuesta del captcha
    if (!response.data.success) {
      return res.status(403).json({
        ok: false,
        mensaje: "Captcha inválido"
      });
    }

    // Guardar los datos en Google Sheets y obtener el número de receta
    const numeroReceta = await guardarEnGoogleSheetsComercializadora(req.body);
    const numeroRecetaStr = numeroReceta.toString();

    // Generar el PDF con los datos del formulario
    const {
      comercioFitosanitario,
      adquiriente,
      cuit1,
      cuit2,
      domicilio,
      predio,
      superficie,
      cultivo,
      diagnostico,
      recomendacion,
      agroquimicos,
      email,
    } = req.body;

    // Cargar la plantilla PDF
    const plantillaBytes = fs.readFileSync('receta_agronomica_comercializadora.pdf');
    const pdfDoc = await PDFDocument.load(plantillaBytes);
    const page = pdfDoc.getPage(0);

    const comercioFitosanitarios = comercioFitosanitario.trim();
    const adquirientes = adquiriente.trim();
    const fecha = new Date().getDate() + '/' + (new Date().getMonth() + 1) + '/' + new Date().getFullYear();

    page.drawText(String(fecha || ""), { x: 450, y: 709, size: 12 });
    page.drawText(String(numeroRecetaStr || ""), { x: 500, y: 659, size: 12 });
    page.drawText(String(comercioFitosanitarios || ""), { x: 137, y: 634, size: 12 });
    page.drawText(String(cuit1 || ""), { x: 403, y: 634, size: 12 });
    page.drawText(String(adquirientes || ""), { x: 90, y: 609, size: 12 });
    page.drawText(String(cuit2 || ""), { x: 403, y: 609, size: 12 });
    page.drawText(String(domicilio || ""), { x: 74, y: 584, size: 12 });
    page.drawText(String(predio || ""), { x: 177, y: 559, size: 12 });
    page.drawText(String(superficie || "") + " km²", { x: 77, y: 534, size: 12 });
    page.drawText(String(cultivo || ""), { x: 101, y: 509, size: 12 });
    page.drawText(String(diagnostico || ""), { x: 84, y: 484, size: 12 });
    page.drawText(String(recomendacion || ""), { x: 159, y: 252, size: 12 });

    let startY = 400; // Posición inicial para los agroquímicos
    const lineHeight = 15;
    if (agroquimicos && Array.isArray(agroquimicos)) {
      agroquimicos.forEach((agro, index) => {
        const y = startY - (index * lineHeight);
        page.drawText(String(agro.principioActivo || ""), { x: 45, y, size: 12 });
        page.drawText(String(agro.nomencComercial || ""), { x: 221, y, size: 12 });
        page.drawText(String(agro.dosis || "") + " ml", { x: 414, y, size: 12 });
        page.drawText(String(agro.cantidadTotal || "") + " lt", { x: 499, y, size: 12 });
      });
    }

    const pdfResultadoBytes = await pdfDoc.save();

    // Enviar el PDF y los datos por correo electrónico
    const correoAdjuntos = [
      {
        filename: `Receta_Agronomica_${numeroRecetaStr}.pdf`,
        content: Buffer.from(pdfResultadoBytes),
        contentType: 'application/pdf'
      }
    ];

    const cuerpoHtml = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
        <h2 style="color: #2e7d32;">Receta Agronómica de Comercialización N° ${numeroRecetaStr}</h2>
        <p>Estimado/a, se adjunta la receta formal correspondiente. </p>
        <h3 style="margin-top: 20px;">Detalles de la Comercialización:</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px; font-weight: bold;">Fecha:</td><td style="padding: 8px;">${fecha}</td></tr>
            <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">Comercio Fitosanitario:</td><td style="padding: 8px;">${comercioFitosanitario}</td></tr>
            <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">Adquiriente:</td><td style="padding: 8px;">${adquiriente}</td></tr>
            <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">Predio:</td><td style="padding: 8px;">${predio}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Cultivo:</td><td style="padding: 8px;">${cultivo}</td></tr>
            <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">Superficie:</td><td style="padding: 8px;">${superficie} km²</td></tr>
        </table>
        <p style="font-size: 12px; color: #777; margin-top: 30px;">
            Este es un mensaje automático generado por el Sistema de Recetario Agronómico. Por favor, descargue el documento oficial en PDF adjunto en este mail.
        </p>
      </div>
    `;

    // Enviar el correo electrónico a la dirección proporcionada en el formulario
    const listaDestinatarios = [];
    if (email && email.trim() !== '') listaDestinatarios.push(email.trim());

    await sendMail({
      to: listaDestinatarios,
      subject: `⚠️ Receta Agronómica de Comercialización N° ${numeroRecetaStr} - Predio: ${predio}`,
      html: cuerpoHtml,
      attachments: correoAdjuntos
    });

    res.json({
      ok: true,
      mensaje: `Receta N° ${numeroRecetaStr} procesada y enviada por correo con éxito. Se envió a ${email}.`
    });

  } catch (error) {
    console.error(error);
    res.status(500).send('Error al generar el PDF o enviar el mail');
  }
};

module.exports = { generarRecetaComercializadoraPdf };