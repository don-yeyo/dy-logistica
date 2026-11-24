import React, { useState, useEffect, useCallback } from 'react';
import { fetchAdminAuditoria } from '../../services/api';
import AdminPagination from './AdminPagination';
import { Search, Eye, X, ShieldAlert } from 'lucide-react';

const DEFAULT_PAGE_SIZE = Number(import.meta.env.VITE_ADMIN_PAGE_SIZE || 15);

const TABLAS_AUDITORIA = [
  'APP_USUARIOS',
  'HOJA_RUTA_ITEM_REMITO',
  'REMITO_DEVOLUCIONES',
  'REMITO_DEVOLUCIONES_ITEMS',
  'REMITO_CAJONES',
  'REMITO_CAJONES_ITEMS',
  'REMITOS_FIRMADOS',
  'REMITO'
];

export default function AdminAuditoria() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [tabla, setTabla] = useState('');
  const [operacion, setOperacion] = useState('');
  const [usuario, setUsuario] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState({ page: 1, page_size: DEFAULT_PAGE_SIZE, total: 0, total_pages: 1 });
  const [selectedEvent, setSelectedEvent] = useState(null);

  const loadAuditoria = useCallback(async (overrides = {}) => {
    try {
      setLoading(true);
      setError(null);
      const nextPage = overrides.page !== undefined ? overrides.page : page;
      const nextSize = overrides.pageSize !== undefined ? overrides.pageSize : pageSize;
      const res = await fetchAdminAuditoria({
        tabla: overrides.tabla !== undefined ? overrides.tabla : tabla,
        operacion: overrides.operacion !== undefined ? overrides.operacion : operacion,
        usuario: overrides.usuario !== undefined ? overrides.usuario : usuario,
        page: nextPage,
        page_size: nextSize
      });
      setLogs(res.auditoria || []);
      if (res.pagination) {
        setPagination(res.pagination);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al consultar la tabla de auditoría.');
    } finally {
      setLoading(false);
    }
  }, [tabla, operacion, usuario, page, pageSize]);

  useEffect(() => {
    loadAuditoria();
  }, [loadAuditoria]);

  const formatJson = (raw) => {
    if (!raw) return 'null';
    if (typeof raw === 'object') return JSON.stringify(raw, null, 2);
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return String(raw);
    }
  };

  return (
    <div className="admin-section">
      <form
        className="admin-filter-bar"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          loadAuditoria({ page: 1 });
        }}
      >
        <select value={tabla} onChange={(e) => setTabla(e.target.value)} className="admin-input">
          <option value="">Todas las tablas auditadas</option>
          {TABLAS_AUDITORIA.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select value={operacion} onChange={(e) => setOperacion(e.target.value)} className="admin-input">
          <option value="">Todas las operaciones</option>
          <option value="INSERT">INSERT</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
        </select>

        <div className="admin-input-icon-wrap" style={{ flex: '1 1 220px' }}>
          <Search size={16} />
          <input
            type="text"
            placeholder="Filtrar por usuario app o DB..."
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            className="admin-input"
          />
        </div>

        <button type="submit" className="admin-btn admin-btn-primary">Filtrar</button>
        <button
          type="button"
          className="admin-btn admin-btn-ghost"
          onClick={() => {
            setTabla('');
            setOperacion('');
            setUsuario('');
            setPage(1);
            loadAuditoria({ tabla: '', operacion: '', usuario: '', page: 1 });
          }}
        >
          Limpiar
        </button>
      </form>

      {error && <div className="admin-alert admin-alert-error">{error}</div>}

      <div className="admin-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Fecha y Hora</th>
                <th>Tabla</th>
                <th>Operación</th>
                <th>Registro PK</th>
                <th>Usuario App / Rol</th>
                <th>Usuario MySQL</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="admin-empty-cell">Cargando bitácora de auditoría...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="admin-empty-cell">No se encontraron eventos con esos filtros.</td>
                </tr>
              ) : (
                logs.map((ev) => (
                  <tr key={ev.id_auditoria}>
                    <td>#{ev.id_auditoria}</td>
                    <td>{ev.fecha_hora ? new Date(ev.fecha_hora).toLocaleString('es-AR') : '—'}</td>
                    <td><code>{ev.tabla_nombre}</code></td>
                    <td>
                      <span className={`admin-badge op-${String(ev.operacion || '').toLowerCase()}`}>
                        {ev.operacion}
                      </span>
                    </td>
                    <td><code>{ev.registro_pk || '—'}</code></td>
                    <td>
                      <div>{ev.usuario_app || '—'}</div>
                      <small className="admin-muted-text">{ev.usuario_rol || ''}</small>
                    </td>
                    <td><small className="admin-muted-text">{ev.usuario_db || '—'}</small></td>
                    <td>
                      <button
                        type="button"
                        className="admin-btn admin-btn-sm admin-btn-secondary"
                        onClick={() => setSelectedEvent(ev)}
                      >
                        <Eye size={14} />
                        <span>JSON</span>
                      </button>
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

      {/* Modal JSON */}
      {selectedEvent && (
        <div className="admin-modal-backdrop" onClick={() => setSelectedEvent(null)}>
          <div className="admin-modal admin-modal-xl" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={19} style={{ color: 'var(--dy-red)' }} />
                <div>
                  <h3 style={{ margin: 0 }}>
                    Evento #{selectedEvent.id_auditoria} — {selectedEvent.tabla_nombre} ({selectedEvent.operacion})
                  </h3>
                  <small className="admin-muted-text">
                    PK: {selectedEvent.registro_pk} • Usuario: {selectedEvent.usuario_app || selectedEvent.usuario_db} •{' '}
                    {selectedEvent.fecha_hora ? new Date(selectedEvent.fecha_hora).toLocaleString('es-AR') : ''}
                  </small>
                </div>
              </div>
              <button type="button" className="admin-icon-btn" onClick={() => setSelectedEvent(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="admin-modal-body">
              <div className="admin-json-grid">
                <div>
                  <h4 style={{ margin: '0 0 8px' }}>Datos Anteriores (OLD)</h4>
                  <pre className="admin-json-pre">{formatJson(selectedEvent.datos_anteriores)}</pre>
                </div>
                <div>
                  <h4 style={{ margin: '0 0 8px' }}>Datos Nuevos (NEW)</h4>
                  <pre className="admin-json-pre">{formatJson(selectedEvent.datos_nuevos)}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
