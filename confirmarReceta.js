const express = require("express");
const app = express();
const { guardarEnGoogleSheets } = require("./googleSheets");
const path = require("path");
const fs = require("fs");
const { google } = require("googleapis");

const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },


    scopes: ["https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive"
    ]
});

app.get("/confirmarReceta/:id", async (req, res) => {
    console.log("Solicitud de confirmación recibida para la receta con ID:", req.params.id);
    try {
        const { id } = req.params;
        console.log("ID recibido para confirmar receta:", id);

        if (!id) {
            return res.status(400).send("Falta el identificador de la receta.");
        }

        const client = await auth.getClient();
        const googleSheets = google.sheets({
            version: "v4",
            auth: client
        });

        const spreadsheetId = "1-B3ekbt83Sal1VvsTeIX-zBVrhoYK9l8DVxD2NFbgBg";

        // Traemos W (ID) y opcionalmente podrías traer X (Estado) o Y (Fecha límite)
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
                numeroFilaEncontrada = i + 2; // Fila real en Google Sheets
                estadoActual = filas[i][1] || "";     // Columna X (Estado actual)
                fechaLimiteStr = filas[i][3] || "";   // Columna Y (Fecha límite)
                break;
            }
        }

        // Corrección aquí: evaluar si es -1
        if (numeroFilaEncontrada === -1) {
            return res.status(404).send("Receta no encontrada.");
        }

        // Verificar si ya fue confirmada antes
        if (estadoActual === "Confirmada") {
            return res.send("<h1>Esta receta ya había sido confirmada anteriormente.</h1>");
        }

        // Validación de las 48 horas (Fecha Límite)
        if (fechaLimiteStr) {
            const fechaActual = new Date();
            const fechaLimite = new Date(fechaLimiteStr);

            if (fechaActual > fechaLimite) {
                // Opcional: Actualizar el estado a "Vencida" si querés registrarlo
                await googleSheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `Registro!X${numeroFilaEncontrada}`,
                    valueInputOption: "USER_ENTERED",
                    resource: { values: [["Vencida"]] }
                });

                return res.send(`
                    <h1 style="color: red;">El plazo de confirmación ha expirado.</h1>
                    <p>Tenías tiempo para confirmar esta aplicación hasta el ${fechaLimiteStr}.</p>
                `);
            }
        }

        const celdaActualizar = `Registro!X${numeroFilaEncontrada}`;

        // Actualizar la celda con el valor "Confirmada"
        await googleSheets.spreadsheets.values.update({
            spreadsheetId,
            range: celdaActualizar,
            valueInputOption: "USER_ENTERED",
            resource: {
                values: [["Confirmada"]]
            }
        });

        return res.send("<h1>¡Aplicación confirmada con éxito!</h1>");

    } catch (error) {
        console.error("Error al confirmar la receta:", error);
        return res.status(500).send("Hubo un error al procesar la confirmación.");
    }
});