import { openDB } from 'idb';

const DB_NAME = 'dy_logistica_offline_db';
const DB_VERSION = 1;

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
    }
  });
}

/**
 * Guarda en caché local la lista de remitos para consulta sin conexión.
 */
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

/**
 * Obtiene los remitos almacenados en la caché local.
 */
export async function getCachedRemitos() {
  try {
    const db = await initOfflineDB();
    return await db.getAll('remitos_cache');
  } catch (error) {
    console.warn('[OfflineDB] Error al leer caché de remitos:', error);
    return [];
  }
}

/**
 * Busca un remito en la caché local por TransaccionId o Comprobante cuando se está offline.
 */
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
 * Encola un control realizado sin conexión para posterior sincronización.
 */
export async function queuePendingControl(controlPayload) {
  try {
    const db = await initOfflineDB();
    const item = {
      ...controlPayload,
      queued_at: new Date().toISOString()
    };
    const queueId = await db.add('pending_controls', item);
    
    // Actualizar también la caché local para reflejar el estado inmediatamente en la UI
    if (controlPayload.remito_id) {
      const cached = await db.get('remitos_cache', controlPayload.remito_id);
      if (cached) {
        cached.ejemplar = controlPayload.ejemplar || 'ORIGINAL';
        cached.estado_firma = controlPayload.estado_firma;
        cached.tipo_documento = controlPayload.tipo_documento;
        cached.observaciones = controlPayload.observaciones;
        cached.sincronizado_offline = 1;
        await db.put('remitos_cache', cached);
      }
    }

    console.log(`[OfflineDB] Control encolado offline con ID ${queueId}.`);
    return queueId;
  } catch (error) {
    console.error('[OfflineDB] Error al encolar control offline:', error);
    throw error;
  }
}

/**
 * Obtiene todos los controles pendientes de sincronizar.
 */
export async function getPendingControls() {
  try {
    const db = await initOfflineDB();
    return await db.getAll('pending_controls');
  } catch (error) {
    console.warn('[OfflineDB] Error al obtener controles pendientes:', error);
    return [];
  }
}

/**
 * Elimina los controles ya sincronizados de la cola.
 */
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
