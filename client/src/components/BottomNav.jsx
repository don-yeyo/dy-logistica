import React from 'react';
import { Home, ScanLine, FileText, HelpCircle } from 'lucide-react';

export default function BottomNav({ currentScreen, onNavigate, onOpenHelp }) {
  const isHomeActive = currentScreen === 'dashboard';
  const isScanActive = currentScreen === 'scan';
  const isViajesActive = currentScreen === 'hojas_ruta';

  const navItems = [
    {
      id: 'dashboard',
      label: 'Inicio',
      icon: <Home size={22} />,
      isActive: isHomeActive,
      onClick: () => onNavigate('dashboard')
    },
    {
      id: 'scan',
      label: 'Escanear',
      icon: <ScanLine size={22} />,
      isActive: isScanActive,
      onClick: () => onNavigate('scan')
    },
    {
      id: 'hojas_ruta',
      label: 'Viajes',
      icon: <FileText size={22} />,
      isActive: isViajesActive,
      onClick: () => onNavigate('hojas_ruta')
    },
    {
      id: 'help',
      label: 'Ayuda',
      icon: <HelpCircle size={22} />,
      isActive: false,
      onClick: onOpenHelp
    }
  ];

  return (
    <nav className="bottom-nav glass">
      <div className="bottom-nav-inner">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`bottom-nav-btn ${item.isActive ? 'active' : ''}`}
            onClick={item.onClick}
            title={item.label}
          >
            <div className={`nav-btn-circle ${item.isActive ? 'active' : ''}`}>
              {item.icon}
            </div>
            <span className={`nav-btn-label ${item.isActive ? 'active' : ''}`}>
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}


