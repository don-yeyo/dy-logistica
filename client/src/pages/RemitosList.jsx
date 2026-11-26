import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchMisRemitos } from '../services/api';
import { cacheRemitos, getCachedRemitos } from '../services/offlineStorage';
import { useAuth } from '../config/AuthContext';
import HojaRutaHeader from '../components/HojaRutaHeader';
import SearchBar from '../components/SearchBar';
import RemitoCard from '../components/RemitoCard';
import { RefreshCw, Inbox, CheckCircle2, Clock, ScanLine } from 'lucide-react';

export default function RemitosList({
  hojaRuta,
  selectedLugar,
  onChangeLugar,
  onOpenScan,
  onSelectRemito
}) {
  const { user } = useAuth();
  const [remitos, setRemitos] = useState([]);
  const [tripFilter, setTripFilter] = useState('TODOS');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const queryParams = {};
      if (hojaRuta?.Transaccionid) {
        queryParams.transaccion_id = hojaRuta.Transaccionid;
      }
      if (selectedLugar) {
        queryParams.lugar = selectedLugar;
      } else if (hojaRuta?.Hoja_de_ruta) {
        queryParams.hoja_ruta = hojaRuta.Hoja_de_ruta;
      }

      if (navigator.onLine) {
        const remitosRes = await fetchMisRemitos(queryParams);
        if (remitosRes && remitosRes.ok) {
          const list = remitosRes.remitos || [];
          setRemitos(list);
          await cacheRemitos(list);
        }
      } else {
        const cached = await getCachedRemitos();
        const filteredCached = selectedLugar
          ? cached.filter(
            (r) =>
              String(r.finne_domicilio || '').trim().toLowerCase() ===
              String(selectedLugar).trim().toLowerCase()
          )
          : cached;
        setRemitos(filteredCached);
      }
    } catch (error) {
      console.warn('[RemitosList] Error al cargar remitos:', error);
      const cached = await getCachedRemitos();
      if (cached.length > 0) {
        const filteredCached = selectedLugar
          ? cached.filter(
            (r) =>
              String(r.finne_domicilio || '').trim().toLowerCase() ===
              String(selectedLugar).trim().toLowerCase()
          )
          : cached;
        setRemitos(filteredCached);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [hojaRuta, selectedLugar]);

  useEffect(() => {
    loadData();
  }, [loadData, user]);

  useEffect(() => {
    const onExternalSaved = (e) => {
      const sameTx = Number(e.detail?.transaccionId) === Number(hojaRuta?.Transaccionid);
      if (sameTx && Array.isArray(e.detail?.sections) && e.detail.sections.includes('remitos')) {
        loadData(true);
      }
    };
    window.addEventListener('dy-draft-saved', onExternalSaved);
    return () => window.removeEventListener('dy-draft-saved', onExternalSaved);
  }, [hojaRuta?.Transaccionid, loadData]);

  const tripCounts = useMemo(() => {
    const actual = remitos.filter((r) => r.es_viaje_actual !== false).length;
    const anteriores = remitos.filter((r) => r.es_viaje_actual === false).length;
    return { todos: remitos.length, actual, anteriores };
  }, [remitos]);

  const filteredRemitos = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return remitos.filter((remito) => {
      if (tripFilter === 'ACTUAL' && remito.es_viaje_actual === false) {
        return false;
      }
      if (tripFilter === 'ANTERIORES' && remito.es_viaje_actual !== false) {
        return false;
      }

      if (!q) return true;

      const comprobante = (remito.finne_Comprobante || '').toLowerCase();
      const cliente = (remito.finne_Cliente || '').toLowerCase();
      const codCliente = String(remito.finne_CodigoCliente || '');
      const domicilio = (remito.finne_domicilio || '').toLowerCase();
      const hr = (remito.nro_hoja_ruta || '').toLowerCase();

      return (
        comprobante.includes(q) ||
        cliente.includes(q) ||
        codCliente.includes(q) ||
        domicilio.includes(q) ||
        hr.includes(q)
      );
    });
  }, [remitos, tripFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = filteredRemitos.length;
    const pendientes = filteredRemitos.filter((r) =>
      r.pendiente_ejemplares !== undefined ? r.pendiente_ejemplares : r.estado_firma === 'PENDIENTE'
    ).length;
    const completados = total - pendientes;
    return { total, pendientes, completados };
  }, [filteredRemitos]);

  return (
    <div className="module-page">
      {hojaRuta && (
        <HojaRutaHeader
          hojaRuta={hojaRuta}
          selectedLugar={selectedLugar}
          onChangeLugar={onChangeLugar}
        />
      )}

      {onOpenScan && (
        <button
          type="button"
          className="remitos-scan-cta"
          onClick={onOpenScan}
        >
          <ScanLine size={20} />
          <span>Escanear Código del Remito</span>
        </button>
      )}

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="🔍 Escribe comprobante, cliente o Nro. HR..."
      />

      {tripCounts.anteriores > 0 && (
        <div className="routes-chips-container">
          <button
            type="button"
            className={`route-chip ${tripFilter === 'TODOS' ? 'active' : ''}`}
            onClick={() => setTripFilter('TODOS')}
          >
            <span>Todos</span>
            <span className="route-chip-badge">{tripCounts.todos}</span>
          </button>
          <button
            type="button"
            className={`route-chip ${tripFilter === 'ACTUAL' ? 'active' : ''}`}
            onClick={() => setTripFilter('ACTUAL')}
          >
            <span>Viaje actual</span>
            <span className="route-chip-badge">{tripCounts.actual}</span>
          </button>
          <button
            type="button"
            className={`route-chip ${tripFilter === 'ANTERIORES' ? 'active' : ''}`}
            onClick={() => setTripFilter('ANTERIORES')}
          >
            <span>Viajes anteriores pendientes</span>
            <span className="route-chip-badge">{tripCounts.anteriores}</span>
          </button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#b45309', fontWeight: 700 }}>
            <Clock size={15} />
            {stats.pendientes} Pendientes
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#047857', fontWeight: 700 }}>
            <CheckCircle2 size={15} />
            {stats.completados} Completos
          </span>
        </div>

        <button
          type="button"
          onClick={() => loadData(true)}
          style={{ background: 'none', border: 'none', color: 'var(--dy-blue)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
          title="Recargar remitos"
        >
          <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
          <span>Actualizar</span>
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '50px 0', gap: '12px', color: 'var(--text-muted)' }}>
          <RefreshCw size={32} className="spin" style={{ color: 'var(--dy-blue)' }} />
          <p style={{ fontWeight: 600 }}>Cargando remitos del lugar...</p>
        </div>
      ) : filteredRemitos.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '50px 20px', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', textAlign: 'center', gap: '12px' }}>
          <Inbox size={44} style={{ color: 'var(--text-muted)' }} />
          <h3 style={{ fontSize: '1.05rem', color: 'var(--text-main)', margin: 0 }}>Sin remitos pendientes</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '280px', margin: 0 }}>
            {searchQuery
              ? `No hay remitos que coincidan con "${searchQuery}".`
              : `No hay remitos del viaje actual ni pendientes anteriores para ${selectedLugar || 'este lugar'}.`}
          </p>
          {searchQuery && (
            <button
              type="button"
              className="sync-now-btn"
              onClick={() => setSearchQuery('')}
            >
              Borrar filtro
            </button>
          )}
        </div>
      ) : (
        <div className="remitos-list">
          {filteredRemitos.map((remito) => (
            <RemitoCard
              key={remito.id}
              remito={remito}
              onSelect={onSelectRemito}
            />
          ))}
        </div>
      )}
    </div>
  );
}
