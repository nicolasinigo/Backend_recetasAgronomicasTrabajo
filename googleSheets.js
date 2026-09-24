const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },


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
                new Date(datos.fechaAplicacion).toLocaleDateString(),

                // Apellido + Nombres del asesor
                `${datos.asesorApellido} ${datos.asesorNombres}`,

                // Email asesor
                datos.emailAsesor,

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

                // Piloto (Apellido + Nombres)
                `${datos.pilotoApellido} ${datos.pilotoNombres}`,

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

                //Latitud
                datos.latitud,

                //Longitud
                datos.longitud,

                //superficie
                datos.superficie,

                //polígono del campo
                JSON.stringify(datos.poligono),

                //cultivo a tratar
                datos.cultivo,

                //diagnóstico
                datos.diagnostico,

                // Número receta
                numeroReceta,

                //Estado
                "Pendiente",

                // Fecha límite = fecha de aplicación + 2 días    
                new Date(new Date(datos.fechaAplicacion).getTime() +  2 * 24 * 60 * 60 * 1000).toLocaleDateString()         
            ]]
        }

    });

    return numeroReceta;
}

const auth2 = new google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },


    scopes: ["https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive"
    ]
});

async function guardarEnGoogleSheetsComercializadora(datos) {

    const client = await auth2.getClient();

    // Instancia de Google Sheets
    const googleSheets = google.sheets({
        version: "v4",
        auth: client
    });

    // ID DEL GOOGLE SHEET
    const spreadsheetId = "1W81OkykipJ3ZURlExHpGZIqGa7YnIDIrPYjBVenUiek";

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

                // comercio fitosanitario
                datos.comercioFitosanitario,

                // cuit comercio fitosanitario
                datos.cuit1,

                // adquiriente
                datos.adquiriente,

                // CUIT adquiriente
                datos.cuit2,

                //domicilio
                datos.domicilio,

                //localización del predio tratado
                datos.predio,

                //superficie
                datos.superficie,

                //cultivo a tratar
                datos.cultivo,

                //diagnóstico
                datos.diagnostico,

                // Número receta
                numeroReceta,
            ]]
        }

    });

    return numeroReceta;
}


module.exports = { guardarEnGoogleSheets, guardarEnGoogleSheetsComercializadora };