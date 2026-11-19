import React from 'react';
import { PackageCheck, PackageMinus, Boxes, FileSignature } from 'lucide-react';

  /**
   * Barra inferior operativa (Sección 4.2):
   * Entregas, Devoluciones, Cajones, Remitos.
   */
  export default function BottomNav({ currentScreen, onNavigate, hasSelectedHojaRuta }) {
    const navItems = [
      {
      id: 'entregas',
        label: 'Entregas',
        icon: <PackageCheck size={21} />,
        isActive: currentScreen === 'entregas'
      },
      {
      id: 'devoluciones',
        label: 'Devoluciones',
        icon: <PackageMinus size={21} />,
        isActive: currentScreen === 'devoluciones'
      },
      {
      id: 'cajones',
        label: 'Cajones',
        icon: <Boxes size={21} />,
        isActive: currentScreen === 'cajones'
      },
      {
      id: 'remitos',
        label: 'Remitos',
        icon: <FileSignature size={21} />,
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
              className={`bottom-nav-btn ${item.isActive ? 'active' : ''} ${!hasSelectedHojaRuta ? 'needs-hr' : ''}`}
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
