import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig, loginRequest } from './msalConfig';
import { fetchCurrentUser, syncOfflineBatch } from '../services/api';
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

  // Actualizar contador de pendientes
  const refreshPendingCount = useCallback(async () => {
    try {
      const pending = await getPendingControls();
      setPendingSyncCount(pending.length);
    } catch (err) {
      console.warn('Error al leer pendientes:', err);
    }
  }, []);

  // Función para sincronizar la cola offline con el backend
  const triggerSyncOffline = useCallback(async () => {
    if (!navigator.onLine || syncing) return;
    try {
      setSyncing(true);
      const pending = await getPendingControls();
      if (pending.length === 0) {
        setPendingSyncCount(0);
        return;
      }

      console.log(`[Sync] Sincronizando ${pending.length} controles offline...`);
      const response = await syncOfflineBatch(pending);
      if (response && response.ok) {
        await clearPendingControls();
        setPendingSyncCount(0);
        console.log('✔ [Sync] Controles offline sincronizados con éxito.');
      }
    } catch (err) {
      console.error('[Sync] Error al sincronizar controles offline:', err);
    } finally {
      setSyncing(false);
    }
  }, [syncing]);

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
      if (storedEmail) {
        // Fallback offline / local
        setUser({
          id: 1,
          email: storedEmail,
          nombre: storedEmail.split('@')[0],
          codigo_chofer: '32355',
          rol: 'chofer',
          activo: 1
        });
      } else {
        setUser(null);
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

    // Cargar sesión existente
    const storedEmail = localStorage.getItem('dy_user_email') || (
      import.meta.env.VITE_MOCK_AUTH === 'true' ? import.meta.env.VITE_DEFAULT_MOCK_EMAIL : null
    );

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

  // Login con Microsoft Entra ID
  const loginWithMicrosoft = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!msalInstance) {
        throw new Error('MSAL no está configurado. Configure VITE_AZURE_AD_CLIENT_ID en el archivo .env.');
      }

      const loginResponse = await msalInstance.loginPopup(loginRequest);
      const email = loginResponse.account?.username || loginResponse.account?.idTokenClaims?.email;

      if (!email) {
        throw new Error('No se pudo obtener el correo corporativo desde la cuenta de Microsoft.');
      }

      await loadUser(email);
    } catch (err) {
      console.error('[MSAL] Error en login Microsoft:', err);
      setError(err.message || 'Error al iniciar sesión con Microsoft.');
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
    setUser(null);
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
    isOnline,
    pendingSyncCount,
    syncing,
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
