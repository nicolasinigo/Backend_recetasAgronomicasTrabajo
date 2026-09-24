require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const recetaRoutes = require('./routers/recetaRouter');
const confirmacionRoutes = require('./routers/confirmacionRouter');
const recetaComercializadoraRoutes = require('./routers/recetaComercializadoraRouter');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' })); // 👈 IMPORTANTE: html2canvas genera un JSON pesado, subí el límite a 50mb

app.use(express.static(path.join(__dirname, 'public/dist'))); // Servimos archivos estáticos desde la carpeta 'public/dist'

app.use('/', recetaRoutes);
app.use('/', confirmacionRoutes);
app.use('/', recetaComercializadoraRoutes);
app.get(/^(?!\/generar-pdf).+/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API lista en el puerto ${PORT}`));