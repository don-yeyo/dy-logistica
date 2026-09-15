import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchMisRemitos, fetchViajes } from '../services/api';
import { cacheRemitos, getCachedRemitos } from '../services/offlineStorage';
import { useAuth } from '../config/AuthContext';
import SearchBar from '../components/SearchBar';
import RemitoCard from '../components/RemitoCard';
import { RefreshCw, Filter, Inbox, CheckCircle2, Clock } from 'lucide-react';

export default function RemitosList({ onSelectRemito }) {
  const { user, isOnline } = useAuth();
  const [remitos, setRemitos] = useState([]);
  const [viajes, setViajes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState('TODAS');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Cargar remitos desde API o Caché Offline
  const loadData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      if (navigator.onLine) {
        // En línea: Cargar desde API
        const [remitosRes, viajesRes] = await Promise.allSettled([
          fetchMisRemitos({ n_viajes: 4 }),
          fetchViajes({ n_viajes: 4 })
        ]);

        if (remitosRes.status === 'fulfilled' && remitosRes.value?.ok) {
          const list = remitosRes.value.remitos || [];
          setRemitos(list);
          await cacheRemitos(list);
        }

        if (viajesRes.status === 'fulfilled' && viajesRes.value?.ok) {
          setViajes(viajesRes.value.viajes || []);
        }
      } else {
        // Sin conexión: Cargar desde IndexedDB
        console.log('[RemitosList] Cargando remitos desde caché local offline...');
        const cached = await getCachedRemitos();
        setRemitos(cached);
      }
    } catch (error) {
      console.warn('[RemitosList] Error al cargar remitos:', error);
      // Fallback a caché local
      const cached = await getCachedRemitos();
      if (cached.length > 0) {
        setRemitos(cached);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, user]);

  // Lista de hojas de ruta únicas para los chips
  const routeOptions = useMemo(() => {
    const routesSet = new Set();
    remitos.forEach(r => {
      if (r.nro_hoja_ruta) routesSet.add(r.nro_hoja_ruta);
    });
    return Array.from(routesSet);
  }, [remitos]);

  // Filtrado predictivo instantáneo por texto y hoja de ruta
  const filteredRemitos = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return remitos.filter((remito) => {
      // Filtro por hoja de ruta
      if (selectedRoute !== 'TODAS' && remito.nro_hoja_ruta !== selectedRoute) {
        return false;
      }

      // Filtro por buscador predictivo
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
  }, [remitos, selectedRoute, searchQuery]);

  // Contadores rápidos
  const stats = useMemo(() => {
    const total = filteredRemitos.length;
    const pendientes = filteredRemitos.filter(r => r.estado_firma === 'PENDIENTE').length;
    const completados = total - pendientes;
    return { total, pendientes, completados };
  }, [filteredRemitos]);

  return (
    <div className="remitos-page">
      {/* Buscador Predictivo */}
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="🔍 Escribe comprobante, cliente o dirección..."
      />

      {/* Selector de Viajes / Hojas de Ruta (Chips horizontales) */}
      <div className="routes-chips-container">
        <button
          type="button"
          className={`route-chip ${selectedRoute === 'TODAS' ? 'active' : ''}`}
          onClick={() => setSelectedRoute('TODAS')}
        >
          <span>Todos los Viajes</span>
          <span className="route-chip-badge">{remitos.length}</span>
        </button>

        {routeOptions.map((route) => {
          const count = remitos.filter(r => r.nro_hoja_ruta === route).length;
          return (
            <button
              key={route}
              type="button"
              className={`route-chip ${selectedRoute === route ? 'active' : ''}`}
              onClick={() => setSelectedRoute(route)}
            >
              <span>{route}</span>
              <span className="route-chip-badge">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Barra de Estadísticas y Refresco */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', fontSize: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#b45309', fontWeight: 700 }}>
            <Clock size={15} />
            {stats.pendientes} Pendientes
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#047857', fontWeight: 700 }}>
            <CheckCircle2 size={15} />
            {stats.completados} Listos
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

      {/* Listado de Remitos */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '50px 0', gap: '12px', color: 'var(--text-muted)' }}>
          <RefreshCw size={32} className="spin" style={{ color: 'var(--dy-blue)' }} />
          <p style={{ fontWeight: 600 }}>Cargando remitos de tus viajes...</p>
        </div>
      ) : filteredRemitos.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', textAlign: 'center', gap: '12px' }}>
          <Inbox size={48} style={{ color: 'var(--text-muted)' }} />
          <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>No se encontraron remitos</h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', maxWidth: '280px' }}>
            {searchQuery
              ? `No hay remitos que coincidan con "${searchQuery}".`
              : 'No hay remitos asignados en las hojas de ruta seleccionadas.'}
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
