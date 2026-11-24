import React, { useState, useEffect } from 'react';
import { useAuth } from '../config/AuthContext';
import { useTheme } from '../config/ThemeContext';
import { fetchUsersList } from '../services/api';
import { ShieldCheck, LogIn, AlertCircle, Sun, Moon } from 'lucide-react';
import logo from '../assets/logo-don-yeyo-png-sin-fondo.png';
import microsoftLogo from '../assets/microsoft-logo.png';

export default function Login() {
  const { loginWithMicrosoft, impersonateUser, availableUsers, impersonationEnabled, loading, error, setError } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [testUsers, setTestUsers] = useState([]);
  const [selectedMockEmail, setSelectedMockEmail] = useState(
    import.meta.env.VITE_DEFAULT_MOCK_EMAIL || 'gabrielt@donyeyo.com.ar'
  );

  useEffect(() => {
    if (!impersonationEnabled) return;
    if (availableUsers && availableUsers.length > 0) {
      setTestUsers(availableUsers);
      return;
    }
    fetchUsersList()
      .then((res) => {
        if (res && res.users) {
          setTestUsers(res.users);
        }
      })
      .catch(() => {});
  }, [impersonationEnabled, availableUsers]);

  const handleMicrosoftLogin = async () => {
    if (setError) setError(null);
    await loginWithMicrosoft();
  };

  return (
    <div className="login-container">
      {/* Botón de cambio de tema en la esquina superior derecha */}
      <button
        onClick={toggleTheme}
        className="mode-toggle"
        style={{
          position: 'absolute',
          top: 'calc(16px + env(safe-area-inset-top, 0px))',
          right: 'calc(16px + env(safe-area-inset-right, 0px))',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)'
        }}
        title="Cambiar modo claro / oscuro"
      >
        {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
      </button>

      <div className="login-card glass">
        {/* Logo Don Yeyo */}
        <img
          src={logo}
          alt="Don Yeyo"
          style={{ height: '96px', width: 'auto', marginBottom: '4px', objectFit: 'contain' }}
        />

        <div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>
            Don Yeyo Logística
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Portal Logístico & App Choferes
          </p>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 14px', borderRadius: '12px', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left', width: '100%' }}>
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <div className="login-options" style={{ width: '100%' }}>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0 0 4px', lineHeight: 1.45 }}>
            Iniciá sesión con tu cuenta corporativa de Microsoft 365. Si tu sesión sigue vigente, el acceso será automático.
          </p>

          {/* Botón único SSO con Microsoft Entra ID */}
          <button
            type="button"
            className="btn-microsoft"
            onClick={handleMicrosoftLogin}
            disabled={loading}
          >
            <img
              src={microsoftLogo}
              alt="Microsoft"
              style={{ height: '22px', width: '22px', objectFit: 'contain' }}
            />
            <span>{loading ? 'Conectando con Microsoft...' : 'Inicia sesión con Microsoft'}</span>
          </button>
        </div>

        {/* Selector de modo gestación/desarrollo para simular ingreso por usuario */}
        {impersonationEnabled && (
          <div style={{ marginTop: '6px', paddingTop: '14px', borderTop: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Modo Gestación: Simular Usuario
            </span>

            <select
              value={selectedMockEmail}
              onChange={(e) => setSelectedMockEmail(e.target.value)}
              style={{
                height: '44px',
                padding: '0 12px',
                borderRadius: '12px',
                border: '1.5px solid var(--border)',
                fontSize: '0.86rem',
                fontWeight: 600,
                background: 'var(--surface)',
                color: 'var(--text)'
              }}
            >
              {testUsers.length > 0 ? (
                testUsers.map((u) => (
                  <option key={u.id} value={u.email}>
                    {u.nombre} ({u.rol} • {u.email})
                  </option>
                ))
              ) : (
                <>
                  <option value="gabrielt@donyeyo.com.ar">Gabriel T. (sysadmin)</option>
                  <option value="logistica@donyeyo.com.ar">Operador Logística (logistica)</option>
                  <option value="chofer.perez@donyeyo.com.ar">Juan Carlos Pérez (chofer)</option>
                </>
              )}
            </select>

            <button
              type="button"
              onClick={() => impersonateUser(selectedMockEmail)}
              disabled={loading}
              style={{
                height: '44px',
                borderRadius: '12px',
                border: 'none',
                background: 'var(--dy-blue)',
                color: '#fff',
                fontSize: '0.9rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer'
              }}
            >
              <LogIn size={18} />
              <span>Simular Ingreso</span>
            </button>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          <ShieldCheck size={14} />
          <span>SSO Microsoft Entra ID • Don Yeyo S.A.</span>
        </div>
      </div>
    </div>
  );
}
