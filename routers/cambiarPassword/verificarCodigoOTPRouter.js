const express = require('express');
const router = express.Router();
const {verificarCodigoOTP} = require('../../controllers/cambiarPasswordOTP/verificarCodigoOTP');

router.post('/verificarCodigoOTP/:id', verificarCodigoOTP);

module.exports = router;