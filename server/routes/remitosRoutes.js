const express = require('express');
const router = express.Router();
const remitosController = require('../controllers/remitosController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { upload } = require('../middlewares/uploadMiddleware');

// Todas las rutas de remitos requieren identificación de chofer
router.use(authMiddleware);

// Buscar remito por código de barras (TransaccionId o Comprobante)
router.get('/buscar', remitosController.buscarRemito);

// Obtener remitos de los últimos N viajes
router.get('/mis-remitos', remitosController.getMisRemitos);

// Listar hojas de ruta asignadas al chofer
router.get('/viajes', remitosController.getViajes);

// Guardar o actualizar control de firma de un remito
router.put('/:id/control', remitosController.saveControl);

// Subida de fotografía capturada por cámara del chofer
router.post('/upload-foto', upload.single('foto'), remitosController.uploadFoto);

// Sincronización de lote de controles generados offline
router.post('/sync-offline', remitosController.syncOffline);

module.exports = router;
