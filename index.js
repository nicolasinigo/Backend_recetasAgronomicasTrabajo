const express = require('express');
const cors = require('cors');
const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');
const app = express();
const path = require('path');


app.use(cors());
app.use(express.json());

//Crear carpeta 'public' si no existe y servirla de forma estática
const publicPath = path.join(__dirname, 'public');
if (!fs.existsSync(publicPath)) fs.mkdirSync(publicPath);
app.use('/descargas', express.static(publicPath));

// Para poder leer el cuerpo del JSON 
app.post('/generar-pdf', async (req, res) => {
    try {
        const {
            comercioFitosanitario,
            cuit1,
            adquiriente,
            cuit2,
            domicilio,
            predio,
            superficie,
            cultivo,
            diagnostico,
            tratamiento,
            recomendacion,
            agroquimicos
        } = req.body;

        console.log('Agroquímicos recibidos:', agroquimicos);

        // 1. leer la plantilla pdf receta_agronomica.pdf 
        const plantillaBytes = fs.readFileSync('receta_agronomica.pdf');
        const pdfDoc = await PDFDocument.load(plantillaBytes);
        const page = pdfDoc.getPage(0);

        // 2. Llenar el PDF con los datos recibidos 
        //page.drawText(numeroReceta, { x: 500, y: 659, size: 12, bold: true, color: rgb(0, 0, 0) });
        page.drawText(comercioFitosanitario, { x: 140, y: 634, size: 12, bold: true, color: rgb(0, 0, 0) });
        page.drawText(cuit1, { x: 403, y: 634, size: 12, bold: true, color: rgb(0, 0, 0) });
        page.drawText(adquiriente, { x: 90, y: 609, size: 12, bold: true, color: rgb(0, 0, 0) });
        page.drawText(cuit2, { x: 403, y: 609, size: 12, bold: true, color: rgb(0, 0, 0) });
        page.drawText(domicilio, { x: 75, y: 585, size: 12, bold: true, color: rgb(0, 0, 0) });
        page.drawText(predio, { x: 176, y: 559, size: 12, bold: true, color: rgb(0, 0, 0) });
        page.drawText(superficie, { x: 77, y: 534, size: 12, bold: true, color: rgb(0, 0, 0) });
        page.drawText(cultivo, { x: 100, y: 510, size: 12, bold: true, color: rgb(0, 0, 0) });
        page.drawText(diagnostico, { x: 84, y: 484, size: 12, bold: true, color: rgb(0, 0, 0) });
        page.drawText(tratamiento, { x: 86, y: 459, size: 12, bold: true, color: rgb(0, 0, 0) });
        page.drawText(recomendacion, { x: 158, y: 252, size: 12, bold: true, color: rgb(0, 0, 0) });

        // Coordenadas base (ajustalas según tu PDF)
        let startY = 400; // altura inicial
        const lineHeight = 15;

        // recorrer agroquímicos
        agroquimicos.forEach((agro, index) => {

            const y = startY - (index * lineHeight);

            page.drawText(agro.principioActivo || "", {
                x: 45,
                y,
                size: 12
            });

            page.drawText(agro.nomencComercial || "", {
                x: 221,
                y,
                size: 12
            });

            page.drawText(agro.dosis || "", {
                x: 414,
                y,
                size: 12
            });

            page.drawText(agro.cantidadTotal || "", {
                x: 499,
                y,
                size: 12
            });

        });

        const pdfResultadoBytes = await pdfDoc.save();

        // 3. Guardar el PDF generado en la carpeta 'public' con un nombre único
        const nombreArchivo = `receta_${comercioFitosanitario}_${Date.now()}.pdf`;
        const rutaArchivo = path.join(publicPath, nombreArchivo);

        fs.writeFileSync(rutaArchivo, pdfResultadoBytes);
        // 4. Devolver la URL de descarga del PDF generado
        const urlDescarga = `http://localhost:3000/descargas/${nombreArchivo}`;

        res.json({
            url: urlDescarga,
            nombre: nombreArchivo
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('Error al generar el PDF');
    }
});

app.listen(3000, () => console.log('API lista en http://localhost:3000'));

