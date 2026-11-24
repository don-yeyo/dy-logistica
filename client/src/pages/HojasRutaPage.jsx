import React, { useState, useEffect, useCallback } from 'react';
import { fetchHojasDeRuta } from '../services/api';
import { cacheHojasRuta, getCachedHojasRuta } from '../services/offlineStorage';
import { useAuth } from '../config/AuthContext';
import {
  FileText,
  Calendar,
  Truck,
  CheckCircle2,
  RefreshCw,
  Inbox
} from 'lucide-react';

/**
 * Pantalla Principal post-login (Sección 4.2 Hoja de Ruta):
 * Exclusiva para el rol chofer. Lista hojas de ruta dentro de la ventana de días configurada.
 * Al seleccionar una card queda marcada en azul y habilita los íconos coloreados de la barra inferior.
 */
export default function HojasRutaPage({ selectedHojaRuta, onSelectHojaRuta }) {
  const { user, pendingSyncCount, triggerSyncOffline, syncing } = useAuth();
  const [hojasRuta, setHojasRuta] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHojasRuta = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      if (navigator.onLine) {
        const res = await fetchHojasDeRuta();
        if (res && res.ok) {
          const list = res.hojas_ruta || [];
          setHojasRuta(list);
          await cacheHojasRuta(list);
        }
      } else {
        const cached = await getCachedHojasRuta();
        setHojasRuta(cached);
      }
    } catch (err) {
      console.warn('[HojasRutaPage] Error al obtener hojas de ruta:', err.message);
      const cached = await getCachedHojasRuta();
      if (cached.length > 0) {
        setHojasRuta(cached);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadHojasRuta();
  }, [loadHojasRuta, user]);

  const formatFecha = (val) => {
    if (!val) return '-';
    return String(val).includes('T') ? String(val).split('T')[0] : String(val);
  };

  return (
    <div className="hr-list-page page-transition">
      <div className="hr-page-banner">
        <div>
          <h2 className="hr-page-title">Hojas de Ruta a Entregar</h2>
          <p className="hr-page-subtitle">
            {selectedHojaRuta
              ? `Seleccionada: ${selectedHojaRuta.Hoja_de_ruta} — Elegí una sección en la barra inferior`
              : 'Selecciona una hoja de ruta para operar'}
          </p>
        </div>

        <button
          type="button"
          className="hr-refresh-btn"
          onClick={() => loadHojasRuta(true)}
          title="Actualizar listado"
        >
          <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
        </button>
      </div>

      {/* Estado de sincronización offline */}
      {pendingSyncCount > 0 && (
        <div
          className="hr-sync-pill"
          onClick={triggerSyncOffline}
        >
          <RefreshCw size={15} className={syncing ? 'spin' : ''} />
          <span>{pendingSyncCount} registros pendientes de envío</span>
          <strong>Sincronizar</strong>
        </div>
      )}

      {loading ? (
        <div className="hr-empty-state">
          <RefreshCw size={32} className="spin" style={{ color: 'var(--dy-blue)' }} />
          <p>Cargando hojas de ruta asignadas...</p>
        </div>
      ) : hojasRuta.length === 0 ? (
        <div className="hr-empty-state">
          <Inbox size={44} style={{ color: 'var(--text-muted)' }} />
          <h3>Sin hojas de ruta asignadas</h3>
          <p>No se encontraron hojas de ruta disponibles dentro de la ventana de fechas para tu usuario.</p>
        </div>
      ) : (
        <div className="hr-cards-list">
          {hojasRuta.map((hr) => {
            const isSelected = selectedHojaRuta?.Transaccionid === hr.Transaccionid;
            return (
              <div
                key={hr.Transaccionid}
                className={`hr-card ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectHojaRuta(hr)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectHojaRuta(hr);
                  }
                }}
              >
                <div className="hr-card-top">
                  <div className="hr-code-badge">
                    <FileText size={16} />
                    <span>{hr.Hoja_de_ruta}</span>
                  </div>

                  <div className="hr-date-tag">
                    <Calendar size={14} />
                    <span>{formatFecha(hr.Fecha)}</span>
                  </div>
                </div>

                <div className="hr-card-body">
                  <div className="hr-patentes-row">
                    <div className="hr-patente-chip">
                      <Truck size={14} />
                      <span>Camión: <strong>{hr.Patente_camion || '-'}</strong></span>
                    </div>
                    <div className="hr-patente-chip">
                      <span>Acoplado: <strong>{hr.Patente_acoplado || '-'}</strong></span>
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div className="hr-selected-actions">
                    <div className="hr-selected-badge">
                      <CheckCircle2 size={15} />
                      <span>Hoja de ruta seleccionada — Elegí una sección en la barra inferior</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
