import React from 'react';
import { Home, ScanLine, FileText, HelpCircle } from 'lucide-react';

export default function BottomNav({ currentScreen, onNavigate, onOpenHelp }) {
  const isHomeActive = currentScreen === 'dashboard';
  const isScanActive = currentScreen === 'scan';
  const isViajesActive = currentScreen === 'hojas_ruta';

  return (
    <nav className="bottom-nav glass">
      <div className="bottom-nav-inner">
        {/* 1. Inicio (Dashboard) */}
        <button
          type="button"
          className={`bottom-nav-item ${isHomeActive ? 'active' : ''}`}
          onClick={() => onNavigate('dashboard')}
          title="Inicio"
        >
          <div className="nav-icon-container">
            <Home size={22} />
          </div>
          <span>Inicio</span>
          {isHomeActive && <div className="nav-active-pill" />}
        </button>

        {/* 2. Escanear (Botón Central) */}
        <button
          type="button"
          className={`bottom-nav-scan-btn ${isScanActive ? 'active' : ''}`}
          onClick={() => onNavigate('scan')}
          title="Escanear Remito"
        >
          <div className={`scan-btn-circle ${isScanActive ? 'active' : ''}`}>
            <ScanLine size={24} />
          </div>
          <span className={`scan-btn-label ${isScanActive ? 'active' : ''}`}>
            Escanear
          </span>
        </button>

        {/* 3. Viajes / Hojas de Ruta */}
        <button
          type="button"
          className={`bottom-nav-item ${isViajesActive ? 'active' : ''}`}
          onClick={() => onNavigate('hojas_ruta')}
          title="Hojas de Ruta"
        >
          <div className="nav-icon-container">
            <FileText size={22} />
          </div>
          <span>Viajes</span>
          {isViajesActive && <div className="nav-active-pill" />}
        </button>

        {/* 4. Ayuda / Asistente Virtual */}
        <button
          type="button"
          className="bottom-nav-item"
          onClick={onOpenHelp}
          title="Robot Ayudante"
        >
          <div className="nav-icon-container">
            <HelpCircle size={22} />
          </div>
          <span>Ayuda</span>
        </button>
      </div>
    </nav>
  );
}

