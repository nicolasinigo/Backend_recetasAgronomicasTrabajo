const axios = require('axios');
const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');
const { guardarEnGoogleSheets } = require('./../googleSheets');
const { sendMail } = require('./../enviarEmail'); // Tu servicio de correo

const generarRecetaPdf = async (req, res) => {
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
    const numeroReceta = await guardarEnGoogleSheets(req.body);
    const numeroRecetaStr = numeroReceta.toString();

    // Generar el PDF con los datos del formulario
    const {
      fechaAplicacion,
      asesorApellido,
      asesorNombres,
      cuit1,
      empresaProductora,
      cuit2,
      aplicadora,
      categoriaAplicadora,
      cuit3,
      pilotoApellido,
      pilotoNombres,
      cuit4,
      tipoMaquina,
      modelo,
      Matricula,
      domicilio,
      predio,
      latitud,
      longitud,
      superficie,
      cultivo,
      diagnostico,
      recomendacion,
      agroquimicos,
      emailAsesor,
      mapaImagen
    } = req.body;

    // Cargar la plantilla PDF
    const plantillaBytes = fs.readFileSync('receta_agronomica.pdf');
    const pdfDoc = await PDFDocument.load(plantillaBytes);
    const page = pdfDoc.getPage(0);

    const asesor = `${asesorApellido || ""} ${asesorNombres || ""}`.trim();
    const piloto = `${pilotoApellido || ""} ${pilotoNombres || ""}`.trim();
    const tipoMaquinaModelo = `${tipoMaquina || ""}-${modelo || ""}`.trim();
    const gps = `Lat: ${latitud || ""}, Lon: ${longitud || ""}`.trim();

    page.drawText(String(fechaAplicacion || ""), { x: 450, y: 709, size: 12 });
    page.drawText(String(numeroRecetaStr || ""), { x: 500, y: 659, size: 12 });
    page.drawText(String(asesor || ""), { x: 100, y: 634, size: 12 });
    page.drawText(String(cuit1 || ""), { x: 403, y: 634, size: 12 });
    page.drawText(String(empresaProductora || ""), { x: 130, y: 609, size: 12 });
    page.drawText(String(cuit2 || ""), { x: 403, y: 609, size: 12 });
    page.drawText(String(aplicadora || ""), { x: 85, y: 584, size: 12 });
    page.drawText(String(cuit3 || ""), { x: 403, y: 584, size: 12 });
    page.drawText(String(categoriaAplicadora || ""), { x: 80, y: 559, size: 12 });
    page.drawText(String(piloto || ""), { x: 110, y: 535, size: 12 });
    page.drawText(String(cuit4 || ""), { x: 403, y: 535, size: 12 });
    page.drawText(String(tipoMaquinaModelo || ""), { x: 120, y: 509, size: 12 });
    page.drawText(String(Matricula || ""), { x: 403, y: 509, size: 12 });
    page.drawText(String(domicilio || ""), { x: 74, y: 484, size: 12 });
    page.drawText(String(predio || ""), { x: 175, y: 460, size: 12 });
    page.drawText(String(gps || ""), { x: 403, y: 459, size: 12 });
    page.drawText(String(superficie || "") + " km²", { x: 77, y: 435, size: 12 });
    page.drawText(String(cultivo || ""), { x: 100, y: 410, size: 12 });
    page.drawText(String(diagnostico || ""), { x: 403, y: 409, size: 12 });
    page.drawText(String(recomendacion || ""), { x: 158, y: 178, size: 12 });

    let startY = 328;
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

    // Adjuntar la imagen del mapa si está disponible
    if (mapaImagen) {
      const base64PureData = mapaImagen.split(';base64,').pop();
      correoAdjuntos.push({
        filename: `Poligono_Receta_${numeroRecetaStr}.png`,
        content: base64PureData,
        encoding: 'base64',
        cid: 'mapa_poligono_cid'
      });
    }

    // Enviar el correo electrónico con la receta y el enlace de confirmación
    //const linkConfirmacion = `${process.env.FRONTEND_URL}/Receta/${numeroRecetaStr}`;
    const linkConfirmacion = `http://localhost:3000/Receta/${numeroRecetaStr}`

    const cuerpoHtml = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
        <h2 style="color: #2e7d32;">Receta Agronómica de Aplicación N° ${numeroRecetaStr}</h2>
        <p>Estimado/a, se adjunta la receta formal correspondiente a la aplicación planificada. </p>
        <p>Por favor, para confirmar la receta, una vez realizada la aplicación, haga clic en el siguiente enlace:</p>
        <a href="${linkConfirmacion}" style="background-color: #2e7d32; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Confirmar Receta</a>
        <h3 style="margin-top: 20px;">Detalles de la Aplicación:</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px; font-weight: bold;">Fecha Aplicación:</td><td style="padding: 8px;">${fechaAplicacion}</td></tr>
            <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">Asesor Técnico:</td><td style="padding: 8px;">${asesor}</td></tr>
            <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">Empresa Productora:</td><td style="padding: 8px;">${empresaProductora}</td></tr>
            <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">Empresa Aplicadora:</td><td style="padding: 8px;">${aplicadora}</td></tr>
            <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">Piloto:</td><td style="padding: 8px;">${piloto}</td></tr>
            <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">Predio:</td><td style="padding: 8px;">${predio}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Cultivo:</td><td style="padding: 8px;">${cultivo}</td></tr>
            <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">Superficie:</td><td style="padding: 8px;">${superficie} km²</td></tr>
            <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">Tipo de Máquina:</td><td style="padding: 8px;">${tipoMaquinaModelo}</td></tr>
        </table>
        ${mapaImagen ? `
            <h3>Croquis y Polígono de Lote:</h3>
            <div style="text-align: center; margin-bottom: 20px;">
                <img src="cid:mapa_poligono_cid" alt="Mapa del Polígono" style="border: 2px solid #ddd; border-radius: 4px; width: 100%; max-width: 500px;" />
            </div>
        ` : ''}
        <p style="font-size: 12px; color: #777; margin-top: 30px;">
            Este es un mensaje automático generado por el Sistema de Recetario Agronómico. Por favor, descargue el documento oficial en PDF adjunto en este mail.
        </p>
      </div>
    `;

    // Enviar el correo electrónico a los destinatarios
    const listaDestinatarios = [process.env.SMTP_USER];
    if (emailAsesor && emailAsesor.trim() !== '') listaDestinatarios.push(emailAsesor.trim());

    await sendMail({
      to: listaDestinatarios,
      subject: `⚠️ Receta Agronómica de Aplicación N° ${numeroRecetaStr} - Predio: ${predio}`,
      html: cuerpoHtml,
      attachments: correoAdjuntos
    });

    res.json({
      ok: true,
      mensaje: `Receta N° ${numeroRecetaStr} procesada y enviada por correo con éxito. Se envió a ${emailAsesor}.`
    });

  } catch (error) {
    console.error(error);
    res.status(500).send('Error al generar el PDF o enviar el mail');
  }
};

module.exports = { generarRecetaPdf };