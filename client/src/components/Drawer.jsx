import React from 'react';
import {
  X,
  ClipboardList,
  MapPin,
  PackageCheck,
  PackageMinus,
  Boxes,
  FileSignature,
  ScanLine,
  HelpCircle,
  Lightbulb,
  LogOut,
  Sun,
  Moon
} from 'lucide-react';
import { useAuth } from '../config/AuthContext';
import { useTheme } from '../config/ThemeContext';
import logo from '../assets/logo-don-yeyo-png-sin-fondo.png';
import pkg from '../../package.json';

export default function Drawer({
  isOpen,
  onClose,
  onNavigate,
  onOpenHelp,
  onOpenSugerencia,
  currentScreen,
  selectedHojaRuta,
  selectedLugar
}) {
  const { user, logout, impersonationEnabled, availableUsers, impersonateUser } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const menuItems = [
    { id: 'hojas_ruta', label: 'Hojas de Ruta', icon: <ClipboardList size={20} />, badge: selectedHojaRuta ? selectedHojaRuta.Hoja_de_ruta : null },
    { id: 'lugares', label: 'Lugares de Entrega', icon: <MapPin size={20} />, badge: selectedLugar ? 'Activo' : null },
    { id: 'entregas', label: 'Entregas de Mercadería', icon: <PackageCheck size={20} />, badge: null },
    { id: 'devoluciones', label: 'Devoluciones', icon: <PackageMinus size={20} />, badge: null },
    { id: 'cajones', label: 'Cajones y Pallets', icon: <Boxes size={20} />, badge: null },
    { id: 'remitos', label: 'Remitos de la Hoja', icon: <FileSignature size={20} />, badge: null },
    { id: 'scan', label: 'Escanear Código 1D', icon: <ScanLine size={20} />, badge: null }
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
                  <span className="drawer-badge primary">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {onOpenHelp && (
            <button
              onClick={() => {
                onClose();
                onOpenHelp();
              }}
              className="drawer-nav-item"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="drawer-nav-icon">
                  <HelpCircle size={20} />
                </span>
                <span>Ayuda / Manual</span>
              </div>
            </button>
          )}

          {onOpenSugerencia && (
            <button
              onClick={() => {
                onClose();
                onOpenSugerencia();
              }}
              className="drawer-nav-item"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="drawer-nav-icon" style={{ color: '#d97706' }}>
                  <Lightbulb size={20} />
                </span>
                <span>Sugerir una mejora</span>
              </div>
            </button>
          )}

          <div className="drawer-footer-actions">
            {impersonationEnabled && availableUsers.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Simular Usuario (Gestación)
                </span>
                <select
                  value={user?.email || ''}
                  onChange={(e) => {
                    const targetEmail = e.target.value;
                    if (targetEmail && targetEmail !== user?.email) {
                      onClose();
                      impersonateUser(targetEmail);
                    }
                  }}
                  style={{
                    height: '38px',
                    padding: '0 10px',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: '0.8rem',
                    fontWeight: 600
                  }}
                >
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.email}>
                      {u.nombre} ({u.rol})
                    </option>
                  ))}
                </select>
              </div>
            )}

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
          <span>v{pkg.version}</span>
        </div>
      </aside>
    </>
  );
}
