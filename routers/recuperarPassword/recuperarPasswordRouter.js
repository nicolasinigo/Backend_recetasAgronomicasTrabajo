const express = require('express');
const router = express.Router();
const { recuperarPassword } = require('../../controllers/recuperarPassword/recuperarPassword');

router.post('/recuperarPassword', recuperarPassword);

module.exports = router;