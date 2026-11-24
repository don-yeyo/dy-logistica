const { pool, withAuditConnection } = require('../config/db');

const NON_NEGATIVE_INT_REGEX = /^\d+$/;
const POSITIVE_INT_REGEX = /^[1-9]\d*$/;
const CAJONES_TIPO_ENTREGA = parseInt(process.env.CAJONES_TIPO_ENTREGA || '1', 10);
const CAJONES_TIPO_DEVOLUCION = parseInt(process.env.CAJONES_TIPO_DEVOLUCION || '2', 10);

function parseNonNegativeIntEnv(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function allowUnassignedFallback(user) {
  return Boolean(!user?.organizacion_id && process.env.ALLOW_UNASSIGNED_HR_FALLBACK === 'true');
}

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
 * Helper interno: obtiene cabecera de hoja de ruta desde Gestion_Logistica.HOJAS_DE_RUTA_A_ENTREGAR
 * validando acceso del chofer por EMail o por mapeo organizacion_id (chofer/transportista).
 */
async function findHojaRutaHeader(transaccionId, user) {
  const txId = Number(transaccionId);
  if (!Number.isInteger(txId) || txId <= 0) {
    return null;
  }

  const baseSelect = `
    SELECT
      v.Transaccionid,
      v.Hoja_de_ruta,
      v.Fecha,
      hr.Usr_viaje AS Viaje,
      COALESCE(NULLIF(TRIM(v.Chofer), ''), NULLIF(TRIM(tr.Nombre), ''), 'Sin Chofer Asignado') AS Chofer,
      v.EMail,
      COALESCE(NULLIF(TRIM(tr.Nombre), ''), NULLIF(TRIM(v.Chofer), ''), 'Transporte No Informado') AS Transporte,
      v.Patente_camion,
      v.Patente_acoplado,
      hr.Organizacionid_chofer,
      hr.Organizacionid_transportista
    FROM HOJAS_DE_RUTA_A_ENTREGAR v
    LEFT JOIN HOJA_DE_RUTA hr ON hr.Transaccionid = v.Transaccionid
    LEFT JOIN ORGANIZACION tr ON tr.Organizacionid = hr.Organizacionid_transportista
  `;

  if (user.organizacion_id) {
    const [mappedRows] = await pool.query(
      `${baseSelect}
       WHERE v.Transaccionid = ?
         AND (LOWER(v.EMail) = LOWER(?) OR hr.Organizacionid_chofer = ? OR hr.Organizacionid_transportista = ?)
       LIMIT 1`,
      [txId, user.email, user.organizacion_id, user.organizacion_id]
    );
    if (mappedRows && mappedRows.length > 0) {
      return mappedRows[0];
    }
    return null;
  }

  const [emailRows] = await pool.query(
    `${baseSelect} WHERE v.Transaccionid = ? AND LOWER(v.EMail) = LOWER(?) LIMIT 1`,
    [txId, user.email]
  );
  if (emailRows && emailRows.length > 0) {
    return emailRows[0];
  }

  if (allowUnassignedFallback(user)) {
    const [fallbackRows] = await pool.query(`${baseSelect} WHERE v.Transaccionid = ? LIMIT 1`, [txId]);
    return fallbackRows?.[0] || null;
  }

  return null;
}

/**
 * Sección 4.2: Listado de hojas de ruta desde HOJAS_DE_RUTA_A_ENTREGAR (exclusivo chofer, con ventana de días).
 */
async function getHojasDeRuta(req, res) {
  try {
    const user = req.user;
    const defaultLimit = parseInt(process.env.MAX_HOJAS_RUTA_LIST || '20', 10);
    const parsedLimit = parseInt(req.query.limit || defaultLimit, 10);
    const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 20;
    const diasAtras = parseNonNegativeIntEnv(process.env.HOJAS_RUTA_DIAS_ATRAS, 1);
    const diasAdelante = parseNonNegativeIntEnv(process.env.HOJAS_RUTA_DIAS_ADELANTE, 1);
    const dateWindowClause = 'DATE(v.Fecha) BETWEEN DATE_SUB(CURDATE(), INTERVAL ? DAY) AND DATE_ADD(CURDATE(), INTERVAL ? DAY)';

    const baseSelect = `
      SELECT
        v.Hoja_de_ruta,
        v.Fecha,
        hr.Usr_viaje AS Viaje,
        COALESCE(NULLIF(TRIM(v.Chofer), ''), NULLIF(TRIM(tr.Nombre), ''), 'Sin Chofer Asignado') AS Chofer,
        v.Patente_camion,
        v.Patente_acoplado,
        COALESCE(NULLIF(TRIM(tr.Nombre), ''), NULLIF(TRIM(v.Chofer), ''), 'Transporte No Informado') AS Transporte,
        v.Transaccionid,
        v.EMail
      FROM HOJAS_DE_RUTA_A_ENTREGAR v
      LEFT JOIN HOJA_DE_RUTA hr ON hr.Transaccionid = v.Transaccionid
      LEFT JOIN ORGANIZACION tr ON tr.Organizacionid = hr.Organizacionid_transportista
    `;

    let rows = [];
    let fallbackUsed = false;

    if (user.organizacion_id) {
      const [mappedRows] = await pool.query(
        `${baseSelect}
         WHERE (LOWER(v.EMail) = LOWER(?) OR hr.Organizacionid_chofer = ? OR hr.Organizacionid_transportista = ?)
           AND ${dateWindowClause}
         ORDER BY v.Fecha DESC, v.Transaccionid DESC
         LIMIT ?`,
        [user.email, user.organizacion_id, user.organizacion_id, diasAtras, diasAdelante, limit]
      );
      rows = mappedRows || [];
    } else {
      const [emailRows] = await pool.query(
        `${baseSelect}
         WHERE LOWER(v.EMail) = LOWER(?)
           AND ${dateWindowClause}
         ORDER BY v.Fecha DESC, v.Transaccionid DESC
         LIMIT ?`,
        [user.email, diasAtras, diasAdelante, limit]
      );
      rows = emailRows || [];

      if (rows.length === 0 && allowUnassignedFallback(user)) {
        const [fallbackRows] = await pool.query(
          `${baseSelect}
           WHERE ${dateWindowClause}
           ORDER BY v.Fecha DESC, v.Transaccionid DESC
           LIMIT ?`,
          [diasAtras, diasAdelante, limit]
        );
        rows = fallbackRows || [];
        fallbackUsed = true;
      }
    }

    return res.json({
      ok: true,
      fallback_sin_email: fallbackUsed,
      ventana_dias: {
        atras: diasAtras,
        adelante: diasAdelante
      },
      hojas_ruta: rows
    });
  } catch (error) {
    console.error(`[HojasRutaController.getHojasDeRuta] Error: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Error al consultar las hojas de ruta asignadas.',
      details: error.message
    });
  }
}

/**
 * Sección 4.2.1: Obtener ítems a entregar desde ITEMS_A_ENTREGAR filtrado por Transaccionid.
 */
async function getEntregasByTransaccion(req, res) {
  try {
    const { transaccionId } = req.params;
    const hojaRuta = await findHojaRutaHeader(transaccionId, req.user);

    if (!hojaRuta) {
      return res.status(404).json({
        ok: false,
        error: 'Hoja de ruta no encontrada o no asignada al chofer autenticado.'
      });
    }

    const [items] = await pool.query(
      `SELECT
         Direccionentrega AS Lugar_de_Entrega,
         Numeroremito AS Remito,
         Cliente,
         Nombre AS Producto,
         Cantidad AS Remitido,
         cantidad_descargada_Chofer AS Entregado,
         codigo_motivo_dif,
         Id_transaccion_remito,
         Hojarutaitemid,
         Transaccionid
       FROM ITEMS_A_ENTREGAR
       WHERE Transaccionid = ? AND Hojarutaitemid IS NOT NULL
       ORDER BY Direccionentrega ASC, Numeroremito ASC, Hojarutaitemid ASC`,
      [hojaRuta.Transaccionid]
    );

    return res.json({
      ok: true,
      hoja_ruta: hojaRuta,
      items: items || []
    });
  } catch (error) {
    console.error(`[HojasRutaController.getEntregasByTransaccion] Error: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Error al obtener los ítems a entregar.',
      details: error.message
    });
  }
}

/**
 * Sección 4.2.1: Actualizar cantidad_descargada_Chofer en HOJA_RUTA_ITEM_REMITO por Hojarutaitemid.
 */
async function guardarEntregas(req, res) {
  try {
    const { transaccionId } = req.params;
    const { items } = req.body;
    const hojaRuta = await findHojaRutaHeader(transaccionId, req.user);

    if (!hojaRuta) {
      return res.status(404).json({
        ok: false,
        error: 'Hoja de ruta no encontrada o no asignada al chofer autenticado.'
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'Debe informar al menos un producto para confirmar la descarga.'
      });
    }

    const normalizedItems = [];
    for (const item of items) {
      const itemId = Number(item.Hojarutaitemid);
      const rawVal = item.Entregado === null || item.Entregado === undefined ? '' : String(item.Entregado).trim();

      if (!Number.isInteger(itemId) || itemId <= 0) {
        return res.status(400).json({
          ok: false,
          error: 'Identificador Hojarutaitemid inválido en uno de los productos.'
        });
      }

      if (!NON_NEGATIVE_INT_REGEX.test(rawVal)) {
        return res.status(400).json({
          ok: false,
          error: 'El campo Entregado debe ser únicamente un número entero positivo (sin negativos, decimales, texto ni símbolos).'
        });
      }

      normalizedItems.push({
        Hojarutaitemid: itemId,
        Entregado: parseInt(rawVal, 10),
        codigo_motivo_dif: item.codigo_motivo_dif ? Number(item.codigo_motivo_dif) : null
      });
    }

    const updatedCount = await withAuditConnection(req.user, async (connection) => {
      await connection.beginTransaction();
      try {
        let count = 0;
        for (const item of normalizedItems) {
          const [result] = await connection.query(
            `UPDATE HOJA_RUTA_ITEM_REMITO ir
             INNER JOIN HOJA_RUTA_ETAPA e ON e.Id_etapa = ir.Id_etapa
             SET ir.cantidad_descargada_Chofer = ?,
                 ir.codigo_motivo_dif = COALESCE(?, ir.codigo_motivo_dif)
             WHERE ir.Hojarutaitemid = ? AND e.Transaccionid_hoja_de_ruta = ?`,
            [item.Entregado, item.codigo_motivo_dif, item.Hojarutaitemid, hojaRuta.Transaccionid]
          );
          count += result.affectedRows;
        }
        await connection.commit();
        return count;
      } catch (txErr) {
        await connection.rollback();
        throw txErr;
      }
    });

    const [refreshedItems] = await pool.query(
      `SELECT
         Direccionentrega AS Lugar_de_Entrega,
         Numeroremito AS Remito,
         Cliente,
         Nombre AS Producto,
         Cantidad AS Remitido,
         cantidad_descargada_Chofer AS Entregado,
         codigo_motivo_dif,
         Id_transaccion_remito,
         Hojarutaitemid,
         Transaccionid
       FROM ITEMS_A_ENTREGAR
       WHERE Transaccionid = ? AND Hojarutaitemid IS NOT NULL
       ORDER BY Direccionentrega ASC, Numeroremito ASC, Hojarutaitemid ASC`,
      [hojaRuta.Transaccionid]
    );

    return res.json({
      ok: true,
      message: `Confirmación de descarga guardada correctamente (${updatedCount} ítems actualizados).`,
      actualizados: updatedCount,
      items: refreshedItems
    });
  } catch (error) {
    console.error(`[HojasRutaController.guardarEntregas] Error: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Error al guardar la confirmación de descarga.',
      details: error.message
    });
  }
}

async function queryDevolucionesRows(transaccionId) {
  const [rows] = await pool.query(
    `SELECT
       etapa.Transaccionid_hoja_de_ruta AS Transaccionid,
       etapa.Id_etapa AS id_etapa,
       hr.Fecha AS fecha,
       etapa.Direccionentrega AS Lugar_de_Entrega,
       COALESCE(de.id_cliente, etapa.Organizacionidoperador) AS id_cliente,
       COALESCE(cl_dev.Nombre, cl_op.Nombre) AS Cliente,
       de.id_remito_devoluciones,
       di.id_remito_devoluciones_item,
       di.id_producto,
       pr.Nombre AS Producto,
       di.cantidad_check_chofer AS Cantidad,
       di.vencimiento_check_chofer AS Vencimiento,
       di.codigo_motivo_dif,
       TRIM(md.Descripcion) AS Motivo,
       di.tipo AS Tipo
     FROM HOJA_RUTA_ETAPA etapa
     INNER JOIN HOJA_DE_RUTA hr ON hr.Transaccionid = etapa.Transaccionid_hoja_de_ruta
     LEFT JOIN ORGANIZACION cl_op ON cl_op.Organizacionid = etapa.Organizacionidoperador
     LEFT JOIN REMITO_DEVOLUCIONES de ON CAST(de.id_etapa AS CHAR) COLLATE utf8mb4_0900_ai_ci = etapa.Id_etapa COLLATE utf8mb4_0900_ai_ci
     LEFT JOIN ORGANIZACION cl_dev ON cl_dev.Organizacionid = de.id_cliente
     LEFT JOIN REMITO_DEVOLUCIONES_ITEMS di ON di.id_remito_devoluciones = de.id_remito_devoluciones
     LEFT JOIN PRODUCTO pr ON pr.Productoid = di.id_producto
     LEFT JOIN MOTIVO_DIFERENCIA md ON CAST(TRIM(md.Codigo) AS UNSIGNED) = di.codigo_motivo_dif
     WHERE etapa.Transaccionid_hoja_de_ruta = ?
     ORDER BY etapa.Direccionentrega ASC, Cliente ASC, di.id_remito_devoluciones_item ASC`,
    [transaccionId]
  );
  return rows || [];
}

/**
 * Sección 4.2.2: Obtener devoluciones de la hoja de ruta y catálogos reales.
 */
async function getDevolucionesByTransaccion(req, res) {
  try {
    const { transaccionId } = req.params;
    const hojaRuta = await findHojaRutaHeader(transaccionId, req.user);

    if (!hojaRuta) {
      return res.status(404).json({
        ok: false,
        error: 'Hoja de ruta no encontrada o no asignada al chofer autenticado.'
      });
    }

    const rows = await queryDevolucionesRows(hojaRuta.Transaccionid);

    const [productos] = await pool.query(
      `SELECT
         Productoid AS id_producto,
         Codigo AS codigo,
         Nombre AS nombre,
         TRIM(COALESCE(Codigomtx, '')) AS codigomtx
       FROM PRODUCTO
       WHERE Activo = '1' OR Activo = 1 OR Activo IS NULL
       ORDER BY Nombre ASC`
    );
    const [clientes] = await pool.query(
      `SELECT Organizacionid AS id_cliente, Codigo AS codigo, Nombre AS nombre
       FROM ORGANIZACION
       WHERE Activo = '1' OR Activo = 1 OR Activo IS NULL
       ORDER BY Nombre ASC
       LIMIT 600`
    );
    const [motivos] = await pool.query(
      `SELECT CAST(TRIM(Codigo) AS UNSIGNED) AS id_motivo, TRIM(Codigo) AS codigo, TRIM(Descripcion) AS descripcion
       FROM MOTIVO_DIFERENCIA
       ORDER BY TRIM(Descripcion) ASC`
    );

    return res.json({
      ok: true,
      hoja_ruta: hojaRuta,
      rows,
      catalogos: {
        productos: productos || [],
        clientes: clientes || [],
        motivos: motivos || []
      }
    });
  } catch (error) {
    console.error(`[HojasRutaController.getDevolucionesByTransaccion] Error: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Error al consultar las devoluciones de la hoja de ruta.',
      details: error.message
    });
  }
}

/**
 * Sección 4.2.2: Guardar / actualizar REMITO_DEVOLUCIONES y REMITO_DEVOLUCIONES_ITEMS.
 */
async function guardarDevoluciones(req, res) {
  try {
    const { transaccionId } = req.params;
    const { clientes } = req.body;
    const hojaRuta = await findHojaRutaHeader(transaccionId, req.user);

    if (!hojaRuta) {
      return res.status(404).json({
        ok: false,
        error: 'Hoja de ruta no encontrada o no asignada al chofer autenticado.'
      });
    }

    if (!Array.isArray(clientes)) {
      return res.status(400).json({
        ok: false,
        error: 'Estructura inválida: se esperaba el listado de clientes y productos de devolución.'
      });
    }

    for (const grupo of clientes) {
      const productos = Array.isArray(grupo.productos) ? grupo.productos : [];
      if (productos.length === 0) continue;

      if (!grupo.id_cliente && !grupo.Cliente) {
        return res.status(400).json({
          ok: false,
          error: `Debe seleccionar un cliente en "${grupo.Lugar_de_Entrega || 'Parada'}" antes de guardar devoluciones.`
        });
      }

      for (const prod of productos) {
        const prodId = Number(prod.id_producto);
        if (!Number.isInteger(prodId) || prodId <= 0) {
          return res.status(400).json({
            ok: false,
            error: 'Debe seleccionar un producto válido de la lista para cada devolución.'
          });
        }

        const cantStr = prod.Cantidad === null || prod.Cantidad === undefined ? '' : String(prod.Cantidad).trim();
        if (!POSITIVE_INT_REGEX.test(cantStr)) {
          return res.status(400).json({
            ok: false,
            error: `La cantidad devuelta para "${prod.Producto || 'Producto'}" debe ser un número entero mayor a 0.`
          });
        }

        if (!prod.codigo_motivo_dif && (!prod.Motivo || !String(prod.Motivo).trim())) {
          return res.status(400).json({
            ok: false,
            error: `Debe indicar un motivo de devolución para "${prod.Producto || 'Producto'}".`
          });
        }

        const tipoVal = prod.Tipo === 'Virtual' ? 'Virtual' : 'Físico';
        if (!['Físico', 'Virtual'].includes(tipoVal)) {
          return res.status(400).json({
            ok: false,
            error: 'El campo Tipo de devolución solo admite Físico o Virtual.'
          });
        }
      }
    }

    const resumen = await withAuditConnection(req.user, async (connection) => {
      await connection.beginTransaction();
      try {
        const [catMotivos] = await connection.query('SELECT Codigo, Descripcion FROM MOTIVO_DIFERENCIA');
        const motivoByDesc = new Map(
          catMotivos.map(m => [String(m.Descripcion || '').trim().toLowerCase(), parseInt(String(m.Codigo).trim(), 10)])
        );

        const [devCols] = await connection.query("SHOW COLUMNS FROM REMITO_DEVOLUCIONES LIKE 'id_remito_devoluciones'");
        const [itemCols] = await connection.query("SHOW COLUMNS FROM REMITO_DEVOLUCIONES_ITEMS LIKE 'id_remito_devoluciones_item'");
        const cabHasAutoInc = Boolean(devCols[0]?.Extra?.includes('auto_increment'));
        const itemHasAutoInc = Boolean(itemCols[0]?.Extra?.includes('auto_increment'));

        let nextCabId = null;
        let nextItemId = null;
        if (!cabHasAutoInc) {
          const [[{ maxId }]] = await connection.query(
            'SELECT COALESCE(MAX(id_remito_devoluciones), 0) AS maxId FROM REMITO_DEVOLUCIONES FOR UPDATE'
          );
          nextCabId = Number(maxId) + 1;
        }
        if (!itemHasAutoInc) {
          const [[{ maxItemId }]] = await connection.query(
            'SELECT COALESCE(MAX(id_remito_devoluciones_item), 0) AS maxItemId FROM REMITO_DEVOLUCIONES_ITEMS FOR UPDATE'
          );
          nextItemId = Number(maxItemId) + 1;
        }

        let cabecerasCreadas = 0;
        let itemsInsertados = 0;
        let itemsActualizados = 0;

        for (const grupo of clientes) {
          const productos = Array.isArray(grupo.productos) ? grupo.productos : [];
          if (productos.length === 0) continue;

          let remitoDevId = grupo.id_remito_devoluciones ? Number(grupo.id_remito_devoluciones) : null;
          const idCliente = Number(grupo.id_cliente) || null;
          const idEtapa = grupo.id_etapa ? String(grupo.id_etapa).trim() : null;
          const fechaCab = (grupo.fecha || hojaRuta.Fecha || new Date().toISOString().slice(0, 10)).slice(0, 10);

          if (!remitoDevId) {
            if (cabHasAutoInc) {
              const [insCab] = await connection.query(
                `INSERT INTO REMITO_DEVOLUCIONES (id_etapa, fecha, id_cliente) VALUES (?, ?, ?)`,
                [idEtapa, fechaCab, idCliente]
              );
              remitoDevId = insCab.insertId;
            } else {
              remitoDevId = nextCabId++;
              await connection.query(
                `INSERT INTO REMITO_DEVOLUCIONES (id_remito_devoluciones, id_etapa, fecha, id_cliente) VALUES (?, ?, ?, ?)`,
                [remitoDevId, idEtapa, fechaCab, idCliente]
              );
            }
            cabecerasCreadas++;
          }

          for (const prod of productos) {
            const idProducto = Number(prod.id_producto) || 1;
            const cantidad = parseInt(String(prod.Cantidad).trim(), 10);
            const vencimiento = prod.Vencimiento && String(prod.Vencimiento).trim()
              ? String(prod.Vencimiento).slice(0, 10)
              : null;
            const tipo = prod.Tipo === 'Virtual' ? 'Virtual' : 'Físico';

            let codigoMotivo = prod.codigo_motivo_dif ? Number(prod.codigo_motivo_dif) : null;
            if (!codigoMotivo && prod.Motivo) {
              codigoMotivo = motivoByDesc.get(String(prod.Motivo).trim().toLowerCase()) || null;
            }

            const itemId = prod.id_remito_devoluciones_item ? Number(prod.id_remito_devoluciones_item) : null;

            if (itemId) {
              await connection.query(
                `UPDATE REMITO_DEVOLUCIONES_ITEMS
                 SET id_producto = ?, cantidad_check_chofer = ?, vencimiento_check_chofer = ?, tipo = ?, codigo_motivo_dif = ?
                 WHERE id_remito_devoluciones_item = ? AND id_remito_devoluciones = ?`,
                [idProducto, cantidad, vencimiento, tipo, codigoMotivo, itemId, remitoDevId]
              );
              itemsActualizados++;
            } else if (itemHasAutoInc) {
              await connection.query(
                `INSERT INTO REMITO_DEVOLUCIONES_ITEMS
                   (id_remito_devoluciones, id_producto, cantidad_check_chofer, vencimiento_check_chofer, tipo, codigo_motivo_dif)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [remitoDevId, idProducto, cantidad, vencimiento, tipo, codigoMotivo]
              );
              itemsInsertados++;
            } else {
              const newItemId = nextItemId++;
              await connection.query(
                `INSERT INTO REMITO_DEVOLUCIONES_ITEMS
                   (id_remito_devoluciones_item, id_remito_devoluciones, id_producto, cantidad_check_chofer, vencimiento_check_chofer, tipo, codigo_motivo_dif)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [newItemId, remitoDevId, idProducto, cantidad, vencimiento, tipo, codigoMotivo]
              );
              itemsInsertados++;
            }
          }
        }

        await connection.commit();
        return { cabecerasCreadas, itemsInsertados, itemsActualizados };
      } catch (txErr) {
        await connection.rollback();
        throw txErr;
      }
    });

    const updatedRows = await queryDevolucionesRows(hojaRuta.Transaccionid);

    return res.json({
      ok: true,
      message: `Devoluciones guardadas con éxito (Cabeceras nuevas: ${resumen.cabecerasCreadas}, Ítems nuevos: ${resumen.itemsInsertados}, Actualizados: ${resumen.itemsActualizados}).`,
      resumen,
      rows: updatedRows
    });
  } catch (error) {
    if (isStageIdTypeMismatch(error)) {
      return res.status(422).json({
        ok: false,
        error: 'El campo REMITO_DEVOLUCIONES.id_etapa es INT en Gestion_Logistica pero HOJA_RUTA_ETAPA.Id_etapa es alfanumérico (ej. "2143599-3913"). Solicite al DBA ejecutar docs/dba_gestion_logistica_ajustes.sql.',
        details: error.message
      });
    }
    console.error(`[HojasRutaController.guardarDevoluciones] Error: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Error al guardar las devoluciones.',
      details: error.message
    });
  }
}

async function queryCajonesGrouped(transaccionId) {
  const [rows] = await pool.query(
    `SELECT
       rce.Transaccionid,
       rce.Id_etapa,
       rce.Direccionentrega AS Lugar_de_Entrega,
       rce.Id_cliente AS id_cliente,
       rce.Cliente,
       rce.tipo,
       rc.id_remito_cajones,
       rce.id_remito_cajones_item,
       rce.cantidad_check_chofer
     FROM REMITOS_CAJONES_X_ETAPA rce
     LEFT JOIN REMITO_CAJONES rc
       ON CAST(rc.id_etapa AS CHAR) COLLATE utf8mb4_0900_ai_ci = rce.Id_etapa COLLATE utf8mb4_0900_ai_ci
       AND rc.tipo <=> rce.tipo
       AND rc.id_cliente <=> rce.Id_cliente
     WHERE rce.Transaccionid = ?
     ORDER BY rce.Direccionentrega ASC, rce.Cliente ASC`,
    [transaccionId]
  );

  const groupedMap = new Map();
  for (const row of rows || []) {
    const key = row.Id_etapa || `${row.Lugar_de_Entrega}__${row.id_cliente}`;
    if (!groupedMap.has(key)) {
      groupedMap.set(key, {
        Transaccionid: row.Transaccionid,
        Id_etapa: row.Id_etapa,
        Lugar_de_Entrega: row.Lugar_de_Entrega || 'Sin Dirección',
        id_cliente: row.id_cliente,
        Cliente: row.Cliente || 'Sin Cliente',
        cajones_entregados: 0,
        cajones_devueltos: 0,
        diferencia: 0,
        observaciones: '',
        id_remito_cajones_entrega: null,
        id_remito_cajones_item_entrega: null,
        id_remito_cajones_devolucion: null,
        id_remito_cajones_item_devolucion: null
      });
    }

    const entry = groupedMap.get(key);
    const qty = Number(row.cantidad_check_chofer || 0);
    if (Number(row.tipo) === CAJONES_TIPO_ENTREGA) {
      entry.cajones_entregados = qty;
      entry.id_remito_cajones_entrega = row.id_remito_cajones || entry.id_remito_cajones_entrega;
      entry.id_remito_cajones_item_entrega = row.id_remito_cajones_item || entry.id_remito_cajones_item_entrega;
    } else if (Number(row.tipo) === CAJONES_TIPO_DEVOLUCION) {
      entry.cajones_devueltos = qty;
      entry.id_remito_cajones_devolucion = row.id_remito_cajones || entry.id_remito_cajones_devolucion;
      entry.id_remito_cajones_item_devolucion = row.id_remito_cajones_item || entry.id_remito_cajones_item_devolucion;
    }
    entry.diferencia = entry.cajones_entregados - entry.cajones_devueltos;
  }

  return Array.from(groupedMap.values());
}

/**
 * Sección 4.2.3: Obtener entrega y devolución de cajones.
 */
async function getCajonesByTransaccion(req, res) {
  try {
    const { transaccionId } = req.params;
    const hojaRuta = await findHojaRutaHeader(transaccionId, req.user);

    if (!hojaRuta) {
      return res.status(404).json({
        ok: false,
        error: 'Hoja de ruta no encontrada o no asignada al chofer autenticado.'
      });
    }

    const items = await queryCajonesGrouped(hojaRuta.Transaccionid);

    return res.json({
      ok: true,
      hoja_ruta: hojaRuta,
      items
    });
  } catch (error) {
    console.error(`[HojasRutaController.getCajonesByTransaccion] Error: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Error al consultar movimientos de cajones.',
      details: error.message
    });
  }
}

async function upsertCajonTipo(connection, { idEtapa, fecha, idCliente, tipo, cantidad, existingCabId, existingItemId }) {
  let cabId = existingCabId ? Number(existingCabId) : null;

  if (!cabId) {
    const [found] = await connection.query(
      'SELECT id_remito_cajones FROM REMITO_CAJONES WHERE CAST(id_etapa AS CHAR) COLLATE utf8mb4_0900_ai_ci = ? COLLATE utf8mb4_0900_ai_ci AND tipo = ? LIMIT 1',
      [idEtapa, tipo]
    );
    if (found && found.length > 0) {
      cabId = found[0].id_remito_cajones;
    }
  }

  if (!cabId) {
    const [insCab] = await connection.query(
      `INSERT INTO REMITO_CAJONES (id_etapa, fecha, id_cliente, tipo) VALUES (?, ?, ?, ?)`,
      [idEtapa, fecha, idCliente, tipo]
    );
    cabId = insCab.insertId;
  }

  let itemId = existingItemId ? Number(existingItemId) : null;
  if (!itemId) {
    const [foundItems] = await connection.query(
      'SELECT id_remito_cajones_item FROM REMITO_CAJONES_ITEMS WHERE id_remito_cajones = ? LIMIT 1',
      [cabId]
    );
    if (foundItems && foundItems.length > 0) {
      itemId = foundItems[0].id_remito_cajones_item;
    }
  }

  if (itemId) {
    await connection.query(
      'UPDATE REMITO_CAJONES_ITEMS SET cantidad_check_chofer = ? WHERE id_remito_cajones_item = ?',
      [cantidad, itemId]
    );
  } else {
    await connection.query(
      'INSERT INTO REMITO_CAJONES_ITEMS (id_remito_cajones, cantidad_check_chofer) VALUES (?, ?)',
      [cabId, cantidad]
    );
  }
}

/**
 * Sección 4.2.3: Guardar entrega y devolución de cajones.
 */
async function guardarCajones(req, res) {
  try {
    const { transaccionId } = req.params;
    const { items } = req.body;
    const hojaRuta = await findHojaRutaHeader(transaccionId, req.user);

    if (!hojaRuta) {
      return res.status(404).json({
        ok: false,
        error: 'Hoja de ruta no encontrada o no asignada al chofer autenticado.'
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'Debe informar al menos un movimiento de cajones.'
      });
    }

    const normalized = [];
    for (const item of items) {
      const entStr = String(item.cajones_entregados ?? '0').trim();
      const devStr = String(item.cajones_devueltos ?? '0').trim();

      if (!NON_NEGATIVE_INT_REGEX.test(entStr) || !NON_NEGATIVE_INT_REGEX.test(devStr)) {
        return res.status(400).json({
          ok: false,
          error: 'Las cantidades de cajones entregados y devueltos deben ser números enteros positivos o cero.'
        });
      }

      normalized.push({
        Id_etapa: item.Id_etapa ? String(item.Id_etapa).trim() : null,
        id_cliente: item.id_cliente ? Number(item.id_cliente) : null,
        cajones_entregados: parseInt(entStr, 10),
        cajones_devueltos: parseInt(devStr, 10),
        id_remito_cajones_entrega: item.id_remito_cajones_entrega || null,
        id_remito_cajones_item_entrega: item.id_remito_cajones_item_entrega || null,
        id_remito_cajones_devolucion: item.id_remito_cajones_devolucion || null,
        id_remito_cajones_item_devolucion: item.id_remito_cajones_item_devolucion || null
      });
    }

    const fecha = (hojaRuta.Fecha || new Date().toISOString().slice(0, 10)).slice(0, 10);

    await withAuditConnection(req.user, async (connection) => {
      await connection.beginTransaction();
      try {
        for (const row of normalized) {
          if (!row.Id_etapa) continue;

          if (row.cajones_entregados > 0 || row.id_remito_cajones_entrega || row.id_remito_cajones_item_entrega) {
            await upsertCajonTipo(connection, {
              idEtapa: row.Id_etapa,
              fecha,
              idCliente: row.id_cliente,
              tipo: CAJONES_TIPO_ENTREGA,
              cantidad: row.cajones_entregados,
              existingCabId: row.id_remito_cajones_entrega,
              existingItemId: row.id_remito_cajones_item_entrega
            });
          }

          if (row.cajones_devueltos > 0 || row.id_remito_cajones_devolucion || row.id_remito_cajones_item_devolucion) {
            await upsertCajonTipo(connection, {
              idEtapa: row.Id_etapa,
              fecha,
              idCliente: row.id_cliente,
              tipo: CAJONES_TIPO_DEVOLUCION,
              cantidad: row.cajones_devueltos,
              existingCabId: row.id_remito_cajones_devolucion,
              existingItemId: row.id_remito_cajones_item_devolucion
            });
          }
        }
        await connection.commit();
      } catch (txErr) {
        await connection.rollback();
        throw txErr;
      }
    });

    const updatedItems = await queryCajonesGrouped(hojaRuta.Transaccionid);

    return res.json({
      ok: true,
      message: `Movimiento de cajones guardado (${normalized.length} paradas procesadas).`,
      items: updatedItems
    });
  } catch (error) {
    if (isStageIdTypeMismatch(error)) {
      return res.status(422).json({
        ok: false,
        error: 'El campo REMITO_CAJONES.id_etapa es INT en Gestion_Logistica pero HOJA_RUTA_ETAPA.Id_etapa es alfanumérico (ej. "2143599-3913"). Solicite al DBA ejecutar docs/dba_gestion_logistica_ajustes.sql.',
        details: error.message
      });
    }
    console.error(`[HojasRutaController.guardarCajones] Error: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Error al guardar movimientos de cajones.',
      details: error.message
    });
  }
}

module.exports = {
  getHojasDeRuta,
  getEntregasByTransaccion,
  guardarEntregas,
  getDevolucionesByTransaccion,
  guardarDevoluciones,
  getCajonesByTransaccion,
  guardarCajones
};
