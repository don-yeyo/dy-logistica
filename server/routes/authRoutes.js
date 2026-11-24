const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middlewares/authMiddleware');

// Obtener datos del usuario autenticado (Microsoft SSO)
router.get('/me', authMiddleware, authController.getMe);

// Listar usuarios activos (solo para selector en modo desarrollo VITE_MOCK_AUTH)
router.get('/users', authController.listUsers);

module.exports = router;
