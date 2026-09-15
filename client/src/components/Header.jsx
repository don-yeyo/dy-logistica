import React from 'react';
import { useAuth } from '../config/AuthContext';
import { Truck, LogOut, Wifi, WifiOff, RefreshCw } from 'lucide-react';

export default function Header({ currentRoute, onSelectRoute }) {
  const { user, isOnline, pendingSyncCount, syncing, triggerSyncOffline, logout } = useAuth();

  return (
    <header className="app-header">
      <div className="header-top">
        <div className="brand-section">
          <img src="/logo.png" alt="Don Yeyo" className="brand-logo" onError={(e) => { e.target.style.display = 'none'; }} />
          <div>
            <div className="brand-title">Don Yeyo</div>
          </div>
          <span className="brand-badge">Logística</span>
        </div>

        <div className="user-section">
          <button
            className={`connection-pill ${isOnline ? 'online' : 'offline'}`}
            onClick={triggerSyncOffline}
            title={isOnline ? 'Conectado al servidor' : 'Modo Sin Conexión activo'}
          >
            <span className="connection-dot" />
            {isOnline ? (
              <>
                <Wifi size={13} />
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff size={13} />
                <span>Offline {pendingSyncCount > 0 && `(${pendingSyncCount})`}</span>
              </>
            )}
            {syncing && <RefreshCw size={12} className="spin" />}
          </button>

          <button 
            className="btn-back-square" 
            style={{ minHeight: '34px', minWidth: '34px', border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', borderRadius: '8px' }}
            onClick={logout}
            title="Cerrar Sesión"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {user && (
        <div className="header-info-bar">
          <div className="driver-info">
            <Truck size={15} />
            <span>Chofer: {user.nombre} {user.codigo_chofer ? `(#${user.codigo_chofer})` : ''}</span>
          </div>
          {pendingSyncCount > 0 && (
            <span style={{ color: '#fef08a', fontSize: '0.75rem', fontWeight: 700 }}>
              {pendingSyncCount} pendientes de sync
            </span>
          )}
        </div>
      )}
    </header>
  );
}
