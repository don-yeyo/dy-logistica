import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000
});

// Interceptor de Peticiones: inyecta email de usuario identificado
api.interceptors.request.use(
  (config) => {
    const userEmail = localStorage.getItem('dy_user_email');
    if (userEmail) {
      config.headers['x-user-email'] = userEmail;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de Respuestas: manejo de errores comunes
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('[API] Sesión no identificada o credenciales rechazadas.');
    }
    return Promise.reject(error);
  }
);


/**
 * Obtener datos del chofer/usuario logueado
 */
export async function fetchCurrentUser() {
  const { data } = await api.get('/auth/me');
  return data;
}

/**
 * Listar usuarios (para selector en desarrollo)
 */
export async function fetchUsersList() {
  const { data } = await api.get('/auth/users');
  return data;
}

/**
 * Sección 4.2: Obtener listado de hojas de ruta asignadas (HOJAS_DE_RUTA_A_ENTREGAR)
 */
export async function fetchHojasDeRuta(params = {}) {
  const { data } = await api.get('/hojas-ruta', { params });
  return data;
}

/**
 * Sección 4.2.1: Obtener ítems a entregar (ITEMS_A_ENTREGAR) de una hoja de ruta
 */
export async function fetchEntregasHojaRuta(transaccionId) {
  const { data } = await api.get(`/hojas-ruta/${transaccionId}/entregas`);
  return data;
}

/**
 * Sección 4.2.1: Guardar confirmación de descarga (HOJA_RUTA_ITEM_REMITO)
 */
export async function saveEntregasHojaRuta(transaccionId, items) {
  const { data } = await api.put(`/hojas-ruta/${transaccionId}/entregas`, { items });
  return data;
}

/**
 * Sección 4.2.2: Obtener devoluciones (HOJA_DE_RUTA_DEVOLUCIONES) y catálogos
 */
export async function fetchDevolucionesHojaRuta(transaccionId) {
  const { data } = await api.get(`/hojas-ruta/${transaccionId}/devoluciones`);
  return data;
}

/**
 * Sección 4.2.2: Guardar / actualizar REMITO_DEVOLUCIONES y REMITO_DEVOLUCIONES_ITEMS
 */
export async function saveDevolucionesHojaRuta(transaccionId, clientes) {
  const { data } = await api.post(`/hojas-ruta/${transaccionId}/devoluciones`, { clientes });
  return data;
}

/**
 * Sección 4.2.3: Obtener movimientos de cajones por hoja de ruta
 */
export async function fetchCajonesHojaRuta(transaccionId) {
  const { data } = await api.get(`/hojas-ruta/${transaccionId}/cajones`);
  return data;
}

/**
 * Sección 4.2.3: Guardar entrega y devolución de cajones
 */
export async function saveCajonesHojaRuta(transaccionId, items) {
  const { data } = await api.post(`/hojas-ruta/${transaccionId}/cajones`, { items });
  return data;
}

/**
 * Buscar remito por código de barras 1D (TransaccionId o Comprobante)
 */
export async function searchRemitoByCode(code) {
  const { data } = await api.get('/remitos/buscar', {
    params: { transaccion_id: code }
  });
  return data;
}

/**
 * Obtener remitos del chofer (con filtros opcionales de hoja de ruta y búsqueda)
 */
export async function fetchMisRemitos(params = {}) {
  const { data } = await api.get('/remitos/mis-remitos', { params });
  return data;
}

/**
 * Obtener lista de viajes/hojas de ruta asignadas (resumen de remitos)
 */
export async function fetchViajes(params = {}) {
  const { data } = await api.get('/remitos/viajes', { params });
  return data;
}

/**
 * Guardar control de firma de un remito
 */
export async function submitControlRemito(remitoId, payload) {
  const { data } = await api.put(`/remitos/${remitoId}/control`, payload);
  return data;
}

/**
 * Subir fotografía tomada por el chofer
 */
export async function uploadFotoRemito(formData) {
  const { data } = await api.post('/remitos/upload-foto', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return data;
}

/**
 * Sincronizar lote de controles guardados offline
 */
export async function syncOfflineBatch(items) {
  const { data } = await api.post('/remitos/sync-offline', { items });
  return data;
}

// ============================================================================
// GESTOR DE ESCRITORIO (/api/admin)
// ============================================================================

export async function fetchAdminDashboard() {
  const { data } = await api.get('/admin/dashboard');
  return data;
}

export async function fetchAdminHojasRuta(params = {}) {
  const { data } = await api.get('/admin/hojas-ruta', { params });
  return data;
}

export async function fetchAdminHojaRutaDetalle(transaccionId) {
  const { data } = await api.get(`/admin/hojas-ruta/${transaccionId}`);
  return data;
}

export async function fetchAdminDevoluciones(params = {}) {
  const { data } = await api.get('/admin/devoluciones', { params });
  return data;
}

export async function fetchAdminCajones(params = {}) {
  const { data } = await api.get('/admin/cajones', { params });
  return data;
}

export async function fetchAdminUsuarios(params = {}) {
  const { data } = await api.get('/admin/usuarios', { params });
  return data;
}

export async function fetchAdminOrganizaciones(params = {}) {
  const { data } = await api.get('/admin/organizaciones', { params });
  return data;
}

export async function createAdminUsuario(payload) {
  const { data } = await api.post('/admin/usuarios', payload);
  return data;
}

export async function updateAdminUsuario(id, payload) {
  const { data } = await api.put(`/admin/usuarios/${id}`, payload);
  return data;
}

export async function deleteAdminUsuario(id) {
  const { data } = await api.delete(`/admin/usuarios/${id}`);
  return data;
}

export async function fetchAdminAuditoria(params = {}) {
  const { data } = await api.get('/admin/auditoria', { params });
  return data;
}

export default api;
