import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchMisRemitos } from '../services/api';
import { cacheRemitos, getCachedRemitos } from '../services/offlineStorage';
import { useAuth } from '../config/AuthContext';
import HojaRutaHeader from '../components/HojaRutaHeader';
import SearchBar from '../components/SearchBar';
import RemitoCard from '../components/RemitoCard';
import { RefreshCw, Inbox, CheckCircle2, Clock, ScanLine } from 'lucide-react';

export default function RemitosList({ hojaRuta, onChangeHojaRuta, onOpenScan, onSelectRemito }) {
  const { user } = useAuth();
  const [remitos, setRemitos] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(hojaRuta?.Hoja_de_ruta || 'TODAS');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (hojaRuta?.Hoja_de_ruta) {
      setSelectedRoute(hojaRuta.Hoja_de_ruta);
    }
  }, [hojaRuta]);

  // Cargar remitos desde API o Caché Offline
  const loadData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const queryParams = { n_viajes: 4 };
      if (hojaRuta?.Transaccionid) {
        queryParams.transaccion_id = hojaRuta.Transaccionid;
      }
      if (hojaRuta?.Hoja_de_ruta) {
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
        console.log('[RemitosList] Cargando remitos desde caché local offline...');
        const cached = await getCachedRemitos();
        setRemitos(cached);
      }
    } catch (error) {
      console.warn('[RemitosList] Error al cargar remitos:', error);
      const cached = await getCachedRemitos();
      if (cached.length > 0) {
        setRemitos(cached);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [hojaRuta]);

  useEffect(() => {
    loadData();
  }, [loadData, user]);

  // Lista de hojas de ruta únicas para los chips
  const routeOptions = useMemo(() => {
    const routesSet = new Set();
    if (hojaRuta?.Hoja_de_ruta) {
      routesSet.add(hojaRuta.Hoja_de_ruta);
    }
    remitos.forEach((r) => {
      if (r.nro_hoja_ruta) routesSet.add(r.nro_hoja_ruta);
    });
    return Array.from(routesSet);
  }, [remitos, hojaRuta]);

  // Filtrado predictivo instantáneo por texto y hoja de ruta
  const filteredRemitos = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return remitos.filter((remito) => {
      if (selectedRoute !== 'TODAS') {
        const normRoute = String(selectedRoute).replace(/^HR-/i, '');
        const normRemito = String(remito.nro_hoja_ruta || '').replace(/^HR-/i, '');
        if (normRemito !== normRoute) {
          return false;
        }
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
  }, [remitos, selectedRoute, searchQuery]);

  // Contadores rápidos
  const stats = useMemo(() => {
    const total = filteredRemitos.length;
    const pendientes = filteredRemitos.filter((r) => r.estado_firma === 'PENDIENTE').length;
    const completados = total - pendientes;
    return { total, pendientes, completados };
  }, [filteredRemitos]);

  return (
    <div className="module-page">
      {hojaRuta && (
        <HojaRutaHeader
          hojaRuta={hojaRuta}
          title="Logística DY - Remitos"
          onChangeHojaRuta={onChangeHojaRuta}
        />
      )}

      {/* Botón Directo de Escáner 1D */}
      {onOpenScan && (
        <button
          type="button"
          className="remitos-scan-cta"
          onClick={onOpenScan}
        >
          <ScanLine size={20} />
          <span>Escanear Código de Barras 1D del Remito</span>
        </button>
      )}

      {/* Buscador Predictivo */}
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="🔍 Escribe comprobante, cliente o dirección..."
      />

      {/* Selector de Viajes / Hojas de Ruta (Chips horizontales) */}
      {routeOptions.length > 1 && (
        <div className="routes-chips-container">
          <button
            type="button"
            className={`route-chip ${selectedRoute === 'TODAS' ? 'active' : ''}`}
            onClick={() => setSelectedRoute('TODAS')}
          >
            <span>Todos</span>
            <span className="route-chip-badge">{remitos.length}</span>
          </button>

          {routeOptions.map((route) => {
            const count = remitos.filter((r) => r.nro_hoja_ruta === route).length;
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
      )}

      {/* Barra de Estadísticas y Refresco */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.85rem' }}>
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
          <p style={{ fontWeight: 600 }}>Cargando remitos de la hoja de ruta...</p>
        </div>
      ) : filteredRemitos.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '50px 20px', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', textAlign: 'center', gap: '12px' }}>
          <Inbox size={44} style={{ color: 'var(--text-muted)' }} />
          <h3 style={{ fontSize: '1.05rem', color: 'var(--text-main)', margin: 0 }}>No se encontraron remitos</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '280px', margin: 0 }}>
            {searchQuery
              ? `No hay remitos que coincidan con "${searchQuery}".`
              : 'No hay remitos asignados en la hoja de ruta seleccionada.'}
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
