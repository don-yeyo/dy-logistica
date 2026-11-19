import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig, loginRequest } from './msalConfig';
import {
  fetchCurrentUser,
  loginWithCredentials,
  syncOfflineBatch,
  saveEntregasHojaRuta,
  saveDevolucionesHojaRuta,
  saveCajonesHojaRuta
} from '../services/api';
import { getPendingControls, clearPendingControls } from '../services/offlineStorage';

const AuthContext = createContext(null);

// Instancia de MSAL
let msalInstance = null;
try {
  if (msalConfig.auth.clientId && !msalConfig.auth.clientId.startsWith('00000000')) {
    msalInstance = new PublicClientApplication(msalConfig);
    msalInstance.initialize();
  }
} catch (e) {
  console.warn('[MSAL] Inicialización de MSAL omitida o en modo Mock:', e.message);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  // Actualizar contador de pendientes
  const refreshPendingCount = useCallback(async () => {
    try {
      const pending = await getPendingControls();
      setPendingSyncCount(pending.length);
    } catch (err) {
      console.warn('Error al leer pendientes:', err);
    }
  }, []);

  // Función para sincronizar la cola offline unificada con el backend
  const triggerSyncOffline = useCallback(async () => {
    if (!navigator.onLine || syncingRef.current) return;
    try {
      syncingRef.current = true;
      setSyncing(true);
      const pending = await getPendingControls();
      if (pending.length === 0) {
        setPendingSyncCount(0);
        return;
      }

      console.log(`[Sync] Sincronizando ${pending.length} operaciones offline...`);

      const remitoItems = pending.filter(p => !p.op_type || p.op_type === 'remito');
      const otherItems = pending.filter(p => p.op_type && p.op_type !== 'remito');
      const syncedIds = [];

      if (remitoItems.length > 0) {
        try {
          const response = await syncOfflineBatch(remitoItems);
          if (response && response.ok) {
            remitoItems.forEach(item => syncedIds.push(item.queue_id));
          }
        } catch (err) {
          console.error('[Sync] Error sincronizando remitos offline:', err);
        }
      }

      for (const op of otherItems) {
        try {
          if (op.op_type === 'entregas') {
            await saveEntregasHojaRuta(op.transaccionId, op.items);
            syncedIds.push(op.queue_id);
          } else if (op.op_type === 'devoluciones') {
            await saveDevolucionesHojaRuta(op.transaccionId, op.clientes);
            syncedIds.push(op.queue_id);
          } else if (op.op_type === 'cajones') {
            await saveCajonesHojaRuta(op.transaccionId, op.items);
            syncedIds.push(op.queue_id);
          }
        } catch (opErr) {
          console.error(`[Sync] Error sincronizando operación ${op.op_type}:`, opErr);
        }
      }

      if (syncedIds.length > 0) {
        await clearPendingControls(syncedIds);
        console.log(`✔ [Sync] ${syncedIds.length} operaciones offline sincronizadas con éxito.`);
      }
      await refreshPendingCount();
    } catch (err) {
      console.error('[Sync] Error al sincronizar operaciones offline:', err);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [refreshPendingCount]);

  // Cargar usuario autenticado inicial
  const loadUser = useCallback(async (email) => {
    try {
      setLoading(true);
      setError(null);
      if (email) {
        localStorage.setItem('dy_user_email', email);
      }
      const data = await fetchCurrentUser();
      if (data && data.ok) {
        setUser(data.user);
      }
    } catch (err) {
      console.warn('[AuthContext] Error al cargar usuario:', err.message);
      const storedEmail = localStorage.getItem('dy_user_email');
      if (storedEmail && !navigator.onLine) {
        // Fallback offline cuando no hay red
        setUser({
          id: 1,
          email: storedEmail,
          nombre: storedEmail.split('@')[0],
          codigo_chofer: '32355',
          rol: 'chofer',
          activo: 1
        });
      } else {
        localStorage.removeItem('dy_user_email');
        setUser(null);
        setError(err.response?.data?.error || 'No se pudo validar el acceso del usuario.');
      }
    } finally {
      setLoading(false);
      refreshPendingCount();
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    const handleOnline = () => {
      console.log('[Network] Conexión a Internet reestablecida.');
      setIsOnline(true);
      triggerSyncOffline();
    };

    const handleOffline = () => {
      console.log('[Network] Sin conexión a Internet (Modo Offline activo).');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cargar sesión existente si el usuario ya inició sesión (no almacena contraseña)
    const storedEmail = localStorage.getItem('dy_user_email');
    if (storedEmail) {
      loadUser(storedEmail);
    } else {
      setLoading(false);
    }

    refreshPendingCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadUser, refreshPendingCount, triggerSyncOffline]);

  // Login con Email y Contraseña validados contra Microsoft Entra ID (Sección 4.1)
  const loginWithEmailPassword = async (email, password) => {
    try {
      setLoading(true);
      setError(null);
      const cleanEmail = String(email || '').trim().toLowerCase();
      const data = await loginWithCredentials(cleanEmail, password);
      if (data && data.ok && data.user) {
        localStorage.setItem('dy_user_email', data.user.email);
        setUser(data.user);
        await refreshPendingCount();
        return { ok: true };
      }
      throw new Error('Las credenciales ingresadas no son válidas.');
    } catch (err) {
      const apiMsg = err.response?.data?.error || err.message || 'Las credenciales ingresadas no son válidas.';
      setError(apiMsg);
      return {
        ok: false,
        error: apiMsg,
        require_sso_popup: Boolean(err.response?.data?.require_sso_popup)
      };
    } finally {
      setLoading(false);
    }
  };

  // Login con Microsoft Entra ID (Popup SSO)
  const loginWithMicrosoft = async (loginHint = '') => {
    try {
      setLoading(true);
      setError(null);

      if (!msalInstance) {
        throw new Error('MSAL no está configurado. Configure VITE_AZURE_AD_CLIENT_ID en el archivo .env.');
      }

      const reqPayload = loginHint && loginHint.includes('@')
        ? { ...loginRequest, loginHint: loginHint.trim() }
        : loginRequest;

      const loginResponse = await msalInstance.loginPopup(reqPayload);
      const email = loginResponse.account?.username || loginResponse.account?.idTokenClaims?.email;

      if (!email) {
        throw new Error('No se pudo obtener el correo corporativo desde la cuenta de Microsoft.');
      }

      await loadUser(email);
    } catch (err) {
      console.error('[MSAL] Error en login Microsoft:', err);
      setError(err.message || 'Las credenciales ingresadas no son válidas.');
    } finally {
      setLoading(false);
    }
  };

  // Login Mock / Switcher para desarrollo
  const loginMock = async (email) => {
    await loadUser(email);
  };

  // Cerrar Sesión
  const logout = async () => {
    localStorage.removeItem('dy_user_email');
    localStorage.removeItem('dy_selected_hoja_ruta');
    setUser(null);
    setError(null);
    if (msalInstance && msalInstance.getAllAccounts().length > 0) {
      try {
        await msalInstance.logoutPopup();
      } catch (e) {
        console.warn('Logout MSAL popup falló:', e);
      }
    }
  };

  const value = {
    user,
    loading,
    error,
    setError,
    isOnline,
    pendingSyncCount,
    syncing,
    loginWithEmailPassword,
    loginWithMicrosoft,
    loginMock,
    logout,
    refreshPendingCount,
    triggerSyncOffline
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
}
