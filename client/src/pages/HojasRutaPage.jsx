import React, { useState, useEffect, useCallback } from 'react';
import { fetchHojasDeRuta } from '../services/api';
import { cacheHojasRuta, getCachedHojasRuta } from '../services/offlineStorage';
import { useAuth } from '../config/AuthContext';
import HojaRutaHeader from '../components/HojaRutaHeader';
import { RefreshCw, Inbox } from 'lucide-react';

/**
 * Pantalla Principal post-login (Sección 4.2 Hoja de Ruta):
 * Exclusiva para el rol chofer. Reutiliza el mismo componente HojaRutaHeader que las secciones operativas.
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
              <HojaRutaHeader
                key={hr.Transaccionid}
                hojaRuta={hr}
                selected={isSelected}
                interactive
                onSelect={() => onSelectHojaRuta(hr)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
