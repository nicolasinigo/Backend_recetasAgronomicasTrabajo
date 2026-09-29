const express = require('express');
const router = express.Router();
const { updateUsuarios } = require('../controllers/updateUsuariosController')

router.put('/updateUsuarios/:id', updateUsuarios)

module.exports = router