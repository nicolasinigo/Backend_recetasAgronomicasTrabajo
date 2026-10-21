const express = require('express');
const router = express.Router();
const { generarCodigoOTP } = require('../controllers/codigoPasswordOTP');

router.put('/generarCodigoOTP/:id', generarCodigoOTP);

module.exports = router;