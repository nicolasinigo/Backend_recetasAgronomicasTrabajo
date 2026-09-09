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

        const client = await auth.getClient();
        const googleSheets = google.sheets({
            version: "v4",
            auth: client
        });

        const spreadsheetId = "1-B3ekbt83Sal1VvsTeIX-zBVrhoYK9l8DVxD2NFbgBg";

        const respuesta = await googleSheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Registro!W2:Y"
        });

        const filas = respuesta.data.values;
        if (!filas || filas.length === 0) {
            return res.status(404).send("No se encontraron registros en la hoja.");
        }

        let numeroFilaEncontrada = -1;
        let estadoActual = "";
        let fechaLimiteStr = "";

        for (let i = 0; i < filas.length; i++) {
            const idEnFila = filas[i][0];
            if (idEnFila === id) {
                numeroFilaEncontrada = i + 2;
                estadoActual = filas[i][1] || "";
                fechaLimiteStr = filas[i][3] || "";
                break;
            }
        }

        if (numeroFilaEncontrada === -1) {
            return res.status(404).json({ ok: false, mensaje: "Receta no encontrada." });
        }

        if (estadoActual === "Confirmada") {
            return res.json({ ok: true, yaConfirmada: true, mensaje: "Esta receta ya había sido confirmada anteriormente." });
        }

        if (fechaLimiteStr) {
            const fechaActual = new Date();
            const fechaLimite = new Date(fechaLimiteStr);

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