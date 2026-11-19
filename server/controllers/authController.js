const axios = require('axios');
const { pool } = require('../config/db');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Autentica credenciales email + contraseña contra Microsoft Entra ID (y modo desarrollo parametrizado).
 * No almacena ni registra la contraseña del usuario.
 */
async function loginWithCredentials(req, res) {
  try {
    const rawEmail = req.body?.email || '';
    const password = req.body?.password || '';
    const cleanEmail = String(rawEmail).trim().toLowerCase();

    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({
        ok: false,
        error: 'Debe ingresar un usuario con formato de email válido.'
      });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'Debe ingresar su contraseña para iniciar sesión.'
      });
    }

    // 1. Verificar que el usuario exista y esté activo en la tabla local `usuarios`
    const [users] = await pool.query(
      'SELECT id, email, nombre, codigo_chofer, rol, activo FROM usuarios WHERE LOWER(email) = ? LIMIT 1',
      [cleanEmail]
    );

    const user = users && users.length > 0 ? users[0] : null;
    if (!user || !user.activo) {
      return res.status(401).json({
        ok: false,
        error: 'Las credenciales ingresadas no son válidas.'
      });
    }

    // 2. Validar contra Microsoft Entra ID (OAuth2 ROPC) cuando está configurado
    const tenantId = process.env.AZURE_AD_TENANT_ID;
    const clientId = process.env.AZURE_AD_CLIENT_ID;
    const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
    let entraVerified = false;
    let entraMfaOrInteractiveRequired = false;

    if (tenantId && clientId && !clientId.startsWith('00000000')) {
      try {
        const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
        const formParams = new URLSearchParams();
        formParams.append('client_id', clientId);
        if (clientSecret) {
          formParams.append('client_secret', clientSecret);
        }
        formParams.append('scope', 'User.Read openid profile email');
        formParams.append('username', cleanEmail);
        formParams.append('password', password);
        formParams.append('grant_type', 'password');

        const tokenRes = await axios.post(tokenUrl, formParams.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000
        });

        if (tokenRes.data && tokenRes.data.access_token) {
          entraVerified = true;
        }
      } catch (entraErr) {
        const errCode = entraErr.response?.data?.error || '';
        const errDesc = entraErr.response?.data?.error_description || '';
        console.warn(`[AuthController.login] Entra ID rechazó ROPC (${errCode}): ${errDesc.split('\r\n')[0]}`);

        // Si el tenant requiere MFA o flujo interactivo explícito (AADSTS50076 / AADSTS50079 / AADSTS7000218)
        if (errDesc.includes('AADSTS50076') || errDesc.includes('AADSTS50079') || errDesc.includes('AADSTS7000218')) {
          entraMfaOrInteractiveRequired = true;
        }
      }
    }

    // 3. Permitir validación controlada para entorno de pruebas si está activado por variable de entorno
    const allowDevPassword = process.env.ALLOW_DEV_PASSWORD_LOGIN === 'true';
    const configuredDevPassword = process.env.DEV_LOGIN_PASSWORD;
    const devVerified = Boolean(allowDevPassword && configuredDevPassword && password === configuredDevPassword);

    if (!entraVerified && !devVerified) {
      if (entraMfaOrInteractiveRequired) {
        return res.status(401).json({
          ok: false,
          require_sso_popup: true,
          error: 'Tu cuenta corporativa requiere verificación MFA en Microsoft. Presiona "Inicia sesión con Microsoft" para autenticarte.'
        });
      }
      return res.status(401).json({
        ok: false,
        error: 'Las credenciales ingresadas no son válidas.'
      });
    }

    return res.json({
      ok: true,
      auth_provider: entraVerified ? 'microsoft_entra_id' : 'dev_credentials',
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        codigo_chofer: user.codigo_chofer,
        rol: user.rol,
        activo: user.activo
      }
    });
  } catch (error) {
    console.error(`[AuthController.loginWithCredentials] Error: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Error interno al validar las credenciales.'
    });
  }
}

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
  loginWithCredentials,
  getMe,
  listUsers
};
