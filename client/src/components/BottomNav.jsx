import React from 'react';
import { Home, PackageCheck, PackageMinus, Boxes, FileSignature } from 'lucide-react';

/**
 * Barra inferior operativa (Sección 4.2):
 * Inicio (Hojas de Ruta), Entregas, Devoluciones, Cajones, Remitos.
 */
export default function BottomNav({ currentScreen, onNavigate, hasSelectedHojaRuta }) {
  const navItems = [
    {
      id: 'hojas_ruta',
      label: 'Inicio',
      icon: <Home size={20} />,
      isActive: currentScreen === 'hojas_ruta',
      alwaysEnabled: true
    },
    {
      id: 'entregas',
      label: 'Entregas',
      icon: <PackageCheck size={20} />,
      isActive: currentScreen === 'entregas'
    },
    {
      id: 'devoluciones',
      label: 'Devoluciones',
      icon: <PackageMinus size={20} />,
      isActive: currentScreen === 'devoluciones'
    },
    {
      id: 'cajones',
      label: 'Cajones',
      icon: <Boxes size={20} />,
      isActive: currentScreen === 'cajones'
    },
    {
      id: 'remitos',
      label: 'Remitos',
      icon: <FileSignature size={20} />,
      isActive: currentScreen === 'remitos' || currentScreen === 'scan'
    }
  ];

  return (
    <nav className="bottom-nav glass">
      <div className="bottom-nav-inner">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`bottom-nav-btn ${item.isActive ? 'active' : ''} ${!hasSelectedHojaRuta && !item.alwaysEnabled ? 'needs-hr' : ''}`}
            onClick={() => onNavigate(item.id)}
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
