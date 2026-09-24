const express = require('express');
const router = express.Router();
const { generarRecetaComercializadoraPdf } = require('../controllers/recetaComercializadoraController');

router.post('/generar-pdf-comercializadora', generarRecetaComercializadoraPdf);

module.exports = router;