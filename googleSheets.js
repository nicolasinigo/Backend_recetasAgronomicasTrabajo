const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

const auth = new google.auth.GoogleAuth({
    keyFile: "recetas-agronomicas-b92bce2e59f6.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive"
    ]
});

async function guardarEnGoogleSheets(datos) {

    const client = await auth.getClient();

    // Instancia de Google Sheets
    const googleSheets = google.sheets({
        version: "v4",
        auth: client
    });

    // ID DEL GOOGLE SHEET
    const spreadsheetId = "1-B3ekbt83Sal1VvsTeIX-zBVrhoYK9l8DVxD2NFbgBg";

    const respuesta = await googleSheets.spreadsheets.values.get({
        spreadsheetId,
        range: "cantidad de recetas!A2"
    });

    let numeroReceta = 1;
    if (respuesta.data.values && respuesta.data.values.length > 0) {
        numeroReceta = parseInt(respuesta.data.values[0][0]) + 1;
    }

    await googleSheets.spreadsheets.values.append({

        spreadsheetId,

        // nombre de la hoja
        range: "Registro!A:G",

        valueInputOption: "USER_ENTERED",

        resource: {
            values: [[

                // Fecha creación receta
                new Date().toLocaleString(),

                //fecha de aplicación
                datos.fechaAplicacion,

                // Asesor
                datos.asesor,

                // Cuit asesor
                datos.cuit1,

                // Comercio
                datos.empresaProductora,

                // CUIT comercio
                datos.cuit2,

                // Adquiriente
                datos.aplicadora,

                // Categoria Aplicadora
                datos.categoriaAplicadora,

                // CUIT adquiriente
                datos.cuit3,

                // Piloto
                datos.piloto,

                // CUIT piloto
                datos.cuit4,

                // Tipo de máquina
                datos.tipoMaquina,

                // Matrícula de la máquina
                datos.Matricula,

                //domicilio
                datos.domicilio,

                //localización del predio tratado
                datos.predio,

                //punto GPS
                datos.gps,

                //superficie
                datos.superficie,

                //polígono del campo
                JSON.stringify(datos.poligono),

                //cultivo a tratar
                datos.cultivo,

                //diagnóstico
                datos.diagnostico,

                // Número receta
                numeroReceta
            ]]
        }

    });

    return numeroReceta;
}


module.exports = { guardarEnGoogleSheets };