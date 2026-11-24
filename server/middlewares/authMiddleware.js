const { pool } = require('../config/db');

/**
 * Resuelve el usuario autenticado exclusivamente en Gestion_Logistica.APP_USUARIOS
 * (y opcionalmente en ORGANIZACION si existe un registro con ese EMail).
 */
async function resolveUserByEmail(cleanEmail) {
  let user = null;

  try {
    const [rows] = await pool.query(
      `SELECT
         u.id,
         u.email,
         u.nombre,
         u.rol,
         u.organizacion_id,
         u.codigo_chofer,
         u.activo,
         org.Nombre AS organizacion_nombre,
         org.Codigo AS organizacion_codigo
       FROM APP_USUARIOS u
       LEFT JOIN ORGANIZACION org ON org.Organizacionid = u.organizacion_id
       WHERE LOWER(u.email) = ?
       LIMIT 1`,
      [cleanEmail]
    );

    if (rows && rows.length > 0) {
      user = rows[0];
    }
  } catch (dbErr) {
    console.warn(`[AuthMiddleware] Error al consultar APP_USUARIOS: ${dbErr.message}`);
  }

  // Respaldo: si el email existe en ORGANIZACION.EMail pero aún no fue dado de alta en APP_USUARIOS
  if (!user) {
    try {
      const [orgRows] = await pool.query(
        `SELECT Organizacionid, Codigo, Nombre, EMail, Activo
         FROM ORGANIZACION
         WHERE LOWER(EMail) = ?
         LIMIT 1`,
        [cleanEmail]
      );
      if (orgRows && orgRows.length > 0) {
        const org = orgRows[0];
        const isActive = org.Activo === null || org.Activo === undefined || org.Activo === 1 || String(org.Activo) === '1';
        user = {
          id: org.Organizacionid,
          email: org.EMail || cleanEmail,
          nombre: org.Nombre || cleanEmail.split('@')[0],
          rol: 'chofer',
          organizacion_id: org.Organizacionid,
          codigo_chofer: org.Codigo || String(org.Organizacionid),
          organizacion_nombre: org.Nombre,
          organizacion_codigo: org.Codigo,
          activo: isActive ? 1 : 0
        };
      }
    } catch (orgErr) {
      console.warn(`[AuthMiddleware] Error al consultar ORGANIZACION: ${orgErr.message}`);
    }
  }

  return user;
}

/**
 * Middleware de autenticación por correo corporativo (SSO Entra ID).
 */
async function authMiddleware(req, res, next) {
  try {
    const userEmail = req.headers['x-user-email'] || req.headers['x-ms-client-principal-name'] || req.query.mock_email;

    if (!userEmail) {
      return res.status(401).json({
        ok: false,
        error: 'No se ha provisto identificación de usuario (x-user-email requerido).'
      });
    }

    const cleanEmail = userEmail.toLowerCase().trim();
    const user = await resolveUserByEmail(cleanEmail);

    if (!user) {
      return res.status(403).json({
        ok: false,
        error: `El correo corporativo [${cleanEmail}] no se encuentra habilitado en el sistema. Solicite el alta a SysAdmin o Logística.`
      });
    }

    if (!user.activo) {
      return res.status(403).json({
        ok: false,
        error: `El usuario asociado a [${cleanEmail}] se encuentra desactivado.`
      });
    }

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
 * Guard RBAC por rol: verifica que req.user.rol esté incluido en allowedRoles.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.rol)) {
      return res.status(403).json({
        ok: false,
        error: `Acceso denegado. Se requiere alguno de los siguientes roles: ${allowedRoles.join(', ')}.`
      });
    }
    next();
  };
}

function apiKeyGuard(req, res, next) {
  const configuredSecret = process.env.API_SECRET_KEY;
  if (!configuredSecret) {
    return next();
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
  requireRole,
  apiKeyGuard,
  resolveUserByEmail
};
