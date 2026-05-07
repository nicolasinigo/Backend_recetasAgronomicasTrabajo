const { google } = require("googleapis");

const auth = new google.auth.GoogleAuth({
    keyFile: "credenciales.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

async function guardarEnGoogleSheets(datos) {

    const client = await auth.getClient();

    const googleSheets = google.sheets({
        version: "v4",
        auth: client
    });

    // ID DEL GOOGLE SHEET
    const spreadsheetId = "1-B3ekbt83Sal1VvsTeIX-zBVrhoYK9l8DVxD2NFbgBg";

    // Número automático de receta
    const numeroReceta = `REC-${Date.now()}`;

    await googleSheets.spreadsheets.values.append({

        spreadsheetId,

        // nombre de la hoja
        range: "Registro!A:G",

        valueInputOption: "USER_ENTERED",

        resource: {
            values: [[

                // Fecha
                new Date().toLocaleString(),

                // Asesor
                "Nicolas Iñigo",

                // Comercio
                datos.comercioFitosanitario,

                // CUIT comercio
                datos.cuit1,

                // Adquiriente
                datos.adquiriente,

                // CUIT adquiriente
                datos.cuit2,

                // Número receta
                "1"
            ]]
        }

    });

    return numeroReceta;
}

module.exports = guardarEnGoogleSheets;