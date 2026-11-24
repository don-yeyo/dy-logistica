import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig, loginRequest } from './msalConfig';
import {
  fetchCurrentUser,
  fetchUsersList,
  syncOfflineBatch,
  saveEntregasHojaRuta,
  saveDevolucionesHojaRuta,
  saveCajonesHojaRuta
} from '../services/api';
import { getPendingControls, clearPendingControls } from '../services/offlineStorage';

const AuthContext = createContext(null);
const IMPERSONATION_ENABLED =
  import.meta.env.VITE_ENABLE_USER_IMPERSONATION === 'true' ||
  import.meta.env.VITE_MOCK_AUTH === 'true';

// Instancia y promesa de inicialización de MSAL
let msalInstance = null;
let msalInitPromise = null;
try {
  if (msalConfig.auth.clientId && !msalConfig.auth.clientId.startsWith('00000000')) {
    msalInstance = new PublicClientApplication(msalConfig);
    msalInitPromise = msalInstance.initialize().catch((err) => {
      console.warn('[MSAL] Error al inicializar MSAL:', err.message);
      return null;
    });
  }
} catch (e) {
  console.warn('[MSAL] Inicialización de MSAL omitida o en modo Mock:', e.message);
}

async function ensureMsalInitialized() {
  if (!msalInstance) return null;
  if (msalInitPromise) {
    await msalInitPromise;
  }
  return msalInstance;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [isImpersonating, setIsImpersonating] = useState(() =>
    Boolean(IMPERSONATION_ENABLED && localStorage.getItem('dy_impersonated_email'))
  );
  const syncingRef = useRef(false);

  const refreshAvailableUsers = useCallback(async () => {
    if (!IMPERSONATION_ENABLED) return;
    try {
      const res = await fetchUsersList();
      if (res && Array.isArray(res.users)) {
        setAvailableUsers(res.users);
      }
    } catch (err) {
      console.warn('[AuthContext] No se pudo obtener lista de usuarios para simulación:', err.message);
    }
  }, []);

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
      if (data && data.ok && data.user) {
        if (data.user.rol) {
          localStorage.setItem('dy_user_rol', data.user.rol);
        }
        setUser(data.user);
      }
    } catch (err) {
      console.warn('[AuthContext] Error al cargar usuario:', err.message);
      const storedEmail = localStorage.getItem('dy_user_email');
      const storedRol = localStorage.getItem('dy_user_rol') || 'chofer';
      if (storedEmail && !navigator.onLine) {
        // Fallback offline cuando no hay red
        setUser({
          id: 1,
          email: storedEmail,
          nombre: storedEmail.split('@')[0],
          codigo_chofer: null,
          rol: storedRol,
          activo: 1
        });
      } else {
        localStorage.removeItem('dy_user_email');
        localStorage.removeItem('dy_user_rol');
        setUser(null);
        setError(err.response?.data?.error || 'No se pudo validar el acceso del usuario.');
      }
    } finally {
      setLoading(false);
      refreshPendingCount();
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    let active = true;

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

    const restoreSession = async () => {
      const storedEmail = localStorage.getItem('dy_user_email');
      const impersonatedEmail = IMPERSONATION_ENABLED ? localStorage.getItem('dy_impersonated_email') : null;

      try {
        if (impersonatedEmail) {
          if (active) {
            setIsImpersonating(true);
            await loadUser(impersonatedEmail);
          }
          return;
        }

        const instance = await ensureMsalInitialized();
        if (instance) {
          const redirectResult = await instance.handleRedirectPromise().catch(() => null);
          const accounts = instance.getAllAccounts();
          const account = redirectResult?.account || instance.getActiveAccount() || accounts[0];

          if (account) {
            instance.setActiveAccount(account);
            if (!navigator.onLine && storedEmail) {
              if (active) await loadUser(storedEmail);
              return;
            }
            try {
              // Verificar silenciosamente que el token Microsoft siga vigente (sin pedir login de nuevo)
              await instance.acquireTokenSilent({
                ...loginRequest,
                account
              });
              const msalEmail = account.username || account.idTokenClaims?.email || storedEmail;
              if (msalEmail && active) {
                await loadUser(msalEmail);
                return;
              }
            } catch (silentErr) {
              console.info('[MSAL] Sesión expirada o requiere nueva autenticación:', silentErr.message);
              if (storedEmail && IMPERSONATION_ENABLED && active) {
                await loadUser(storedEmail);
                return;
              }
              localStorage.removeItem('dy_user_email');
              localStorage.removeItem('dy_user_rol');
              if (active) setLoading(false);
              return;
            }
          }
        }

        // Modo gestación/desarrollo o contingencia offline con sesión previa
        if (storedEmail && (IMPERSONATION_ENABLED || !navigator.onLine)) {
          if (active) await loadUser(storedEmail);
          return;
        }

        localStorage.removeItem('dy_user_email');
        localStorage.removeItem('dy_user_rol');
        if (active) setLoading(false);
      } catch (err) {
        console.warn('[AuthContext] Error restaurando sesión:', err.message);
        if (active) setLoading(false);
      }
    };

    restoreSession();
    refreshAvailableUsers();
    refreshPendingCount();

    return () => {
      active = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadUser, refreshAvailableUsers, refreshPendingCount, triggerSyncOffline]);

  // Login con Microsoft Entra ID (Popup SSO)
  const loginWithMicrosoft = async () => {
    try {
      setLoading(true);
      setError(null);

      const instance = await ensureMsalInitialized();
      if (!instance) {
        throw new Error('MSAL no está configurado. Configure VITE_AZURE_AD_CLIENT_ID en el archivo .env.');
      }

      const loginResponse = await instance.loginPopup(loginRequest);
      if (loginResponse.account) {
        instance.setActiveAccount(loginResponse.account);
      }
      const email = loginResponse.account?.username || loginResponse.account?.idTokenClaims?.email;

      if (!email) {
        throw new Error('No se pudo obtener el correo corporativo desde la cuenta de Microsoft.');
      }

      await loadUser(email);
    } catch (err) {
      console.error('[MSAL] Error en login Microsoft:', err);
      setError(err.message || 'No se pudo completar el inicio de sesión con Microsoft.');
    } finally {
      setLoading(false);
    }
  };

  // Simular ingreso con otro usuario (solo cuando el bypass de gestación está habilitado)
  const impersonateUser = useCallback(async (email) => {
    if (!IMPERSONATION_ENABLED || !email) return;
    localStorage.removeItem('dy_selected_hoja_ruta');
    localStorage.setItem('dy_impersonated_email', email);
    setIsImpersonating(true);
    await loadUser(email);
  }, [loadUser]);

  // Login Mock / Switcher para desarrollo
  const loginMock = async (email) => {
    await impersonateUser(email);
  };

  // Cerrar Sesión
  const logout = async () => {
    localStorage.removeItem('dy_user_email');
    localStorage.removeItem('dy_user_rol');
    localStorage.removeItem('dy_impersonated_email');
    localStorage.removeItem('dy_selected_hoja_ruta');
    setIsImpersonating(false);
    setUser(null);
    setError(null);
    const instance = await ensureMsalInitialized();
    if (instance && instance.getAllAccounts().length > 0) {
      try {
        await instance.logoutPopup();
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
    impersonationEnabled: IMPERSONATION_ENABLED,
    isImpersonating,
    availableUsers,
    impersonateUser,
    refreshAvailableUsers,
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
