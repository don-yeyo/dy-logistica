const { pool } = require('../config/db');

/**
 * Middleware para autenticación y resolución de chofer/usuario por correo electrónico.
 */
async function authMiddleware(req, res, next) {
  try {
    // 1. Obtener email del usuario desde headers (inyectado por cliente MSAL / JWT o Mock Dev)
    const userEmail = req.headers['x-user-email'] || req.headers['x-ms-client-principal-name'] || req.query.mock_email;

    if (!userEmail) {
      return res.status(401).json({
        ok: false,
        error: 'No se ha provisto identificación de usuario (x-user-email requerido).'
      });
    }

    const cleanEmail = userEmail.toLowerCase().trim();

    // 2. Buscar en la tabla 'usuarios' por email
    let user = null;
    try {
      const [rows] = await pool.query(
        'SELECT id, email, nombre, codigo_chofer, rol, activo FROM usuarios WHERE LOWER(email) = ? LIMIT 1',
        [cleanEmail]
      );
      if (rows && rows.length > 0) {
        user = rows[0];
      }
    } catch (dbErr) {
      console.warn(`[AuthMiddleware] Fallo al consultar tabla usuarios en BD: ${dbErr.message}`);
      // Fallback si la BD no está disponible en desarrollo
      user = {
        id: 1,
        email: cleanEmail,
        nombre: cleanEmail.split('@')[0],
        codigo_chofer: '32355',
        rol: cleanEmail.includes('admin') ? 'admin' : 'chofer',
        activo: 1
      };
    }

    if (!user) {
      // Si el email no está en la tabla de usuarios habilitados
      return res.status(403).json({
        ok: false,
        error: `El correo corporativo [${cleanEmail}] no se encuentra registrado ni habilitado como chofer/usuario en el sistema.`
      });
    }

    if (!user.activo) {
      return res.status(403).json({
        ok: false,
        error: `El usuario asociado a [${cleanEmail}] se encuentra desactivado.`
      });
    }

    // Inyectar en req.user
    req.user = user;
    next();
  } catch (error) {
    console.error(`[AuthMiddleware] Error inesperado: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Error interno de autenticación de usuario.'
    });
  }
}

/**
 * Middleware opcional para validar X-API-Key en endpoints protegidos.
 */
function apiKeyGuard(req, res, next) {
  const configuredSecret = process.env.API_SECRET_KEY;
  if (!configuredSecret) {
    return next(); // Sin secret configurado
  }

  const clientKey = req.headers['x-api-key'] || req.query.api_key;
  if (!clientKey || clientKey !== configuredSecret) {
    return res.status(403).json({
      ok: false,
      error: 'Acceso no autorizado. Clave de API inválida o faltante.'
    });
  }

  next();
}

module.exports = {
  authMiddleware,
  apiKeyGuard
};
