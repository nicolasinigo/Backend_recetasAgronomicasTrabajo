const express = require('express');
const router = express.Router();
const { verificarCodigoOTP } = require('../../controllers/recuperarPassword/verificarCodigoOTP');

router.post('/verificarCodigoOTP', verificarCodigoOTP);

module.exports = router;