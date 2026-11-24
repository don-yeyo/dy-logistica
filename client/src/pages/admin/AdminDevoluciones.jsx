import React, { useState, useEffect, useCallback } from 'react';
import { fetchAdminDevoluciones } from '../../services/api';
import AdminPagination from './AdminPagination';
import { Search, RotateCcw, AlertTriangle, FileSpreadsheet } from 'lucide-react';

const DEFAULT_PAGE_SIZE = Number(import.meta.env.VITE_ADMIN_PAGE_SIZE || 15);

export default function AdminDevoluciones() {
  const [tab, setTab] = useState('devoluciones'); // 'devoluciones' | 'faltantes'
  const [q, setQ] = useState('');
  const [devoluciones, setDevoluciones] = useState([]);
  const [faltantes, setFaltantes] = useState([]);
  const [devPage, setDevPage] = useState(1);
  const [faltPage, setFaltPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState({
    devoluciones: { page: 1, page_size: DEFAULT_PAGE_SIZE, total: 0, total_pages: 1 },
    faltantes: { page: 1, page_size: DEFAULT_PAGE_SIZE, total: 0, total_pages: 1 }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const currentPage = tab === 'devoluciones' ? devPage : faltPage;

  const loadData = useCallback(async (overrides = {}) => {
    try {
      setLoading(true);
      setError(null);
      const activeTab = overrides.tab !== undefined ? overrides.tab : tab;
      const activePage = overrides.page !== undefined ? overrides.page : (activeTab === 'devoluciones' ? devPage : faltPage);
      const activeSize = overrides.pageSize !== undefined ? overrides.pageSize : pageSize;
      const res = await fetchAdminDevoluciones({
        q: overrides.q !== undefined ? overrides.q : q,
        tab: activeTab,
        page: activePage,
        page_size: activeSize
      });
      if (activeTab === 'devoluciones') {
        setDevoluciones(res.devoluciones || []);
      } else {
        setFaltantes(res.faltantes || []);
      }
      if (res.pagination) {
        setPagination(res.pagination);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar devoluciones y faltantes.');
    } finally {
      setLoading(false);
    }
  }, [q, tab, devPage, faltPage, pageSize]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activePagination = tab === 'devoluciones' ? pagination.devoluciones : pagination.faltantes;

  return (
    <div className="admin-section">
      <div className="admin-info-banner">
        <FileSpreadsheet size={18} />
        <span>
          <strong>Preparado para Notas de Crédito:</strong> esta bandeja centraliza todas las devoluciones y faltantes de entrega para el futuro módulo de solicitudes de Notas de Crédito de Logística.
        </span>
      </div>

      <form
        className="admin-filter-bar"
        onSubmit={(e) => {
          e.preventDefault();
          setDevPage(1);
          setFaltPage(1);
          loadData({ page: 1 });
        }}
      >
        <div className="admin-input-icon-wrap" style={{ flex: '1 1 280px' }}>
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar por Hoja de Ruta, cliente, remito o producto..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="admin-input"
          />
        </div>
        <button type="submit" className="admin-btn admin-btn-primary">Buscar</button>
        {q && (
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            onClick={() => {
              setQ('');
              setDevPage(1);
              setFaltPage(1);
              loadData({ q: '', page: 1 });
            }}
          >
            Limpiar
          </button>
        )}
      </form>

      <div className="admin-tabs">
        <button
          type="button"
          className={`admin-tab ${tab === 'devoluciones' ? 'active' : ''}`}
          onClick={() => setTab('devoluciones')}
        >
          <RotateCcw size={16} />
          <span>Devoluciones Registradas ({pagination.devoluciones?.total ?? devoluciones.length})</span>
        </button>
        <button
          type="button"
          className={`admin-tab ${tab === 'faltantes' ? 'active' : ''}`}
          onClick={() => setTab('faltantes')}
        >
          <AlertTriangle size={16} />
          <span>Faltantes en Entrega ({pagination.faltantes?.total ?? faltantes.length})</span>
        </button>
      </div>

      {error && <div className="admin-alert admin-alert-error">{error}</div>}

      {tab === 'devoluciones' ? (
        <div className="admin-card">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Hoja de Ruta</th>
                  <th>Fecha</th>
                  <th>Cliente / Lugar</th>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Vencimiento</th>
                  <th>Motivo</th>
                  <th>Tipo</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="admin-empty-cell">Cargando devoluciones...</td>
                  </tr>
                ) : devoluciones.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="admin-empty-cell">No hay devoluciones registradas.</td>
                  </tr>
                ) : (
                  devoluciones.map((dev) => (
                    <tr key={dev.id_remito_devoluciones_item}>
                      <td><strong>{dev.Hoja_de_ruta || '—'}</strong></td>
                      <td>{dev.fecha ? String(dev.fecha).slice(0, 10) : '—'}</td>
                      <td>
                        <div>{dev.Cliente || '—'}</div>
                        <small className="admin-muted-text">{dev.Lugar_de_Entrega || ''}</small>
                      </td>
                      <td>
                        <div>{dev.Producto || '—'}</div>
                        <small className="admin-muted-text">{dev.ProductoCodigo || ''}</small>
                      </td>
                      <td><strong>{dev.Cantidad}</strong></td>
                      <td>{dev.Vencimiento ? String(dev.Vencimiento).slice(0, 10) : '—'}</td>
                      <td>{dev.Motivo || '—'}</td>
                      <td>
                        <span className="admin-badge admin-badge-blue">{dev.Tipo || 'Físico'}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <AdminPagination
            pagination={{ ...activePagination, page: currentPage }}
            loading={loading}
            onPageChange={(nextPage) => setDevPage(nextPage)}
            onPageSizeChange={(nextSize) => {
              setPageSize(nextSize);
              setDevPage(1);
              setFaltPage(1);
            }}
          />
        </div>
      ) : (
        <div className="admin-card">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Hoja de Ruta</th>
                  <th>Fecha</th>
                  <th>Cliente / Lugar</th>
                  <th>Remito</th>
                  <th>Producto</th>
                  <th>Remitido</th>
                  <th>Entregado</th>
                  <th>Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="admin-empty-cell">Cargando faltantes...</td>
                  </tr>
                ) : faltantes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="admin-empty-cell">No se detectan diferencias/faltantes en entregas.</td>
                  </tr>
                ) : (
                  faltantes.map((f) => (
                    <tr key={f.Hojarutaitemid}>
                      <td><strong>{f.Hoja_de_ruta}</strong></td>
                      <td>{f.Fecha ? String(f.Fecha).slice(0, 10) : '—'}</td>
                      <td>
                        <div>{f.Cliente || '—'}</div>
                        <small className="admin-muted-text">{f.Lugar_de_Entrega || ''}</small>
                      </td>
                      <td>{f.Remito || '—'}</td>
                      <td>{f.Producto}</td>
                      <td>{f.Remitido}</td>
                      <td>{f.Entregado}</td>
                      <td>
                        <span className={`admin-badge ${Number(f.Diferencia) > 0 ? 'admin-badge-red' : 'admin-badge-amber'}`}>
                          {Number(f.Diferencia) > 0 ? `-${f.Diferencia}` : `+${Math.abs(f.Diferencia)}`}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <AdminPagination
            pagination={{ ...activePagination, page: currentPage }}
            loading={loading}
            onPageChange={(nextPage) => setFaltPage(nextPage)}
            onPageSizeChange={(nextSize) => {
              setPageSize(nextSize);
              setDevPage(1);
              setFaltPage(1);
            }}
          />
        </div>
      )}
    </div>
  );
}
