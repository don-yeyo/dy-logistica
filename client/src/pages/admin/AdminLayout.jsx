import React, { useState, useEffect, useRef } from 'react';
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
  X,
  UserCheck
} from 'lucide-react';
import logo from '../../assets/logo-don-yeyo-png-sin-fondo.png';
import pkg from '../../../package.json';

function getInitials(nombre, email) {
  const source = (nombre || '').trim();
  if (source) {
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return source.slice(0, 2).toUpperCase();
  }
  return String(email || 'DY').slice(0, 2).toUpperCase();
}

export default function AdminLayout({ user, activeTab, onSelectTab, onSwitchToMobile, children }) {
  const { logout, impersonationEnabled, availableUsers, impersonateUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('dy_admin_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

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

  const headerMetaMap = {
    dashboard: {
      title: 'Resumen Operativo',
      subtitle: 'Monitoreo consolidado de hojas de ruta activas, entregas, devoluciones y cajones.'
    },
    hojas_ruta: {
      title: 'Seguimiento de Hojas de Ruta',
      subtitle: 'Estado de avance en descargas, devoluciones y cajones por hoja de ruta (excluye firma de remitos).'
    },
    devoluciones: {
      title: 'Devoluciones y Faltantes',
      subtitle: 'Consolidado de mercadería devuelta y diferencias reportadas durante el reparto.'
    },
    cajones: {
      title: 'Control de Cajones',
      subtitle: 'Balance entre cajones entregados y devueltos por hoja de ruta, etapa y cliente.'
    },
    usuarios: isSysadmin
      ? {
          title: 'Gestión de Usuarios, Roles y Mapeo ERP',
          subtitle: 'Alta y asignación de roles (sysadmin, logistica, chofer) vinculando su email Microsoft 365 con su Organización en el ERP.'
        }
      : {
          title: 'Gestión de Choferes',
          subtitle: 'Administrá las cuentas corporativas de los choferes y su mapeo al identificador de Organización en el ERP.'
        },
    auditoria: {
      title: 'Auditoría de Base de Datos (Triggers)',
      subtitle: 'Bitácora inmutable generada automáticamente mediante triggers AFTER INSERT / UPDATE / DELETE en MySQL.'
    }
  };

  const currentMeta = headerMetaMap[activeTab] || {
    title: 'Gestor Logístico',
    subtitle: 'Base operativa: Gestion_Logistica'
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleToggleSidebar = () => {
    if (window.innerWidth <= 960) {
      setMobileMenuOpen((prev) => !prev);
      return;
    }
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('dy_admin_sidebar_collapsed', String(next));
      } catch {
        // Ignorar errores de almacenamiento
      }
      return next;
    });
  };

  const handleSelect = (id) => {
    onSelectTab(id);
    setMobileMenuOpen(false);
  };

  const initials = getInitials(user?.nombre, user?.email);

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
      <aside className={`admin-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="admin-brand">
          <img src={logo} alt="Don Yeyo" className="admin-brand-logo" />
          <div className="admin-brand-text" style={{ minWidth: 0 }}>
            <div className="admin-brand-title">Logística</div>
            <div className="admin-brand-sub">v{pkg.version}</div>
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
                title={item.label}
              >
                <Icon size={19} style={{ flexShrink: 0 }} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Área Principal */}
      <div className="admin-content-wrap">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              type="button"
              className="admin-sidebar-toggle-btn"
              onClick={handleToggleSidebar}
              aria-label="Alternar menú lateral"
              title="Contraer o expandir menú"
            >
              <Menu size={20} />
            </button>
            <div style={{ minWidth: 0 }}>
              <h1 className="admin-page-title">{currentMeta.title}</h1>
              <p className="admin-page-subtitle">{currentMeta.subtitle}</p>
            </div>
          </div>

          <div className="admin-topbar-right" ref={userMenuRef}>
            <div className="admin-user-menu-wrap">
              <button
                type="button"
                className={`admin-avatar-btn ${userMenuOpen ? 'active' : ''}`}
                onClick={() => setUserMenuOpen((prev) => !prev)}
                title={`${user?.nombre || 'Usuario'} (${user?.rol || ''})`}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                {initials}
              </button>

              {userMenuOpen && (
                <div className="admin-user-dropdown" role="menu">
                  <div className="admin-dropdown-header">
                    <div className="admin-user-row">
                      <strong className="admin-dropdown-name">{user?.nombre}</strong>
                      <span className={`admin-role-badge role-${user?.rol || 'logistica'}`}>
                        {user?.rol}
                      </span>
                    </div>
                    <div className="admin-dropdown-email">{user?.email}</div>
                  </div>

                  {impersonationEnabled && availableUsers.length > 0 && (
                    <div className="admin-dropdown-section">
                      <label className="admin-dropdown-label" htmlFor="admin-impersonate-select">
                        <UserCheck size={14} />
                        <span>Simular Usuario (Gestación)</span>
                      </label>
                      <select
                        id="admin-impersonate-select"
                        className="admin-input"
                        style={{ width: '100%', height: '36px', fontSize: '0.82rem' }}
                        value={user?.email || ''}
                        onChange={(e) => {
                          const targetEmail = e.target.value;
                          if (targetEmail && targetEmail !== user?.email) {
                            setUserMenuOpen(false);
                            impersonateUser(targetEmail);
                          }
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

                  <div className="admin-dropdown-actions">
                    {onSwitchToMobile && (
                      <button
                        type="button"
                        className="admin-dropdown-item"
                        onClick={() => {
                          setUserMenuOpen(false);
                          onSwitchToMobile();
                        }}
                      >
                        <Smartphone size={16} />
                        <span>Vista App Choferes</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="admin-dropdown-item"
                      onClick={() => {
                        toggleTheme();
                        setUserMenuOpen(false);
                      }}
                    >
                      {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                      <span>{theme === 'light' ? 'Activar Modo Oscuro' : 'Activar Modo Claro'}</span>
                    </button>

                    <button
                      type="button"
                      className="admin-dropdown-item admin-dropdown-item-danger"
                      onClick={() => {
                        setUserMenuOpen(false);
                        logout();
                      }}
                    >
                      <LogOut size={16} />
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
