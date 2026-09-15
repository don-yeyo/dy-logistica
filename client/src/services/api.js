import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000
});

// Interceptor de Peticiones: inyecta email de usuario y API Key
api.interceptors.request.use(
  (config) => {
    const userEmail = localStorage.getItem('dy_user_email');
    if (userEmail) {
      config.headers['x-user-email'] = userEmail;
    }

    const apiKey = import.meta.env.VITE_API_SECRET_KEY;
    if (apiKey) {
      config.headers['x-api-key'] = apiKey;
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
      console.warn('[API] Sesión no identificada o expirada.');
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
 * Obtener lista de viajes/hojas de ruta asignadas
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

export default api;
