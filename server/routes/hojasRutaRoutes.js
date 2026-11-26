const express = require('express');
const router = express.Router();
const hojasRutaController = require('../controllers/hojasRutaController');
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');

// Todas las rutas operativas de la App Mobile son exclusivas del rol chofer
router.use(authMiddleware, requireRole('chofer'));

// Sección 4.2: Listado de hojas de ruta desde HOJAS_DE_RUTA_A_ENTREGAR filtrando EMail
router.get('/', hojasRutaController.getHojasDeRuta);

// Paso 2 del wizard: Listado de lugares de entrega únicos de la hoja de ruta
router.get('/:transaccionId/lugares', hojasRutaController.getLugaresByTransaccion);

// Sección 4.2.1: Confirmación de descarga (Entregas)
router.get('/:transaccionId/entregas', hojasRutaController.getEntregasByTransaccion);
router.put('/:transaccionId/entregas', hojasRutaController.guardarEntregas);

// Sección 4.2.2: Devolución de mercadería
router.get('/:transaccionId/devoluciones', hojasRutaController.getDevolucionesByTransaccion);
router.post('/:transaccionId/devoluciones', hojasRutaController.guardarDevoluciones);

// Sección 4.2.3: Entrega y devolución de cajones
router.get('/:transaccionId/cajones', hojasRutaController.getCajonesByTransaccion);
router.post('/:transaccionId/cajones', hojasRutaController.guardarCajones);

module.exports = router;
