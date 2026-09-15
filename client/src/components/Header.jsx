import React, { useState } from 'react';
import { useAuth } from '../config/AuthContext';
import { useTheme } from '../config/ThemeContext';
import { 
  Menu, 
  Sun, 
  Moon, 
  LogOut, 
  Wifi, 
  WifiOff, 
  RefreshCw,
  User
} from 'lucide-react';
import logo from '../assets/logo-don-yeyo-png-sin-fondo.png';
import pkg from '../../package.json';

const appVersion = pkg.version;

export default function Header({ onMenuClick }) {
  const { user, logout, isOnline, pendingSyncCount, syncing, triggerSyncOffline } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const name = user?.nombre || 'Chofer';
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'DY';

  return (
    <header className="app-header glass">
      <div className="header-top">
        {/* Sección Izquierda: Menú Hamburguesa y Logo Don Yeyo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="mode-toggle"
            onClick={onMenuClick}
            style={{ border: 'none', color: '#ffffff', background: 'rgba(255,255,255,0.1)' }}
            title="Abrir menú"
          >
            <Menu size={22} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img
              src={logo}
              alt="Don Yeyo"
              style={{ height: '32px', width: 'auto', objectFit: 'contain' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="brand-title">Logística</span>
                <span className="brand-badge" title={`Versión ${appVersion}`}>
                  v{appVersion}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sección Derecha: Indicador de red, Toggle de tema y Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Indicador de Conexión & Sincronización */}
          <button
            type="button"
            onClick={triggerSyncOffline}
            className={`connection-pill ${isOnline ? 'online' : 'offline'}`}
            style={{ border: 'none' }}
            title={
              isOnline
                ? pendingSyncCount > 0
                  ? `Sincronizar ${pendingSyncCount} pendientes`
                  : 'Conectado a Internet'
                : 'Sin conexión (Modo Offline activo)'
            }
          >
            {syncing ? (
              <RefreshCw size={12} className="spin" />
            ) : isOnline ? (
              <Wifi size={12} />
            ) : (
              <WifiOff size={12} />
            )}
            <span>
              {syncing
                ? 'Sincronizando...'
                : !isOnline
                ? 'Sin conexión'
                : pendingSyncCount > 0
                ? `${pendingSyncCount} pend.`
                : 'Con conexión'}
            </span>
          </button>

          {/* Toggle Modo Claro / Oscuro */}
          <button
            type="button"
            className="mode-toggle"
            onClick={toggleTheme}
            style={{ border: 'none', color: '#ffffff', background: 'rgba(255,255,255,0.1)' }}
            title="Cambiar tema"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          {/* Avatar con Menú Desplegable */}
          <div style={{ position: 'relative' }}>
            <div
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: '#ffffff',
                color: 'var(--dy-blue)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
              }}
              title={name}
            >
              {initials}
            </div>

            {showUserDropdown && (
              <div
                className="glass"
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '8px',
                  minWidth: '190px',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  borderRadius: '14px',
                  border: '1px solid var(--border)',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                  overflow: 'hidden',
                  zIndex: 200,
                  padding: '6px'
                }}
              >
                <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: 800, margin: 0 }}>{name}</p>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    {user?.email}
                  </p>
                </div>

                <button
                  onClick={() => {
                    toggleTheme();
                    setShowUserDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                  <span>{theme === 'light' ? 'Modo Oscuro' : 'Modo Claro'}</span>
                </button>

                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    logout();
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--error)',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <LogOut size={16} />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
