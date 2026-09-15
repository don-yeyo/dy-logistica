const path = require('path');
const fs = require('fs');
const { pool } = require('../config/db');
const SharePointService = require('../services/sharepointService');
const { uploadsDir } = require('../middlewares/uploadMiddleware');

/**
 * Buscar un remito específico por código de barras 1D (finne_transaccionID o finne_Comprobante).
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

    const sql = `
      SELECT 
        id,
        finne_transaccionID,
        finne_Copias,
        finne_Fecha,
        finne_CodigoCliente,
        finne_Cliente,
        finne_domicilio,
        finne_importe_total,
        finne_Comprobante,
        nro_hoja_ruta,
        transportistas,
        ejemplar,
        estado_firma,
        tipo_documento,
        observaciones,
        foto_url,
        foto_sharepoint_url,
        foto_nombre_archivo,
        fecha_control,
        controlado_por_chofer_id,
        controlado_por_chofer_email,
        sincronizado_offline
      FROM remitos
      WHERE finne_transaccionID = ? 
         OR CAST(finne_transaccionID AS CHAR) = ?
         OR finne_Comprobante = ? 
         OR id = ?
      LIMIT 1
    `;

    const [rows] = await pool.query(sql, [rawCode, rawCode, rawCode, isNaN(rawCode) ? -1 : Number(rawCode)]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: `No se encontró ningún remito asociado al código / TransaccionId "${rawCode}".`
      });
    }

    return res.json({
      ok: true,
      remito: rows[0]
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
 * Helper para obtener la lista de las últimas N hojas de ruta para el chofer autenticado.
 */
async function getRecentRouteNumbers(codigoChofer, email, limitN = 4, rol = 'chofer') {
  try {
    let query;
    let params;

    if (rol === 'admin') {
      query = `
        SELECT nro_hoja_ruta, MAX(finne_Fecha) AS ultima_fecha
        FROM remitos
        WHERE nro_hoja_ruta IS NOT NULL AND nro_hoja_ruta != ''
        GROUP BY nro_hoja_ruta
        ORDER BY ultima_fecha DESC, nro_hoja_ruta DESC
        LIMIT ?
      `;
      params = [limitN];
    } else {
      query = `
        SELECT nro_hoja_ruta, MAX(finne_Fecha) AS ultima_fecha
        FROM remitos
        WHERE nro_hoja_ruta IS NOT NULL AND nro_hoja_ruta != '' AND (
          JSON_CONTAINS(transportistas, JSON_OBJECT('chofer', ?)) 
          OR JSON_SEARCH(transportistas, 'one', ?) IS NOT NULL
          OR controlado_por_chofer_email = ?
        )
        GROUP BY nro_hoja_ruta
        ORDER BY ultima_fecha DESC, nro_hoja_ruta DESC
        LIMIT ?
      `;
      params = [codigoChofer || '', codigoChofer || '', email || '', limitN];
    }

    const [rows] = await pool.query(query, params);
    if (rows && rows.length > 0) {
      return rows.map(r => r.nro_hoja_ruta);
    }

    // Fallback: Si el chofer aún no tiene viajes específicamente asignados, devolver las hojas más recientes globales
    const [fallbackRows] = await pool.query(`
      SELECT nro_hoja_ruta, MAX(finne_Fecha) AS ultima_fecha
      FROM remitos
      WHERE nro_hoja_ruta IS NOT NULL AND nro_hoja_ruta != ''
      GROUP BY nro_hoja_ruta
      ORDER BY ultima_fecha DESC, nro_hoja_ruta DESC
      LIMIT ?
    `, [limitN]);

    return fallbackRows.map(r => r.nro_hoja_ruta);
  } catch (error) {
    console.warn(`[RemitosController] Error al obtener hojas de ruta recientes: ${error.message}`);
    return ['HR-23812', 'HR-23810', 'HR-23806', 'HR-23805'];
  }
}

/**
 * Obtener los remitos de los últimos N viajes del chofer autenticado.
 */
async function getMisRemitos(req, res) {
  try {
    const user = req.user;
    const defaultN = parseInt(process.env.MAX_VIAJES_HISTORICOS_DEFAULT || '4', 10);
    const limitN = parseInt(req.query.n_viajes || defaultN, 10);
    const selectedRoute = req.query.hoja_ruta;
    const searchQuery = (req.query.q || '').trim();

    // 1. Obtener las N hojas de ruta recientes
    const recentRoutes = await getRecentRouteNumbers(user.codigo_chofer, user.email, limitN, user.rol);

    // 2. Construir condiciones SQL
    let whereClauses = [];
    let params = [];

    // Filtro por chofer asignado
    whereClauses.push(`(
      JSON_CONTAINS(transportistas, JSON_OBJECT('chofer', ?)) 
      OR JSON_SEARCH(transportistas, 'one', ?) IS NOT NULL
      OR controlado_por_chofer_email = ?
      OR ? = 'admin'
    )`);
    params.push(user.codigo_chofer || '', user.codigo_chofer || '', user.email || '', user.rol);

    // Filtro por hoja de ruta
    if (selectedRoute && selectedRoute !== 'TODAS') {
      whereClauses.push('nro_hoja_ruta = ?');
      params.push(selectedRoute);
    } else if (recentRoutes.length > 0) {
      const placeholders = recentRoutes.map(() => '?').join(',');
      whereClauses.push(`nro_hoja_ruta IN (${placeholders})`);
      params.push(...recentRoutes);
    }

    // Búsqueda predictiva adicional si viene parámetro 'q'
    if (searchQuery) {
      whereClauses.push(`(
        finne_Comprobante LIKE ? 
        OR finne_Cliente LIKE ? 
        OR finne_domicilio LIKE ? 
        OR CAST(finne_CodigoCliente AS CHAR) LIKE ?
        OR nro_hoja_ruta LIKE ?
        OR CAST(finne_transaccionID AS CHAR) LIKE ?
      )`);
      const searchPattern = `%${searchQuery}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const sql = `
      SELECT 
        id,
        finne_transaccionID,
        finne_Copias,
        finne_Fecha,
        finne_CodigoCliente,
        finne_Cliente,
        finne_domicilio,
        finne_importe_total,
        finne_Comprobante,
        nro_hoja_ruta,
        transportistas,
        ejemplar,
        estado_firma,
        tipo_documento,
        observaciones,
        foto_url,
        foto_sharepoint_url,
        foto_nombre_archivo,
        fecha_control,
        controlado_por_chofer_id,
        controlado_por_chofer_email,
        sincronizado_offline
      FROM remitos
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY 
        CASE WHEN estado_firma = 'PENDIENTE' THEN 0 ELSE 1 END ASC,
        finne_Fecha DESC,
        id DESC
    `;

    const [remitos] = await pool.query(sql, params);

    return res.json({
      ok: true,
      total: remitos.length,
      hojas_ruta_disponibles: recentRoutes,
      remitos: remitos
    });

  } catch (error) {
    console.error(`[RemitosController.getMisRemitos] Error: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Error al obtener remitos del chofer.',
      details: error.message
    });
  }
}

/**
 * Obtener listado de viajes/hojas de ruta con métricas para el chofer.
 */
async function getViajes(req, res) {
  try {
    const user = req.user;
    const defaultN = parseInt(process.env.MAX_VIAJES_HISTORICOS_DEFAULT || '4', 10);
    const limitN = parseInt(req.query.n_viajes || defaultN, 10);

    const sql = `
      SELECT 
        nro_hoja_ruta,
        MAX(finne_Fecha) AS fecha,
        COUNT(id) AS total_remitos,
        COUNT(CASE WHEN estado_firma = 'PENDIENTE' THEN 1 END) AS pendientes,
        COUNT(CASE WHEN estado_firma = 'FIRMADO_CLIENTE' THEN 1 END) AS firmados_cliente,
        COUNT(CASE WHEN estado_firma = 'FIRMADO_INTERMEDIARIO' THEN 1 END) AS firmados_intermediario,
        COUNT(CASE WHEN estado_firma = 'NO_FIRMADO' THEN 1 END) AS no_firmados
      FROM remitos
      WHERE nro_hoja_ruta IS NOT NULL AND (
        JSON_CONTAINS(transportistas, JSON_OBJECT('chofer', ?)) 
        OR JSON_SEARCH(transportistas, 'one', ?) IS NOT NULL
        OR controlado_por_chofer_email = ?
        OR ? = 'admin'
      )
      GROUP BY nro_hoja_ruta
      ORDER BY fecha DESC, nro_hoja_ruta DESC
      LIMIT ?
    `;

    const [viajes] = await pool.query(sql, [
      user.codigo_chofer || '', 
      user.codigo_chofer || '', 
      user.email || '', 
      user.rol, 
      limitN
    ]);

    return res.json({
      ok: true,
      viajes: viajes
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
 * Guardar o actualizar la marcación de firma de un remito.
 */
async function saveControl(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;
    const {
      ejemplar,
      estado_firma,
      tipo_documento,
      observaciones,
      foto_url,
      foto_sharepoint_url,
      foto_nombre_archivo,
      sincronizado_offline
    } = req.body;

    if (!estado_firma || !['PENDIENTE', 'FIRMADO_CLIENTE', 'FIRMADO_INTERMEDIARIO', 'NO_FIRMADO'].includes(estado_firma)) {
      return res.status(400).json({
        ok: false,
        error: 'Estado de firma inválido. Valores permitidos: PENDIENTE, FIRMADO_CLIENTE, FIRMADO_INTERMEDIARIO, NO_FIRMADO.'
      });
    }

    const validEjemplares = ['ORIGINAL', 'DUPLICADO', 'TRIPLICADO', 'CUATRIPLICADO', 'RECEPCION_VALORIZADA', 'OTRO'];
    const chosenEjemplar = validEjemplares.includes(ejemplar) ? ejemplar : 'ORIGINAL';

    const botConfirmadoCliente = estado_firma === 'FIRMADO_CLIENTE' ? 1 : 0;
    const botConfirmadoDistribuidor = estado_firma === 'FIRMADO_INTERMEDIARIO' ? 1 : 0;
    const docType = tipo_documento || (chosenEjemplar === 'RECEPCION_VALORIZADA' ? 'RECEPCION_VALORIZADA' : 'REMITO');
    const isOffline = sincronizado_offline ? 1 : 0;

    const sql = `
      UPDATE remitos
      SET 
        ejemplar = ?,
        estado_firma = ?,
        tipo_documento = ?,
        observaciones = ?,
        foto_url = COALESCE(?, foto_url),
        foto_sharepoint_url = COALESCE(?, foto_sharepoint_url),
        foto_nombre_archivo = COALESCE(?, foto_nombre_archivo),
        fecha_control = NOW(),
        controlado_por_chofer_id = ?,
        controlado_por_chofer_email = ?,
        sincronizado_offline = ?,
        bot_confirmado_cliente = ?,
        bot_confirmado_distribuidor = ?
      WHERE id = ?
    `;

    const [result] = await pool.query(sql, [
      chosenEjemplar,
      estado_firma,
      docType,
      observaciones || null,
      foto_url || null,
      foto_sharepoint_url || null,
      foto_nombre_archivo || null,
      user.id || null,
      user.email,
      isOffline,
      botConfirmadoCliente,
      botConfirmadoDistribuidor,
      id
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        ok: false,
        error: `No se encontró el remito con ID ${id}.`
      });
    }

    // Devolver registro actualizado
    const [updated] = await pool.query('SELECT * FROM remitos WHERE id = ? LIMIT 1', [id]);

    return res.json({
      ok: true,
      message: 'Control de remito guardado exitosamente.',
      remito: updated[0]
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

    if (!file) {
      return res.status(400).json({
        ok: false,
        error: 'No se recibió ningún archivo de imagen.'
      });
    }

    // 1. Generar nombre estandarizado: FOTO_CAM_CHOFER_<codigoChofer>_<comprobante>_<timestamp>.jpg
    const finalFileName = SharePointService.generateFileName(
      user.codigo_chofer || user.id,
      comprobante || (remitoId ? `ID_${remitoId}` : 'SIN_CBTE'),
      path.extname(file.originalname) || '.jpg'
    );

    const oldPath = file.path;
    const newPath = path.join(uploadsDir, finalFileName);

    // Renombrar archivo local
    fs.renameSync(oldPath, newPath);

    console.log(`[Upload] Foto guardada localmente como: ${finalFileName} (Tamaño: ${(file.size / 1024).toFixed(1)} KB)`);

    // 2. Subir a SharePoint / Power Automate
    const spResult = await SharePointService.uploadToSharePoint(newPath, finalFileName, {
      remitoId: remitoId,
      comprobante: comprobante,
      choferEmail: user.email,
      codigoChofer: user.codigo_chofer
    });

    const localUrl = `/uploads/${finalFileName}`;
    const sharepointUrl = spResult.isRemote ? spResult.url : null;

    // 3. Si se envió remitoId, actualizar en la base de datos automáticamente
    if (remitoId) {
      await pool.query(`
        UPDATE remitos
        SET 
          foto_url = ?,
          foto_sharepoint_url = ?,
          foto_nombre_archivo = ?
        WHERE id = ?
      `, [localUrl, sharepointUrl, finalFileName, remitoId]);
    }

    return res.json({
      ok: true,
      message: 'Fotografía procesada y asociada correctamente.',
      foto: {
        fileName: finalFileName,
        url: localUrl,
        sharepointUrl: sharepointUrl,
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
    let errors = [];

    const validEjemplares = ['ORIGINAL', 'DUPLICADO', 'TRIPLICADO', 'CUATRIPLICADO', 'RECEPCION_VALORIZADA', 'OTRO'];

    for (const item of items) {
      try {
        const { remito_id, ejemplar, estado_firma, tipo_documento, observaciones, foto_url, foto_nombre_archivo } = item;
        
        if (!remito_id || !estado_firma) continue;

        const chosenEjemplar = validEjemplares.includes(ejemplar) ? ejemplar : 'ORIGINAL';
        const botCliente = estado_firma === 'FIRMADO_CLIENTE' ? 1 : 0;
        const botDistribuidor = estado_firma === 'FIRMADO_INTERMEDIARIO' ? 1 : 0;

        await pool.query(`
          UPDATE remitos
          SET 
            ejemplar = ?,
            estado_firma = ?,
            tipo_documento = ?,
            observaciones = ?,
            foto_url = COALESCE(?, foto_url),
            foto_nombre_archivo = COALESCE(?, foto_nombre_archivo),
            fecha_control = NOW(),
            controlado_por_chofer_id = ?,
            controlado_por_chofer_email = ?,
            sincronizado_offline = 1,
            bot_confirmado_cliente = ?,
            bot_confirmado_distribuidor = ?
          WHERE id = ?
        `, [
          chosenEjemplar,
          estado_firma,
          tipo_documento || 'REMITO',
          observaciones || null,
          foto_url || null,
          foto_nombre_archivo || null,
          user.id,
          user.email,
          botCliente,
          botDistribuidor,
          remito_id
        ]);

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
