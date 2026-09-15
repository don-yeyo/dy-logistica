import React, { useState } from 'react';
import { useAuth } from './config/AuthContext';
import Header from './components/Header';
import OfflineBanner from './components/OfflineBanner';
import ScanHome from './pages/ScanHome';
import RemitosList from './pages/RemitosList';
import RemitoDetail from './pages/RemitoDetail';
import Login from './pages/Login';
import { RefreshCw } from 'lucide-react';

export default function App() {
  const { user, loading } = useAuth();
  const [selectedRemito, setSelectedRemito] = useState(null);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0d2c5c', color: '#fff', gap: '14px' }}>
        <RefreshCw size={36} className="spin" />
        <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>Iniciando Don Yeyo Remitos...</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="app-container">
      <Header />
      <OfflineBanner />

      <main className="main-content">
        {selectedRemito ? (
          <RemitoDetail
            remito={selectedRemito}
            onBack={() => setSelectedRemito(null)}
            onSaved={(updatedRemito) => {
              setSelectedRemito(null);
            }}
          />
        ) : (
          <ScanHome
            onSelectRemito={(remito) => setSelectedRemito(remito)}
          />
        )}
      </main>
    </div>
  );
}
