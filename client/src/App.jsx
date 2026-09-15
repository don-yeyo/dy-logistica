import React, { useState } from 'react';
import { useAuth } from './config/AuthContext';
import Header from './components/Header';
import Drawer from './components/Drawer';
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
          <RemitoDetail
            remito={selectedRemito}
            onBack={() => setSelectedRemito(null)}
            onSaved={(updatedRemito) => {
              setSelectedRemito(null);
              // Volver al dashboard tras guardar
              setCurrentScreen('dashboard');
            }}
          />
        ) : currentScreen === 'scan' ? (
          <div>
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
          <div>
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
          <Dashboard
            onStartScan={() => setCurrentScreen('scan')}
            onOpenHojasRuta={() => setCurrentScreen('hojas_ruta')}
          />
        )}
      </main>
    </div>
  );
}
