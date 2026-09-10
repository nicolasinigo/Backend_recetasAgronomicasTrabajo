const { google } = require('googleapis');

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

        if (!id) {
            return res.status(400).send("Falta el identificador de la receta.");
        }

        // Autenticación con Google Sheets
        const client = await auth.getClient();
        const googleSheets = google.sheets({
            version: "v4",
            auth: client
        });

        const spreadsheetId = "1-B3ekbt83Sal1VvsTeIX-zBVrhoYK9l8DVxD2NFbgBg";

        // Leer los datos de la hoja "Registro" para encontrar la fila correspondiente al ID de la receta
        const respuesta = await googleSheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Registro!W2:Y"
        });

        // Verificar si se encontraron filas en la hoja
        const filas = respuesta.data.values;
        if (!filas || filas.length === 0) {
            return res.status(404).send("No se encontraron registros en la hoja.");
        }

        let numeroFilaEncontrada = -1;
        let estadoActual = "";
        let fechaLimiteStr = "";

        // Buscar la fila correspondiente al ID de la receta
        for (let i = 0; i < filas.length; i++) {
            const idEnFila = filas[i][0];
            if (idEnFila === id) {
                numeroFilaEncontrada = i + 2;
                estadoActual = filas[i][1] || "";
                fechaLimiteStr = filas[i][2] || "";
                break;
            }
        }

        // Verificar si se encontró la fila correspondiente al ID de la receta
        if (numeroFilaEncontrada === -1) {
            return res.status(404).json({ ok: false, mensaje: "Receta no encontrada." });
        }

        // Verificar si la receta ya ha sido confirmada
        if (estadoActual === "Confirmada") {
            return res.json({ ok: true, yaConfirmada: true, mensaje: "Esta receta ya había sido confirmada anteriormente." });
        }

        // Verificar si la receta ha vencido
        if (estadoActual === "Vencida") {
            return res.json({ ok: false, vencida: true, mensaje: "Esta receta ya ha vencido y no puede ser confirmada. Tenias hasta " + fechaLimiteStr + "para confirmarla." });
        }

        // Verificar si la receta ha vencido
        if (fechaLimiteStr) {
            const fechaActual = new Date();
            const fechaLimite = new Date(fechaLimiteStr);
            console.log("Fecha actual:", fechaActual);
            console.log("Fecha límite:", fechaLimite);

            // Verificar si la fecha límite es válida
            if (fechaActual > fechaLimite) {
                await googleSheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `Registro!X${numeroFilaEncontrada}`,
                    valueInputOption: "USER_ENTERED",
                    resource: { values: [["Vencida"]] }
                });

                return res.json({
                    ok: false,
                    vencida: true,
                    mensaje: `El plazo de confirmación ha expirado. Tenías tiempo hasta el ${fechaLimiteStr}.`
                });
            }
        }

        // Actualizar el estado de la receta a "Confirmada" en la hoja de Google Sheets
        const celdaActualizar = `Registro!X${numeroFilaEncontrada}`;

        await googleSheets.spreadsheets.values.update({
            spreadsheetId,
            range: celdaActualizar,
            valueInputOption: "USER_ENTERED",
            resource: {
                values: [["Confirmada"]]
            }
        });

        return res.json({ ok: true, mensaje: "¡Aplicación confirmada con éxito!" });

    } catch (error) {
        console.error("Error al confirmar la receta:", error);
        return res.status(500).json({ ok: false, mensaje: "Hubo un error al procesar la confirmación." });
    }
};

module.exports = { confirmarReceta };