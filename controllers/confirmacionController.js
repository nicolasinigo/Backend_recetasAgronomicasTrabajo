const { google } = require('googleapis');
const pool = require('../config/db'); // Importamos la conexión a MySQL

const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
    },
    scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive"
    ]
});

const confirmarReceta = async (req, res) => {
    try {
        const { id } = req.params;
        const { fechaAplicacion } = req.query;

        console.log(`Confirmando receta con ID: ${id} y fecha de aplicación: ${fechaAplicacion}`);

        // 1. Validaciones iniciales de parámetros
        if (!id) {
            return res.status(400).json({ ok: false, mensaje: "Falta el identificador de la receta." });
        }

        if (!fechaAplicacion) {
            return res.status(400).json({
                ok: false,
                permiteReintentar: true,
                mensaje: "Falta la fecha de aplicación en la solicitud."
            });
        }

        // 2. Buscar la receta en la base de datos (MySQL como fuente de verdad)
        const [rows] = await pool.execute(
            `SELECT id, fecha_creacion, fecha_vencimiento, estado_receta 
             FROM recetas_aplicacion 
             WHERE id = ? AND estado_registro = 'Activo'`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ ok: false, mensaje: "Receta no encontrada en la base de datos." });
        }

        const receta = rows[0];

        // 3. Verificar estado actual en la base de datos
        if (receta.estado_receta === "Confirmada") {
            return res.status(400).json({
                ok: false,
                yaConfirmada: true,
                permiteReintentar: false,
                mensaje: "Esta receta ya había sido confirmada anteriormente."
            });
        }

        if (receta.estado_receta === "Vencida") {
            return res.status(400).json({
                ok: false,
                vencida: true,
                permiteReintentar: false,
                mensaje: "Esta receta ya ha vencido y no puede ser confirmada."
            });
        }

        // 4. Validar plazos: 7 días para aplicar + 48 horas posteriores para informar
        const ahora = new Date();
        const fechaCreacion = new Date(receta.fecha_creacion);
        const fechaVencimiento = new Date(receta.fecha_vencimiento);

        // Sumamos 48 horas (2 días) de margen al vencimiento para poder informar
        const fechaLimiteConfirmacion = new Date(fechaVencimiento.getTime() + 48 * 60 * 60 * 1000);

        if (ahora > fechaLimiteConfirmacion) {
            // Marcar como Vencida en MySQL
            await pool.execute(
                `UPDATE recetas_aplicacion SET estado_receta = 'Vencida' WHERE id = ?`,
                [id]
            );

            // Intentar reflejar el vencimiento en Google Sheets (sin frenar la respuesta si falla)
            await actualizarGoogleSheets(id, "Vencida", "", "");

            const fechaVencStr = fechaVencimiento.toLocaleDateString('es-AR');
            return res.status(400).json({
                ok: false,
                vencida: true,
                permiteReintentar: false,
                mensaje: `El plazo de confirmación ha expirado. Tenías tiempo hasta el ${fechaVencStr} (más 48 hs de tolerancia).`
            });
        }

        // 5. Validar que la fecha elegida (YYYY-MM-DD) esté dentro del rango de 7 días
        const [anio, mes, dia] = fechaAplicacion.split("-").map(Number);
        const fechaAplicacionDate = new Date(anio, mes - 1, dia, 12, 0, 0); // Mediodía local para evitar desfases UTC

        const inicioRango = new Date(fechaCreacion);
        inicioRango.setHours(0, 0, 0, 0);

        const finRango = new Date(fechaVencimiento);
        finRango.setHours(23, 59, 59, 999);

        if (fechaAplicacionDate < inicioRango || fechaAplicacionDate > finRango) {
            return res.status(400).json({
                ok: false,
                permiteReintentar: true,
                mensaje: `La fecha de aplicación (${dia}/${mes}/${anio}) debe estar entre el ${inicioRango.toLocaleDateString('es-AR')} y el ${finRango.toLocaleDateString('es-AR')}.`
            });
        }

        // 6. Actualizar el registro en MySQL (Pendiente -> Confirmada)
        await pool.execute(
            `UPDATE recetas_aplicacion 
             SET fecha_aplicacion = ?, 
                 fecha_confirmacion = NOW(), 
                 estado_receta = 'Confirmada' 
             WHERE id = ?`,
            [fechaAplicacion, id]
        );

        // 7. Si MySQL salió bien, actualizar Google Sheets
        const fechaAplicacionFormateada = `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`;
        const fechaConfirmacionFormateada = ahora.toLocaleDateString('es-AR');

        await actualizarGoogleSheets(id, "Confirmada", fechaAplicacionFormateada, fechaConfirmacionFormateada);

        return res.status(200).json({
            ok: true,
            mensaje: "¡Aplicación confirmada y registrada con éxito!"
        });

    } catch (error) {
        console.error("Error al confirmar la receta:", error);
        return res.status(500).json({ ok: false, mensaje: "Hubo un error al procesar la confirmación." });
    }
};

// Función auxiliar aislada para actualizar Google Sheets sin comprometer la transacción principal
async function actualizarGoogleSheets(idReceta, nuevoEstado, fechaAplicacionStr, fechaConfirmacionStr) {
    try {
        const client = await auth.getClient();
        const googleSheets = google.sheets({ version: "v4", auth: client });
        const spreadsheetId = "1-B3ekbt83Sal1VvsTeIX-zBVrhoYK9l8DVxD2NFbgBg";

        const respuesta = await googleSheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Registro!W2:W" // Solo necesitamos leer la columna W donde está el ID
        });

        const filas = respuesta.data.values;
        if (!filas || filas.length === 0) return;

        let numeroFilaEncontrada = -1;
        for (let i = 0; i < filas.length; i++) {
            if (String(filas[i][0]).trim() === String(idReceta).trim()) {
                numeroFilaEncontrada = i + 2;
                break;
            }
        }

        if (numeroFilaEncontrada !== -1) {
            const valoresActualizar = nuevoEstado === "Vencida"
                ? [["Vencida"]]
                : [["Confirmada", fechaAplicacionStr, fechaConfirmacionStr]];

            const rangoActualizar = nuevoEstado === "Vencida"
                ? `Registro!X${numeroFilaEncontrada}`
                : `Registro!X${numeroFilaEncontrada}:Z${numeroFilaEncontrada}`;

            await googleSheets.spreadsheets.values.update({
                spreadsheetId,
                range: rangoActualizar,
                valueInputOption: "USER_ENTERED",
                resource: { values: valoresActualizar }
            });
        }
    } catch (sheetError) {
        // Logueamos el error pero no rompemos la respuesta al usuario porque MySQL ya guardó el dato
        console.error(`Error al sincronizar receta #${idReceta} en Google Sheets:`, sheetError);
    }
}

module.exports = { confirmarReceta };