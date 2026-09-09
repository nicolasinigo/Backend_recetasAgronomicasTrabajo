const express = require('express');
const router = express.Router();
const { confirmarReceta } = require('../controllers/confirmacionController');

router.get('/confirmarReceta/:id', confirmarReceta);

module.exports = router;