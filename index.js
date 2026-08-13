require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');
const app = express();
const { guardarEnGoogleSheets } = require('./googleSheets');
const { sendMail } = require('./enviarEmail'); // Tu servicio de correo
const path = require('path');
const axios = require('axios');

app.use(cors());
app.use(express.json({ limit: '50mb' })); // 👈 IMPORTANTE: html2canvas genera un JSON pesado, subí el límite a 50mb

app.use(express.static(path.join(__dirname, 'public/dist'))); // Servimos archivos estáticos desde la carpeta 'public/dist'

app.get(/^(?!\/generar-pdf).+/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/dist', 'index.html'));
});

app.post('/generar-pdf', async (req, res) => {

    try {
        const { captchaToken, ...datosFormulario } = req.body;

        // 1. Verificar que venga el token
        if (!captchaToken) {
            return res.status(400).json({
                ok: false,
                mensaje: "Captcha requerido"
            });
        }

        // 2. Consultar a Cloudflare
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

        // 3. Verificar respuesta
        if (!response.data.success) {
            return res.status(403).json({
                ok: false,
                mensaje: "Captcha inválido"
            });
        }

        try {

            const numeroReceta = await guardarEnGoogleSheets(req.body);
            const numeroRecetaStr = numeroReceta.toString();

            // Destructuramos también 'email' y 'mapaImagen' del cuerpo 👇
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
                emailEmpresa,       // 👈 Capturado
                emailAsesor,        // 👈 Capturado
                emailPiloto,        // 👈 Capturado
                mapaImagen   // 👈 Capturado (String Base64)
            } = req.body;

            // --- 1. Lógica del PDF (Se mantiene igual a tu código) ---
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
            agroquimicos.forEach((agro, index) => {
                const y = startY - (index * lineHeight);
                page.drawText(String(agro.principioActivo || ""), { x: 45, y, size: 12 });
                page.drawText(String(agro.nomencComercial || ""), { x: 221, y, size: 12 });
                page.drawText(String(agro.dosis || "") + " ml", { x: 414, y, size: 12 });
                page.drawText(String(agro.cantidadTotal || "") + " lt", { x: 499, y, size: 12 });
            });

            const pdfResultadoBytes = await pdfDoc.save();

            // Estructuramos los archivos adjuntos
            const correoAdjuntos = [
                {
                    filename: `Receta_Agronomica_${numeroRecetaStr}.pdf`,
                    content: Buffer.from(pdfResultadoBytes), // Adjuntamos los bytes del PDF directamente
                    contentType: 'application/pdf'
                }
            ];

            // Si el cliente nos mandó la foto del mapa, la procesamos para incrustarla
            if (mapaImagen) {
                // Limpiamos el prefijo "data:image/png;base64," del string
                const base64PureData = mapaImagen.split(';base64,').pop();

                correoAdjuntos.push({
                    filename: `Poligono_Receta_${numeroRecetaStr}.png`,
                    content: base64PureData,
                    encoding: 'base64',
                    cid: 'mapa_poligono_cid' // 👈 Este ID se usa en el <img src="cid:..."/>
                });
            }

            // Armamos el cuerpo del correo con formato HTML agradable
            const cuerpoHtml = `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
                <h2 style="color: #2e7d32;">Receta Agronómica de Aplicación N° ${numeroRecetaStr}</h2>
                <p>Estimado/a, se adjunta la receta formal correspondiente a la aplicación planificada.</p>
                
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
                        <!-- Invocamos la foto adjunta mediante su cid 👇 -->
                        <img src="cid:mapa_poligono_cid" alt="Mapa del Polígono" style="border: 2px solid #ddd; border-radius: 4px; width: 100%; max-width: 500px;" />
                    </div>
                ` : ''}

                <p style="font-size: 12px; color: #777; margin-top: 30px;">
                    Este es un mensaje automático generado por el Sistema de Recetario Agronómico. Por favor, descargue el documento oficial en PDF adjunto en este mail.
                </p>
            </div>
        `;

            // Enviamos el correo al mail provisto y el mail del .env al mismo tiempo (para que quede constancia en la bandeja de salida)
            // 1. Creamos un array que arranca con tu propio correo electrónico
            const listaDestinatarios = [process.env.SMTP_USER];

            // 2. Si el frontend nos pasó los mails de empresa, asesor y piloto, los agregamos a la lista, si no llego el mail del piloto, no lo agregamos
            if (emailEmpresa && emailEmpresa.trim() !== '') listaDestinatarios.push(emailEmpresa.trim());
            if (emailAsesor && emailAsesor.trim() !== '') listaDestinatarios.push(emailAsesor.trim());
            if (emailPiloto && emailPiloto.trim() !== '') listaDestinatarios.push(emailPiloto.trim());

            await sendMail({
                to: listaDestinatarios,
                subject: `⚠️ Receta Agronómica de Aplicación N° ${numeroRecetaStr} - Predio: ${predio}`,
                html: cuerpoHtml,
                attachments: correoAdjuntos // 👈 Enviamos el PDF y el mapa procesado
            });

            // Responder al Frontend con éxito
            res.json({
                ok: true,
                mensaje: `Receta N° ${numeroRecetaStr} procesada y enviada por correo con éxito.Se envió una copia a ${emailEmpresa}, ${emailAsesor} y ${emailPiloto}.`
            });

        } catch (error) {
            console.error(error);
            res.status(500).send('Error al generar el PDF o enviar el mail');
        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            mensaje: "Error interno"
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API lista en el puerto ${PORT}`));