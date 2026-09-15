import React from 'react';
import {
  X,
  Home,
  ScanLine,
  Truck,
  PackageMinus,
  Boxes,
  FileText,
  LogOut,
  Shield,
  Sun,
  Moon
} from 'lucide-react';
import { useAuth } from '../config/AuthContext';
import { useTheme } from '../config/ThemeContext';
import logo from '../assets/logo-don-yeyo-png-sin-fondo.png';

export default function Drawer({ isOpen, onClose, onNavigate, currentScreen }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard Principal', icon: <Home size={20} />, badge: null },
    { id: 'scan', label: 'Registrar Remito', icon: <ScanLine size={20} />, badge: null },
    { id: 'entregas', label: 'Entregas de Mercadería', icon: <Truck size={20} />, badge: 'Próx.' },
    { id: 'devoluciones', label: 'Devoluciones', icon: <PackageMinus size={20} />, badge: 'Próx.' },
    { id: 'cajones', label: 'Movimiento de Cajones', icon: <Boxes size={20} />, badge: 'Próx.' },
    { id: 'hojas_ruta', label: 'Mis Hojas de Ruta', icon: <FileText size={20} />, badge: null },
  ];

  const handleItemClick = (id) => {
    onNavigate(id);
    onClose();
  };

  const handleLogout = () => {
    onClose();
    logout();
  };

  return (
    <>
      <div
        className={`drawer-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
      />
      <aside className={`drawer ${isOpen ? 'open' : ''} glass`}>
        {/* Cabecera del Drawer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src={logo} alt="Don Yeyo" style={{ height: '36px', objectFit: 'contain' }} />
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                Menú Logística
              </h3>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {user?.nombre || 'Chofer'}
              </span>
            </div>
          </div>
          <button className="mode-toggle" onClick={onClose} title="Cerrar menú">
            <X size={20} />
          </button>
        </div>

        {/* Lista de Navegación */}
        <nav className="drawer-nav-list">
          {menuItems.map((item) => {
            const isActive = currentScreen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`drawer-nav-item ${isActive ? 'active' : ''}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className="drawer-nav-icon">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`drawer-badge ${item.badge === 'Próx.' ? '' : 'primary'}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="drawer-footer-actions">
            {/* Toggle de Modo Claro / Oscuro */}
            <button
              onClick={toggleTheme}
              className="drawer-action-btn"
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              <span>{theme === 'light' ? 'Activar Modo Oscuro' : 'Activar Modo Claro'}</span>
            </button>

            {/* Cerrar Sesión */}
            <button
              onClick={handleLogout}
              className="drawer-action-btn logout"
            >
              <LogOut size={18} />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </nav>

        {/* Footer */}
        <div style={{ marginTop: '16px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <span style={{ fontWeight: 800 }}>DON YEYO S.A.</span>
          <span>v1.0.0</span>
        </div>
      </aside>
    </>
  );
}
