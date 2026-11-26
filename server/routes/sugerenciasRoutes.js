const express = require('express');
const router = express.Router();
const sugerenciasController = require('../controllers/sugerenciasController');
const { authMiddleware } = require('../middlewares/authMiddleware');

// Cualquier usuario autenticado (chofer, logistica, sysadmin) puede enviar sugerencias
router.use(authMiddleware);

router.post('/', sugerenciasController.crearSugerencia);

module.exports = router;
