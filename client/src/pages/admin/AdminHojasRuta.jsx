import React, { useState, useEffect, useCallback } from 'react';
import { fetchAdminHojasRuta, fetchAdminHojaRutaDetalle } from '../../services/api';
import { Search, RefreshCw, Eye, X, Truck, CheckCircle2, RotateCcw, Package } from 'lucide-react';

export default function AdminHojasRuta({ initialTransaccionId, onClearInitialTransaccion }) {
  const [hojasRuta, setHojasRuta] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [q, setQ] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [estadoDescarga, setEstadoDescarga] = useState('');

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState('entregas');

  const loadList = useCallback(async (overrides = {}) => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        q: overrides.q !== undefined ? overrides.q : q,
        fecha_desde: overrides.fecha_desde !== undefined ? overrides.fecha_desde : fechaDesde,
        fecha_hasta: overrides.fecha_hasta !== undefined ? overrides.fecha_hasta : fechaHasta,
        estado_descarga: overrides.estado_descarga !== undefined ? overrides.estado_descarga : estadoDescarga,
        limit: 150
      };
      const res = await fetchAdminHojasRuta(params);
      setHojasRuta(res.hojas_ruta || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar hojas de ruta.');
    } finally {
      setLoading(false);
    }
  }, [q, fechaDesde, fechaHasta, estadoDescarga]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const openDetail = useCallback(async (transaccionId) => {
    try {
      setDetailLoading(true);
      setDetailTab('entregas');
      const res = await fetchAdminHojaRutaDetalle(transaccionId);
      setDetail(res);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cargar el detalle de la hoja de ruta.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialTransaccionId) {
      openDetail(initialTransaccionId);
      if (onClearInitialTransaccion) onClearInitialTransaccion();
    }
  }, [initialTransaccionId, openDetail, onClearInitialTransaccion]);

  const handleSubmit = (e) => {
    e.preventDefault();
    loadList();
  };

  const handleReset = () => {
    setQ('');
    setFechaDesde('');
    setFechaHasta('');
    setEstadoDescarga('');
    loadList({ q: '', fecha_desde: '', fecha_hasta: '', estado_descarga: '' });
  };

  return (
    <div className="admin-section">
      <div className="admin-section-toolbar">
        <div>
          <h2 className="admin-section-heading">Seguimiento de Hojas de Ruta</h2>
          <p className="admin-section-desc">
            Estado de avance en descargas, devoluciones y cajones por hoja de ruta (excluye firma de remitos).
          </p>
        </div>
        <button type="button" className="admin-btn admin-btn-secondary" onClick={() => loadList()} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          <span>Actualizar</span>
        </button>
      </div>

      <form className="admin-filter-bar" onSubmit={handleSubmit}>
        <div className="admin-input-icon-wrap" style={{ flex: '1 1 240px' }}>
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar por Hoja de Ruta, viaje, chofer o patente..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="admin-input"
          />
        </div>
        <input
          type="date"
          value={fechaDesde}
          onChange={(e) => setFechaDesde(e.target.value)}
          className="admin-input"
          title="Fecha desde"
        />
        <input
          type="date"
          value={fechaHasta}
          onChange={(e) => setFechaHasta(e.target.value)}
          className="admin-input"
          title="Fecha hasta"
        />
        <select
          value={estadoDescarga}
          onChange={(e) => setEstadoDescarga(e.target.value)}
          className="admin-input"
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente (0%)</option>
          <option value="parcial">Parcial (En curso)</option>
          <option value="completa">Completa (100%)</option>
        </select>
        <button type="submit" className="admin-btn admin-btn-primary">
          Filtrar
        </button>
        <button type="button" className="admin-btn admin-btn-ghost" onClick={handleReset}>
          Limpiar
        </button>
      </form>

      {error && <div className="admin-alert admin-alert-error">{error}</div>}

      <div className="admin-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Hoja de Ruta</th>
                <th>Fecha</th>
                <th>Viaje</th>
                <th>Chofer / Transporte</th>
                <th>Vehículo</th>
                <th>Paradas</th>
                <th>Confirmados</th>
                <th>Diferencias</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="admin-empty-cell">Cargando hojas de ruta...</td>
                </tr>
              ) : hojasRuta.length === 0 ? (
                <tr>
                  <td colSpan={9} className="admin-empty-cell">No se encontraron hojas de ruta con esos filtros.</td>
                </tr>
              ) : (
                hojasRuta.map((hr) => {
                  const total = Number(hr.total_items || 0);
                  const conf = Number(hr.items_confirmados || 0);
                  const pct = total > 0 ? Math.round((conf / total) * 100) : 0;
                  return (
                    <tr key={hr.Transaccionid}>
                      <td>
                        <strong>{hr.Hoja_de_ruta}</strong>
                        <div className="admin-muted-text" style={{ fontSize: '0.75rem' }}>
                          Tx #{hr.Transaccionid}
                        </div>
                      </td>
                      <td>{hr.Fecha ? String(hr.Fecha).slice(0, 10) : '—'}</td>
                      <td>{hr.Viaje || '—'}</td>
                      <td>
                        <div>{hr.Chofer || 'Sin asignar'}</div>
                        <small className="admin-muted-text">{hr.Transporte || ''}</small>
                      </td>
                      <td>
                        {[hr.Patente_camion, hr.Patente_acoplado].filter(Boolean).join(' / ') || '—'}
                      </td>
                      <td>{hr.total_paradas}</td>
                      <td>
                        <span className={`admin-badge ${pct === 100 ? 'admin-badge-green' : pct > 0 ? 'admin-badge-blue' : 'admin-badge-gray'}`}>
                          {conf}/{total} ({pct}%)
                        </span>
                      </td>
                      <td>
                        {Number(hr.items_con_diferencia || 0) > 0 ? (
                          <span className="admin-badge admin-badge-amber">{hr.items_con_diferencia}</span>
                        ) : (
                          '0'
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="admin-btn admin-btn-sm admin-btn-secondary"
                          onClick={() => openDetail(hr.Transaccionid)}
                        >
                          <Eye size={15} />
                          <span>Detalle</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalle */}
      {(detail || detailLoading) && (
        <div className="admin-modal-backdrop" onClick={() => setDetail(null)}>
          <div className="admin-modal admin-modal-xl" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Truck size={20} style={{ color: 'var(--dy-blue)' }} />
                <div>
                  <h3 style={{ margin: 0 }}>
                    {detail?.hoja_ruta ? `Hoja de Ruta ${detail.hoja_ruta.Hoja_de_ruta}` : 'Cargando detalle...'}
                  </h3>
                  {detail?.hoja_ruta && (
                    <small className="admin-muted-text">
                      Chofer: {detail.hoja_ruta.Chofer || 'Sin asignar'} • Viaje: {detail.hoja_ruta.Viaje || '—'} • Fecha:{' '}
                      {detail.hoja_ruta.Fecha ? String(detail.hoja_ruta.Fecha).slice(0, 10) : '—'}
                    </small>
                  )}
                </div>
              </div>
              <button type="button" className="admin-icon-btn" onClick={() => setDetail(null)}>
                <X size={20} />
              </button>
            </div>

            {detailLoading ? (
              <div className="admin-modal-body" style={{ padding: '40px', textAlign: 'center' }}>
                Cargando seguimiento completo...
              </div>
            ) : (
              <>
                <div className="admin-tabs">
                  <button
                    type="button"
                    className={`admin-tab ${detailTab === 'entregas' ? 'active' : ''}`}
                    onClick={() => setDetailTab('entregas')}
                  >
                    <CheckCircle2 size={16} />
                    <span>Entregas ({detail?.entregas?.length || 0})</span>
                  </button>
                  <button
                    type="button"
                    className={`admin-tab ${detailTab === 'devoluciones' ? 'active' : ''}`}
                    onClick={() => setDetailTab('devoluciones')}
                  >
                    <RotateCcw size={16} />
                    <span>Devoluciones ({detail?.devoluciones?.length || 0})</span>
                  </button>
                  <button
                    type="button"
                    className={`admin-tab ${detailTab === 'cajones' ? 'active' : ''}`}
                    onClick={() => setDetailTab('cajones')}
                  >
                    <Package size={16} />
                    <span>Cajones ({detail?.cajones?.length || 0})</span>
                  </button>
                </div>

                <div className="admin-modal-body">
                  {detailTab === 'entregas' && (
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Lugar de Entrega / Cliente</th>
                            <th>Remito</th>
                            <th>Producto</th>
                            <th>Remitido</th>
                            <th>Entregado</th>
                            <th>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(detail?.entregas || []).length === 0 ? (
                            <tr>
                              <td colSpan={6} className="admin-empty-cell">Sin ítems de entrega.</td>
                            </tr>
                          ) : (
                            detail.entregas.map((item) => {
                              const confirmado = item.Entregado !== null && item.Entregado !== undefined;
                              const diff = confirmado && Number(item.Entregado) !== Number(item.Remitido);
                              return (
                                <tr key={item.Hojarutaitemid}>
                                  <td>
                                    <div>{item.Lugar_de_Entrega || '—'}</div>
                                    <small className="admin-muted-text">{item.Cliente || ''}</small>
                                  </td>
                                  <td>{item.Remito || '—'}</td>
                                  <td>{item.Producto || '—'}</td>
                                  <td>{item.Remitido}</td>
                                  <td>
                                    <strong>{confirmado ? item.Entregado : '—'}</strong>
                                  </td>
                                  <td>
                                    {!confirmado ? (
                                      <span className="admin-badge admin-badge-gray">Pendiente</span>
                                    ) : diff ? (
                                      <span className="admin-badge admin-badge-amber">Con diferencia</span>
                                    ) : (
                                      <span className="admin-badge admin-badge-green">Confirmada</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {detailTab === 'devoluciones' && (
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Lugar / Cliente</th>
                            <th>Producto</th>
                            <th>Cantidad</th>
                            <th>Vencimiento</th>
                            <th>Motivo</th>
                            <th>Tipo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(detail?.devoluciones || []).length === 0 ? (
                            <tr>
                              <td colSpan={6} className="admin-empty-cell">
                                No hay devoluciones registradas para esta hoja de ruta.
                              </td>
                            </tr>
                          ) : (
                            detail.devoluciones.map((d) => (
                              <tr key={d.id_remito_devoluciones_item}>
                                <td>
                                  <div>{d.Cliente || '—'}</div>
                                  <small className="admin-muted-text">{d.Lugar_de_Entrega || ''}</small>
                                </td>
                                <td>{d.Producto || '—'}</td>
                                <td><strong>{d.Cantidad}</strong></td>
                                <td>{d.Vencimiento ? String(d.Vencimiento).slice(0, 10) : '—'}</td>
                                <td>{d.Motivo || '—'}</td>
                                <td>
                                  <span className="admin-badge admin-badge-blue">{d.Tipo || 'Físico'}</span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {detailTab === 'cajones' && (
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Lugar de Entrega / Cliente</th>
                            <th>Entregados</th>
                            <th>Devueltos</th>
                            <th>Diferencia</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(detail?.cajones || []).length === 0 ? (
                            <tr>
                              <td colSpan={4} className="admin-empty-cell">No hay movimientos de cajones registrados.</td>
                            </tr>
                          ) : (
                            detail.cajones.map((c, idx) => (
                              <tr key={`${c.Cliente || 'cli'}-${idx}`}>
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
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
