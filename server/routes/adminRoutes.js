const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');

// Todo el módulo de escritorio requiere autenticación y rol sysadmin o logistica
router.use(authMiddleware);
router.use(requireRole('sysadmin', 'logistica'));

// Dashboard de seguimiento
router.get('/dashboard', adminController.getDashboard);

// Seguimiento de Hojas de Ruta, Entregas, Devoluciones y Cajones
router.get('/hojas-ruta', adminController.getHojasRutaAdmin);
router.get('/hojas-ruta/:transaccionId', adminController.getHojaRutaDetalleAdmin);
router.get('/devoluciones', adminController.getDevolucionesAdmin);
router.get('/cajones', adminController.getCajonesAdmin);

// Gestión de usuarios y mapeo con ORGANIZACION (ERP)
router.get('/usuarios', adminController.getUsuarios);
router.get('/organizaciones', adminController.getOrganizaciones);
router.post('/usuarios', adminController.createUsuario);
router.put('/usuarios/:id', adminController.updateUsuario);
router.delete('/usuarios/:id', adminController.deleteUsuario);

// Auditoría completa (exclusivo sysadmin)
router.get('/auditoria', requireRole('sysadmin'), adminController.getAuditoria);

module.exports = router;
