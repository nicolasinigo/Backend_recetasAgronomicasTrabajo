const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');
const { guardarEnGoogleSheetsComercializadora } = require('./../googleSheets');
const { sendMail } = require('./../enviarEmail'); // Tu servicio de correo
const pool = require('../config/db');

const generarRecetaComercializadoraPdf = async (req, res) => {
  try {

    if (req.body.cuitUsuario) {

      const cuitValidar = req.body.cuitUsuario;
      const consultaUsuario = `SELECT estado FROM usuarios WHERE cuitUsuario = ?`;

      // 1. mysql2 devuelve un array: [filas, campos]
      const [rows] = await pool.execute(consultaUsuario, [cuitValidar]);

      // 2. Verificamos si el usuario existe antes de leer su estado
      if (rows.length === 0) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      // 3. Tomamos la primera fila
      const usuario = rows[0];

      // 4. Validamos el estado correctamente
      if (usuario.estado === "Inactivo") {
        return res.status(403).json({ message: "Usuario Inactivo, por favor comunicarse con administración" }); // *Sugerencia: 403 Forbidden o 401 suele ser mejor que 500 para este caso*
      }
    }
    
    // Validar que los campos obligatorios estén presentes
    const camposObligatorios = [
      'cuitUsuario', 'nombreUsuario', 'apellidoUsuario', 'NRegistro',
      'comercioFitosanitario', 'adquiriente', 'cuit1', 'cuit2', 'domicilio',
      'predio', 'superficie', 'cultivo', 'diagnostico', 'recomendacion',
      'agroquimicos', 'email', 'mailEmpresa'
    ];

    for (const campo of camposObligatorios) {
      if (!req.body[campo]) {
        return res.status(400).json({ message: `El campo ${campo} es obligatorio.` });
      }
    }

    // Validar que 'agroquimicos' sea un array
    if (!Array.isArray(req.body.agroquimicos)) {
      return res.status(400).json({ message: "El campo 'agroquimicos' debe ser un array." });
    }

    //optenemos conexion del pool para realizar las transacciones
    const connection = await pool.getConnection();

    try {
      // Iniciamos la transacción
      await connection.beginTransaction();

      //consulta para traer el id del usuario a partir del cuitUsuario
      const consultaUsuarioId = `SELECT id FROM usuarios WHERE cuitUsuario = ?`;
      const [resultadoUsuario] = await connection.execute(consultaUsuarioId, [req.body.cuitUsuario]);

      if (resultadoUsuario.length === 0) {
        throw new Error("Usuario no encontrado");
      }

      const usuarioId = resultadoUsuario[0].id;

      const { comercioFitosanitario,cuit1, adquiriente, cuit2, domicilio, predio, superficie, cultivo, cultivoOtro, diagnostico, recomendacion, mailEmpresa,agroquimicos } = req.body;

      //si cultivo viene vacio, utilizo cultivoOtro
      const cultivoElegido = cultivo || cultivoOtro;

      const consultaInsertReceta = `
        INSERT INTO recetas_comercializadoras (
        usuario_id, 
        comercio_fitosanitario,
        cuit_comercio,
        adquiriente,
        cuit_adquiriente,
        domicilio,
        predio,
        superficie,
        cultivo,
        diagnostico,
        recomendacion,
        mail_empresa
        )
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      `;

      const [resultadoReceta] = await connection.execute(consultaInsertReceta, [
        usuarioId, comercioFitosanitario, cuit1, adquiriente, cuit2, domicilio, predio, superficie, cultivoElegido, diagnostico, recomendacion, mailEmpresa
      ]);

      const recetaId = resultadoReceta.insertId;

      // Insertar los agroquímicos asociados a la receta
      const consultaInsertAgroquimico = `
        INSERT INTO agroquimicos (receta_id, principio_activo, nombre_comercial, dosis, cantidad_total)
        VALUES (?, ?, ?, ?, ?)
      `;

      for (const agro of agroquimicos) {
        await connection.execute(consultaInsertAgroquimico, [
          recetaId, agro.principioActivo, agro.nomencComercial, agro.dosis, agro.cantidadTotal
        ]);
      }

      // Confirmamos la transacción
      await connection.commit();
    } catch (error) {
      // Si ocurre un error, revertimos la transacción
      await connection.rollback();
      throw error; // Re-lanzamos el error para que sea manejado en el bloque externo
    } finally {
      // Liberamos la conexión
      connection.release();
    }

    // Guardar los datos en Google Sheets y obtener el número de receta
    const numeroReceta = await guardarEnGoogleSheetsComercializadora(req.body);
    const numeroRecetaStr = numeroReceta.toString();

    // Generar el PDF con los datos del formulario
    const {
      cuitUsuario,
      nombreUsuario,
      apellidoUsuario,
      NRegistro,
      comercioFitosanitario,
      adquiriente,
      cuit1,
      cuit2,
      domicilio,
      predio,
      superficie,
      cultivo,
      cultivoOtro,
      diagnostico,
      recomendacion,
      agroquimicos,
      email,
      mailEmpresa
    } = req.body;

    //si cultivo viene vacio, utilizo cultivoOtro
    const cultivoElegido = cultivo || cultivoOtro;

    // Cargar la plantilla PDF
    const plantillaBytes = fs.readFileSync('receta_agronomica_comercializadora.pdf');
    const pdfDoc = await PDFDocument.load(plantillaBytes);
    const page = pdfDoc.getPage(0);

    const asesor = `${nombreUsuario || ""} ${apellidoUsuario || ""}`.trim();

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
    page.drawText(String(cultivoElegido || ""), { x: 101, y: 509, size: 12 });
    page.drawText(String(diagnostico || ""), { x: 84, y: 484, size: 12 });
    page.drawText(String(recomendacion || ""), { x: 159, y: 252, size: 12 });
    page.drawText(String(asesor || ""), { x: 420, y: 145, size: 12 });
    page.drawText(String(cuitUsuario || ""), { x: 420, y: 130, size: 12 });

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
            <tr><td style="padding: 8px; font-weight: bold;">Cultivo:</td><td style="padding: 8px;">${cultivoElegido}</td></tr>
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
    if (mailEmpresa && mailEmpresa.trim() !== '') listaDestinatarios.push(mailEmpresa.trim());

    await sendMail({
      to: listaDestinatarios,
      subject: `⚠️ Receta Agronómica de Comercialización N° ${numeroRecetaStr} - Predio: ${predio}`,
      html: cuerpoHtml,
      attachments: correoAdjuntos
    });

    res.json({
      ok: true,
      mensaje: `Receta N° ${numeroRecetaStr} procesada y enviada por correo con éxito. Se envió a ${email} y ${mailEmpresa}.`
    });

  } catch (error) {
    console.error(error);
    res.status(500).send('Error al generar el PDF o enviar el mail');
  }
};

module.exports = { generarRecetaComercializadoraPdf };