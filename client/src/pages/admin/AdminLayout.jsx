import React, { useState } from 'react';
import { useAuth } from '../../config/AuthContext';
import { useTheme } from '../../config/ThemeContext';
import {
  LayoutDashboard,
  Truck,
  RotateCcw,
  Package,
  Users,
  ShieldAlert,
  Smartphone,
  LogOut,
  Sun,
  Moon,
  Menu,
  X
} from 'lucide-react';
import logo from '../../assets/logo-don-yeyo-png-sin-fondo.png';

export default function AdminLayout({ user, activeTab, onSelectTab, onSwitchToMobile, children }) {
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isSysadmin = user?.rol === 'sysadmin';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'hojas_ruta', label: 'Hojas de Ruta', icon: Truck },
    { id: 'devoluciones', label: 'Devoluciones & Faltantes', icon: RotateCcw },
    { id: 'cajones', label: 'Control de Cajones', icon: Package },
    {
      id: 'usuarios',
      label: isSysadmin ? 'Usuarios y Roles' : 'Choferes (Usuarios)',
      icon: Users
    },
    ...(isSysadmin ? [{ id: 'auditoria', label: 'Auditoría DB', icon: ShieldAlert }] : [])
  ];

  const handleSelect = (id) => {
    onSelectTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="admin-shell">
      {/* Overlay mobile sidebar */}
      {mobileMenuOpen && (
        <div
          className="admin-sidebar-backdrop"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Escritorio */}
      <aside className={`admin-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="admin-brand">
          <img src={logo} alt="Don Yeyo" className="admin-brand-logo" />
          <div style={{ minWidth: 0 }}>
            <div className="admin-brand-title">Don Yeyo</div>
            <div className="admin-brand-sub">Gestor Logístico</div>
          </div>
          <button
            type="button"
            className="admin-mobile-close"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="admin-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`admin-nav-item ${active ? 'active' : ''}`}
                onClick={() => handleSelect(item.id)}
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-user-card">
            <div className="admin-user-row">
              <strong className="admin-user-name">{user?.nombre}</strong>
              <span className={`admin-role-badge role-${user?.rol || 'logistica'}`}>
                {user?.rol}
              </span>
            </div>
            <div className="admin-user-email">{user?.email}</div>
          </div>

          {onSwitchToMobile && (
            <button
              type="button"
              className="admin-footer-btn admin-footer-btn-accent"
              onClick={onSwitchToMobile}
            >
              <Smartphone size={17} />
              <span>Vista App Choferes</span>
            </button>
          )}

          <div className="admin-footer-actions">
            <button
              type="button"
              className="admin-footer-btn"
              onClick={toggleTheme}
              title="Cambiar tema claro/oscuro"
            >
              {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
              <span>{theme === 'light' ? 'Oscuro' : 'Claro'}</span>
            </button>
            <button
              type="button"
              className="admin-footer-btn admin-footer-btn-danger"
              onClick={logout}
            >
              <LogOut size={17} />
              <span>Salir</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Área Principal */}
      <div className="admin-content-wrap">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              type="button"
              className="admin-mobile-menu-btn"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu size={22} />
            </button>
            <div>
              <h1 className="admin-page-title">
                {navItems.find((i) => i.id === activeTab)?.label || 'Gestor Logístico'}
              </h1>
              <p className="admin-page-subtitle">
                Base operativa en tiempo real: Gestion_Logistica
              </p>
            </div>
          </div>
          <div className="admin-topbar-right">
            <span className={`admin-role-badge role-${user?.rol || 'logistica'}`}>
              {user?.rol === 'sysadmin' ? 'SysAdmin (Acceso Total)' : 'Logística'}
            </span>
          </div>
        </header>

        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
