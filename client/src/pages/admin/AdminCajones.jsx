import React, { useState, useEffect, useCallback } from 'react';
import { fetchAdminCajones } from '../../services/api';
import { Search, RefreshCw } from 'lucide-react';

export default function AdminCajones() {
  const [cajones, setCajones] = useState([]);
  const [q, setQ] = useState('');
  const [soloDiferencia, setSoloDiferencia] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async (overrides = {}) => {
    try {
      setLoading(true);
      setError(null);
      const searchVal = overrides.q !== undefined ? overrides.q : q;
      const diffVal = overrides.soloDiferencia !== undefined ? overrides.soloDiferencia : soloDiferencia;
      const res = await fetchAdminCajones({
        q: searchVal,
        solo_con_diferencia: diffVal ? 'true' : 'false'
      });
      setCajones(res.cajones || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar control de cajones.');
    } finally {
      setLoading(false);
    }
  }, [q, soloDiferencia]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="admin-section">
      <div className="admin-section-toolbar">
        <div>
          <h2 className="admin-section-heading">Control de Cajones</h2>
          <p className="admin-section-desc">
            Balance entre cajones entregados y devueltos por hoja de ruta, etapa y cliente.
          </p>
        </div>
        <button type="button" className="admin-btn admin-btn-secondary" onClick={() => loadData()} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          <span>Actualizar</span>
        </button>
      </div>

      <form
        className="admin-filter-bar"
        onSubmit={(e) => {
          e.preventDefault();
          loadData();
        }}
      >
        <div className="admin-input-icon-wrap" style={{ flex: '1 1 260px' }}>
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar por Hoja de Ruta, cliente o dirección..."
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
              loadData({ soloDiferencia: next });
            }}
          />
          <span>Solo con diferencia</span>
        </label>

        <button type="submit" className="admin-btn admin-btn-primary">Filtrar</button>
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
      </div>
    </div>
  );
}
