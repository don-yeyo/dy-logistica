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
    { id: 'scan', label: 'Registrar Remito', icon: <ScanLine size={20} />, badge: 'Cámara 1D' },
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
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
          {menuItems.map((item) => {
            const isActive = currentScreen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: isActive ? 'rgba(13, 44, 92, 0.12)' : 'transparent',
                  color: isActive ? 'var(--dy-blue)' : 'var(--text)',
                  border: isActive ? '1.5px solid var(--dy-blue)' : '1px solid transparent',
                  fontWeight: isActive ? 800 : 600,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ color: isActive ? 'var(--dy-blue)' : 'var(--text-muted)' }}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '50px',
                    background: item.badge === 'Próx.' ? 'rgba(100, 116, 139, 0.15)' : 'rgba(13, 44, 92, 0.15)',
                    color: item.badge === 'Próx.' ? 'var(--text-muted)' : 'var(--dy-blue)'
                  }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Toggle de Modo Claro / Oscuro */}
            <button
              onClick={toggleTheme}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              <span>{theme === 'light' ? 'Activar Modo Oscuro' : 'Activar Modo Claro'}</span>
            </button>

            {/* Cerrar Sesión */}
            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: 'var(--error)',
                fontSize: '0.9rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
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
