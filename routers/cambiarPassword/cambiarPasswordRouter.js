const express = require('express');
const router = express.Router();
const { cambiarPassword } = require('../../controllers/cambiarPasswordOTP/cambiarPassword');

router.put('/cambiarPassword', cambiarPassword);

module.exports = router;