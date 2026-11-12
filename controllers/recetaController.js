const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');
const { guardarEnGoogleSheets } = require('./../googleSheets');
const { sendMail } = require('./../enviarEmail');
const pool = require('../config/db');

const generarRecetaPdf = async (req, res) => {
  try {
    // 1. Verificar que el usuario esté activo
    if (req.body.cuit1) {
      const cuitValidar = req.body.cuit1;
      const consultaUsuario = `SELECT estado FROM usuarios WHERE cuitUsuario = ?`;
      const [rows] = await pool.execute(consultaUsuario, [cuitValidar]);

      if (rows.length === 0) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      if (rows[0].estado === "Inactivo") {
        return res.status(403).json({ message: "Usuario Inactivo, por favor comunicarse con administración" });
      }
    }

    // 2. Extraer TODOS los datos de req.body una sola vez
    const {
      asesorApellido,
      asesorNombres,
      cuit1,
      NRegistro,
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
      matricula,
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
      mailEmpresa,
      mapaImagen
    } = req.body;

    // Calculamos las fechas una sola vez para usarlas en la BD, el PDF y el Mail
    const fechaCreacion = new Date();
    const fechaVencimiento = new Date(fechaCreacion.getTime() + 7 * 24 * 60 * 60 * 1000);

    // 3. Declaramos idReceta AFUERA del try para que sea accesible en toda la función
    let idReceta;

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const consultaIdUsuario = `SELECT id FROM usuarios WHERE cuitUsuario = ?`;
      const [rows] = await connection.execute(consultaIdUsuario, [cuit1]);

      if (rows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      const idUsuario = rows[0].id;

      const consultaInsertarReceta = `
        INSERT INTO recetas_aplicacion (
            usuario_id, empresa_productora, cuit_productor, aplicadora, categoria_aplicadora, cuit_aplicadora, 
            piloto_apellido, piloto_nombres, cuit_piloto, tipo_maquina, modelo, matricula, domicilio, predio, latitud, 
            longitud, superficie, cultivo, diagnostico, recomendacion, mail_empresa, mapa_imagen, 
            fecha_vencimiento, estado_receta
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente')
      `;

      const [result] = await connection.execute(consultaInsertarReceta, [
        idUsuario,
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
        matricula,
        domicilio,
        predio,
        latitud,
        longitud,
        superficie,
        cultivo,
        diagnostico,
        recomendacion,
        mailEmpresa,
        mapaImagen,
        fechaVencimiento
      ]);

      // Asignamos el valor a la variable declarada arriba
      idReceta = result.insertId;

      if (agroquimicos && Array.isArray(agroquimicos)) {
        const consultaInsertarAgroquimico = `
          INSERT INTO agroquimicos_aplicacion (receta_id, principio_activo, nombre_comercial, dosis, cantidad_total)
          VALUES (?, ?, ?, ?, ?)
        `;

        for (const agro of agroquimicos) {
          await connection.execute(consultaInsertarAgroquimico, [
            idReceta,
            agro.principioActivo,
            agro.nomencComercial,
            agro.dosis,
            agro.cantidadTotal
          ]);
        }
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      console.error("Error al insertar la receta y los agroquímicos:", error);
      return res.status(500).json({ message: "Error al procesar la receta en la base de datos" });
    } finally {
      // Liberar conexión al pool (no usar .end())
      if (connection) connection.release();
    }

    // 4. Guardar en Google Sheets usando idReceta
    try {
      await guardarEnGoogleSheets(req.body, idReceta, fechaCreacion, fechaVencimiento);
    } catch (error) {
      console.error("Error al guardar en Google Sheets:", error);
    }

    // 5. Generar el PDF usando idReceta
    const plantillaBytes = fs.readFileSync('receta_agronomica.pdf');
    const pdfDoc = await PDFDocument.load(plantillaBytes);
    const page = pdfDoc.getPage(0);

    const asesor = `${asesorApellido || ""} ${asesorNombres || ""}`.trim();
    const piloto = `${pilotoApellido || ""} ${pilotoNombres || ""}`.trim();
    const tipoMaquinaModelo = `${tipoMaquina || ""}-${modelo || ""}`.trim();
    const gps = `Lat: ${latitud || ""}, Lon: ${longitud || ""}`.trim();

    const fechaAplicacion = `${fechaCreacion.getDate().toString().padStart(2, '0')}/${(fechaCreacion.getMonth() + 1).toString().padStart(2, '0')} - ${fechaVencimiento.getDate().toString().padStart(2, '0')}/${(fechaVencimiento.getMonth() + 1).toString().padStart(2, '0')}/${fechaVencimiento.getFullYear()}`;

    page.drawText(String(fechaAplicacion || ""), { x: 450, y: 709, size: 12 });
    page.drawText(String(idReceta || ""), { x: 500, y: 659, size: 12 });
    page.drawText(String(asesor || ""), { x: 100, y: 634, size: 12 });
    page.drawText(String(NRegistro || ""), { x: 403, y: 634, size: 12 });
    page.drawText(String(empresaProductora || ""), { x: 130, y: 609, size: 12 });
    page.drawText(String(cuit2 || ""), { x: 403, y: 609, size: 12 });
    page.drawText(String(aplicadora || ""), { x: 85, y: 584, size: 12 });
    page.drawText(String(cuit3 || ""), { x: 403, y: 584, size: 12 });
    page.drawText(String(categoriaAplicadora || ""), { x: 80, y: 559, size: 12 });
    page.drawText(String(piloto || ""), { x: 110, y: 535, size: 12 });
    page.drawText(String(cuit4 || ""), { x: 403, y: 535, size: 12 });
    page.drawText(String(tipoMaquinaModelo || ""), { x: 120, y: 509, size: 12 });
    page.drawText(String(matricula || ""), { x: 403, y: 509, size: 12 });
    page.drawText(String(domicilio || ""), { x: 74, y: 484, size: 12 });
    page.drawText(String(predio || ""), { x: 175, y: 460, size: 12 });
    page.drawText(String(gps || ""), { x: 403, y: 459, size: 12 });
    page.drawText(String(superficie || "") + " km²", { x: 77, y: 435, size: 12 });
    page.drawText(String(cultivo || ""), { x: 100, y: 410, size: 12 });
    page.drawText(String(diagnostico || ""), { x: 403, y: 409, size: 12 });
    page.drawText(String(recomendacion || ""), { x: 158, y: 178, size: 12 });
    page.drawText(String(asesor || ""), { x: 420, y: 120, size: 12 });
    page.drawText(String(cuit1 || ""), { x: 420, y: 105, size: 12 });

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

    // 6. Enviar el correo electrónico usando idReceta
    const correoAdjuntos = [
      {
        filename: `Receta_Agronomica_${idReceta}.pdf`,
        content: Buffer.from(pdfResultadoBytes),
        contentType: 'application/pdf'
      }
    ];

    if (mapaImagen) {
      const base64PureData = mapaImagen.split(';base64,').pop();
      correoAdjuntos.push({
        filename: `Poligono_Receta_${idReceta}.png`,
        content: base64PureData,
        encoding: 'base64',
        cid: 'mapa_poligono_cid'
      });
    }

    // 7. link de confirmación para el correo
    const linkConfirmacion = `http://${process.env.FRONTEND_URL_PRODUCCION}/receta/${idReceta}`;
    //link de prueba: http://localhost:5173/receta/${idReceta}
    //const linkConfirmacion = `http://localhost:5173/receta/${idReceta}`;

    const cuerpoHtml = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
        <h2 style="color: #2e7d32;">Receta Agronómica de Aplicación N° ${idReceta}</h2>
        <p>Estimado/a, se adjunta la receta formal correspondiente a la aplicación planificada. </p>
        <p>Por favor, para confirmar la receta, una vez realizada la aplicación, haga clic en el siguiente enlace:</p>
        <a href="${linkConfirmacion}" style="background-color: #2e7d32; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Confirmar Receta</a>
        <h3 style="margin-top: 20px;">Detalles de la Aplicación:</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">Rango de Fechas para realizar la aplicación:</td><td style="padding: 8px;">${fechaAplicacion}</td></tr>
            <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">Asesor Técnico:</td><td style="padding: 8px;">${asesor}</td></tr>
            <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">N° de Registro del Asesor:</td><td style="padding: 8px;">${NRegistro}</td></tr>
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

    const listaDestinatarios = [];
    if (emailAsesor && emailAsesor.trim() !== '') listaDestinatarios.push(emailAsesor.trim());
    if (mailEmpresa && mailEmpresa.trim() !== '') listaDestinatarios.push(mailEmpresa.trim());

    await sendMail({
      to: listaDestinatarios,
      subject: `⚠️ Receta Agronómica de Aplicación N° ${idReceta} - Predio: ${predio}`,
      html: cuerpoHtml,
      attachments: correoAdjuntos
    });

    res.json({
      ok: true,
      mensaje: `Receta N° ${idReceta} procesada y enviada por correo con éxito. Se envió a ${emailAsesor} y ${mailEmpresa}.`
    });

  } catch (error) {
    console.error(error);
    res.status(500).send('Error al generar el PDF o enviar el mail');
  }
};

module.exports = { generarRecetaPdf };