import { openDB } from 'idb';

const DB_NAME = 'dy_logistica_offline_db';
const DB_VERSION = 2;

/**
 * Inicializa la base de datos IndexedDB local.
 */
export async function initOfflineDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('remitos_cache')) {
        db.createObjectStore('remitos_cache', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('pending_controls')) {
        const store = db.createObjectStore('pending_controls', { keyPath: 'queue_id', autoIncrement: true });
        store.createIndex('by_remito', 'remito_id', { unique: false });
      }
      if (!db.objectStoreNames.contains('hojas_ruta_cache')) {
        db.createObjectStore('hojas_ruta_cache', { keyPath: 'Transaccionid' });
      }
      if (!db.objectStoreNames.contains('entregas_cache')) {
        db.createObjectStore('entregas_cache', { keyPath: 'Transaccionid' });
      }
      if (!db.objectStoreNames.contains('devoluciones_cache')) {
        db.createObjectStore('devoluciones_cache', { keyPath: 'Transaccionid' });
      }
      if (!db.objectStoreNames.contains('cajones_cache')) {
        db.createObjectStore('cajones_cache', { keyPath: 'Transaccionid' });
      }
    }
  });
}

// ============================================================================
// CACHÉ DE HOJAS DE RUTA, ENTREGAS, DEVOLUCIONES Y CAJONES
// ============================================================================

export async function cacheHojasRuta(hojasList) {
  try {
    const db = await initOfflineDB();
    const tx = db.transaction('hojas_ruta_cache', 'readwrite');
    await tx.store.clear();
    for (const hr of hojasList) {
      await tx.store.put(hr);
    }
    await tx.done;
  } catch (error) {
    console.warn('[OfflineDB] Error al cachear hojas de ruta:', error);
  }
}

export async function getCachedHojasRuta() {
  try {
    const db = await initOfflineDB();
    return await db.getAll('hojas_ruta_cache');
  } catch (error) {
    console.warn('[OfflineDB] Error al leer caché de hojas de ruta:', error);
    return [];
  }
}

export async function cacheEntregas(transaccionId, payload) {
  try {
    const db = await initOfflineDB();
    await db.put('entregas_cache', { Transaccionid: Number(transaccionId), ...payload });
  } catch (error) {
    console.warn('[OfflineDB] Error al cachear entregas:', error);
  }
}

export async function getCachedEntregas(transaccionId) {
  try {
    const db = await initOfflineDB();
    return await db.get('entregas_cache', Number(transaccionId));
  } catch (error) {
    console.warn('[OfflineDB] Error al leer entregas cacheadas:', error);
    return null;
  }
}

export async function cacheDevoluciones(transaccionId, payload) {
  try {
    const db = await initOfflineDB();
    await db.put('devoluciones_cache', { Transaccionid: Number(transaccionId), ...payload });
  } catch (error) {
    console.warn('[OfflineDB] Error al cachear devoluciones:', error);
  }
}

export async function getCachedDevoluciones(transaccionId) {
  try {
    const db = await initOfflineDB();
    return await db.get('devoluciones_cache', Number(transaccionId));
  } catch (error) {
    console.warn('[OfflineDB] Error al leer devoluciones cacheadas:', error);
    return null;
  }
}

export async function cacheCajones(transaccionId, payload) {
  try {
    const db = await initOfflineDB();
    await db.put('cajones_cache', { Transaccionid: Number(transaccionId), ...payload });
  } catch (error) {
    console.warn('[OfflineDB] Error al cachear cajones:', error);
  }
}

export async function getCachedCajones(transaccionId) {
  try {
    const db = await initOfflineDB();
    return await db.get('cajones_cache', Number(transaccionId));
  } catch (error) {
    console.warn('[OfflineDB] Error al leer cajones cacheados:', error);
    return null;
  }
}

// ============================================================================
// CACHÉ DE REMITOS Y COLA OFFLINE UNIFICADA
// ============================================================================

export async function cacheRemitos(remitosList) {
  try {
    const db = await initOfflineDB();
    const tx = db.transaction('remitos_cache', 'readwrite');
    await tx.store.clear();
    for (const remito of remitosList) {
      await tx.store.put(remito);
    }
    await tx.done;
    console.log(`[OfflineDB] ${remitosList.length} remitos guardados en caché local.`);
  } catch (error) {
    console.warn('[OfflineDB] Error al guardar caché de remitos:', error);
  }
}

export async function getCachedRemitos() {
  try {
    const db = await initOfflineDB();
    return await db.getAll('remitos_cache');
  } catch (error) {
    console.warn('[OfflineDB] Error al leer caché de remitos:', error);
    return [];
  }
}

export async function searchCachedRemitoByCode(code) {
  try {
    const all = await getCachedRemitos();
    const strCode = String(code).trim().toLowerCase();
    const found = all.find(r =>
      String(r.finne_transaccionID) === strCode ||
      String(r.finne_Comprobante || '').toLowerCase() === strCode ||
      String(r.id) === strCode
    );
    return found || null;
  } catch (error) {
    console.warn('[OfflineDB] Error al buscar remito en caché:', error);
    return null;
  }
}

/**
 * Encola una operación realizada sin conexión para sincronización posterior.
 * Soporta op_type: 'remito' | 'entregas' | 'devoluciones' | 'cajones'
 */
export async function queuePendingControl(controlPayload) {
  try {
    const db = await initOfflineDB();
    const item = {
      op_type: controlPayload.op_type || 'remito',
      ...controlPayload,
      queued_at: new Date().toISOString()
    };
    const queueId = await db.add('pending_controls', item);

    // Actualizar caché local inmediata según el tipo de operación
    if (item.op_type === 'remito' && controlPayload.remito_id) {
      const cached = await db.get('remitos_cache', controlPayload.remito_id);
      if (cached) {
        cached.ejemplar = controlPayload.ejemplar || 'ORIGINAL';
        cached.estado_firma = controlPayload.estado_firma;
        cached.tipo_documento = controlPayload.tipo_documento;
        cached.observaciones = controlPayload.observaciones;
        cached.firma_digital_base64 = controlPayload.firma_digital_base64 || cached.firma_digital_base64;
        cached.sincronizado_offline = 1;
        await db.put('remitos_cache', cached);
      }
    }

    console.log(`[OfflineDB] Operación offline (${item.op_type}) encolada con ID ${queueId}.`);
    return queueId;
  } catch (error) {
    console.error('[OfflineDB] Error al encolar operación offline:', error);
    throw error;
  }
}

export async function getPendingControls() {
  try {
    const db = await initOfflineDB();
    return await db.getAll('pending_controls');
  } catch (error) {
    console.warn('[OfflineDB] Error al obtener pendientes offline:', error);
    return [];
  }
}

export async function clearPendingControls(queueIds = null) {
  try {
    const db = await initOfflineDB();
    if (!queueIds) {
      await db.clear('pending_controls');
    } else {
      const tx = db.transaction('pending_controls', 'readwrite');
      for (const qId of queueIds) {
        await tx.store.delete(qId);
      }
      await tx.done;
    }
    console.log('[OfflineDB] Cola de pendientes limpiada.');
  } catch (error) {
    console.warn('[OfflineDB] Error al limpiar cola de pendientes:', error);
  }
}
