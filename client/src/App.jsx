import React, { useState, useEffect, useCallback } from 'react';
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
import { getDirtySummary } from './services/draftStorage';
import { saveDraftSection } from './services/draftSaver';
import SaveFab from './components/SaveFab';
import { RefreshCw, ArrowLeft, AlertTriangle } from 'lucide-react';

const UNSAVED_REMINDER_SECONDS = Math.max(
  parseInt(import.meta.env.VITE_UNSAVED_REMINDER_SECONDS || '60', 10) || 60,
  5
);

const SECTION_LABELS = {
  entregas: 'Entregas',
  devoluciones: 'Devoluciones',
  cajones: 'Cajones'
};

export default function App() {
  const { user, loading, refreshPendingCount } = useAuth();
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

  // Estado de borradores pendientes y recordatorio automático
  const [dirtySummary, setDirtySummary] = useState({
    entregas: false,
    devoluciones: false,
    cajones: false,
    anyDirty: false,
    dirtySections: [],
    lastDirtyAt: null
  });
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderResetTick, setReminderResetTick] = useState(0);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [reminderErrorMsg, setReminderErrorMsg] = useState(null);
  const [reminderSuccessMsg, setReminderSuccessMsg] = useState(null);

  // Estado del Gestor de Escritorio (sysadmin y logistica)
  const [adminTab, setAdminTab] = useState('dashboard');
  const [adminDetailTxId, setAdminDetailTxId] = useState(null);

  const syncDirtySummary = useCallback(() => {
    if (user?.rol === 'chofer' && user?.email && selectedHojaRuta?.Transaccionid) {
      setDirtySummary(getDirtySummary(user.email, selectedHojaRuta.Transaccionid));
    } else {
      setDirtySummary({
        entregas: false,
        devoluciones: false,
        cajones: false,
        anyDirty: false,
        dirtySections: [],
        lastDirtyAt: null
      });
    }
  }, [user?.rol, user?.email, selectedHojaRuta?.Transaccionid]);

  useEffect(() => {
    if (!user) {
      setSelectedHojaRuta(null);
      setSelectedRemito(null);
      setCurrentScreen('hojas_ruta');
      setAdminTab('dashboard');
      setAdminDetailTxId(null);
      setReminderOpen(false);
      return;
    }

    if (user.rol !== 'chofer') {
      setAdminTab('dashboard');
      setReminderOpen(false);
    }
  }, [user]);

  useEffect(() => {
    syncDirtySummary();
    const handleDraftChanged = () => syncDirtySummary();
    window.addEventListener('dy-draft-changed', handleDraftChanged);
    return () => window.removeEventListener('dy-draft-changed', handleDraftChanged);
  }, [syncDirtySummary]);

  // Temporizador para recordar cambios locales sin confirmar tras N segundos
  useEffect(() => {
    if (
      user?.rol !== 'chofer' ||
      !selectedHojaRuta?.Transaccionid ||
      !dirtySummary.anyDirty ||
      reminderOpen ||
      confirmingAll
    ) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setReminderOpen(true);
    }, UNSAVED_REMINDER_SECONDS * 1000);

    return () => clearTimeout(timer);
  }, [
    user?.rol,
    selectedHojaRuta?.Transaccionid,
    dirtySummary.anyDirty,
    dirtySummary.lastDirtyAt,
    reminderOpen,
    confirmingAll,
    reminderResetTick
  ]);

  const handleSelectHojaRuta = (hr) => {
    setSelectedHojaRuta(hr);
    setReminderOpen(false);
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

  const handleConfirmAllPending = async () => {
    if (!user?.email || !selectedHojaRuta?.Transaccionid) return;
    const sectionsToSave = [...dirtySummary.dirtySections];
    if (sectionsToSave.length === 0) {
      setReminderOpen(false);
      return;
    }

    try {
      setConfirmingAll(true);
      setReminderErrorMsg(null);
      for (const sec of sectionsToSave) {
        try {
          await saveDraftSection(sec, {
            email: user.email,
            hojaRuta: selectedHojaRuta,
            refreshPendingCount
          });
        } catch (secErr) {
          setReminderOpen(false);
          setSelectedRemito(null);
          setCurrentScreen(sec);
          setReminderErrorMsg(secErr?.response?.data?.error || secErr?.message || `Revisá los datos de ${SECTION_LABELS[sec] || sec}.`);
          return;
        }
      }
      setReminderOpen(false);
      setReminderSuccessMsg(
        navigator.onLine
          ? `Se confirmaron correctamente los cambios pendientes (${sectionsToSave.map((s) => SECTION_LABELS[s] || s).join(', ')}).`
          : 'Sin conexión: los cambios pendientes quedaron encolados para sincronizar.'
      );
    } finally {
      setConfirmingAll(false);
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

  // Gestor de Escritorio exclusivo para sysadmin y logistica
  if (user.rol !== 'chofer') {
    return (
      <AdminLayout
        user={user}
        activeTab={adminTab}
        onSelectTab={setAdminTab}
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

  // App Mobile PWA exclusiva para Choferes
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

  const showGlobalSaveFab =
    !selectedRemito &&
    dirtySummary.anyDirty &&
    ['hojas_ruta', 'remitos', 'scan'].includes(currentScreen);

  return (
    <div className="app-container">
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
          />
        )}
      </main>

      {showGlobalSaveFab && (
        <SaveFab
          variant="global"
          onClick={handleConfirmAllPending}
          saving={confirmingAll}
          title="Confirmar todos los cambios pendientes"
        />
      )}

      {!selectedRemito && (
        <BottomNav
          currentScreen={currentScreen}
          onNavigate={handleNavigate}
          hasSelectedHojaRuta={Boolean(selectedHojaRuta)}
          dirtyModules={dirtySummary}
        />
      )}

      {/* Modal Recordatorio de Informes sin Confirmar */}
      {reminderOpen && (
        <div className="modal-overlay" onClick={() => {
          setReminderOpen(false);
          setReminderResetTick((t) => t + 1);
        }}>
          <div
            className="modal-card glass"
            style={{ maxWidth: '400px', width: '92%', padding: '20px', textAlign: 'left', alignItems: 'stretch' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(245, 158, 11, 0.16)', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={22} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text)' }}>
                Informes sin confirmar
              </h3>
            </div>

            <p style={{ margin: '4px 0 12px', fontSize: '0.88rem', color: 'var(--text-main)', lineHeight: 1.45 }}>
              Tenés cambios cargados en{' '}
              <strong>
                {dirtySummary.dirtySections.map((s) => SECTION_LABELS[s] || s).join(', ')}
              </strong>{' '}
              que todavía no fueron confirmados en el sistema.
            </p>

            <div className="unsaved-modal-actions">
              <button
                type="button"
                className="unsaved-btn-secondary"
                disabled={confirmingAll}
                onClick={() => {
                  setReminderOpen(false);
                  setReminderResetTick((t) => t + 1);
                }}
              >
                Seguir editando
              </button>
              <button
                type="button"
                className="unsaved-btn-primary"
                disabled={confirmingAll}
                onClick={handleConfirmAllPending}
              >
                {confirmingAll ? 'Confirmando...' : 'Confirmar ahora'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertModal
        isOpen={Boolean(navWarning)}
        onClose={() => setNavWarning(null)}
        type="warning"
        title="Seleccione una Hoja de Ruta"
        message={navWarning}
        confirmText="Entendido"
      />

      <AlertModal
        isOpen={Boolean(reminderErrorMsg)}
        onClose={() => setReminderErrorMsg(null)}
        type="error"
        title="No se pudo confirmar"
        message={reminderErrorMsg}
        confirmText="Corregir"
      />

      <AlertModal
        isOpen={Boolean(reminderSuccessMsg)}
        onClose={() => setReminderSuccessMsg(null)}
        type="success"
        title="Cambios Confirmados"
        message={reminderSuccessMsg}
        confirmText="Aceptar"
      />

      <HelpChatModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  );
}
