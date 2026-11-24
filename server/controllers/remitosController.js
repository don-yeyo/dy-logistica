const path = require('path');
const fs = require('fs');
const { pool, withAuditConnection } = require('../config/db');
const SharePointService = require('../services/sharepointService');
const { uploadsDir } = require('../middlewares/uploadMiddleware');

const VALID_EJEMPLARES = [
  'ORIGINAL',
  'DUPLICADO',
  'TRIPLICADO',
  'CUATRIPLICADO',
  'RECEPCION_VALORIZADA',
  'OTRO'
];

function isStageIdTypeMismatch(err) {
  const msg = String(err?.message || '');
  return (
    err?.errno === 1366 ||
    err?.errno === 1265 ||
    err?.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD' ||
    msg.toLowerCase().includes('id_etapa')
  );
}

/**
 * Consulta los ejemplares registrados en APP_REMITO_EJEMPLARES para un conjunto de remitos.
 */
async function fetchEjemplaresMap(remitoIds = []) {
  const map = new Map();
  const cleanIds = Array.from(new Set(remitoIds.map(Number).filter((id) => Number.isInteger(id) && id > 0)));
  if (cleanIds.length === 0) return map;

  const [rows] = await pool.query(
    `SELECT
       id,
       id_transaccion_remito,
       id_etapa,
       nro_remito,
       ejemplar,
       firmado_cliente,
       firmado_intermediario,
       no_firmado,
       observaciones,
       foto_url,
       foto_sharepoint_url,
       foto_nombre_archivo,
       firma_digital_base64,
       firma_receptor_aclaracion,
       firma_receptor_dni,
       fecha_hora
     FROM APP_REMITO_EJEMPLARES
     WHERE id_transaccion_remito IN (${cleanIds.map(() => '?').join(',')})
     ORDER BY FIELD(ejemplar, 'ORIGINAL','DUPLICADO','TRIPLICADO','CUATRIPLICADO','RECEPCION_VALORIZADA','OTRO'), id ASC`,
    cleanIds
  );

  for (const r of rows || []) {
    if (!map.has(r.id_transaccion_remito)) {
      map.set(r.id_transaccion_remito, []);
    }
    map.get(r.id_transaccion_remito).push(r);
  }
  return map;
}

/**
 * Calcula el estado consolidado del remito considerando todos sus ejemplares y/o columnas ERP.
 */
function computeConsolidatedStatus(ejemplares = [], row = {}) {
  if (ejemplares.length > 0) {
    const hasCliente = ejemplares.some((e) => Boolean(e.firmado_cliente));
    const hasInterm = ejemplares.some((e) => Boolean(e.firmado_intermediario));
    if (hasCliente && hasInterm) return 'FIRMADO_AMBOS';
    if (hasCliente) return 'FIRMADO_CLIENTE';
    if (hasInterm) return 'FIRMADO_INTERMEDIARIO';
    return 'NO_FIRMADO';
  }

  const hasCliente = row.Firmado_cliente === 1 || Boolean(row.firma_cliente_url);
  const hasInterm = row.Firmado_distribuidor === 1 || Boolean(row.firma_distribuidor_url);
  if (hasCliente && hasInterm) return 'FIRMADO_AMBOS';
  if (hasCliente) return 'FIRMADO_CLIENTE';
  if (hasInterm) return 'FIRMADO_INTERMEDIARIO';
  return 'PENDIENTE';
}

/**
 * Mapea una fila combinada de Gestion_Logistica (REMITO + ETAPA + HOJA_DE_RUTA + REMITOS_FIRMADOS + APP_REMITO_EJEMPLARES)
 * al contrato de remito utilizado por el frontend mobile.
 */
function mapRemitoRow(row, rawEjemplares = []) {
  const ejemplares = (rawEjemplares || []).map((e) => ({
    id: e.id || null,
    ejemplar: e.ejemplar,
    firmado_cliente: Boolean(e.firmado_cliente),
    firmado_intermediario: Boolean(e.firmado_intermediario),
    no_firmado: Boolean(e.no_firmado),
    observaciones: e.observaciones || '',
    foto_url: e.foto_url || null,
    foto_sharepoint_url: e.foto_sharepoint_url || null,
    foto_nombre_archivo: e.foto_nombre_archivo || null,
    fecha_hora: e.fecha_hora || null
  }));

  const estadoFirma = computeConsolidatedStatus(ejemplares, row);
  const hasCliente = estadoFirma === 'FIRMADO_CLIENTE' || estadoFirma === 'FIRMADO_AMBOS';
  const hasInterm = estadoFirma === 'FIRMADO_INTERMEDIARIO' || estadoFirma === 'FIRMADO_AMBOS';

  const firstFotoEjemplar = ejemplares.find((e) => e.foto_sharepoint_url || e.foto_url);
  const firstObsEjemplar = ejemplares.find((e) => e.observaciones && e.observaciones.trim());
  const firstSigRaw = (rawEjemplares || []).find((e) => e.firma_digital_base64 || e.firma_receptor_aclaracion || e.firma_receptor_dni);

  const fotoUrl =
    firstFotoEjemplar?.foto_sharepoint_url ||
    firstFotoEjemplar?.foto_url ||
    row.Url_imagen ||
    row.firma_cliente_url ||
    row.firma_distribuidor_url ||
    null;

  return {
    id: row.Id_transaccion_remito,
    finne_transaccionID: row.Id_transaccion_remito,
    finne_Fecha: row.Fecha,
    finne_CodigoCliente: row.ClienteCodigo
      ? Number(row.ClienteCodigo) || row.Organizacioniddestinatarioremito
      : row.Organizacioniddestinatarioremito,
    finne_Cliente: row.ClienteNombre || 'Cliente no especificado',
    finne_domicilio: row.Direccionentrega || null,
    finne_Comprobante: row.Numeroremito,
    nro_hoja_ruta: row.Hoja_de_ruta || null,
    hoja_ruta_transaccion_id: row.HojaRutaTransaccionId || null,
    id_etapa: row.Id_etapa || null,
    ejemplar: ejemplares[0]?.ejemplar || 'ORIGINAL',
    ejemplares,
    estado_firma: estadoFirma,
    tiene_firma_cliente: hasCliente,
    tiene_firma_intermediario: hasInterm,
    tipo_documento: ejemplares.some((e) => e.ejemplar === 'RECEPCION_VALORIZADA') ? 'RECEPCION_VALORIZADA' : 'REMITO',
    observaciones: firstObsEjemplar?.observaciones || null,
    foto_url: fotoUrl,
    foto_sharepoint_url: fotoUrl && String(fotoUrl).startsWith('http') ? fotoUrl : null,
    firma_digital_base64: firstSigRaw?.firma_digital_base64 || null,
    firma_receptor_aclaracion: firstSigRaw?.firma_receptor_aclaracion || '',
    firma_receptor_dni: firstSigRaw?.firma_receptor_dni || '',
    fecha_control: ejemplares[0]?.fecha_hora || row.Fecha_hora || null,
    source_db: 'Gestion_Logistica'
  };
}

/**
 * Normaliza y valida el arreglo de ejemplares recibido en saveControl / syncOffline
 * (manteniendo retrocompatibilidad con payloads legacy de ejemplar único).
 */
function normalizeIncomingEjemplares(body = {}) {
  let list = [];

  if (Array.isArray(body.ejemplares)) {
    list = body.ejemplares.map((item) => {
      const noFirmado = Boolean(item.no_firmado);
      return {
        ejemplar: String(item.ejemplar || '').trim().toUpperCase(),
        firmado_cliente: noFirmado ? false : Boolean(item.firmado_cliente),
        firmado_intermediario: noFirmado ? false : Boolean(item.firmado_intermediario),
        no_firmado: noFirmado,
        observaciones: item.observaciones ? String(item.observaciones) : null,
        foto_url: item.foto_url ? String(item.foto_url) : null,
        foto_sharepoint_url: item.foto_sharepoint_url ? String(item.foto_sharepoint_url) : null,
        foto_nombre_archivo: item.foto_nombre_archivo ? String(item.foto_nombre_archivo) : null
      };
    });
  } else if (body.estado_firma) {
    const est = String(body.estado_firma).trim().toUpperCase();
    const noFirmado = est === 'NO_FIRMADO';
    list = [
      {
        ejemplar: String(body.ejemplar || 'ORIGINAL').trim().toUpperCase(),
        firmado_cliente: !noFirmado && (est === 'FIRMADO_CLIENTE' || est === 'FIRMADO_AMBOS'),
        firmado_intermediario: !noFirmado && (est === 'FIRMADO_INTERMEDIARIO' || est === 'FIRMADO_AMBOS'),
        no_firmado: noFirmado,
        observaciones: body.observaciones ? String(body.observaciones) : null,
        foto_url: body.foto_url ? String(body.foto_url) : null,
        foto_sharepoint_url: body.foto_sharepoint_url ? String(body.foto_sharepoint_url) : null,
        foto_nombre_archivo: body.foto_nombre_archivo ? String(body.foto_nombre_archivo) : null
      }
    ];
  }

  if (list.length === 0) {
    return { error: 'Debe informar al menos un ejemplar recibido para el remito.' };
  }

  const seen = new Set();
  for (const ej of list) {
    if (!VALID_EJEMPLARES.includes(ej.ejemplar)) {
      return { error: `Tipo de ejemplar inválido: "${ej.ejemplar}".` };
    }
    if (seen.has(ej.ejemplar)) {
      return { error: `El ejemplar "${ej.ejemplar}" está duplicado en la petición.` };
    }
    seen.add(ej.ejemplar);

    if (!ej.no_firmado && !ej.firmado_cliente && !ej.firmado_intermediario) {
      return { error: `Debe indicar quién firmó el ejemplar ${ej.ejemplar} (Cliente, Intermediario o No Firmado).` };
    }
  }

  return { ejemplares: list };
}

/**
 * Buscar un remito específico por código de barras 1D (Id_transaccion_remito o Numeroremito) en Gestion_Logistica.
 */
async function buscarRemito(req, res) {
  try {
    const rawVal = req.query.transaccion_id ?? req.query.comprobante ?? req.query.q ?? '';
    const rawCode = String(rawVal).trim();
    if (!rawCode) {
      return res.status(400).json({
        ok: false,
        error: 'Debe especificar el código de barras o TransaccionId a buscar.'
      });
    }

    const numericCode = isNaN(rawCode) ? -1 : Number(rawCode);
    const [rows] = await pool.query(
      `SELECT
         r.Id_transaccion_remito,
         r.Fecha,
         r.Organizacioniddestinatarioremito,
         r.Numeroremito,
         r.firma_cliente_url,
         r.firma_distribuidor_url,
         cl.Codigo AS ClienteCodigo,
         cl.Nombre AS ClienteNombre,
         MAX(etapa.Id_etapa) AS Id_etapa,
         MAX(etapa.Direccionentrega) AS Direccionentrega,
         MAX(hr.Transaccionid) AS HojaRutaTransaccionId,
         MAX(hr.Numerocomprobante) AS Hoja_de_ruta,
         MAX(rf.Firmado_cliente) AS Firmado_cliente,
         MAX(rf.Firmado_distribuidor) AS Firmado_distribuidor,
         MAX(rf.Url_imagen) AS Url_imagen,
         MAX(rf.Fecha_hora) AS Fecha_hora
       FROM REMITO r
       LEFT JOIN ORGANIZACION cl ON cl.Organizacionid = r.Organizacioniddestinatarioremito
       LEFT JOIN HOJA_RUTA_ITEM_REMITO ir ON ir.Id_transaccion_remito = r.Id_transaccion_remito
       LEFT JOIN HOJA_RUTA_ETAPA etapa ON etapa.Id_etapa = ir.Id_etapa
       LEFT JOIN HOJA_DE_RUTA hr ON hr.Transaccionid = etapa.Transaccionid_hoja_de_ruta
       LEFT JOIN REMITOS_FIRMADOS rf ON rf.Id_transaccion_remito = r.Id_transaccion_remito
       WHERE r.Id_transaccion_remito = ?
          OR CAST(r.Id_transaccion_remito AS CHAR) = ?
          OR r.Numeroremito = ?
       GROUP BY r.Id_transaccion_remito, r.Fecha, r.Organizacioniddestinatarioremito, r.Numeroremito,
                r.firma_cliente_url, r.firma_distribuidor_url, cl.Codigo, cl.Nombre
       LIMIT 1`,
      [numericCode, rawCode, rawCode]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: `No se encontró ningún remito asociado al código / TransaccionId "${rawCode}".`
      });
    }

    const ejMap = await fetchEjemplaresMap([rows[0].Id_transaccion_remito]);
    const remito = mapRemitoRow(rows[0], ejMap.get(rows[0].Id_transaccion_remito) || []);

    return res.json({
      ok: true,
      remito
    });
  } catch (error) {
    console.error(`[RemitosController.buscarRemito] Error: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Error al buscar el remito por código.',
      details: error.message
    });
  }
}

/**
 * Obtener los remitos de la hoja de ruta seleccionada o de las últimas hojas del chofer.
 */
async function getMisRemitos(req, res) {
  try {
    const user = req.user;
    const defaultN = parseInt(process.env.MAX_VIAJES_HISTORICOS_DEFAULT || '4', 10);
    const limitN = parseInt(req.query.n_viajes || defaultN, 10);
    const limit = Number.isInteger(limitN) && limitN > 0 ? limitN : 4;
    const selectedRoute = req.query.hoja_ruta;
    const selectedTxId = req.query.transaccion_id ? Number(req.query.transaccion_id) : null;
    const searchQuery = (req.query.q || '').trim();

    const whereClauses = ['hr.Usr_estadohojaruta = 1'];
    const params = [];

    if (selectedTxId && Number.isInteger(selectedTxId)) {
      whereClauses.push('hr.Transaccionid = ?');
      params.push(selectedTxId);
    } else if (selectedRoute && selectedRoute !== 'TODAS') {
      const cleanRoute = String(selectedRoute).trim();
      const withoutPrefix = cleanRoute.replace(/^HR-/i, '');
      whereClauses.push('(hr.Numerocomprobante = ? OR hr.Numerocomprobante = ?)');
      params.push(cleanRoute, withoutPrefix);
    } else if (user.rol === 'chofer' && user.organizacion_id) {
      const [driverHrs] = await pool.query(
        `SELECT hr.Transaccionid
         FROM HOJA_DE_RUTA hr
         LEFT JOIN ORGANIZACION tr ON tr.Organizacionid = hr.Organizacionid_transportista
         WHERE hr.Usr_estadohojaruta = 1
           AND (LOWER(tr.EMail) = LOWER(?) OR hr.Organizacionid_chofer = ? OR hr.Organizacionid_transportista = ?)
         ORDER BY hr.Fecha DESC, hr.Transaccionid DESC
         LIMIT ?`,
        [user.email, user.organizacion_id, user.organizacion_id, limit]
      );
      const txIds = (driverHrs || []).map((h) => h.Transaccionid);
      if (txIds.length === 0) {
        return res.json({ ok: true, total: 0, hojas_ruta_disponibles: [], remitos: [] });
      }
      whereClauses.push(`hr.Transaccionid IN (${txIds.map(() => '?').join(',')})`);
      params.push(...txIds);
    } else {
      const [recentHrs] = await pool.query(
        `SELECT Transaccionid FROM HOJAS_DE_RUTA_A_ENTREGAR ORDER BY Fecha DESC, Transaccionid DESC LIMIT ?`,
        [limit]
      );
      const txIds = (recentHrs || []).map((h) => h.Transaccionid);
      if (txIds.length > 0) {
        whereClauses.push(`hr.Transaccionid IN (${txIds.map(() => '?').join(',')})`);
        params.push(...txIds);
      }
    }

    if (searchQuery) {
      whereClauses.push(`(
        r.Numeroremito LIKE ?
        OR cl.Nombre LIKE ?
        OR etapa.Direccionentrega LIKE ?
        OR CAST(cl.Codigo AS CHAR) LIKE ?
        OR hr.Numerocomprobante LIKE ?
        OR CAST(r.Id_transaccion_remito AS CHAR) LIKE ?
      )`);
      const pattern = `%${searchQuery}%`;
      params.push(pattern, pattern, pattern, pattern, pattern, pattern);
    }

    const sql = `
      SELECT
        r.Id_transaccion_remito,
        r.Fecha,
        r.Organizacioniddestinatarioremito,
        r.Numeroremito,
        r.firma_cliente_url,
        r.firma_distribuidor_url,
        cl.Codigo AS ClienteCodigo,
        cl.Nombre AS ClienteNombre,
        MAX(etapa.Id_etapa) AS Id_etapa,
        MAX(etapa.Direccionentrega) AS Direccionentrega,
        MAX(hr.Transaccionid) AS HojaRutaTransaccionId,
        MAX(hr.Numerocomprobante) AS Hoja_de_ruta,
        MAX(rf.Firmado_cliente) AS Firmado_cliente,
        MAX(rf.Firmado_distribuidor) AS Firmado_distribuidor,
        MAX(rf.Url_imagen) AS Url_imagen,
        MAX(rf.Fecha_hora) AS Fecha_hora
      FROM HOJA_RUTA_ITEM_REMITO ir
      INNER JOIN HOJA_RUTA_ETAPA etapa ON etapa.Id_etapa = ir.Id_etapa
      INNER JOIN HOJA_DE_RUTA hr ON hr.Transaccionid = etapa.Transaccionid_hoja_de_ruta
      INNER JOIN REMITO r ON r.Id_transaccion_remito = ir.Id_transaccion_remito
      LEFT JOIN ORGANIZACION cl ON cl.Organizacionid = r.Organizacioniddestinatarioremito
      LEFT JOIN REMITOS_FIRMADOS rf ON rf.Id_transaccion_remito = r.Id_transaccion_remito
      WHERE ${whereClauses.join(' AND ')}
      GROUP BY r.Id_transaccion_remito, r.Fecha, r.Organizacioniddestinatarioremito, r.Numeroremito,
               r.firma_cliente_url, r.firma_distribuidor_url, cl.Codigo, cl.Nombre
      ORDER BY r.Fecha DESC, r.Id_transaccion_remito DESC
    `;

    const [rows] = await pool.query(sql, params);
    const ejMap = await fetchEjemplaresMap((rows || []).map((r) => r.Id_transaccion_remito));
    const mappedRemitos = (rows || []).map((r) => mapRemitoRow(r, ejMap.get(r.Id_transaccion_remito) || []));

    mappedRemitos.sort((a, b) => {
      const aPend = a.estado_firma === 'PENDIENTE' ? 0 : 1;
      const bPend = b.estado_firma === 'PENDIENTE' ? 0 : 1;
      if (aPend !== bPend) return aPend - bPend;
      return b.id - a.id;
    });

    const rutasDisponibles = Array.from(new Set(mappedRemitos.map((r) => r.nro_hoja_ruta).filter(Boolean)));

    return res.json({
      ok: true,
      total: mappedRemitos.length,
      hojas_ruta_disponibles: rutasDisponibles,
      remitos: mappedRemitos
    });
  } catch (error) {
    console.error(`[RemitosController.getMisRemitos] Error: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Error al obtener remitos en Gestion_Logistica.',
      details: error.message
    });
  }
}

/**
 * Listar viajes con métricas de remitos desde Gestion_Logistica.
 */
async function getViajes(req, res) {
  try {
    const user = req.user;
    const defaultN = parseInt(process.env.MAX_VIAJES_HISTORICOS_DEFAULT || '4', 10);
    const limitN = parseInt(req.query.n_viajes || defaultN, 10);
    const limit = Number.isInteger(limitN) && limitN > 0 ? limitN : 4;

    const filterClause = user.organizacion_id
      ? '(LOWER(tr.EMail) = LOWER(?) OR hr.Organizacionid_chofer = ? OR hr.Organizacionid_transportista = ?)'
      : '(LOWER(tr.EMail) = LOWER(?) OR ? = \'true\')';

    const filterParams = user.organizacion_id
      ? [user.email, user.organizacion_id, user.organizacion_id]
      : [user.email, process.env.ALLOW_UNASSIGNED_HR_FALLBACK || 'false'];

    const [viajes] = await pool.query(
      `SELECT
         hr.Transaccionid,
         hr.Numerocomprobante AS nro_hoja_ruta,
         hr.Fecha AS fecha,
         COUNT(DISTINCT ir.Id_transaccion_remito) AS total_remitos,
         COUNT(DISTINCT CASE WHEN r.firma_cliente_url IS NULL AND r.firma_distribuidor_url IS NULL AND rf.Id_remito_firmado IS NULL AND are.id IS NULL THEN r.Id_transaccion_remito END) AS pendientes,
         COUNT(DISTINCT CASE WHEN rf.Firmado_cliente = 1 OR r.firma_cliente_url IS NOT NULL OR are.firmado_cliente = 1 THEN r.Id_transaccion_remito END) AS firmados_cliente,
         COUNT(DISTINCT CASE WHEN rf.Firmado_distribuidor = 1 OR r.firma_distribuidor_url IS NOT NULL OR are.firmado_intermediario = 1 THEN r.Id_transaccion_remito END) AS firmados_intermediario
       FROM HOJA_DE_RUTA hr
       LEFT JOIN ORGANIZACION tr ON tr.Organizacionid = hr.Organizacionid_transportista
       LEFT JOIN HOJA_RUTA_ETAPA etapa ON etapa.Transaccionid_hoja_de_ruta = hr.Transaccionid
       LEFT JOIN HOJA_RUTA_ITEM_REMITO ir ON ir.Id_etapa = etapa.Id_etapa
       LEFT JOIN REMITO r ON r.Id_transaccion_remito = ir.Id_transaccion_remito
       LEFT JOIN REMITOS_FIRMADOS rf ON rf.Id_transaccion_remito = r.Id_transaccion_remito
       LEFT JOIN APP_REMITO_EJEMPLARES are ON are.id_transaccion_remito = r.Id_transaccion_remito
       WHERE hr.Usr_estadohojaruta = 1 AND ${filterClause}
       GROUP BY hr.Transaccionid, hr.Numerocomprobante, hr.Fecha
       ORDER BY hr.Fecha DESC, hr.Transaccionid DESC
       LIMIT ?`,
      [...filterParams, limit]
    );

    return res.json({
      ok: true,
      viajes: viajes || []
    });
  } catch (error) {
    console.error(`[RemitosController.getViajes] Error: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Error al consultar viajes.'
    });
  }
}

/**
 * Persiste control multi-ejemplar en APP_REMITO_EJEMPLARES y sincroniza estado consolidado en REMITO / REMITOS_FIRMADOS.
 */
async function persistControlInDatabase(remitoId, user, payload, normalizedEjemplares) {
  const {
    id_etapa,
    comprobante,
    firma_digital_base64,
    firma_receptor_aclaracion,
    firma_receptor_dni
  } = payload;

  return withAuditConnection(user, async (connection) => {
    await connection.beginTransaction();
    try {
      const [glogRows] = await connection.query(
        'SELECT Id_transaccion_remito, Numeroremito FROM REMITO WHERE Id_transaccion_remito = ? LIMIT 1',
        [remitoId]
      );

      if (!glogRows || glogRows.length === 0) {
        await connection.rollback();
        return { found: false, dbWarning: null };
      }

      const nroRemito = comprobante || glogRows[0].Numeroremito;

      let resolvedStageId = id_etapa || null;
      if (!resolvedStageId) {
        const [irRows] = await connection.query(
          'SELECT Id_etapa FROM HOJA_RUTA_ITEM_REMITO WHERE Id_transaccion_remito = ? LIMIT 1',
          [remitoId]
        );
        if (irRows && irRows.length > 0) {
          resolvedStageId = irRows[0].Id_etapa;
        }
      }

      const keepKeys = normalizedEjemplares.map((e) => e.ejemplar);
      await connection.query(
        `DELETE FROM APP_REMITO_EJEMPLARES
         WHERE id_transaccion_remito = ?
           AND ejemplar NOT IN (${keepKeys.map(() => '?').join(',')})`,
        [remitoId, ...keepKeys]
      );

      for (const ej of normalizedEjemplares) {
        await connection.query(
          `INSERT INTO APP_REMITO_EJEMPLARES
             (id_transaccion_remito, id_etapa, nro_remito, ejemplar, firmado_cliente, firmado_intermediario, no_firmado,
              observaciones, foto_url, foto_sharepoint_url, foto_nombre_archivo,
              firma_digital_base64, firma_receptor_aclaracion, firma_receptor_dni,
              organizacion_id_chofer, usuario_email, fecha_hora)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE
             id_etapa = VALUES(id_etapa),
             nro_remito = VALUES(nro_remito),
             firmado_cliente = VALUES(firmado_cliente),
             firmado_intermediario = VALUES(firmado_intermediario),
             no_firmado = VALUES(no_firmado),
             observaciones = VALUES(observaciones),
             foto_url = VALUES(foto_url),
             foto_sharepoint_url = VALUES(foto_sharepoint_url),
             foto_nombre_archivo = VALUES(foto_nombre_archivo),
             firma_digital_base64 = VALUES(firma_digital_base64),
             firma_receptor_aclaracion = VALUES(firma_receptor_aclaracion),
             firma_receptor_dni = VALUES(firma_receptor_dni),
             organizacion_id_chofer = VALUES(organizacion_id_chofer),
             usuario_email = VALUES(usuario_email),
             fecha_hora = NOW()`,
          [
            remitoId,
            resolvedStageId ? String(resolvedStageId) : null,
            nroRemito,
            ej.ejemplar,
            ej.firmado_cliente ? 1 : 0,
            ej.firmado_intermediario ? 1 : 0,
            ej.no_firmado ? 1 : 0,
            ej.observaciones || null,
            ej.foto_url || null,
            ej.foto_sharepoint_url || null,
            ej.foto_nombre_archivo || null,
            firma_digital_base64 || null,
            firma_receptor_aclaracion || null,
            firma_receptor_dni || null,
            user.organizacion_id || null,
            user.email || null
          ]
        );
      }

      const estadoConsolidado = computeConsolidatedStatus(normalizedEjemplares);
      const anyCliente = normalizedEjemplares.some((e) => e.firmado_cliente);
      const anyInterm = normalizedEjemplares.some((e) => e.firmado_intermediario);
      const clienteFoto = normalizedEjemplares.find((e) => e.firmado_cliente && (e.foto_sharepoint_url || e.foto_url));
      const intermFoto = normalizedEjemplares.find((e) => e.firmado_intermediario && (e.foto_sharepoint_url || e.foto_url));
      const anyFoto = normalizedEjemplares.find((e) => e.foto_sharepoint_url || e.foto_url);
      const markerNow = `FIRMADO_APP_${new Date().toISOString().slice(0, 19)}`;

      const clienteUrl = anyCliente
        ? String(clienteFoto?.foto_sharepoint_url || clienteFoto?.foto_url || anyFoto?.foto_sharepoint_url || anyFoto?.foto_url || markerNow).slice(0, 250)
        : null;
      const intermUrl = anyInterm
        ? String(intermFoto?.foto_sharepoint_url || intermFoto?.foto_url || anyFoto?.foto_sharepoint_url || anyFoto?.foto_url || markerNow).slice(0, 250)
        : null;

      await connection.query(
        'UPDATE REMITO SET firma_cliente_url = ?, firma_distribuidor_url = ? WHERE Id_transaccion_remito = ?',
        [clienteUrl, intermUrl, remitoId]
      );

      let dbWarning = null;
      if (resolvedStageId) {
        const photo150 = anyFoto
          ? String(anyFoto.foto_sharepoint_url || anyFoto.foto_url).slice(0, 150)
          : null;
        try {
          const [existingRf] = await connection.query(
            'SELECT Id_remito_firmado FROM REMITOS_FIRMADOS WHERE Id_transaccion_remito = ? LIMIT 1',
            [remitoId]
          );
          if (existingRf && existingRf.length > 0) {
            await connection.query(
              `UPDATE REMITOS_FIRMADOS
               SET Organizacionid_chofer = ?, Fecha_hora = NOW(), Url_imagen = COALESCE(?, Url_imagen),
                   Firmado_cliente = ?, Firmado_distribuidor = ?, Nro_remito = ?
               WHERE Id_remito_firmado = ?`,
              [
                user.organizacion_id || null,
                photo150,
                anyCliente ? 1 : 0,
                anyInterm ? 1 : 0,
                nroRemito,
                existingRf[0].Id_remito_firmado
              ]
            );
          } else {
            await connection.query(
              `INSERT INTO REMITOS_FIRMADOS
                 (Id_etapa, Organizacionid_chofer, Fecha_hora, Url_imagen, Firmado_cliente, Firmado_distribuidor, Id_transaccion_remito, Nro_remito)
               VALUES (?, ?, NOW(), ?, ?, ?, ?, ?)`,
              [
                resolvedStageId,
                user.organizacion_id || null,
                photo150,
                anyCliente ? 1 : 0,
                anyInterm ? 1 : 0,
                remitoId,
                nroRemito
              ]
            );
          }
        } catch (rfErr) {
          if (isStageIdTypeMismatch(rfErr)) {
            dbWarning = 'El control multi-ejemplar se guardó en APP_REMITO_EJEMPLARES y REMITO, pero REMITOS_FIRMADOS.Id_etapa es INT en Gestion_Logistica; solicite al DBA ejecutar docs/dba_gestion_logistica_ajustes.sql.';
            console.warn(`[RemitosController] ${dbWarning}`);
          } else {
            console.warn(`[RemitosController] Aviso al escribir REMITOS_FIRMADOS: ${rfErr.message}`);
          }
        }
      }

      await connection.commit();
      return {
        found: true,
        dbWarning,
        estado_firma: estadoConsolidado,
        ejemplares: normalizedEjemplares
      };
    } catch (txErr) {
      await connection.rollback();
      throw txErr;
    }
  });
}

/**
 * Guardar o actualizar la recepción multi-ejemplar y firmantes de un remito.
 */
async function saveControl(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;
    const parsed = normalizeIncomingEjemplares(req.body);

    if (parsed.error) {
      return res.status(400).json({
        ok: false,
        error: parsed.error
      });
    }

    const result = await persistControlInDatabase(Number(id) || id, user, req.body, parsed.ejemplares);

    if (!result.found) {
      return res.status(404).json({
        ok: false,
        error: `No se encontró el remito con ID ${id} en Gestion_Logistica.`
      });
    }

    return res.json({
      ok: true,
      message: 'Control de remito guardado exitosamente.',
      db_warning: result.dbWarning,
      remito: {
        id: Number(id) || id,
        estado_firma: result.estado_firma,
        ejemplares: result.ejemplares,
        ...req.body
      }
    });
  } catch (error) {
    console.error(`[RemitosController.saveControl] Error: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Error al guardar el control del remito.',
      details: error.message
    });
  }
}

/**
 * Subir fotografía de remito capturada por la cámara del chofer.
 */
async function uploadFoto(req, res) {
  try {
    const user = req.user;
    const file = req.file;
    const remitoId = req.body.remito_id;
    const comprobante = req.body.comprobante;
    const ejemplar = req.body.ejemplar;

    if (!file) {
      return res.status(400).json({
        ok: false,
        error: 'No se recibió ningún archivo de imagen.'
      });
    }

    const suffixEj = ejemplar ? `_${String(ejemplar).toLowerCase()}` : '';
    const finalFileName = SharePointService.generateFileName(
      user.codigo_chofer || user.organizacion_id || user.id,
      `${comprobante || (remitoId ? `ID_${remitoId}` : 'SIN_CBTE')}${suffixEj}`,
      path.extname(file.originalname) || '.jpg'
    );

    const oldPath = file.path;
    const newPath = path.join(uploadsDir, finalFileName);
    fs.renameSync(oldPath, newPath);

    console.log(`[Upload] Foto guardada localmente como: ${finalFileName} (Tamaño: ${(file.size / 1024).toFixed(1)} KB)`);

    const spResult = await SharePointService.uploadToSharePoint(newPath, finalFileName, {
      remitoId,
      comprobante,
      ejemplar,
      choferEmail: user.email,
      codigoChofer: user.codigo_chofer
    });

    const localUrl = `/uploads/${finalFileName}`;
    const sharepointUrl = spResult.isRemote ? spResult.url : null;
    const effectivePhotoUrl = sharepointUrl || localUrl;

    return res.json({
      ok: true,
      message: 'Fotografía procesada y asociada correctamente.',
      foto: {
        fileName: finalFileName,
        url: localUrl,
        sharepointUrl,
        effectiveUrl: effectivePhotoUrl,
        sizeKb: Math.round(file.size / 1024)
      }
    });
  } catch (error) {
    console.error(`[RemitosController.uploadFoto] Error: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Error al procesar la fotografía.',
      details: error.message
    });
  }
}

/**
 * Sincronización de lote de controles generados en modo Offline.
 */
async function syncOffline(req, res) {
  try {
    const user = req.user;
    const items = req.body.items;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'El cuerpo de la petición debe contener un array de "items" para sincronizar.'
      });
    }

    let processedCount = 0;
    const errors = [];

    for (const item of items) {
      try {
        if (!item.remito_id) continue;
        const parsed = normalizeIncomingEjemplares(item);
        if (parsed.error) {
          errors.push({ remito_id: item.remito_id, error: parsed.error });
          continue;
        }
        await persistControlInDatabase(item.remito_id, user, item, parsed.ejemplares);
        processedCount++;
      } catch (itemErr) {
        errors.push({ remito_id: item.remito_id, error: itemErr.message });
      }
    }

    return res.json({
      ok: true,
      message: `Sincronización completada: ${processedCount} registros actualizados.`,
      procesados: processedCount,
      errores: errors
    });
  } catch (error) {
    console.error(`[RemitosController.syncOffline] Error: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Error durante la sincronización de controles offline.'
    });
  }
}

module.exports = {
  buscarRemito,
  getMisRemitos,
  getViajes,
  saveControl,
  uploadFoto,
  syncOffline
};
