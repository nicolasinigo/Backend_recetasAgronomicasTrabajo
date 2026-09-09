const express = require('express');
const router = express.Router();
const { generarRecetaPdf } = require('../controllers/recetaController');

router.post('/generar-pdf', generarRecetaPdf);

module.exports = router;