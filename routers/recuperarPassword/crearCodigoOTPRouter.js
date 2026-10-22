const express = require('express');
const router = express.Router();
const { crearPasswordCodigoOTP } = require('../../controllers/recuperarPassword/crearCodigoOPT');

router.post('/crearCodigoOTP', crearPasswordCodigoOTP);

module.exports = router;