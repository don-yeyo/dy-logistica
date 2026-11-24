import React, { useState, useEffect, useCallback } from 'react';
import { fetchAdminCajones } from '../../services/api';
import AdminPagination from './AdminPagination';
import { Search } from 'lucide-react';

const DEFAULT_PAGE_SIZE = Number(import.meta.env.VITE_ADMIN_PAGE_SIZE || 15);

export default function AdminCajones() {
  const [cajones, setCajones] = useState([]);
  const [q, setQ] = useState('');
  const [soloDiferencia, setSoloDiferencia] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState({ page: 1, page_size: DEFAULT_PAGE_SIZE, total: 0, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async (overrides = {}) => {
    try {
      setLoading(true);
      setError(null);
      const searchVal = overrides.q !== undefined ? overrides.q : q;
      const diffVal = overrides.soloDiferencia !== undefined ? overrides.soloDiferencia : soloDiferencia;
      const nextPage = overrides.page !== undefined ? overrides.page : page;
      const nextSize = overrides.pageSize !== undefined ? overrides.pageSize : pageSize;
      const res = await fetchAdminCajones({
        q: searchVal,
        solo_con_diferencia: diffVal ? 'true' : 'false',
        page: nextPage,
        page_size: nextSize
      });
      setCajones(res.cajones || []);
      if (res.pagination) {
        setPagination(res.pagination);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar control de cajones.');
    } finally {
      setLoading(false);
    }
  }, [q, soloDiferencia, page, pageSize]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="admin-section">
      <form
        className="admin-filter-bar"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          loadData({ page: 1 });
        }}
      >
        <div className="admin-input-icon-wrap" style={{ flex: '1 1 260px' }}>
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar por Hoja de Ruta, chofer, cliente o dirección..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="admin-input"
          />
        </div>

        <label className="admin-checkbox-label">
          <input
            type="checkbox"
            checked={soloDiferencia}
            onChange={(e) => {
              const next = e.target.checked;
              setSoloDiferencia(next);
              setPage(1);
              loadData({ soloDiferencia: next, page: 1 });
            }}
          />
          <span>Solo con diferencia</span>
        </label>

        <button type="submit" className="admin-btn admin-btn-primary">Filtrar</button>
        {q && (
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            onClick={() => {
              setQ('');
              setPage(1);
              loadData({ q: '', page: 1 });
            }}
          >
            Limpiar
          </button>
        )}
      </form>

      {error && <div className="admin-alert admin-alert-error">{error}</div>}

      <div className="admin-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Hoja de Ruta</th>
                <th>Fecha</th>
                <th>Chofer</th>
                <th>Cliente / Lugar de Entrega</th>
                <th>Entregados</th>
                <th>Devueltos</th>
                <th>Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="admin-empty-cell">Cargando balance de cajones...</td>
                </tr>
              ) : cajones.length === 0 ? (
                <tr>
                  <td colSpan={7} className="admin-empty-cell">No hay registros de cajones para mostrar.</td>
                </tr>
              ) : (
                cajones.map((c, idx) => (
                  <tr key={`${c.Transaccionid}-${c.Id_etapa}-${idx}`}>
                    <td><strong>{c.Hoja_de_ruta}</strong></td>
                    <td>{c.Fecha ? String(c.Fecha).slice(0, 10) : '—'}</td>
                    <td>{c.Chofer || '—'}</td>
                    <td>
                      <div>{c.Cliente || '—'}</div>
                      <small className="admin-muted-text">{c.Lugar_de_Entrega || ''}</small>
                    </td>
                    <td>{c.cajones_entregados}</td>
                    <td>{c.cajones_devueltos}</td>
                    <td>
                      <span className={`admin-badge ${c.diferencia === 0 ? 'admin-badge-green' : 'admin-badge-amber'}`}>
                        {c.diferencia > 0 ? `+${c.diferencia}` : c.diferencia}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <AdminPagination
          pagination={pagination}
          loading={loading}
          onPageChange={(nextPage) => setPage(nextPage)}
          onPageSizeChange={(nextSize) => {
            setPageSize(nextSize);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}
