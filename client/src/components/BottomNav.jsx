import React from 'react';
import { Home, ScanLine, FileText, HelpCircle } from 'lucide-react';

export default function BottomNav({ currentScreen, onNavigate, onOpenHelp }) {
  return (
    <nav className="bottom-nav glass">
      <div className="bottom-nav-inner">
        {/* 1. Inicio (Dashboard) */}
        <button
          type="button"
          className={`bottom-nav-item ${currentScreen === 'dashboard' ? 'active' : ''}`}
          onClick={() => onNavigate('dashboard')}
        >
          <Home size={22} />
          <span>Inicio</span>
        </button>

        {/* 2. Escanear (Botón Central Elevado) */}
        <button
          type="button"
          className="bottom-nav-scan-btn"
          onClick={() => onNavigate('scan')}
          title="Escanear Remito"
        >
          <div className="scan-btn-circle">
            <ScanLine size={26} />
          </div>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, marginTop: '2px', color: 'var(--text)' }}>
            Escanear
          </span>
        </button>

        {/* 3. Viajes / Hojas de Ruta */}
        <button
          type="button"
          className={`bottom-nav-item ${currentScreen === 'hojas_ruta' ? 'active' : ''}`}
          onClick={() => onNavigate('hojas_ruta')}
        >
          <FileText size={22} />
          <span>Viajes</span>
        </button>

        {/* 4. Ayuda / Asistente Virtual */}
        <button
          type="button"
          className="bottom-nav-item"
          onClick={onOpenHelp}
          title="Asistente y Ayuda"
        >
          <HelpCircle size={22} />
          <span>Ayuda</span>
        </button>
      </div>
    </nav>
  );
}
