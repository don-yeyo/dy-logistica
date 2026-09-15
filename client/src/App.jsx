import React, { useState } from 'react';
import { useAuth } from './config/AuthContext';
import Header from './components/Header';
import Drawer from './components/Drawer';
import BottomNav from './components/BottomNav';
import HelpChatModal from './components/HelpChatModal';
import OfflineBanner from './components/OfflineBanner';
import Dashboard from './pages/Dashboard';
import ScanHome from './pages/ScanHome';
import RemitosList from './pages/RemitosList';
import RemitoDetail from './pages/RemitoDetail';
import Login from './pages/Login';
import { RefreshCw, ArrowLeft } from 'lucide-react';

export default function App() {
  const { user, loading } = useAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [currentScreen, setCurrentScreen] = useState('dashboard'); // 'dashboard' | 'scan' | 'hojas_ruta'
  const [selectedRemito, setSelectedRemito] = useState(null);

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

  const handleNavigate = (screenId) => {
    setSelectedRemito(null);
    setCurrentScreen(screenId);
  };

  return (
    <div className="app-container">
      <Header onMenuClick={() => setIsDrawerOpen(true)} />
      
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onNavigate={handleNavigate}
        currentScreen={currentScreen}
      />

      <OfflineBanner />

      <main className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedRemito ? (
          <div key="detail" className="page-transition" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <RemitoDetail
              remito={selectedRemito}
              onBack={() => setSelectedRemito(null)}
              onSaved={(updatedRemito) => {
                setSelectedRemito(null);
                // Volver al dashboard tras guardar
                setCurrentScreen('dashboard');
              }}
            />
          </div>
        ) : currentScreen === 'scan' ? (
          <div key="scan" className="page-transition">
            <div style={{ padding: '8px 16px 0 16px' }}>
              <button
                onClick={() => setCurrentScreen('dashboard')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--dy-blue)',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  padding: '6px 0'
                }}
              >
                <ArrowLeft size={18} />
                <span>Volver al Dashboard</span>
              </button>
            </div>
            <ScanHome
              onSelectRemito={(remito) => setSelectedRemito(remito)}
            />
          </div>
        ) : currentScreen === 'hojas_ruta' ? (
          <div key="hojas_ruta" className="page-transition">
            <div style={{ padding: '8px 16px 0 16px' }}>
              <button
                onClick={() => setCurrentScreen('dashboard')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--dy-blue)',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  padding: '6px 0'
                }}
              >
                <ArrowLeft size={18} />
                <span>Volver al Dashboard</span>
              </button>
            </div>
            <RemitosList
              onSelectRemito={(remito) => setSelectedRemito(remito)}
            />
          </div>
        ) : (
          <div key="dashboard" className="page-transition">
            <Dashboard
              onStartScan={() => setCurrentScreen('scan')}
              onOpenHojasRuta={() => setCurrentScreen('hojas_ruta')}
            />
          </div>
        )}
      </main>

      {/* Barra Inferior Persistente (BottomNav) */}
      {!selectedRemito && (
        <BottomNav
          currentScreen={currentScreen}
          onNavigate={handleNavigate}
          onOpenHelp={() => setIsHelpOpen(true)}
        />
      )}

      {/* Modal Interactivo de Ayuda y Chatbot Chofer */}
      <HelpChatModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  );
}
