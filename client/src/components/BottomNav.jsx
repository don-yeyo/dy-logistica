import React from 'react';
import { Home, PackageCheck, PackageMinus, Boxes, FileSignature } from 'lucide-react';

/**
 * Barra inferior operativa (Sección 4.2):
 * Inicio (azul), Entregas (verde), Devoluciones (naranja), Cajones (violeta), Remitos (cian).
 * Muestra un puntito lleno cuando la sección tiene borradores locales sin confirmar en BD.
 */
export default function BottomNav({ currentScreen, onNavigate, hasSelectedHojaRuta, dirtyModules = {} }) {
  const navItems = [
    {
      id: 'hojas_ruta',
      label: 'Inicio',
      colorClass: 'mod-inicio',
      icon: <Home size={20} />,
      isActive: currentScreen === 'hojas_ruta',
      alwaysEnabled: true
    },
    {
      id: 'entregas',
      label: 'Entregas',
      colorClass: 'mod-entregas',
      icon: <PackageCheck size={20} />,
      isActive: currentScreen === 'entregas'
    },
    {
      id: 'devoluciones',
      label: 'Devoluciones',
      colorClass: 'mod-devoluciones',
      icon: <PackageMinus size={20} />,
      isActive: currentScreen === 'devoluciones'
    },
    {
      id: 'cajones',
      label: 'Cajones',
      colorClass: 'mod-cajones',
      icon: <Boxes size={20} />,
      isActive: currentScreen === 'cajones'
    },
    {
      id: 'remitos',
      label: 'Remitos',
      colorClass: 'mod-remitos',
      icon: <FileSignature size={20} />,
      isActive: currentScreen === 'remitos' || currentScreen === 'scan'
    }
  ];

  return (
    <nav className="bottom-nav glass">
      <div className="bottom-nav-inner">
        {navItems.map((item) => {
          const isEnabled = Boolean(item.alwaysEnabled || hasSelectedHojaRuta);
          const hasDirty = Boolean(dirtyModules[item.id]);
          return (
            <button
              key={item.id}
              type="button"
              className={`bottom-nav-btn ${item.colorClass} ${item.isActive ? 'active' : ''} ${isEnabled ? 'ready' : 'needs-hr'}`}
              onClick={() => onNavigate(item.id)}
              title={hasDirty ? `${item.label} (cambios sin confirmar)` : item.label}
            >
              <div className={`nav-btn-circle ${item.isActive ? 'active' : ''}`}>
                {item.icon}
                {hasDirty && (
                  <span className="nav-dirty-dot" aria-label="Cambios sin confirmar" />
                )}
              </div>
              <span className={`nav-btn-label ${item.isActive ? 'active' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
