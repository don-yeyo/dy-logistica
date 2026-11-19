const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middlewares/authMiddleware');

// Validar usuario y contraseña contra Microsoft Entra ID
router.post('/login', authController.loginWithCredentials);

// Obtener datos del chofer/usuario logueado
router.get('/me', authMiddleware, authController.getMe);

// Listar todos los usuarios habilitados (para selector dev / admin)
router.get('/users', authController.listUsers);

module.exports = router;
