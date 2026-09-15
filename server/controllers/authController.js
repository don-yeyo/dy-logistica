const { pool } = require('../config/db');

/**
 * Retorna la información del usuario autenticado (obtenido tras resolver por email en el middleware).
 */
async function getMe(req, res) {
  try {
    const user = req.user;

    // Obtener estadísticas rápidas de sus remitos
    let pendingCount = 0;
    let completedCount = 0;
    let activeRoutes = [];

    try {
      const [stats] = await pool.query(`
        SELECT 
          COUNT(CASE WHEN estado_firma = 'PENDIENTE' THEN 1 END) AS pendientes,
          COUNT(CASE WHEN estado_firma != 'PENDIENTE' THEN 1 END) AS completados
        FROM remitos
        WHERE (
          JSON_CONTAINS(transportistas, JSON_OBJECT('chofer', ?)) 
          OR JSON_SEARCH(transportistas, 'one', ?) IS NOT NULL
          OR controlado_por_chofer_email = ?
        )
      `, [user.codigo_chofer || '', user.codigo_chofer || '', user.email]);

      if (stats && stats[0]) {
        pendingCount = stats[0].pendientes || 0;
        completedCount = stats[0].completados || 0;
      }

      // Obtener lista de sus hojas de ruta recientes
      const [routes] = await pool.query(`
        SELECT DISTINCT nro_hoja_ruta, MAX(finne_Fecha) AS ultima_fecha
        FROM remitos
        WHERE nro_hoja_ruta IS NOT NULL AND (
          JSON_CONTAINS(transportistas, JSON_OBJECT('chofer', ?)) 
          OR JSON_SEARCH(transportistas, 'one', ?) IS NOT NULL
          OR controlado_por_chofer_email = ?
        )
        GROUP BY nro_hoja_ruta
        ORDER BY ultima_fecha DESC
        LIMIT 10
      `, [user.codigo_chofer || '', user.codigo_chofer || '', user.email]);

      activeRoutes = routes.map(r => r.nro_hoja_ruta);
    } catch (err) {
      console.warn(`[AuthController] No se pudieron calcular métricas secundarias: ${err.message}`);
    }

    return res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        codigo_chofer: user.codigo_chofer,
        rol: user.rol,
        activo: user.activo
      },
      stats: {
        pendientes: pendingCount,
        completados: completedCount,
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
 * Lista todos los usuarios/choferes habilitados (útil para selector de pruebas o panel admin).
 */
async function listUsers(req, res) {
  try {
    const [users] = await pool.query(
      'SELECT id, email, nombre, codigo_chofer, rol, activo FROM usuarios WHERE activo = 1 ORDER BY nombre ASC'
    );
    return res.json({
      ok: true,
      users: users || []
    });
  } catch (error) {
    console.error(`[AuthController.listUsers] Error: ${error.message}`);
    // Fallback de desarrollo
    return res.json({
      ok: true,
      users: [
        { id: 1, email: 'chofer.perez@donyeyo.com.ar', nombre: 'Juan Carlos Pérez', codigo_chofer: '32355', rol: 'chofer', activo: 1 },
        { id: 2, email: 'chofer.gomez@donyeyo.com.ar', nombre: 'Carlos Alberto Gómez', codigo_chofer: '32356', rol: 'chofer', activo: 1 },
        { id: 3, email: 'chofer.rodriguez@donyeyo.com.ar', nombre: 'Marcos Rodríguez', codigo_chofer: '32357', rol: 'chofer', activo: 1 },
        { id: 4, email: 'gabrielt@donyeyo.com.ar', nombre: 'Gabriel T. (Admin / Logística)', codigo_chofer: '32355', rol: 'admin', activo: 1 }
      ]
    });
  }
}

module.exports = {
  getMe,
  listUsers
};
