import React, { useState, useEffect, useCallback } from 'react';
import HojaRutaHeader from '../components/HojaRutaHeader';
import { fetchLugaresHojaRuta } from '../services/api';
import { cacheLugares, getCachedLugares } from '../services/offlineStorage';
import { getLugaresDirtyMap } from '../services/draftStorage';
import { useAuth } from '../config/AuthContext';
import {
  MapPin,
  RefreshCw,
  Inbox,
  ChevronRight,
  CheckCircle2,
  FileText,
  Package,
  Users
} from 'lucide-react';

/**
 * Paso 2 del wizard del chofer:
 * Permite seleccionar el Lugar de Entrega dentro de la Hoja de Ruta activa.
 */
export default function LugaresPage({
  hojaRuta,
  selectedLugar,
  onSelectLugar
}) {
  const { user } = useAuth();
  const [headerInfo, setHeaderInfo] = useState(hojaRuta);
  const [lugares, setLugares] = useState([]);
  const [dirtyMap, setDirtyMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const syncDirty = useCallback(() => {
    setDirtyMap(getLugaresDirtyMap(user?.email, hojaRuta?.Transaccionid));
  }, [user?.email, hojaRuta?.Transaccionid]);

  const loadLugares = useCallback(async (isSilent = false) => {
    if (!hojaRuta?.Transaccionid) return;
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      let loadedHeader = hojaRuta;
      let loadedLugares = [];

      if (navigator.onLine) {
        try {
          const res = await fetchLugaresHojaRuta(hojaRuta.Transaccionid);
          if (res && res.ok) {
            loadedHeader = res.hoja_ruta || hojaRuta;
            loadedLugares = res.lugares || [];
            await cacheLugares(hojaRuta.Transaccionid, {
              hoja_ruta: loadedHeader,
              lugares: loadedLugares
            });
          }
        } catch (apiErr) {
          console.warn('[LugaresPage] Error API, usando caché local:', apiErr.message);
          const cached = await getCachedLugares(hojaRuta.Transaccionid);
          if (cached) {
            loadedHeader = cached.hoja_ruta || hojaRuta;
            loadedLugares = cached.lugares || [];
          }
        }
      } else {
        const cached = await getCachedLugares(hojaRuta.Transaccionid);
        if (cached) {
          loadedHeader = cached.hoja_ruta || hojaRuta;
          loadedLugares = cached.lugares || [];
        }
      }

      setHeaderInfo(loadedHeader);
      setLugares(loadedLugares);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [hojaRuta]);

  useEffect(() => {
    loadLugares();
    syncDirty();
  }, [loadLugares, syncDirty]);

  useEffect(() => {
    const onChanged = () => syncDirty();
    const onSaved = () => {
      syncDirty();
      loadLugares(true);
    };
    window.addEventListener('dy-draft-changed', onChanged);
    window.addEventListener('dy-draft-saved', onSaved);
    return () => {
      window.removeEventListener('dy-draft-changed', onChanged);
      window.removeEventListener('dy-draft-saved', onSaved);
    };
  }, [syncDirty, loadLugares]);

  return (
    <div className="module-page page-transition">
      <HojaRutaHeader hojaRuta={headerInfo} />

      <div className="hr-page-banner">
        <div>
          <h2 className="hr-page-title">Lugares de Entrega</h2>
          <p className="hr-page-subtitle">
            {selectedLugar
              ? `Activo: ${selectedLugar}`
              : 'Elegí el lugar donde estás descargando para continuar'}
          </p>
        </div>

        <button
          type="button"
          className="hr-refresh-btn"
          onClick={() => loadLugares(true)}
          title="Actualizar lugares"
        >
          <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="hr-empty-state">
          <RefreshCw size={30} className="spin" style={{ color: 'var(--dy-blue)' }} />
          <p>Cargando lugares de entrega...</p>
        </div>
      ) : lugares.length === 0 ? (
        <div className="hr-empty-state">
          <Inbox size={42} style={{ color: 'var(--text-muted)' }} />
          <h3>Sin lugares asignados</h3>
          <p>No se encontraron lugares de entrega registrados en esta Hoja de Ruta.</p>
        </div>
      ) : (
        <div className="lugares-select-list">
          {lugares.map((item) => {
            const isSelected =
              Boolean(selectedLugar) &&
              String(selectedLugar).trim().toLowerCase() === String(item.lugar).trim().toLowerCase();
            const hasDirty = Boolean(dirtyMap[String(item.lugar).trim().toLowerCase()]);

            return (
              <button
                key={item.lugar}
                type="button"
                className={`lugar-select-card ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectLugar(item.lugar)}
              >
                <div className="lugar-select-top">
                  <div className="lugar-select-title-row">
                    <span className="lugar-select-icon">
                      <MapPin size={17} />
                    </span>
                    <span className="lugar-select-name">{item.lugar}</span>
                  </div>
                  <ChevronRight size={19} className="lugar-select-arrow" />
                </div>

                {item.clientes_preview && (
                  <p className="lugar-select-clients">{item.clientes_preview}</p>
                )}

                <div className="lugar-select-chips">
                  <span className="lugar-info-chip">
                    <Users size={12} />
                    {item.total_clientes} {item.total_clientes === 1 ? 'cliente' : 'clientes'}
                  </span>
                  <span className="lugar-info-chip">
                    <FileText size={12} />
                    {item.total_remitos} rem.
                  </span>
                  <span className="lugar-info-chip">
                    <Package size={12} />
                    {item.total_productos} prod. · {item.total_unidades} u.
                  </span>

                  {hasDirty ? (
                    <span className="lugar-status-pill dirty">Sin confirmar</span>
                  ) : item.confirmado ? (
                    <span className="lugar-status-pill confirmed">
                      <CheckCircle2 size={12} /> Descarga OK
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
