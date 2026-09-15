import React, { useState, useEffect } from 'react';
import BarcodeScanner from '../components/BarcodeScanner';
import { searchRemitoByCode } from '../services/api';
import { searchCachedRemitoByCode, getCachedRemitos } from '../services/offlineStorage';
import { useAuth } from '../config/AuthContext';
import { 
  Scan, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  History, 
  RefreshCw, 
  ChevronRight,
  Truck,
  Building2,
  XCircle,
  PackageCheck
} from 'lucide-react';

export default function ScanHome({ onSelectRemito }) {
  const { user, isOnline } = useAuth();
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [recentControls, setRecentControls] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Cargar historial reciente de remitos controlados
  const loadRecentHistory = async () => {
    try {
      setLoadingHistory(true);
      const cached = await getCachedRemitos();
      // Filtrar remitos que ya fueron controlados (no pendientes) o encolados offline
      const controlled = cached
        .filter(r => r.estado_firma && r.estado_firma !== 'PENDIENTE')
        .sort((a, b) => new Date(b.fecha_control || b.finne_Fecha) - new Date(a.fecha_control || a.finne_Fecha))
        .slice(0, 5);
      setRecentControls(controlled);
    } catch (e) {
      console.debug('Error loading recent controls:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadRecentHistory();
  }, []);

  // Manejador del código escaneado o ingresado
  const handleCodeDetected = async (code) => {
    if (!code) return;
    try {
      setSearching(true);
      setSearchError(null);
      console.log(`[ScanHome] Buscando remito para código: ${code}`);

      let foundRemito = null;

      if (navigator.onLine) {
        try {
          const res = await searchRemitoByCode(code);
          if (res && res.ok && res.remito) {
            foundRemito = res.remito;
          }
        } catch (apiErr) {
          console.warn('[ScanHome] Búsqueda en API falló, probando caché local:', apiErr.message);
          foundRemito = await searchCachedRemitoByCode(code);
        }
      } else {
        foundRemito = await searchCachedRemitoByCode(code);
      }

      if (foundRemito) {
        onSelectRemito(foundRemito);
      } else {
        setSearchError({
          code: code,
          message: `No se encontró ningún remito registrado con el código o TransaccionId "${code}".`
        });
      }
    } catch (err) {
      console.error('[ScanHome] Error al procesar código:', err);
      setSearchError({
        code: code,
        message: 'Error al consultar el remito. Verifique su conexión o intente nuevamente.'
      });
    } finally {
      setSearching(false);
    }
  };

  const getStatusBadge = (estado) => {
    switch (estado) {
      case 'FIRMADO_CLIENTE':
        return <span className="status-pill signed-client"><Building2 size={12} /> Cliente</span>;
      case 'FIRMADO_INTERMEDIARIO':
        return <span className="status-pill signed-interm"><Truck size={12} /> Intermediario</span>;
      case 'NO_FIRMADO':
        return <span className="status-pill not-signed"><XCircle size={12} /> No Firmado</span>;
      default:
        return <span className="status-pill pending"><Clock size={12} /> Pendiente</span>;
    }
  };

  return (
    <div className="scan-home-container">
      {/* Banner Superior con Identificación */}
      <div className="scan-home-header">
        <div className="scan-home-title-row">
          <div className="scan-icon-bubble">
            <Scan size={24} />
          </div>
          <div>
            <h2 className="scan-main-title">Escanear Remito</h2>
            <p className="scan-subtitle">
              Lectura 1D de <strong>TransaccionId</strong> (Code 128 / Code 39)
            </p>
          </div>
        </div>
      </div>

      {/* Visor de Cámara y Escáner */}
      <div className="scan-viewport-card">
        <BarcodeScanner
          isPaused={searching}
          onScanSuccess={handleCodeDetected}
          onError={(err) => console.warn('Scanner error:', err)}
        />
      </div>

      {/* Indicador de Búsqueda Activa */}
      {searching && (
        <div className="scan-loading-card">
          <RefreshCw size={24} className="spin" style={{ color: 'var(--dy-blue)' }} />
          <span>Buscando remito en sistema...</span>
        </div>
      )}

      {/* Modal / Alerta de Remito No Encontrado */}
      {searchError && (
        <div className="modal-overlay" onClick={() => setSearchError(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <AlertCircle size={32} />
            </div>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--text)', margin: '0 0 6px', textAlign: 'center' }}>
              Remito No Encontrado
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textAlign: 'center', margin: '0 0 16px' }}>
              {searchError.message}
            </p>
            <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', fontSize: '0.85rem', color: '#475569', marginBottom: '16px', textAlign: 'center' }}>
              Código leído: <strong>{searchError.code}</strong>
            </div>
            <button
              type="button"
              className="btn-primary"
              style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'var(--dy-blue)', color: '#fff', border: 'none', fontWeight: 700 }}
              onClick={() => setSearchError(null)}
            >
              Reintentar Escaneo
            </button>
          </div>
        </div>
      )}

      {/* Historial Reciente de Remitos Controlados */}
      {recentControls.length > 0 && (
        <div className="recent-scans-section">
          <div className="section-label" style={{ marginBottom: '10px' }}>
            <History size={16} style={{ color: 'var(--dy-blue)' }} />
            <span>Remitos controlados recientemente ({recentControls.length})</span>
          </div>

          <div className="recent-scans-list">
            {recentControls.map((remito) => (
              <div
                key={remito.id}
                className="recent-scan-item"
                onClick={() => onSelectRemito(remito)}
              >
                <div className="recent-scan-left">
                  <div className="recent-scan-cbte">
                    {remito.finne_Comprobante || `ID: ${remito.id}`}
                  </div>
                  <div className="recent-scan-client">
                    {remito.finne_Cliente}
                  </div>
                  <div className="recent-scan-ejemplar">
                    Ejemplar: <strong>{remito.ejemplar || 'ORIGINAL'}</strong>
                  </div>
                </div>

                <div className="recent-scan-right">
                  {getStatusBadge(remito.estado_firma)}
                  <ChevronRight size={18} style={{ color: '#94a3b8' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
