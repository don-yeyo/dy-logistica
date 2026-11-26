import React from 'react';
import { Home, MapPin, PackageCheck, PackageMinus, Boxes, FileSignature } from 'lucide-react';

/**
 * Barra inferior operativa de 6 pasos encadenados:
 * Inicio -> Lugares -> Entregas -> Devoluciones -> Cajones y Pallets -> Remitos.
 */
export default function BottomNav({
  currentScreen,
  onNavigate,
  hasSelectedHojaRuta,
  hasSelectedLugar,
  dirtyModules = {}
}) {
  const navItems = [
    {
      id: 'hojas_ruta',
      label: 'Inicio',
      colorClass: 'mod-inicio',
      icon: <Home size={19} />,
      isActive: currentScreen === 'hojas_ruta',
      isEnabled: true
    },
    {
      id: 'lugares',
      label: 'Lugares',
      colorClass: 'mod-lugares',
      icon: <MapPin size={19} />,
      isActive: currentScreen === 'lugares',
      isEnabled: Boolean(hasSelectedHojaRuta)
    },
    {
      id: 'entregas',
      label: 'Entregas',
      colorClass: 'mod-entregas',
      icon: <PackageCheck size={19} />,
      isActive: currentScreen === 'entregas',
      isEnabled: Boolean(hasSelectedHojaRuta && hasSelectedLugar)
    },
    {
      id: 'devoluciones',
      label: 'Devol.',
      colorClass: 'mod-devoluciones',
      icon: <PackageMinus size={19} />,
      isActive: currentScreen === 'devoluciones',
      isEnabled: Boolean(hasSelectedHojaRuta && hasSelectedLugar)
    },
    {
      id: 'cajones',
      label: 'Cajones',
      colorClass: 'mod-cajones',
      icon: <Boxes size={19} />,
      isActive: currentScreen === 'cajones',
      isEnabled: Boolean(hasSelectedHojaRuta && hasSelectedLugar)
    },
    {
      id: 'remitos',
      label: 'Remitos',
      colorClass: 'mod-remitos',
      icon: <FileSignature size={19} />,
      isActive: currentScreen === 'remitos' || currentScreen === 'scan',
      isEnabled: Boolean(hasSelectedHojaRuta && hasSelectedLugar)
    }
  ];

  return (
    <nav className="bottom-nav glass">
      <div className="bottom-nav-inner bottom-nav-6">
        {navItems.map((item) => {
          const hasDirty = Boolean(dirtyModules[item.id]);
          return (
            <button
              key={item.id}
              type="button"
              className={`bottom-nav-btn ${item.colorClass} ${item.isActive ? 'active' : ''} ${item.isEnabled ? 'ready' : 'needs-hr'}`}
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
