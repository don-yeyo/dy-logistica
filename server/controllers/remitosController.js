const path = require('path');
const fs = require('fs');
const { pool, withAuditConnection } = require('../config/db');
const SharePointService = require('../services/sharepointService');
const { uploadsDir } = require('../middlewares/uploadMiddleware');

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
 * Mapea una fila combinada de Gestion_Logistica (REMITO + ETAPA + HOJA_DE_RUTA + REMITOS_FIRMADOS)
 * al contrato de remito utilizado por el frontend mobile.
 */
function mapRemitoRow(row) {
  let estadoFirma = 'PENDIENTE';
  if (row.Firmado_cliente === 1 || row.firma_cliente_url) {
    estadoFirma = 'FIRMADO_CLIENTE';
  } else if (row.Firmado_distribuidor === 1 || row.firma_distribuidor_url) {
    estadoFirma = 'FIRMADO_INTERMEDIARIO';
  }

  const fotoUrl = row.Url_imagen || row.firma_cliente_url || row.firma_distribuidor_url || null;

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
    ejemplar: 'ORIGINAL',
    estado_firma: estadoFirma,
    tipo_documento: 'REMITO',
    observaciones: null,
    foto_url: fotoUrl,
    foto_sharepoint_url: fotoUrl && fotoUrl.startsWith('http') ? fotoUrl : null,
    fecha_control: row.Fecha_hora || null,
    source_db: 'Gestion_Logistica'
  };
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

    return res.json({
      ok: true,
      remito: mapRemitoRow(rows[0])
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
    const mappedRemitos = (rows || []).map(mapRemitoRow);

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

    const filterClause =
      user.rol === 'sysadmin' || user.rol === 'logistica'
        ? '1=1'
        : user.organizacion_id
        ? '(LOWER(tr.EMail) = LOWER(?) OR hr.Organizacionid_chofer = ? OR hr.Organizacionid_transportista = ?)'
        : '(LOWER(tr.EMail) = LOWER(?) OR ? = \'true\')';

    const filterParams =
      user.rol === 'sysadmin' || user.rol === 'logistica'
        ? []
        : user.organizacion_id
        ? [user.email, user.organizacion_id, user.organizacion_id]
        : [user.email, process.env.ALLOW_UNASSIGNED_HR_FALLBACK || 'false'];

    const [viajes] = await pool.query(
      `SELECT
         hr.Transaccionid,
         hr.Numerocomprobante AS nro_hoja_ruta,
         hr.Fecha AS fecha,
         COUNT(DISTINCT ir.Id_transaccion_remito) AS total_remitos,
         COUNT(DISTINCT CASE WHEN r.firma_cliente_url IS NULL AND r.firma_distribuidor_url IS NULL AND rf.Id_remito_firmado IS NULL THEN r.Id_transaccion_remito END) AS pendientes,
         COUNT(DISTINCT CASE WHEN rf.Firmado_cliente = 1 OR r.firma_cliente_url IS NOT NULL THEN r.Id_transaccion_remito END) AS firmados_cliente,
         COUNT(DISTINCT CASE WHEN rf.Firmado_distribuidor = 1 OR r.firma_distribuidor_url IS NOT NULL THEN r.Id_transaccion_remito END) AS firmados_intermediario
       FROM HOJA_DE_RUTA hr
       LEFT JOIN ORGANIZACION tr ON tr.Organizacionid = hr.Organizacionid_transportista
       LEFT JOIN HOJA_RUTA_ETAPA etapa ON etapa.Transaccionid_hoja_de_ruta = hr.Transaccionid
       LEFT JOIN HOJA_RUTA_ITEM_REMITO ir ON ir.Id_etapa = etapa.Id_etapa
       LEFT JOIN REMITO r ON r.Id_transaccion_remito = ir.Id_transaccion_remito
       LEFT JOIN REMITOS_FIRMADOS rf ON rf.Id_transaccion_remito = r.Id_transaccion_remito
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
 * Persiste control de firma en Gestion_Logistica.REMITO y REMITOS_FIRMADOS con auditoría.
 */
async function persistControlInDatabase(remitoId, user, payload) {
  const {
    estado_firma,
    foto_url,
    foto_sharepoint_url,
    id_etapa,
    comprobante
  } = payload;

  const botCliente = estado_firma === 'FIRMADO_CLIENTE' ? 1 : 0;
  const botDistribuidor = estado_firma === 'FIRMADO_INTERMEDIARIO' ? 1 : 0;
  const effectivePhotoUrl = foto_sharepoint_url || foto_url || null;
  const truncatedPhoto250 = effectivePhotoUrl ? String(effectivePhotoUrl).slice(0, 250) : null;
  const truncatedPhoto150 = effectivePhotoUrl ? String(effectivePhotoUrl).slice(0, 150) : null;
  const signedMarker = truncatedPhoto250 || `FIRMADO_APP_${new Date().toISOString().slice(0, 19)}`;

  return withAuditConnection(user, async (connection) => {
    const [glogRows] = await connection.query(
      'SELECT Id_transaccion_remito, Numeroremito FROM REMITO WHERE Id_transaccion_remito = ? LIMIT 1',
      [remitoId]
    );

    if (!glogRows || glogRows.length === 0) {
      return { found: false, dbWarning: null };
    }

    const nroRemito = comprobante || glogRows[0].Numeroremito;

    if (estado_firma === 'FIRMADO_CLIENTE') {
      await connection.query(
        'UPDATE REMITO SET firma_cliente_url = ? WHERE Id_transaccion_remito = ?',
        [signedMarker, remitoId]
      );
    } else if (estado_firma === 'FIRMADO_INTERMEDIARIO') {
      await connection.query(
        'UPDATE REMITO SET firma_distribuidor_url = ? WHERE Id_transaccion_remito = ?',
        [signedMarker, remitoId]
      );
    } else if (estado_firma === 'NO_FIRMADO') {
      await connection.query(
        'UPDATE REMITO SET firma_cliente_url = NULL, firma_distribuidor_url = NULL WHERE Id_transaccion_remito = ?',
        [remitoId]
      );
    }

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

    let dbWarning = null;
    if (resolvedStageId) {
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
              truncatedPhoto150,
              botCliente,
              botDistribuidor,
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
              truncatedPhoto150,
              botCliente,
              botDistribuidor,
              remitoId,
              nroRemito
            ]
          );
        }
      } catch (rfErr) {
        if (isStageIdTypeMismatch(rfErr)) {
          dbWarning = 'El remito se actualizó en REMITO, pero REMITOS_FIRMADOS.Id_etapa es INT en Gestion_Logistica; solicite al DBA ejecutar docs/dba_gestion_logistica_ajustes.sql.';
          console.warn(`[RemitosController] ${dbWarning}`);
        } else {
          console.warn(`[RemitosController] Aviso al escribir REMITOS_FIRMADOS: ${rfErr.message}`);
        }
      }
    }

    return { found: true, dbWarning };
  });
}

/**
 * Guardar o actualizar la marcación de firma de un remito.
 */
async function saveControl(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;
    const { estado_firma } = req.body;

    if (!estado_firma || !['PENDIENTE', 'FIRMADO_CLIENTE', 'FIRMADO_INTERMEDIARIO', 'NO_FIRMADO'].includes(estado_firma)) {
      return res.status(400).json({
        ok: false,
        error: 'Estado de firma inválido. Valores permitidos: PENDIENTE, FIRMADO_CLIENTE, FIRMADO_INTERMEDIARIO, NO_FIRMADO.'
      });
    }

    const result = await persistControlInDatabase(Number(id) || id, user, req.body);

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
        estado_firma,
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

    const finalFileName = SharePointService.generateFileName(
      user.codigo_chofer || user.organizacion_id || user.id,
      comprobante || (remitoId ? `ID_${remitoId}` : 'SIN_CBTE'),
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
        if (!item.remito_id || !item.estado_firma) continue;
        await persistControlInDatabase(item.remito_id, user, item);
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
