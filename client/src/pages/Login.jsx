import React, { useState, useEffect } from 'react';
import { useAuth } from '../config/AuthContext';
import { useTheme } from '../config/ThemeContext';
import { fetchUsersList } from '../services/api';
import { ShieldCheck, LogIn, AlertCircle, Sun, Moon, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import logo from '../assets/logo-don-yeyo-png-sin-fondo.png';
import microsoftLogo from '../assets/microsoft-logo.png';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { loginWithEmailPassword, loginWithMicrosoft, loginMock, loading, error, setError } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [testUsers, setTestUsers] = useState([]);
  const [selectedMockEmail, setSelectedMockEmail] = useState(
    import.meta.env.VITE_DEFAULT_MOCK_EMAIL || 'chofer.perez@donyeyo.com.ar'
  );
  const isMockAllowed = import.meta.env.VITE_MOCK_AUTH === 'true';

  useEffect(() => {
    if (isMockAllowed) {
      fetchUsersList()
        .then((res) => {
          if (res && res.users) {
            setTestUsers(res.users);
          }
        })
        .catch(() => {});
    }
  }, [isMockAllowed]);

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);
    if (setError) setError(null);

    const cleanEmail = email.trim();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      setLocalError('Ingrese un usuario con formato de email válido (ej. chofer@donyeyo.com.ar).');
      return;
    }
    if (!password) {
      setLocalError('Ingrese su contraseña para validar contra Microsoft Entra ID.');
      return;
    }

    const result = await loginWithEmailPassword(cleanEmail, password);
    // Limpiar contraseña de memoria inmediatamente tras el intento
    setPassword('');

    if (!result.ok) {
      setLocalError(result.error || 'Las credenciales ingresadas no son válidas.');
    }
  };

  const displayError = localError || error;

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
            App Móvil para Choferes
          </p>
        </div>

        {displayError && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 14px', borderRadius: '12px', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left', width: '100%' }}>
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <span>{displayError}</span>
          </div>
        )}

        <form onSubmit={handleCredentialsSubmit} className="login-options" noValidate>
          <div className="login-field-group">
            <label className="login-field-label" htmlFor="login-email">
              Usuario (Email corporativo)
            </label>
            <div className="login-input-wrap">
              <Mail size={18} className="login-input-icon" />
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="chofer@donyeyo.com.ar"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="login-input"
                disabled={loading}
              />
            </div>
          </div>

          <div className="login-field-group">
            <label className="login-field-label" htmlFor="login-password">
              Contraseña
            </label>
            <div className="login-input-wrap">
              <Lock size={18} className="login-input-icon" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="login-input"
                style={{ paddingRight: '42px' }}
                disabled={loading}
              />
              <button
                type="button"
                className="login-eye-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-login-primary"
          >
            <LogIn size={19} />
            <span>{loading ? 'Validando acceso...' : 'Iniciar Sesión'}</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '4px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              o con SSO Microsoft
            </span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>

          {/* Botón de inicio de sesión con Microsoft Entra ID (Popup interactivo) */}
          <button
            type="button"
            className="btn-microsoft"
            onClick={() => loginWithMicrosoft(email)}
            disabled={loading}
          >
            <img
              src={microsoftLogo}
              alt="Microsoft"
              style={{ height: '22px', width: '22px', objectFit: 'contain' }}
            />
            <span>Inicia sesión con Microsoft</span>
          </button>
        </form>

        {/* Selector de modo desarrollo para pruebas rápidas */}
        {isMockAllowed && (
          <div style={{ marginTop: '6px', paddingTop: '14px', borderTop: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Modo Desarrollo: Acceso Rápido
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
                    {u.nombre} ({u.codigo_chofer ? `Chofer #${u.codigo_chofer}` : u.rol})
                  </option>
                ))
              ) : (
                <>
                  <option value="chofer.perez@donyeyo.com.ar">Juan Carlos Pérez (Chofer #32355)</option>
                  <option value="gabrielt@donyeyo.com.ar">Gabriel T. (Admin)</option>
                  <option value="chofer.gomez@donyeyo.com.ar">Carlos Alberto Gómez (Chofer #32356)</option>
                  <option value="chofer.rodriguez@donyeyo.com.ar">Marcos Rodríguez (Chofer #32357)</option>
                </>
              )}
            </select>

            <button
              type="button"
              onClick={() => loginMock(selectedMockEmail)}
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
              <span>Ingresar como Usuario Seleccionado</span>
            </button>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          <ShieldCheck size={14} />
          <span>Validación Microsoft Entra ID • Don Yeyo S.A.</span>
        </div>
      </div>
    </div>
  );
}
