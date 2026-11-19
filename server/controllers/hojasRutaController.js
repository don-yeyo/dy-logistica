const { pool } = require('../config/db');

const NON_NEGATIVE_INT_REGEX = /^\d+$/;
const POSITIVE_INT_REGEX = /^[1-9]\d*$/;

/**
 * Helper interno para obtener cabecera de una hoja de ruta desde HOJAS_DE_RUTA_A_ENTREGAR.
 */
async function findHojaRutaHeader(transaccionId, user) {
  const txId = Number(transaccionId);
  if (!Number.isInteger(txId) || txId <= 0) {
    return null;
  }

  const [rows] = await pool.query(
    `SELECT Transaccionid, Hoja_de_ruta, Fecha, Viaje, Chofer, EMail, Transporte, Patente_camion, Patente_acoplado, id_etapa
     FROM HOJAS_DE_RUTA_A_ENTREGAR
     WHERE Transaccionid = ? AND LOWER(EMail) = LOWER(?)
     LIMIT 1`,
    [txId, user.email]
  );

  if (rows && rows.length > 0) {
    return rows[0];
  }

  if (user.rol === 'admin' || user.rol === 'supervisor') {
    const [adminRows] = await pool.query(
      `SELECT Transaccionid, Hoja_de_ruta, Fecha, Viaje, Chofer, EMail, Transporte, Patente_camion, Patente_acoplado, id_etapa
       FROM HOJAS_DE_RUTA_A_ENTREGAR
       WHERE Transaccionid = ?
       LIMIT 1`,
      [txId]
    );
    if (adminRows && adminRows.length > 0) {
      return adminRows[0];
    }
  }

  return null;
}

/**
 * Sección 4.2: Listado de hojas de ruta disponibles para el chofer autenticado
 * obtenido desde la vista HOJAS_DE_RUTA_A_ENTREGAR filtrando EMail.
 */
async function getHojasDeRuta(req, res) {
  try {
    const user = req.user;
    const defaultLimit = parseInt(process.env.MAX_HOJAS_RUTA_LIST || '20', 10);
    const limit = parseInt(req.query.limit || defaultLimit, 10);

    const [rows] = await pool.query(
      `SELECT
         Hoja_de_ruta,
         Fecha,
         Viaje,
         Chofer,
         Patente_camion,
         Patente_acoplado,
         Transporte,
         Transaccionid,
         EMail,
         id_etapa
       FROM HOJAS_DE_RUTA_A_ENTREGAR
       WHERE LOWER(EMail) = LOWER(?)
       ORDER BY Fecha DESC, Transaccionid DESC
       LIMIT ?`,
      [user.email, Number.isInteger(limit) && limit > 0 ? limit : 20]
    );

    return res.json({
      ok: true,
      hojas_ruta: rows || []
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
 * Sección 4.2.1: Obtener detalle de entregas (ITEMS_A_ENTREGAR) filtrado por Transaccionid.
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
         Lugar_de_Entrega,
         Remito,
         Cliente,
         id_cliente,
         Producto,
         Remitido,
         Entregado,
         Transaccionid,
         Hojarutaitemid
       FROM ITEMS_A_ENTREGAR
       WHERE Transaccionid = ?
       ORDER BY Lugar_de_Entrega ASC, Remito ASC, Hojarutaitemid ASC`,
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
 * Sección 4.2.1: Guardar confirmación de descarga actualizando HOJA_RUTA_ITEM_REMITO
 * (cantidad_descargada_Chofer por Hojarutaitemid).
 */
async function guardarEntregas(req, res) {
  let connection;
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
        Entregado: parseInt(rawVal, 10)
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    let updatedCount = 0;
    for (const item of normalizedItems) {
      const [result] = await connection.query(
        `UPDATE HOJA_RUTA_ITEM_REMITO
         SET cantidad_descargada_Chofer = ?, updated_by_email = ?
         WHERE Hojarutaitemid = ? AND Transaccionid = ?`,
        [item.Entregado, req.user.email, item.Hojarutaitemid, hojaRuta.Transaccionid]
      );
      updatedCount += result.affectedRows;
    }

    await connection.commit();

    const [refreshedItems] = await pool.query(
      `SELECT
         Lugar_de_Entrega,
         Remito,
         Cliente,
         id_cliente,
         Producto,
         Remitido,
         Entregado,
         Transaccionid,
         Hojarutaitemid
       FROM ITEMS_A_ENTREGAR
       WHERE Transaccionid = ?
       ORDER BY Lugar_de_Entrega ASC, Remito ASC, Hojarutaitemid ASC`,
      [hojaRuta.Transaccionid]
    );

    return res.json({
      ok: true,
      message: `Confirmación de descarga guardada correctamente (${updatedCount} ítems actualizados).`,
      actualizados: updatedCount,
      items: refreshedItems
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (e) { /* ignore rollback error */ }
    }
    console.error(`[HojasRutaController.guardarEntregas] Error: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Error al guardar la confirmación de descarga.',
      details: error.message
    });
  } finally {
    if (connection) connection.release();
  }
}

/**
 * Sección 4.2.2: Obtener devoluciones (HOJA_DE_RUTA_DEVOLUCIONES) y catálogos auxiliares.
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

    const [rows] = await pool.query(
      `SELECT
         Transaccionid,
         id_etapa,
         fecha,
         Lugar_de_Entrega,
         id_cliente,
         Cliente,
         id_remito_devoluciones,
         id_remito_devoluciones_item,
         id_producto,
         Producto,
         Cantidad,
         Vencimiento,
         Motivo,
         Tipo
       FROM HOJA_DE_RUTA_DEVOLUCIONES
       WHERE Transaccionid = ?
       ORDER BY Lugar_de_Entrega ASC, Cliente ASC, id_remito_devoluciones_item ASC`,
      [hojaRuta.Transaccionid]
    );

    const [productos] = await pool.query(
      'SELECT id_producto, codigo, nombre, unidad FROM CATALOGO_PRODUCTOS WHERE activo = 1 ORDER BY nombre ASC'
    );
    const [clientes] = await pool.query(
      'SELECT id_cliente, nombre, domicilio FROM CATALOGO_CLIENTES WHERE activo = 1 ORDER BY nombre ASC LIMIT 120'
    );
    const [motivos] = await pool.query(
      'SELECT id_motivo, descripcion FROM CATALOGO_MOTIVOS_DEVOLUCION WHERE activo = 1 ORDER BY id_motivo ASC'
    );

    return res.json({
      ok: true,
      hoja_ruta: hojaRuta,
      rows: rows || [],
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
  let connection;
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

    // Validar grupos que tienen productos cargados
    for (const grupo of clientes) {
      const productos = Array.isArray(grupo.productos) ? grupo.productos : [];
      if (productos.length === 0) continue;

      if (!grupo.Lugar_de_Entrega || !String(grupo.Lugar_de_Entrega).trim()) {
        return res.status(400).json({
          ok: false,
          error: 'Cada devolución debe estar asociada a un Lugar de Entrega.'
        });
      }

      if (!grupo.id_cliente && !grupo.Cliente) {
        return res.status(400).json({
          ok: false,
          error: `Debe seleccionar un cliente en "${grupo.Lugar_de_Entrega}" antes de guardar devoluciones.`
        });
      }

      for (const prod of productos) {
        const cantStr = prod.Cantidad === null || prod.Cantidad === undefined ? '' : String(prod.Cantidad).trim();
        if (!POSITIVE_INT_REGEX.test(cantStr)) {
          return res.status(400).json({
            ok: false,
            error: `La cantidad devuelta para "${prod.Producto || 'Producto'}" debe ser un número entero mayor a 0.`
          });
        }

        if (!prod.Motivo || !String(prod.Motivo).trim()) {
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

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Mapa auxiliar de catálogo de productos para resolver id_producto / nombre si falta uno
    const [catProds] = await connection.query('SELECT id_producto, nombre FROM CATALOGO_PRODUCTOS');
    const prodById = new Map(catProds.map(p => [Number(p.id_producto), p.nombre]));
    const prodByName = new Map(catProds.map(p => [p.nombre.toLowerCase(), Number(p.id_producto)]));

    let cabecerasCreadas = 0;
    let itemsInsertados = 0;
    let itemsActualizados = 0;

    for (const grupo of clientes) {
      const productos = Array.isArray(grupo.productos) ? grupo.productos : [];
      if (productos.length === 0) continue;

      let remitoDevId = grupo.id_remito_devoluciones ? Number(grupo.id_remito_devoluciones) : null;
      const idCliente = Number(grupo.id_cliente) || 0;
      const nombreCliente = (grupo.Cliente || '').trim() || `Cliente #${idCliente}`;
      const lugarEntrega = String(grupo.Lugar_de_Entrega).trim();
      const idEtapa = Number(grupo.id_etapa || hojaRuta.id_etapa || 1);
      const fechaCab = (grupo.fecha || hojaRuta.Fecha || new Date().toISOString().slice(0, 10)).slice(0, 10);

      // Si id_remito_devoluciones viene vacío o nulo, insertar cabecera en REMITO_DEVOLUCIONES
      if (!remitoDevId) {
        const [insCab] = await connection.query(
          `INSERT INTO REMITO_DEVOLUCIONES
             (Transaccionid, id_etapa, fecha, id_cliente, Cliente, Lugar_de_Entrega, usuario_email)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [hojaRuta.Transaccionid, idEtapa, fechaCab, idCliente, nombreCliente, lugarEntrega, req.user.email]
        );
        remitoDevId = insCab.insertId;
        cabecerasCreadas++;
      }

      for (const prod of productos) {
        let idProducto = prod.id_producto ? Number(prod.id_producto) : null;
        let nombreProducto = (prod.Producto || '').trim();

        if (!idProducto && nombreProducto && prodByName.has(nombreProducto.toLowerCase())) {
          idProducto = prodByName.get(nombreProducto.toLowerCase());
        }
        if (!nombreProducto && idProducto && prodById.has(idProducto)) {
          nombreProducto = prodById.get(idProducto);
        }
        if (!idProducto) idProducto = 1;
        if (!nombreProducto) nombreProducto = `Producto #${idProducto}`;

        const cantidad = parseInt(String(prod.Cantidad).trim(), 10);
        const vencimiento = prod.Vencimiento && String(prod.Vencimiento).trim() ? String(prod.Vencimiento).slice(0, 10) : null;
        const motivo = String(prod.Motivo).trim();
        const tipo = prod.Tipo === 'Virtual' ? 'Virtual' : 'Físico';

        const itemId = prod.id_remito_devoluciones_item ? Number(prod.id_remito_devoluciones_item) : null;

        if (itemId) {
          await connection.query(
            `UPDATE REMITO_DEVOLUCIONES_ITEMS
             SET id_producto = ?, Producto = ?, cantidad_check_chofer = ?, vencimiento_check_chofer = ?, motivo = ?, tipo = ?
             WHERE id_remito_devoluciones_item = ? AND id_remito_devoluciones = ?`,
            [idProducto, nombreProducto, cantidad, vencimiento, motivo, tipo, itemId, remitoDevId]
          );
          itemsActualizados++;
        } else {
          await connection.query(
            `INSERT INTO REMITO_DEVOLUCIONES_ITEMS
               (id_remito_devoluciones, id_producto, Producto, cantidad_check_chofer, vencimiento_check_chofer, motivo, tipo)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [remitoDevId, idProducto, nombreProducto, cantidad, vencimiento, motivo, tipo]
          );
          itemsInsertados++;
        }
      }
    }

    await connection.commit();

    const [updatedRows] = await pool.query(
      `SELECT
         Transaccionid,
         id_etapa,
         fecha,
         Lugar_de_Entrega,
         id_cliente,
         Cliente,
         id_remito_devoluciones,
         id_remito_devoluciones_item,
         id_producto,
         Producto,
         Cantidad,
         Vencimiento,
         Motivo,
         Tipo
       FROM HOJA_DE_RUTA_DEVOLUCIONES
       WHERE Transaccionid = ?
       ORDER BY Lugar_de_Entrega ASC, Cliente ASC, id_remito_devoluciones_item ASC`,
      [hojaRuta.Transaccionid]
    );

    return res.json({
      ok: true,
      message: `Devoluciones guardadas con éxito (Cabeceras nuevas: ${cabecerasCreadas}, Ítems nuevos: ${itemsInsertados}, Actualizados: ${itemsActualizados}).`,
      resumen: { cabecerasCreadas, itemsInsertados, itemsActualizados },
      rows: updatedRows
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (e) { /* ignore rollback error */ }
    }
    console.error(`[HojasRutaController.guardarDevoluciones] Error: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Error al guardar las devoluciones.',
      details: error.message
    });
  } finally {
    if (connection) connection.release();
  }
}

/**
 * Sección 4.2.3: Obtener entregas y devoluciones de cajones por parada/cliente de la hoja de ruta.
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

    const [items] = await pool.query(
      `SELECT
         paradas.Transaccionid,
         paradas.Lugar_de_Entrega,
         paradas.id_cliente,
         paradas.Cliente,
         c.id_cajon_movimiento,
         COALESCE(c.cajones_entregados, 0) AS cajones_entregados,
         COALESCE(c.cajones_devueltos, 0) AS cajones_devueltos,
         COALESCE(c.diferencia, 0) AS diferencia,
         COALESCE(c.observaciones, '') AS observaciones,
         c.usuario_email,
         c.updated_at
       FROM (
         SELECT DISTINCT Transaccionid, Lugar_de_Entrega, id_cliente, Cliente
         FROM HOJA_RUTA_ITEM_REMITO
         WHERE Transaccionid = ?
         UNION
         SELECT DISTINCT Transaccionid, Lugar_de_Entrega, id_cliente, Cliente
         FROM HOJA_RUTA_CAJONES
         WHERE Transaccionid = ?
       ) paradas
       LEFT JOIN HOJA_RUTA_CAJONES c
         ON c.Transaccionid = paradas.Transaccionid
         AND c.Lugar_de_Entrega = paradas.Lugar_de_Entrega
         AND c.Cliente <=> paradas.Cliente
       ORDER BY paradas.Lugar_de_Entrega ASC, paradas.Cliente ASC`,
      [hojaRuta.Transaccionid, hojaRuta.Transaccionid]
    );

    return res.json({
      ok: true,
      hoja_ruta: hojaRuta,
      items: items || []
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

/**
 * Sección 4.2.3: Guardar entrega y devolución de cajones.
 */
async function guardarCajones(req, res) {
  let connection;
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

      const entregados = parseInt(entStr, 10);
      const devueltos = parseInt(devStr, 10);
      const diferencia = entregados - devueltos;

      normalized.push({
        Lugar_de_Entrega: String(item.Lugar_de_Entrega || 'General').trim(),
        id_cliente: item.id_cliente ? Number(item.id_cliente) : null,
        Cliente: String(item.Cliente || 'Sin Cliente').trim(),
        cajones_entregados: entregados,
        cajones_devueltos: devueltos,
        diferencia,
        observaciones: item.observaciones ? String(item.observaciones).trim() : null
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    for (const row of normalized) {
      await connection.query(
        `INSERT INTO HOJA_RUTA_CAJONES (
           Transaccionid, Lugar_de_Entrega, id_cliente, Cliente,
           cajones_entregados, cajones_devueltos, diferencia, observaciones, usuario_email
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           id_cliente = VALUES(id_cliente),
           cajones_entregados = VALUES(cajones_entregados),
           cajones_devueltos = VALUES(cajones_devueltos),
           diferencia = VALUES(diferencia),
           observaciones = VALUES(observaciones),
           usuario_email = VALUES(usuario_email)`,
        [
          hojaRuta.Transaccionid,
          row.Lugar_de_Entrega,
          row.id_cliente,
          row.Cliente,
          row.cajones_entregados,
          row.cajones_devueltos,
          row.diferencia,
          row.observaciones,
          req.user.email
        ]
      );
    }

    await connection.commit();

    return res.json({
      ok: true,
      message: `Movimiento de cajones guardado (${normalized.length} registros).`,
      actualizados: normalized.length
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (e) { /* ignore rollback error */ }
    }
    console.error(`[HojasRutaController.guardarCajones] Error: ${error.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Error al guardar movimientos de cajones.',
      details: error.message
    });
  } finally {
    if (connection) connection.release();
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
