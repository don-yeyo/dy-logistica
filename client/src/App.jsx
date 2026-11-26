import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from './config/AuthContext';
import Header from './components/Header';
import Drawer from './components/Drawer';
import BottomNav from './components/BottomNav';
import HelpChatModal from './components/HelpChatModal';
import AlertModal from './components/AlertModal';
import OfflineBanner from './components/OfflineBanner';
import HojasRutaPage from './pages/HojasRutaPage';
import LugaresPage from './pages/LugaresPage';
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
  cajones: 'Cajones y Pallets',
  remitos: 'Remitos'
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
  const [selectedLugar, setSelectedLugar] = useState(() => {
    try {
      return localStorage.getItem('dy_selected_lugar') || '';
    } catch {
      return '';
    }
  });
  const [selectedRemito, setSelectedRemito] = useState(null);
  const [navWarning, setNavWarning] = useState(null);

  // Estado de borradores pendientes y recordatorio automático
  const [dirtySummary, setDirtySummary] = useState({
    entregas: false,
    devoluciones: false,
    cajones: false,
    remitos: false,
    entregasUnconfirmed: false,
    anyDirty: false,
    dirtySections: [],
    lastDirtyAt: null
  });
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderResetTick, setReminderResetTick] = useState(0);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [confirmingSections, setConfirmingSections] = useState([]);
  const [reminderErrorMsg, setReminderErrorMsg] = useState(null);
  const [reminderSuccessMsg, setReminderSuccessMsg] = useState(null);
  const reminderOverlayRef = useRef(null);
  const savingOverlayRef = useRef(null);

  // Estado del Gestor de Escritorio (sysadmin y logistica)
  const [adminTab, setAdminTab] = useState('dashboard');
  const [adminDetailTxId, setAdminDetailTxId] = useState(null);

  const syncDirtySummary = useCallback(() => {
    if (user?.rol === 'chofer' && user?.email && selectedHojaRuta?.Transaccionid && selectedLugar) {
      setDirtySummary(getDirtySummary(user.email, selectedHojaRuta.Transaccionid, selectedLugar));
    } else {
      setDirtySummary({
        entregas: false,
        devoluciones: false,
        cajones: false,
        remitos: false,
        entregasUnconfirmed: false,
        anyDirty: false,
        dirtySections: [],
        lastDirtyAt: null
      });
    }
  }, [user?.rol, user?.email, selectedHojaRuta?.Transaccionid, selectedLugar]);

  useEffect(() => {
    if (!user) {
      setSelectedHojaRuta(null);
      setSelectedLugar('');
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

  // Temporizador para recordar cambios locales sin confirmar tras N segundos continuos sin actividad del usuario
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

    let timerId = null;
    let lastHighFreqResetAt = 0;

    const resetInactivityTimer = () => {
      if (timerId) clearTimeout(timerId);
      timerId = setTimeout(() => {
        setReminderOpen(true);
      }, UNSAVED_REMINDER_SECONDS * 1000);
    };

    const handleDiscreteActivity = () => {
      resetInactivityTimer();
    };

    const handleHighFreqActivity = () => {
      const now = Date.now();
      if (now - lastHighFreqResetAt < 300) return;
      lastHighFreqResetAt = now;
      resetInactivityTimer();
    };

    const discreteEvents = ['mousedown', 'pointerdown', 'click', 'touchstart', 'keydown', 'input'];
    const highFreqEvents = ['mousemove', 'pointermove', 'touchmove', 'wheel', 'scroll'];
    const listenerOpts = { capture: true, passive: true };

    discreteEvents.forEach((evt) => window.addEventListener(evt, handleDiscreteActivity, listenerOpts));
    highFreqEvents.forEach((evt) => window.addEventListener(evt, handleHighFreqActivity, listenerOpts));

    resetInactivityTimer();

    return () => {
      if (timerId) clearTimeout(timerId);
      discreteEvents.forEach((evt) => window.removeEventListener(evt, handleDiscreteActivity, listenerOpts));
      highFreqEvents.forEach((evt) => window.removeEventListener(evt, handleHighFreqActivity, listenerOpts));
    };
  }, [
    user?.rol,
    selectedHojaRuta?.Transaccionid,
    dirtySummary.anyDirty,
    dirtySummary.lastDirtyAt,
    reminderOpen,
    confirmingAll,
    reminderResetTick
  ]);

  // Bloquear scroll del documento y evitar propagación en el fondo difuminado mientras el modal recordatorio o de guardado esté abierto
  useEffect(() => {
    if (!reminderOpen && !confirmingAll) return undefined;

    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevOverscroll = document.body.style.overscrollBehavior;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    const overlays = [reminderOverlayRef.current, savingOverlayRef.current].filter(Boolean);
    const preventScroll = (e) => {
      e.preventDefault();
    };
    overlays.forEach((el) => {
      el.addEventListener('wheel', preventScroll, { passive: false });
      el.addEventListener('touchmove', preventScroll, { passive: false });
    });

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.overscrollBehavior = prevOverscroll;
      overlays.forEach((el) => {
        el.removeEventListener('wheel', preventScroll);
        el.removeEventListener('touchmove', preventScroll);
      });
    };
  }, [reminderOpen, confirmingAll]);

  const handleSelectHojaRuta = (hr) => {
    const isNewHr = Number(hr?.Transaccionid) !== Number(selectedHojaRuta?.Transaccionid);
    setSelectedHojaRuta(hr);
    setSelectedRemito(null);
    setReminderOpen(false);

    try {
      if (hr) {
        localStorage.setItem('dy_selected_hoja_ruta', JSON.stringify(hr));
      } else {
        localStorage.removeItem('dy_selected_hoja_ruta');
      }
      if (!hr || isNewHr) {
        setSelectedLugar('');
        localStorage.removeItem('dy_selected_lugar');
      }
    } catch {
      // Ignorar errores de cuota de almacenamiento
    }

    if (hr) {
      setCurrentScreen('lugares');
    }
  };

  const handleSelectLugar = (lugarStr) => {
    const cleanLugar = String(lugarStr || '').trim();
    setSelectedLugar(cleanLugar);
    setSelectedRemito(null);
    setReminderOpen(false);
    try {
      if (cleanLugar) {
        localStorage.setItem('dy_selected_lugar', cleanLugar);
      } else {
        localStorage.removeItem('dy_selected_lugar');
      }
    } catch {
      // Ignorar errores de cuota
    }
    if (cleanLugar) {
      setCurrentScreen('entregas');
    }
  };

  const handleConfirmAllPending = async () => {
    if (!user?.email || !selectedHojaRuta?.Transaccionid || !selectedLugar) return;
    const sectionsToSave = [...dirtySummary.dirtySections];
    if (
      sectionsToSave.length === 0 &&
      currentScreen === 'entregas' &&
      !selectedRemito &&
      dirtySummary.entregasUnconfirmed
    ) {
      sectionsToSave.push('entregas');
    }
    if (sectionsToSave.length === 0) {
      setReminderOpen(false);
      return;
    }

    try {
      setReminderOpen(false);
      setConfirmingSections(sectionsToSave);
      setConfirmingAll(true);
      setReminderErrorMsg(null);
      let anyOfflineQueued = false;

      for (const sec of sectionsToSave) {
        try {
          const res = await saveDraftSection(sec, {
            email: user.email,
            hojaRuta: selectedHojaRuta,
            lugar: selectedLugar,
            refreshPendingCount
          });
          if (res?.offlineQueued) {
            anyOfflineQueued = true;
          }
        } catch (secErr) {
          if (sec !== 'remitos') {
            setSelectedRemito(null);
          }
          setCurrentScreen(sec);
          setReminderErrorMsg(secErr?.response?.data?.error || secErr?.message || `Revisá los datos de ${SECTION_LABELS[sec] || sec}.`);
          return;
        }
      }

      if (sectionsToSave.includes('remitos')) {
        setSelectedRemito(null);
      }
      const sectionListText = sectionsToSave.map((s) => SECTION_LABELS[s] || s).join(', ');
      setReminderSuccessMsg(
        anyOfflineQueued
          ? `Sin conexión al servidor: los cambios (${sectionListText}) se guardaron localmente en la base temporal y se sincronizarán automáticamente.`
          : `Se confirmaron correctamente los cambios pendientes (${sectionListText}).`
      );
    } finally {
      setConfirmingAll(false);
      setConfirmingSections([]);
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

  // App Mobile PWA exclusiva para Choferes (flujo encadenado: Inicio -> Lugares -> Entregas/Devol/Cajones/Remitos)
  const handleNavigate = (screenId) => {
    const requiresHojaRuta = ['lugares', 'entregas', 'devoluciones', 'cajones', 'remitos', 'scan'].includes(screenId);
    const requiresLugar = ['entregas', 'devoluciones', 'cajones', 'remitos', 'scan'].includes(screenId);

    if (requiresHojaRuta && !selectedHojaRuta) {
      setNavWarning({
        title: 'Seleccione una Hoja de Ruta',
        message: 'Debe seleccionar previamente una Hoja de Ruta del listado antes de continuar.'
      });
      setCurrentScreen('hojas_ruta');
      return;
    }

    if (requiresLugar && !selectedLugar) {
      setNavWarning({
        title: 'Seleccione un Lugar de Entrega',
        message: 'Debe seleccionar primero un Lugar de Entrega de la Hoja de Ruta para habilitar las operaciones.'
      });
      setCurrentScreen('lugares');
      return;
    }

    setSelectedRemito(null);
    setCurrentScreen(screenId);
  };

  const showGlobalSaveFab =
    Boolean(selectedHojaRuta?.Transaccionid) &&
    Boolean(selectedLugar) &&
    (dirtySummary.anyDirty || (currentScreen === 'entregas' && !selectedRemito && dirtySummary.entregasUnconfirmed));

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
        selectedLugar={selectedLugar}
      />

      <OfflineBanner />

      <main
        className={`main-content${showGlobalSaveFab ? ' has-fab-clearance' : ''}`}
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
      >
        {selectedRemito ? (
          <div key="detail" className="page-transition" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <RemitoDetail
              remito={selectedRemito}
              hojaRuta={selectedHojaRuta}
              selectedLugar={selectedLugar}
              onBack={() => setSelectedRemito(null)}
              onSaved={() => {
                setSelectedRemito(null);
                setCurrentScreen('remitos');
              }}
            />
          </div>
        ) : currentScreen === 'lugares' ? (
          <LugaresPage
            key={`lugares-${selectedHojaRuta?.Transaccionid}`}
            hojaRuta={selectedHojaRuta}
            selectedLugar={selectedLugar}
            onSelectLugar={handleSelectLugar}
          />
        ) : currentScreen === 'entregas' ? (
          <EntregasPage
            key={`entregas-${selectedHojaRuta?.Transaccionid}-${selectedLugar}`}
            hojaRuta={selectedHojaRuta}
            selectedLugar={selectedLugar}
            onChangeLugar={() => handleNavigate('lugares')}
          />
        ) : currentScreen === 'devoluciones' ? (
          <DevolucionesPage
            key={`devoluciones-${selectedHojaRuta?.Transaccionid}-${selectedLugar}`}
            hojaRuta={selectedHojaRuta}
            selectedLugar={selectedLugar}
            onChangeLugar={() => handleNavigate('lugares')}
          />
        ) : currentScreen === 'cajones' ? (
          <CajonesPage
            key={`cajones-${selectedHojaRuta?.Transaccionid}-${selectedLugar}`}
            hojaRuta={selectedHojaRuta}
            selectedLugar={selectedLugar}
            onChangeLugar={() => handleNavigate('lugares')}
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
          <div key={`remitos-${selectedHojaRuta?.Transaccionid}-${selectedLugar}`} className="page-transition">
            <RemitosList
              hojaRuta={selectedHojaRuta}
              selectedLugar={selectedLugar}
              onChangeLugar={() => handleNavigate('lugares')}
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
          hasSelectedLugar={Boolean(selectedLugar)}
          dirtyModules={dirtySummary}
        />
      )}

      {/* Modal Recordatorio de Informes sin Confirmar (montado en document.body por encima de todo) */}
      {reminderOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={reminderOverlayRef}
          className="modal-overlay unsaved-reminder-overlay"
          onClick={() => {
            setReminderOpen(false);
            setReminderResetTick((t) => t + 1);
          }}
        >
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
        </div>,
        document.body
      )}

      <AlertModal
        isOpen={Boolean(navWarning)}
        onClose={() => setNavWarning(null)}
        type="warning"
        title={navWarning?.title || 'Seleccione una Hoja de Ruta'}
        message={navWarning?.message || ''}
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

      {confirmingAll && typeof document !== 'undefined' && createPortal(
        <div
          ref={savingOverlayRef}
          className="modal-overlay saving-blocking-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Guardando cambios"
        >
          <div className="modal-card glass saving-blocking-card">
            <div className="saving-spinner-badge">
              <RefreshCw size={32} className="spin" />
            </div>
            <h3 className="saving-blocking-title">Guardando cambios...</h3>
            <p className="saving-blocking-subtitle">
              Confirmando {confirmingSections.map((s) => SECTION_LABELS[s] || s).join(', ') || 'la hoja de ruta'}.
              Por favor, aguardá un instante.
            </p>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
