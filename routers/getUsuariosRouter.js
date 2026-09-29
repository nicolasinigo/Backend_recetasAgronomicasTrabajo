const express = require('express');
const router = express.Router();
const { getUsuarios } = require('../controllers/getUsuarios')

router.get('/getUsuarios', getUsuarios)

module.exports = router