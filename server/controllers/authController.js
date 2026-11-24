const { pool } = require('../config/db');

function parseNonNegativeIntEnv(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * Retorna la información del usuario autenticado (APP_USUARIOS) y sus hojas de ruta activas.
 */
async function getMe(req, res) {
  try {
    const user = req.user;
    let activeRoutes = [];
    const diasAtras = parseNonNegativeIntEnv(process.env.HOJAS_RUTA_DIAS_ATRAS, 1);
    const diasAdelante = parseNonNegativeIntEnv(process.env.HOJAS_RUTA_DIAS_ADELANTE, 1);
    const dateWindowClause = 'DATE(v.Fecha) BETWEEN DATE_SUB(CURDATE(), INTERVAL ? DAY) AND DATE_ADD(CURDATE(), INTERVAL ? DAY)';

    try {
      let query;
      let params;

      if (user.rol === 'sysadmin' || user.rol === 'logistica') {
        query = `
          SELECT v.Hoja_de_ruta, v.Fecha
          FROM HOJAS_DE_RUTA_A_ENTREGAR v
          ORDER BY v.Fecha DESC, v.Transaccionid DESC
          LIMIT 10
        `;
        params = [];
      } else if (user.organizacion_id) {
        query = `
          SELECT v.Hoja_de_ruta, v.Fecha
          FROM HOJAS_DE_RUTA_A_ENTREGAR v
          INNER JOIN HOJA_DE_RUTA hr ON hr.Transaccionid = v.Transaccionid
          WHERE (LOWER(v.EMail) = LOWER(?)
             OR hr.Organizacionid_chofer = ?
             OR hr.Organizacionid_transportista = ?)
            AND ${dateWindowClause}
          ORDER BY v.Fecha DESC, v.Transaccionid DESC
          LIMIT 10
        `;
        params = [user.email, user.organizacion_id, user.organizacion_id, diasAtras, diasAdelante];
      } else {
        query = `
          SELECT v.Hoja_de_ruta, v.Fecha
          FROM HOJAS_DE_RUTA_A_ENTREGAR v
          WHERE LOWER(v.EMail) = LOWER(?)
            AND ${dateWindowClause}
          ORDER BY v.Fecha DESC, v.Transaccionid DESC
          LIMIT 10
        `;
        params = [user.email, diasAtras, diasAdelante];
      }

      const [routes] = await pool.query(query, params);
      activeRoutes = (routes || []).map((r) => r.Hoja_de_ruta);
    } catch (err) {
      console.warn(`[AuthController] No se pudieron consultar hojas de ruta activas: ${err.message}`);
    }

    return res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        rol: user.rol,
        organizacion_id: user.organizacion_id || null,
        organizacion_nombre: user.organizacion_nombre || null,
        organizacion_codigo: user.organizacion_codigo || null,
        codigo_chofer: user.codigo_chofer || user.organizacion_codigo || null,
        activo: user.activo
      },
      stats: {
        hojas_ruta_activas: activeRoutes
      }
    });
  } catch (error) {
    console.error(`[AuthController.getMe] Error: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Error al obtener datos del usuario.'
    });
  }
}

/**
 * Lista usuarios activos de APP_USUARIOS (útil para selector dev cuando VITE_MOCK_AUTH=true).
 */
async function listUsers(req, res) {
  try {
    const [users] = await pool.query(
      `SELECT id, email, nombre, rol, organizacion_id, codigo_chofer, activo
       FROM APP_USUARIOS
       WHERE activo = 1
       ORDER BY FIELD(rol, 'sysadmin', 'logistica', 'chofer'), nombre ASC`
    );
    return res.json({
      ok: true,
      users: users || []
    });
  } catch (error) {
    console.error(`[AuthController.listUsers] Error: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Error al listar usuarios.'
    });
  }
}

module.exports = {
  getMe,
  listUsers
};
