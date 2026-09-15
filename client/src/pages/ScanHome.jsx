import React, { useState, useEffect } from 'react';
import BarcodeScanner from '../components/BarcodeScanner';
import AlertModal from '../components/AlertModal';
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
      <AlertModal
        isOpen={Boolean(searchError)}
        onClose={() => setSearchError(null)}
        type="warning"
        title="Remito No Encontrado"
        message={searchError?.message}
        details={searchError?.code ? `Código leído: ${searchError.code}` : null}
        buttonText="Reintentar Escaneo"
      />

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
