const { pool, withAuditConnection } = require('../config/db');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = ['sysadmin', 'logistica', 'chofer'];
const CAJONES_TIPO_ENTREGA = parseInt(process.env.CAJONES_TIPO_ENTREGA || '1', 10);
const CAJONES_TIPO_DEVOLUCION = parseInt(process.env.CAJONES_TIPO_DEVOLUCION || '2', 10);

/**
 * Dashboard principal del Gestor de Escritorio (sysadmin / logistica).
 */
async function getDashboard(req, res) {
  try {
    const [[hrStats]] = await pool.query(`
      SELECT COUNT(*) AS total_hojas_ruta_activas
      FROM HOJAS_DE_RUTA_A_ENTREGAR
    `);

    const [[itemsStats]] = await pool.query(`
      SELECT
        COUNT(Hojarutaitemid) AS total_items,
        COUNT(CASE WHEN cantidad_descargada_Chofer IS NOT NULL THEN 1 END) AS items_confirmados,
        COUNT(CASE WHEN cantidad_descargada_Chofer IS NOT NULL AND cantidad_descargada_Chofer <> Cantidad THEN 1 END) AS items_con_diferencia,
        COALESCE(SUM(Cantidad), 0) AS total_unidades_remitidas,
        COALESCE(SUM(cantidad_descargada_Chofer), 0) AS total_unidades_entregadas
      FROM ITEMS_A_ENTREGAR
      WHERE Hojarutaitemid IS NOT NULL
    `);

    const [[devStats]] = await pool.query(`
      SELECT
        COUNT(DISTINCT id_remito_devoluciones) AS total_devoluciones_cabeceras,
        COUNT(id_remito_devoluciones_item) AS total_devoluciones_items,
        COALESCE(SUM(cantidad_check_chofer), 0) AS total_unidades_devueltas
      FROM REMITO_DEVOLUCIONES_ITEMS
    `);

    const [[cajStats]] = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN rc.tipo = ? THEN rci.cantidad_check_chofer ELSE 0 END), 0) AS cajones_entregados,
         COALESCE(SUM(CASE WHEN rc.tipo = ? THEN rci.cantidad_check_chofer ELSE 0 END), 0) AS cajones_devueltos
       FROM REMITO_CAJONES rc
       INNER JOIN REMITO_CAJONES_ITEMS rci ON rci.id_remito_cajones = rc.id_remito_cajones`,
      [CAJONES_TIPO_ENTREGA, CAJONES_TIPO_DEVOLUCION]
    );

    const [userRolesRows] = await pool.query(`
      SELECT rol, COUNT(*) AS cantidad
      FROM APP_USUARIOS
      WHERE activo = 1
      GROUP BY rol
    `);
    const usuariosPorRol = { sysadmin: 0, logistica: 0, chofer: 0 };
    for (const r of userRolesRows || []) {
      usuariosPorRol[r.rol] = Number(r.cantidad || 0);
    }

    const [ultimasHojasRuta] = await pool.query(`
      SELECT
        v.Transaccionid,
        v.Hoja_de_ruta,
        v.Fecha,
        hr.Usr_viaje AS Viaje,
        COALESCE(NULLIF(TRIM(v.Chofer), ''), NULLIF(TRIM(tr.Nombre), ''), 'Sin Chofer Asignado') AS Chofer,
        COALESCE(NULLIF(TRIM(tr.Nombre), ''), 'Transporte No Informado') AS Transporte,
        v.Patente_camion,
        v.Patente_acoplado,
        COUNT(DISTINCT etapa.Id_etapa) AS total_paradas,
        COUNT(ir.Hojarutaitemid) AS total_items,
        COUNT(CASE WHEN ir.cantidad_descargada_Chofer IS NOT NULL THEN 1 END) AS items_confirmados,
        COUNT(CASE WHEN ir.cantidad_descargada_Chofer IS NOT NULL AND ir.cantidad_descargada_Chofer <> ir.Cantidad THEN 1 END) AS items_con_diferencia
      FROM HOJAS_DE_RUTA_A_ENTREGAR v
      LEFT JOIN HOJA_DE_RUTA hr ON hr.Transaccionid = v.Transaccionid
      LEFT JOIN ORGANIZACION tr ON tr.Organizacionid = hr.Organizacionid_transportista
      LEFT JOIN HOJA_RUTA_ETAPA etapa ON etapa.Transaccionid_hoja_de_ruta = v.Transaccionid
      LEFT JOIN HOJA_RUTA_ITEM_REMITO ir ON ir.Id_etapa = etapa.Id_etapa
      GROUP BY v.Transaccionid, v.Hoja_de_ruta, v.Fecha, hr.Usr_viaje, v.Chofer, tr.Nombre, v.Patente_camion, v.Patente_acoplado
      ORDER BY v.Fecha DESC, v.Transaccionid DESC
      LIMIT 10
    `);

    let ultimosEventosAuditoria = [];
    if (req.user.rol === 'sysadmin') {
      const [audRows] = await pool.query(`
        SELECT id_auditoria, tabla_nombre, operacion, registro_pk, usuario_app, usuario_rol, fecha_hora
        FROM AUDITORIA
        ORDER BY id_auditoria DESC
        LIMIT 8
      `);
      ultimosEventosAuditoria = audRows || [];
    }

    return res.json({
      ok: true,
      kpis: {
        total_hojas_ruta_activas: Number(hrStats?.total_hojas_ruta_activas || 0),
        total_items: Number(itemsStats?.total_items || 0),
        items_confirmados: Number(itemsStats?.items_confirmados || 0),
        items_con_diferencia: Number(itemsStats?.items_con_diferencia || 0),
        total_unidades_remitidas: Number(itemsStats?.total_unidades_remitidas || 0),
        total_unidades_entregadas: Number(itemsStats?.total_unidades_entregadas || 0),
        total_devoluciones_cabeceras: Number(devStats?.total_devoluciones_cabeceras || 0),
        total_devoluciones_items: Number(devStats?.total_devoluciones_items || 0),
        total_unidades_devueltas: Number(devStats?.total_unidades_devueltas || 0),
        cajones_entregados: Number(cajStats?.cajones_entregados || 0),
        cajones_devueltos: Number(cajStats?.cajones_devueltos || 0),
        cajones_diferencia: Number(cajStats?.cajones_entregados || 0) - Number(cajStats?.cajones_devueltos || 0),
        usuarios_por_rol: usuariosPorRol
      },
      ultimas_hojas_ruta: ultimasHojasRuta || [],
      ultimos_eventos_auditoria: ultimosEventosAuditoria
    });
  } catch (error) {
    console.error(`[AdminController.getDashboard] Error: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Error al cargar métricas del dashboard.',
      details: error.message
    });
  }
}

/**
 * Listado de Hojas de Ruta para seguimiento en escritorio con filtros y métricas.
 */
async function getHojasRutaAdmin(req, res) {
  try {
    const q = (req.query.q || '').trim();
    const fechaDesde = (req.query.fecha_desde || '').trim();
    const fechaHasta = (req.query.fecha_hasta || '').trim();
    const estadoDescarga = (req.query.estado_descarga || 'TODOS').trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10) || 50, 1), 200);

    const whereClauses = ['1=1'];
    const params = [];

    if (q) {
      whereClauses.push(`(
        v.Hoja_de_ruta LIKE ?
        OR v.Chofer LIKE ?
        OR tr.Nombre LIKE ?
        OR v.Patente_camion LIKE ?
        OR v.Patente_acoplado LIKE ?
      )`);
      const pat = `%${q}%`;
      params.push(pat, pat, pat, pat, pat);
    }
    if (fechaDesde) {
      whereClauses.push('v.Fecha >= ?');
      params.push(fechaDesde);
    }
    if (fechaHasta) {
      whereClauses.push('v.Fecha <= ?');
      params.push(fechaHasta);
    }

    let havingClause = '';
    if (estadoDescarga === 'PENDIENTES') {
      havingClause = 'HAVING items_confirmados = 0';
    } else if (estadoDescarga === 'COMPLETAS') {
      havingClause = 'HAVING total_items > 0 AND items_confirmados >= total_items';
    } else if (estadoDescarga === 'CON_DIFERENCIAS') {
      havingClause = 'HAVING items_con_diferencia > 0';
    }

    const [rows] = await pool.query(
      `SELECT
         v.Transaccionid,
         v.Hoja_de_ruta,
         v.Fecha,
         hr.Usr_viaje AS Viaje,
         COALESCE(NULLIF(TRIM(v.Chofer), ''), NULLIF(TRIM(tr.Nombre), ''), 'Sin Chofer Asignado') AS Chofer,
         COALESCE(NULLIF(TRIM(tr.Nombre), ''), 'Transporte No Informado') AS Transporte,
         v.Patente_camion,
         v.Patente_acoplado,
         COUNT(DISTINCT etapa.Id_etapa) AS total_paradas,
         COUNT(ir.Hojarutaitemid) AS total_items,
         COUNT(CASE WHEN ir.cantidad_descargada_Chofer IS NOT NULL THEN 1 END) AS items_confirmados,
         COUNT(CASE WHEN ir.cantidad_descargada_Chofer IS NOT NULL AND ir.cantidad_descargada_Chofer <> ir.Cantidad THEN 1 END) AS items_con_diferencia
       FROM HOJAS_DE_RUTA_A_ENTREGAR v
       LEFT JOIN HOJA_DE_RUTA hr ON hr.Transaccionid = v.Transaccionid
       LEFT JOIN ORGANIZACION tr ON tr.Organizacionid = hr.Organizacionid_transportista
       LEFT JOIN HOJA_RUTA_ETAPA etapa ON etapa.Transaccionid_hoja_de_ruta = v.Transaccionid
       LEFT JOIN HOJA_RUTA_ITEM_REMITO ir ON ir.Id_etapa = etapa.Id_etapa
       WHERE ${whereClauses.join(' AND ')}
       GROUP BY v.Transaccionid, v.Hoja_de_ruta, v.Fecha, hr.Usr_viaje, v.Chofer, tr.Nombre, v.Patente_camion, v.Patente_acoplado
       ${havingClause}
       ORDER BY v.Fecha DESC, v.Transaccionid DESC
       LIMIT ?`,
      [...params, limit]
    );

    return res.json({
      ok: true,
      hojas_ruta: rows || []
    });
  } catch (error) {
    console.error(`[AdminController.getHojasRutaAdmin] Error: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Error al listar hojas de ruta.',
      details: error.message
    });
  }
}

/**
 * Detalle consolidado de una hoja de ruta (entregas, devoluciones y cajones; excluye firma de remitos).
 */
async function getHojaRutaDetalleAdmin(req, res) {
  try {
    const txId = Number(req.params.transaccionId);
    if (!Number.isInteger(txId) || txId <= 0) {
      return res.status(400).json({ ok: false, error: 'Transaccionid inválido.' });
    }

    const [hrRows] = await pool.query(
      `SELECT
         v.Transaccionid,
         v.Hoja_de_ruta,
         v.Fecha,
         hr.Usr_viaje AS Viaje,
         COALESCE(NULLIF(TRIM(v.Chofer), ''), NULLIF(TRIM(tr.Nombre), ''), 'Sin Chofer Asignado') AS Chofer,
         COALESCE(NULLIF(TRIM(tr.Nombre), ''), 'Transporte No Informado') AS Transporte,
         v.Patente_camion,
         v.Patente_acoplado
       FROM HOJAS_DE_RUTA_A_ENTREGAR v
       LEFT JOIN HOJA_DE_RUTA hr ON hr.Transaccionid = v.Transaccionid
       LEFT JOIN ORGANIZACION tr ON tr.Organizacionid = hr.Organizacionid_transportista
       WHERE v.Transaccionid = ?
       LIMIT 1`,
      [txId]
    );

    if (!hrRows || hrRows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Hoja de ruta no encontrada.' });
    }

    const [entregas] = await pool.query(
      `SELECT
         Direccionentrega AS Lugar_de_Entrega,
         Numeroremito AS Remito,
         Cliente,
         Nombre AS Producto,
         Cantidad AS Remitido,
         cantidad_descargada_Chofer AS Entregado,
         codigo_motivo_dif,
         Hojarutaitemid
       FROM ITEMS_A_ENTREGAR
       WHERE Transaccionid = ? AND Hojarutaitemid IS NOT NULL
       ORDER BY Direccionentrega ASC, Numeroremito ASC, Hojarutaitemid ASC`,
      [txId]
    );

    const [devoluciones] = await pool.query(
      `SELECT
         etapa.Direccionentrega AS Lugar_de_Entrega,
         COALESCE(cl_dev.Nombre, cl_op.Nombre) AS Cliente,
         de.id_remito_devoluciones,
         di.id_remito_devoluciones_item,
         pr.Nombre AS Producto,
         di.cantidad_check_chofer AS Cantidad,
         di.vencimiento_check_chofer AS Vencimiento,
         TRIM(md.Descripcion) AS Motivo,
         di.tipo AS Tipo
       FROM HOJA_RUTA_ETAPA etapa
       LEFT JOIN ORGANIZACION cl_op ON cl_op.Organizacionid = etapa.Organizacionidoperador
       INNER JOIN REMITO_DEVOLUCIONES de ON CAST(de.id_etapa AS CHAR) COLLATE utf8mb4_0900_ai_ci = etapa.Id_etapa COLLATE utf8mb4_0900_ai_ci
       LEFT JOIN ORGANIZACION cl_dev ON cl_dev.Organizacionid = de.id_cliente
       INNER JOIN REMITO_DEVOLUCIONES_ITEMS di ON di.id_remito_devoluciones = de.id_remito_devoluciones
       LEFT JOIN PRODUCTO pr ON pr.Productoid = di.id_producto
       LEFT JOIN MOTIVO_DIFERENCIA md ON CAST(TRIM(md.Codigo) AS UNSIGNED) = di.codigo_motivo_dif
       WHERE etapa.Transaccionid_hoja_de_ruta = ?
       ORDER BY etapa.Direccionentrega ASC, Cliente ASC`,
      [txId]
    );

    const [cajones] = await pool.query(
      `SELECT
         rce.Direccionentrega AS Lugar_de_Entrega,
         rce.Cliente,
         MAX(CASE WHEN rce.tipo = ? THEN COALESCE(rce.cantidad_check_chofer, 0) ELSE 0 END) AS cajones_entregados,
         MAX(CASE WHEN rce.tipo = ? THEN COALESCE(rce.cantidad_check_chofer, 0) ELSE 0 END) AS cajones_devueltos
       FROM REMITOS_CAJONES_X_ETAPA rce
       WHERE rce.Transaccionid = ?
       GROUP BY rce.Id_etapa, rce.Direccionentrega, rce.Cliente
       ORDER BY rce.Direccionentrega ASC, rce.Cliente ASC`,
      [CAJONES_TIPO_ENTREGA, CAJONES_TIPO_DEVOLUCION, txId]
    );

    return res.json({
      ok: true,
      hoja_ruta: hrRows[0],
      entregas: entregas || [],
      devoluciones: devoluciones || [],
      cajones: (cajones || []).map(c => ({
        ...c,
        diferencia: Number(c.cajones_entregados || 0) - Number(c.cajones_devueltos || 0)
      }))
    });
  } catch (error) {
    console.error(`[AdminController.getHojaRutaDetalleAdmin] Error: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Error al consultar el detalle de la hoja de ruta.',
      details: error.message
    });
  }
}

/**
 * Listado global de Devoluciones y Faltantes de Entregas (insumo futuro para Notas de Crédito).
 */
async function getDevolucionesAdmin(req, res) {
  try {
    const q = (req.query.q || '').trim();
    const tipo = (req.query.tipo || '').trim();

    const devWhere = ['1=1'];
    const devParams = [];
    if (q) {
      devWhere.push('(hr.Numerocomprobante LIKE ? OR cl.Nombre LIKE ? OR pr.Nombre LIKE ?)');
      const pat = `%${q}%`;
      devParams.push(pat, pat, pat);
    }
    if (tipo && ['Físico', 'Virtual'].includes(tipo)) {
      devWhere.push('di.tipo = ?');
      devParams.push(tipo);
    }

    const [devoluciones] = await pool.query(
      `SELECT
         di.id_remito_devoluciones_item,
         de.id_remito_devoluciones,
         de.fecha,
         hr.Transaccionid,
         hr.Numerocomprobante AS Hoja_de_ruta,
         etapa.Direccionentrega AS Lugar_de_Entrega,
         COALESCE(cl.Nombre, 'Cliente #' ) AS Cliente,
         pr.Codigo AS ProductoCodigo,
         pr.Nombre AS Producto,
         di.cantidad_check_chofer AS Cantidad,
         di.vencimiento_check_chofer AS Vencimiento,
         TRIM(md.Descripcion) AS Motivo,
         di.tipo AS Tipo
       FROM REMITO_DEVOLUCIONES_ITEMS di
       INNER JOIN REMITO_DEVOLUCIONES de ON de.id_remito_devoluciones = di.id_remito_devoluciones
       LEFT JOIN HOJA_RUTA_ETAPA etapa ON CAST(de.id_etapa AS CHAR) COLLATE utf8mb4_0900_ai_ci = etapa.Id_etapa COLLATE utf8mb4_0900_ai_ci
       LEFT JOIN HOJA_DE_RUTA hr ON hr.Transaccionid = etapa.Transaccionid_hoja_de_ruta
       LEFT JOIN ORGANIZACION cl ON cl.Organizacionid = de.id_cliente
       LEFT JOIN PRODUCTO pr ON pr.Productoid = di.id_producto
       LEFT JOIN MOTIVO_DIFERENCIA md ON CAST(TRIM(md.Codigo) AS UNSIGNED) = di.codigo_motivo_dif
       WHERE ${devWhere.join(' AND ')}
       ORDER BY de.fecha DESC, di.id_remito_devoluciones_item DESC
       LIMIT 150`,
      devParams
    );

    const faltWhere = [
      'Hojarutaitemid IS NOT NULL',
      'cantidad_descargada_Chofer IS NOT NULL',
      'cantidad_descargada_Chofer <> Cantidad'
    ];
    const faltParams = [];
    if (q) {
      faltWhere.push('(Hoja_de_ruta LIKE ? OR Cliente LIKE ? OR Nombre LIKE ? OR Numeroremito LIKE ?)');
      const pat = `%${q}%`;
      faltParams.push(pat, pat, pat, pat);
    }

    const [faltantes] = await pool.query(
      `SELECT
         Hojarutaitemid,
         Transaccionid,
         Hoja_de_ruta,
         Fecha,
         Direccionentrega AS Lugar_de_Entrega,
         Numeroremito AS Remito,
         Cliente,
         Nombre AS Producto,
         Cantidad AS Remitido,
         cantidad_descargada_Chofer AS Entregado,
         (Cantidad - COALESCE(cantidad_descargada_Chofer, 0)) AS Diferencia
       FROM ITEMS_A_ENTREGAR
       WHERE ${faltWhere.join(' AND ')}
       ORDER BY Fecha DESC, Hojarutaitemid DESC
       LIMIT 150`,
      faltParams
    );

    return res.json({
      ok: true,
      devoluciones: devoluciones || [],
      faltantes: faltantes || []
    });
  } catch (error) {
    console.error(`[AdminController.getDevolucionesAdmin] Error: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Error al consultar devoluciones y faltantes.',
      details: error.message
    });
  }
}

/**
 * Listado global de movimientos de Cajones por hoja de ruta / etapa / cliente.
 */
async function getCajonesAdmin(req, res) {
  try {
    const q = (req.query.q || '').trim();
    const soloDiferencias = req.query.solo_con_diferencia === 'true';

    const whereClauses = ['1=1'];
    const params = [];

    if (q) {
      whereClauses.push('(rce.Hoja_de_ruta LIKE ? OR rce.Cliente LIKE ? OR rce.Direccionentrega LIKE ?)');
      const pat = `%${q}%`;
      params.push(pat, pat, pat);
    }

    const [rows] = await pool.query(
      `SELECT
         rce.Transaccionid,
         rce.Hoja_de_ruta,
         rce.Fecha,
         rce.Chofer,
         rce.Id_etapa,
         rce.Direccionentrega AS Lugar_de_Entrega,
         rce.Id_cliente,
         rce.Cliente,
         MAX(CASE WHEN rce.tipo = ? THEN COALESCE(rce.cantidad_check_chofer, 0) ELSE 0 END) AS cajones_entregados,
         MAX(CASE WHEN rce.tipo = ? THEN COALESCE(rce.cantidad_check_chofer, 0) ELSE 0 END) AS cajones_devueltos
       FROM REMITOS_CAJONES_X_ETAPA rce
       WHERE ${whereClauses.join(' AND ')}
       GROUP BY rce.Transaccionid, rce.Hoja_de_ruta, rce.Fecha, rce.Chofer, rce.Id_etapa, rce.Direccionentrega, rce.Id_cliente, rce.Cliente
       ORDER BY rce.Fecha DESC, rce.Transaccionid DESC, rce.Cliente ASC
       LIMIT 200`,
      [CAJONES_TIPO_ENTREGA, CAJONES_TIPO_DEVOLUCION, ...params]
    );

    let mapped = (rows || []).map(r => {
      const ent = Number(r.cajones_entregados || 0);
      const dev = Number(r.cajones_devueltos || 0);
      return { ...r, cajones_entregados: ent, cajones_devueltos: dev, diferencia: ent - dev };
    });

    if (soloDiferencias) {
      mapped = mapped.filter(r => r.diferencia !== 0);
    }

    return res.json({
      ok: true,
      cajones: mapped
    });
  } catch (error) {
    console.error(`[AdminController.getCajonesAdmin] Error: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Error al consultar seguimiento de cajones.',
      details: error.message
    });
  }
}

/**
 * Gestión de Usuarios (APP_USUARIOS) con RBAC:
 * - sysadmin gestiona todos los roles (sysadmin, logistica, chofer).
 * - logistica solo puede ver y gestionar usuarios de tipo 'chofer'.
 */
async function getUsuarios(req, res) {
  try {
    const isSysAdmin = req.user.rol === 'sysadmin';
    const whereClause = isSysAdmin ? '1=1' : "u.rol = 'chofer'";

    const [users] = await pool.query(`
      SELECT
        u.id,
        u.email,
        u.nombre,
        u.rol,
        u.organizacion_id,
        u.codigo_chofer,
        u.activo,
        u.created_by,
        u.created_at,
        u.updated_at,
        org.Nombre AS organizacion_nombre,
        org.Codigo AS organizacion_codigo
      FROM APP_USUARIOS u
      LEFT JOIN ORGANIZACION org ON org.Organizacionid = u.organizacion_id
      WHERE ${whereClause}
      ORDER BY FIELD(u.rol, 'sysadmin', 'logistica', 'chofer'), u.nombre ASC
    `);

    return res.json({
      ok: true,
      usuarios: users || []
    });
  } catch (error) {
    console.error(`[AdminController.getUsuarios] Error: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Error al obtener usuarios.',
      details: error.message
    });
  }
}

/**
 * Buscador de organizaciones (choferes/transportistas en ERP) para mapear el campo clave del chofer.
 */
async function getOrganizaciones(req, res) {
  try {
    const q = (req.query.q || '').trim();
    const params = [];
    let where = "1=1";
    if (q) {
      where = "(org.Nombre LIKE ? OR org.Codigo LIKE ? OR CAST(org.Organizacionid AS CHAR) = ?)";
      const pat = `%${q}%`;
      params.push(pat, pat, q);
    }

    const [rows] = await pool.query(
      `SELECT
         org.Organizacionid,
         org.Codigo,
         org.Nombre,
         org.EMail,
         EXISTS(SELECT 1 FROM HOJA_DE_RUTA h WHERE h.Organizacionid_chofer = org.Organizacionid) AS es_chofer_hr,
         EXISTS(SELECT 1 FROM HOJA_DE_RUTA h WHERE h.Organizacionid_transportista = org.Organizacionid) AS es_transportista_hr
       FROM ORGANIZACION org
       WHERE ${where}
       ORDER BY es_chofer_hr DESC, es_transportista_hr DESC, org.Nombre ASC
       LIMIT 60`,
      params
    );

    return res.json({
      ok: true,
      organizaciones: rows || []
    });
  } catch (error) {
    console.error(`[AdminController.getOrganizaciones] Error: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Error al consultar organizaciones del ERP.',
      details: error.message
    });
  }
}

async function createUsuario(req, res) {
  try {
    const rawEmail = String(req.body?.email || '').trim().toLowerCase();
    const nombre = String(req.body?.nombre || '').trim();
    const rol = String(req.body?.rol || 'chofer').trim();
    const organizacionId = req.body?.organizacion_id ? Number(req.body.organizacion_id) : null;
    const codigoChofer = req.body?.codigo_chofer ? String(req.body.codigo_chofer).trim() : null;
    const activo = req.body?.activo === 0 || req.body?.activo === false ? 0 : 1;

    if (!EMAIL_REGEX.test(rawEmail)) {
      return res.status(400).json({ ok: false, error: 'Debe ingresar un correo corporativo válido.' });
    }
    if (!nombre) {
      return res.status(400).json({ ok: false, error: 'Debe ingresar el nombre del usuario.' });
    }
    if (!VALID_ROLES.includes(rol)) {
      return res.status(400).json({ ok: false, error: 'Rol inválido. Valores permitidos: sysadmin, logistica, chofer.' });
    }

    if (req.user.rol === 'logistica' && rol !== 'chofer') {
      return res.status(403).json({
        ok: false,
        error: 'El rol Logística solo puede crear usuarios de tipo chofer.'
      });
    }

    const createdId = await withAuditConnection(req.user, async (conn) => {
      const [existing] = await conn.query('SELECT id FROM APP_USUARIOS WHERE LOWER(email) = ? LIMIT 1', [rawEmail]);
      if (existing && existing.length > 0) {
        const err = new Error(`Ya existe un usuario registrado con el email ${rawEmail}.`);
        err.status = 409;
        throw err;
      }

      let resolvedCodigo = codigoChofer;
      if (organizacionId && !resolvedCodigo) {
        const [orgRows] = await conn.query('SELECT Codigo FROM ORGANIZACION WHERE Organizacionid = ? LIMIT 1', [organizacionId]);
        if (orgRows?.[0]?.Codigo) {
          resolvedCodigo = String(orgRows[0].Codigo).trim();
        }
      }

      const [ins] = await conn.query(
        `INSERT INTO APP_USUARIOS (email, nombre, rol, organizacion_id, codigo_chofer, activo, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [rawEmail, nombre, rol, organizacionId, resolvedCodigo, activo, req.user.email]
      );
      return ins.insertId;
    });

    const [createdRows] = await pool.query('SELECT * FROM APP_USUARIOS WHERE id = ? LIMIT 1', [createdId]);

    return res.status(201).json({
      ok: true,
      message: 'Usuario creado correctamente.',
      usuario: createdRows[0]
    });
  } catch (error) {
    if (error.status === 409) {
      return res.status(409).json({ ok: false, error: error.message });
    }
    console.error(`[AdminController.createUsuario] Error: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Error al crear el usuario.',
      details: error.message
    });
  }
}

async function updateUsuario(req, res) {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ ok: false, error: 'ID de usuario inválido.' });
    }

    const [targetRows] = await pool.query('SELECT * FROM APP_USUARIOS WHERE id = ? LIMIT 1', [userId]);
    if (!targetRows || targetRows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado.' });
    }
    const target = targetRows[0];

    const nombre = req.body?.nombre !== undefined ? String(req.body.nombre).trim() : target.nombre;
    const rol = req.body?.rol !== undefined ? String(req.body.rol).trim() : target.rol;
    const organizacionId = req.body?.organizacion_id !== undefined
      ? (req.body.organizacion_id ? Number(req.body.organizacion_id) : null)
      : target.organizacion_id;
    const codigoChofer = req.body?.codigo_chofer !== undefined
      ? (req.body.codigo_chofer ? String(req.body.codigo_chofer).trim() : null)
      : target.codigo_chofer;
    const activo = req.body?.activo !== undefined ? (req.body.activo ? 1 : 0) : target.activo;

    if (!VALID_ROLES.includes(rol)) {
      return res.status(400).json({ ok: false, error: 'Rol inválido.' });
    }

    if (req.user.rol === 'logistica' && (target.rol !== 'chofer' || rol !== 'chofer')) {
      return res.status(403).json({
        ok: false,
        error: 'El rol Logística solo puede editar usuarios de tipo chofer.'
      });
    }

    if (target.email.toLowerCase() === req.user.email.toLowerCase() && (activo === 0 || rol !== req.user.rol)) {
      return res.status(400).json({
        ok: false,
        error: 'No puedes desactivar ni cambiar tu propio rol mientras estás conectado.'
      });
    }

    await withAuditConnection(req.user, async (conn) => {
      let resolvedCodigo = codigoChofer;
      if (organizacionId && !resolvedCodigo) {
        const [orgRows] = await conn.query('SELECT Codigo FROM ORGANIZACION WHERE Organizacionid = ? LIMIT 1', [organizacionId]);
        if (orgRows?.[0]?.Codigo) {
          resolvedCodigo = String(orgRows[0].Codigo).trim();
        }
      }

      await conn.query(
        `UPDATE APP_USUARIOS
         SET nombre = ?, rol = ?, organizacion_id = ?, codigo_chofer = ?, activo = ?
         WHERE id = ?`,
        [nombre, rol, organizacionId, resolvedCodigo, activo, userId]
      );
    });

    const [updatedRows] = await pool.query('SELECT * FROM APP_USUARIOS WHERE id = ? LIMIT 1', [userId]);

    return res.json({
      ok: true,
      message: 'Usuario actualizado correctamente.',
      usuario: updatedRows[0]
    });
  } catch (error) {
    console.error(`[AdminController.updateUsuario] Error: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Error al actualizar el usuario.',
      details: error.message
    });
  }
}

async function deleteUsuario(req, res) {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ ok: false, error: 'ID de usuario inválido.' });
    }

    const [targetRows] = await pool.query('SELECT * FROM APP_USUARIOS WHERE id = ? LIMIT 1', [userId]);
    if (!targetRows || targetRows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado.' });
    }
    const target = targetRows[0];

    if (target.email.toLowerCase() === req.user.email.toLowerCase()) {
      return res.status(400).json({ ok: false, error: 'No puedes eliminar tu propio usuario activo.' });
    }

    if (req.user.rol === 'logistica' && target.rol !== 'chofer') {
      return res.status(403).json({
        ok: false,
        error: 'El rol Logística solo puede dar de baja usuarios de tipo chofer.'
      });
    }

    await withAuditConnection(req.user, async (conn) => {
      if (req.user.rol === 'sysadmin') {
        await conn.query('DELETE FROM APP_USUARIOS WHERE id = ?', [userId]);
      } else {
        await conn.query('UPDATE APP_USUARIOS SET activo = 0 WHERE id = ?', [userId]);
      }
    });

    return res.json({
      ok: true,
      message: req.user.rol === 'sysadmin' ? 'Usuario eliminado correctamente.' : 'Chofer desactivado correctamente.'
    });
  } catch (error) {
    console.error(`[AdminController.deleteUsuario] Error: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Error al eliminar usuario.',
      details: error.message
    });
  }
}

/**
 * Visor de Auditoría (solo sysadmin): consulta registros generados por triggers en AUDITORIA.
 */
async function getAuditoria(req, res) {
  try {
    const tabla = (req.query.tabla || '').trim();
    const operacion = (req.query.operacion || '').trim();
    const usuario = (req.query.usuario || '').trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit || '100', 10) || 100, 1), 300);

    const whereClauses = ['1=1'];
    const params = [];

    if (tabla) {
      whereClauses.push('tabla_nombre = ?');
      params.push(tabla);
    }
    if (operacion && ['INSERT', 'UPDATE', 'DELETE'].includes(operacion)) {
      whereClauses.push('operacion = ?');
      params.push(operacion);
    }
    if (usuario) {
      whereClauses.push('(usuario_app LIKE ? OR usuario_db LIKE ?)');
      const pat = `%${usuario}%`;
      params.push(pat, pat);
    }

    const [logs] = await pool.query(
      `SELECT
         id_auditoria,
         tabla_nombre,
         operacion,
         registro_pk,
         usuario_app,
         usuario_rol,
         usuario_db,
         fecha_hora,
         datos_anteriores,
         datos_nuevos
       FROM AUDITORIA
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY id_auditoria DESC
       LIMIT ?`,
      [...params, limit]
    );

    return res.json({
      ok: true,
      auditoria: logs || []
    });
  } catch (error) {
    console.error(`[AdminController.getAuditoria] Error: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Error al consultar registros de auditoría.',
      details: error.message
    });
  }
}

module.exports = {
  getDashboard,
  getHojasRutaAdmin,
  getHojaRutaDetalleAdmin,
  getDevolucionesAdmin,
  getCajonesAdmin,
  getUsuarios,
  getOrganizaciones,
  createUsuario,
  updateUsuario,
  deleteUsuario,
  getAuditoria
};
