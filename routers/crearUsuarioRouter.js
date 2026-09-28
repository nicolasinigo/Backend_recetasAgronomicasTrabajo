const express = require('express');
const router = express.Router();
const { crearUsuario } = require('../controllers/crearUsuarioController');

router.post('/crearUsuario', crearUsuario);

module.exports = router;