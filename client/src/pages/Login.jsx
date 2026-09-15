import React, { useState, useEffect } from 'react';
import { useAuth } from '../config/AuthContext';
import { useTheme } from '../config/ThemeContext';
import { fetchUsersList } from '../services/api';
import { ShieldCheck, LogIn, AlertCircle, Sun, Moon } from 'lucide-react';
import logo from '../assets/logo-don-yeyo-png-sin-fondo.png';
import microsoftLogo from '../assets/microsoft-logo.png';

export default function Login() {
  const { loginWithMicrosoft, loginMock, loading, error } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [testUsers, setTestUsers] = useState([]);
  const [selectedMockEmail, setSelectedMockEmail] = useState('chofer.perez@donyeyo.com.ar');
  const isMockAllowed = import.meta.env.VITE_MOCK_AUTH === 'true';

  useEffect(() => {
    if (isMockAllowed) {
      fetchUsersList()
        .then((res) => {
          if (res && res.users) {
            setTestUsers(res.users);
          }
        })
        .catch(() => { });
    }
  }, [isMockAllowed]);

  return (
    <div className="login-container">
      {/* Botón de cambio de tema en la esquina superior derecha */}
      <button
        onClick={toggleTheme}
        className="mode-toggle"
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
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
          style={{ height: '110px', width: 'auto', marginBottom: '8px', objectFit: 'contain' }}
        />

        <div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>
            Don Yeyo Logística
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: '6px' }}>
            Gestión Documental de Transporte
          </p>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 14px', borderRadius: '12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left', width: '100%' }}>
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <div className="login-options">
          {/* Botón de inicio de sesión con Microsoft Entra ID */}
          <button
            type="button"
            className="btn-microsoft"
            onClick={loginWithMicrosoft}
            disabled={loading}
          >
            <img
              src={microsoftLogo}
              alt="Microsoft"
              style={{ height: '24px', width: '24px', objectFit: 'contain' }}
            />
            <span>Inicia sesión con Microsoft</span>
          </button>

          {/* Selector de modo desarrollo para pruebas rápidas */}
          {isMockAllowed && (
            <div style={{ marginTop: '14px', paddingTop: '16px', borderTop: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Modo Desarrollo: Acceso Rápido
              </span>

              <select
                value={selectedMockEmail}
                onChange={(e) => setSelectedMockEmail(e.target.value)}
                style={{
                  height: '46px',
                  padding: '0 12px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--border)',
                  fontSize: '0.88rem',
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
                  height: '46px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'var(--dy-blue)',
                  color: '#fff',
                  fontSize: '0.92rem',
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
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '8px' }}>
          <ShieldCheck size={14} />
          <span>Acceso seguro corporativo Don Yeyo S.A.</span>
        </div>
      </div>
    </div>
  );
}
