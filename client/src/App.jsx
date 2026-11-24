import React, { useState, useEffect } from 'react';
import { useAuth } from './config/AuthContext';
import Header from './components/Header';
import Drawer from './components/Drawer';
import BottomNav from './components/BottomNav';
import HelpChatModal from './components/HelpChatModal';
import AlertModal from './components/AlertModal';
import OfflineBanner from './components/OfflineBanner';
import HojasRutaPage from './pages/HojasRutaPage';
import EntregasPage from './pages/EntregasPage';
import DevolucionesPage from './pages/DevolucionesPage';
import CajonesPage from './pages/CajonesPage';
import ScanHome from './pages/ScanHome';
import RemitosList from './pages/RemitosList';
import RemitoDetail from './pages/RemitoDetail';
import Login from './pages/Login';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminHojasRuta from './pages/admin/AdminHojasRuta';
import AdminDevoluciones from './pages/admin/AdminDevoluciones';
import AdminCajones from './pages/admin/AdminCajones';
import AdminUsuarios from './pages/admin/AdminUsuarios';
import AdminAuditoria from './pages/admin/AdminAuditoria';
import { RefreshCw, ArrowLeft, Monitor } from 'lucide-react';

export default function App() {
  const { user, loading } = useAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [currentScreen, setCurrentScreen] = useState('hojas_ruta');
  const [selectedHojaRuta, setSelectedHojaRuta] = useState(() => {
    try {
      const saved = localStorage.getItem('dy_selected_hoja_ruta');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [selectedRemito, setSelectedRemito] = useState(null);
  const [navWarning, setNavWarning] = useState(null);

  // Estado del Gestor de Escritorio (sysadmin y logistica)
  const [viewMode, setViewMode] = useState('admin'); // 'admin' | 'mobile' (mobile solo permitido a chofer o sysadmin probando)
  const [adminTab, setAdminTab] = useState('dashboard');
  const [adminDetailTxId, setAdminDetailTxId] = useState(null);

  useEffect(() => {
    if (!user) {
      setSelectedHojaRuta(null);
      setSelectedRemito(null);
      setCurrentScreen('hojas_ruta');
      setViewMode('admin');
      setAdminTab('dashboard');
      setAdminDetailTxId(null);
      return;
    }

    // Choferes acceden exclusivamente a la App Mobile
    if (user.rol === 'chofer') {
      setViewMode('mobile');
    } else {
      setViewMode('admin');
      setAdminTab('dashboard');
    }
  }, [user]);

  const handleSelectHojaRuta = (hr) => {
    setSelectedHojaRuta(hr);
    try {
      if (hr) {
        localStorage.setItem('dy_selected_hoja_ruta', JSON.stringify(hr));
      } else {
        localStorage.removeItem('dy_selected_hoja_ruta');
      }
    } catch {
      // Ignorar errores de cuota de almacenamiento
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0d2c5c', color: '#fff', gap: '14px' }}>
        <RefreshCw size={36} className="spin" />
        <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>Iniciando Don Yeyo Logística...</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  // Gestor de Escritorio para sysadmin y logistica
  const isAdminRole = user.rol === 'sysadmin' || user.rol === 'logistica';
  const showDesktopManager = isAdminRole && (viewMode === 'admin' || user.rol === 'logistica');

  if (showDesktopManager) {
    return (
      <AdminLayout
        user={user}
        activeTab={adminTab}
        onSelectTab={setAdminTab}
        onSwitchToMobile={user.rol === 'sysadmin' ? () => setViewMode('mobile') : null}
      >
        {adminTab === 'dashboard' && (
          <AdminDashboard
            user={user}
            onNavigateTab={setAdminTab}
            onOpenHojaRuta={(txId) => {
              setAdminDetailTxId(txId);
              setAdminTab('hojas_ruta');
            }}
          />
        )}
        {adminTab === 'hojas_ruta' && (
          <AdminHojasRuta
            initialTransaccionId={adminDetailTxId}
            onClearInitialTransaccion={() => setAdminDetailTxId(null)}
          />
        )}
        {adminTab === 'devoluciones' && <AdminDevoluciones />}
        {adminTab === 'cajones' && <AdminCajones />}
        {adminTab === 'usuarios' && <AdminUsuarios currentUser={user} />}
        {adminTab === 'auditoria' && user.rol === 'sysadmin' && <AdminAuditoria />}
      </AdminLayout>
    );
  }

  // App Mobile PWA para Choferes (y vista previa opcional para sysadmin)
  const handleNavigate = (screenId) => {
    const requiresHojaRuta = ['entregas', 'devoluciones', 'cajones', 'remitos', 'scan'].includes(screenId);

    if (requiresHojaRuta && !selectedHojaRuta) {
      setNavWarning(
        'Debe seleccionar previamente una Hoja de Ruta del listado antes de acceder a Entregas, Devoluciones, Cajones o Remitos.'
      );
      setCurrentScreen('hojas_ruta');
      return;
    }

    setSelectedRemito(null);
    setCurrentScreen(screenId);
  };

  return (
    <div className="app-container">
      {user.rol === 'sysadmin' && (
        <div
          style={{
            background: '#0d2c5c',
            color: '#fff',
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.8rem'
          }}
        >
          <span>Vista previa App Choferes (SysAdmin)</span>
          <button
            type="button"
            onClick={() => setViewMode('admin')}
            style={{
              background: '#fff',
              color: '#0d2c5c',
              border: 'none',
              borderRadius: '8px',
              padding: '4px 10px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <Monitor size={14} />
            <span>Volver al Gestor</span>
          </button>
        </div>
      )}

      <Header
        onMenuClick={() => setIsDrawerOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onNavigate={handleNavigate}
        onOpenHelp={() => setIsHelpOpen(true)}
        currentScreen={currentScreen}
        selectedHojaRuta={selectedHojaRuta}
      />

      <OfflineBanner />

      <main className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedRemito ? (
          <div key="detail" className="page-transition" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <RemitoDetail
              remito={selectedRemito}
              onBack={() => setSelectedRemito(null)}
              onSaved={() => {
                setSelectedRemito(null);
                setCurrentScreen('remitos');
              }}
            />
          </div>
        ) : currentScreen === 'entregas' ? (
          <EntregasPage
            key={`entregas-${selectedHojaRuta?.Transaccionid}`}
            hojaRuta={selectedHojaRuta}
            onChangeHojaRuta={() => handleNavigate('hojas_ruta')}
          />
        ) : currentScreen === 'devoluciones' ? (
          <DevolucionesPage
            key={`devoluciones-${selectedHojaRuta?.Transaccionid}`}
            hojaRuta={selectedHojaRuta}
            onChangeHojaRuta={() => handleNavigate('hojas_ruta')}
          />
        ) : currentScreen === 'cajones' ? (
          <CajonesPage
            key={`cajones-${selectedHojaRuta?.Transaccionid}`}
            hojaRuta={selectedHojaRuta}
            onChangeHojaRuta={() => handleNavigate('hojas_ruta')}
          />
        ) : currentScreen === 'scan' ? (
          <div key="scan" className="page-transition">
            <div style={{ padding: '4px 4px 8px 4px' }}>
              <button
                type="button"
                className="top-back-btn"
                onClick={() => setCurrentScreen('remitos')}
              >
                <ArrowLeft size={18} />
                <span>Volver a Remitos ({selectedHojaRuta?.Hoja_de_ruta})</span>
              </button>
            </div>
            <ScanHome
              hojaRuta={selectedHojaRuta}
              onSelectRemito={(remito) => setSelectedRemito(remito)}
            />
          </div>
        ) : currentScreen === 'remitos' ? (
          <div key={`remitos-${selectedHojaRuta?.Transaccionid}`} className="page-transition">
            <RemitosList
              hojaRuta={selectedHojaRuta}
              onChangeHojaRuta={() => handleNavigate('hojas_ruta')}
              onOpenScan={() => handleNavigate('scan')}
              onSelectRemito={(remito) => setSelectedRemito(remito)}
            />
          </div>
        ) : (
          <HojasRutaPage
            key="hojas_ruta"
            selectedHojaRuta={selectedHojaRuta}
            onSelectHojaRuta={handleSelectHojaRuta}
            onNavigateModule={handleNavigate}
          />
        )}
      </main>

      {!selectedRemito && (
        <BottomNav
          currentScreen={currentScreen}
          onNavigate={handleNavigate}
          hasSelectedHojaRuta={Boolean(selectedHojaRuta)}
        />
      )}

      <AlertModal
        isOpen={Boolean(navWarning)}
        onClose={() => setNavWarning(null)}
        type="warning"
        title="Seleccione una Hoja de Ruta"
        message={navWarning}
        confirmText="Ir a Hojas de Ruta"
      />

      <HelpChatModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  );
}
