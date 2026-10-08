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

        if (!req.query.fechaAplicacion) {
            return res.status(400).json({
                ok: false,
                permiteReintentar: true, // <--- Agregado
                mensaje: "Falta la fecha de aplicación en la solicitud."
            });
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
            range: "Registro!V2:Y"
        });

        // Verificar si se encontraron filas en la hoja
        const filas = respuesta.data.values;
        if (!filas || filas.length === 0) {
            return res.status(404).json({ ok: false, mensaje: "No se encontraron recetas en la hoja de Google Sheets." });
        }

        let numeroFilaEncontrada = -1;
        let estadoActual = "";

        // Buscar la fila correspondiente al ID de la receta
        for (let i = 0; i < filas.length; i++) {
            const idEnFila = filas[i][0];
            if (idEnFila === id) {
                numeroFilaEncontrada = i + 2;
                rangoAplicacion = filas[i][1] || "";
                estadoActual = filas[i][2] || "";
                break;
            }
        }

        // Verificar si se encontró la fila correspondiente al ID de la receta
        if (numeroFilaEncontrada === -1) {
            return res.status(404).json({ ok: false, mensaje: "Receta no encontrada." });
        }

        // Verificar si la receta ya ha sido confirmada
        if (estadoActual === "Confirmada") {
            return res.status(400).json({
                ok: false,
                yaConfirmada: true,
                permiteReintentar: false, // <--- Agregado
                mensaje: "Esta receta ya había sido confirmada anteriormente."
            });
        }

        // Verificar si la receta ha vencido
        if (estadoActual === "Vencida") {
            return res.status(400).json({
                ok: false,
                vencida: true,
                permiteReintentar: false, // <--- Agregado
                mensaje: "Esta receta ya ha vencido y no puede ser confirmada."
            });
        }

        //el rangoAplicacion tiene el formato "dd/mm - dd/mm/yyyy", extraer la fecha limite
        const partesRango = rangoAplicacion.split(" - ");
        const fechaLimiteStr = partesRango[1]; // La fecha límite es el segundo elemento

        // Verificar si la receta ha vencido
        if (fechaLimiteStr) {
            const fechaActual = new Date();
            const partesFechaLimite = fechaLimiteStr.split("/");
            const fechaLimite = new Date(
                parseInt(partesFechaLimite[2], 10), // Año
                parseInt(partesFechaLimite[1], 10) - 1, // Mes (0-indexed)
                parseInt(partesFechaLimite[0], 10) // Día
            );

            //sumamos a la fecha limite 2 dias mas para que el usuario tenga un margen de tiempo para confirmar la receta
            const fechaLimiteConMargen = new Date(fechaLimite.getTime() + 2 * 24 * 60 * 60 * 1000);

            // Verificar si la fecha actual es mayor que la fecha límite con margen
            if (fechaActual > fechaLimiteConMargen) {
                await googleSheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `Registro!X${numeroFilaEncontrada}`,
                    valueInputOption: "USER_ENTERED",
                    resource: { values: [["Vencida"]] }
                });

                return res.status(400).json({
                    ok: false,
                    vencida: true,
                    permiteReintentar: false, // <--- Agregado
                    mensaje: `El plazo de confirmación ha expirado. Tenías tiempo hasta el ${fechaLimiteStr}.`
                });
            }
        }

        //verificacion de que la fecha de aplicacion sea menor q la fecha limite
        if (req.query.fechaAplicacion) {
            const fechaAplicacion = new Date(req.query.fechaAplicacion);
            const partesFechaLimite = fechaLimiteStr.split("/");
            const fechaLimite = new Date(
                parseInt(partesFechaLimite[2], 10),
                parseInt(partesFechaLimite[1], 10) - 1,
                parseInt(partesFechaLimite[0], 10)
            );

            if (fechaAplicacion > fechaLimite) {
                return res.status(400).json({
                    ok: false,
                    mensaje: `La fecha de aplicación (${req.query.fechaAplicacion}) no puede ser posterior a la fecha límite (${fechaLimiteStr}).`
                });
            }
        }

        // Actualizar el estado de la receta a "Confirmada", "fecha de aplicación" y "fecha de confirmacion(solo el dia, mes y año)" en la hoja de Google Sheets

        const diaActualSinHora = new Date();
        diaActualSinHora.setHours(0, 0, 0, 0);

        let fechaAplicacionFormateada = "";
        if (req.query.fechaAplicacion) {
            const [año, mes, dia] = req.query.fechaAplicacion.split("-");
            fechaAplicacionFormateada = `${dia}/${mes}/${año}`;
        }

        // Actualizar las columnas X, Y y Z de la fila correspondiente

        await googleSheets.spreadsheets.values.update({
            spreadsheetId,
            range: `Registro!X${numeroFilaEncontrada}:Z${numeroFilaEncontrada}`,
            valueInputOption: "USER_ENTERED",
            resource: { values: [["Confirmada", fechaAplicacionFormateada || "", diaActualSinHora.toLocaleDateString()]] }
        });

        return res.status(200).json({ ok: true, mensaje: "¡Aplicación confirmada con éxito!" });

    } catch (error) {
        console.error("Error al confirmar la receta:", error);
        return res.status(500).json({ ok: false, mensaje: "Hubo un error al procesar la confirmación." });
    }
};

module.exports = { confirmarReceta };