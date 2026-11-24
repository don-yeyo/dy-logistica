import React, { useState, useEffect, useCallback } from 'react';
import { fetchAdminDashboard } from '../../services/api';
import {
  Truck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Package,
  Users,
  RefreshCw,
  ArrowRight,
  FileSpreadsheet,
  ShieldAlert
} from 'lucide-react';

export default function AdminDashboard({ user, onOpenHojaRuta, onNavigateTab }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchAdminDashboard();
      setData(res);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudieron cargar las métricas del dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const kpis = data?.kpis || {};
  const ultimasHr = data?.ultimas_hojas_ruta || [];
  const ultimosAudit = data?.ultimos_eventos_auditoria || [];

  const totalItems = Number(kpis.total_items || 0);
  const itemsConfirmados = Number(kpis.items_confirmados || 0);
  const pctConfirmado = totalItems > 0 ? Math.round((itemsConfirmados / totalItems) * 100) : 0;

  return (
    <div className="admin-section">
      <div className="admin-section-toolbar">
        <div>
          <h2 className="admin-section-heading">Resumen Operativo</h2>
          <p className="admin-section-desc">
            Monitoreo consolidado de hojas de ruta activas, entregas, devoluciones y cajones.
          </p>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          onClick={loadDashboard}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          <span>Actualizar</span>
        </button>
      </div>

      {error && <div className="admin-alert admin-alert-error">{error}</div>}

      {/* KPIs Principales */}
      <div className="admin-kpi-grid">
        <div className="admin-kpi-card" onClick={() => onNavigateTab('hojas_ruta')} role="button" tabIndex={0}>
          <div className="admin-kpi-icon kpi-blue">
            <Truck size={22} />
          </div>
          <div className="admin-kpi-body">
            <span className="admin-kpi-label">Hojas de Ruta Activas</span>
            <strong className="admin-kpi-value">{kpis.total_hojas_ruta_activas ?? '—'}</strong>
            <span className="admin-kpi-foot">{totalItems} ítems totales en reparto</span>
          </div>
        </div>

        <div className="admin-kpi-card" onClick={() => onNavigateTab('hojas_ruta')} role="button" tabIndex={0}>
          <div className="admin-kpi-icon kpi-green">
            <CheckCircle2 size={22} />
          </div>
          <div className="admin-kpi-body">
            <span className="admin-kpi-label">Entregas Confirmadas</span>
            <strong className="admin-kpi-value">{pctConfirmado}%</strong>
            <span className="admin-kpi-foot">
              {itemsConfirmados} de {totalItems} ítems • {Number(kpis.total_unidades_entregadas || 0).toLocaleString('es-AR')} un.
            </span>
          </div>
        </div>

        <div className="admin-kpi-card" onClick={() => onNavigateTab('devoluciones')} role="button" tabIndex={0}>
          <div className="admin-kpi-icon kpi-amber">
            <AlertTriangle size={22} />
          </div>
          <div className="admin-kpi-body">
            <span className="admin-kpi-label">Diferencias / Faltantes</span>
            <strong className="admin-kpi-value">{kpis.items_con_diferencia ?? 0}</strong>
            <span className="admin-kpi-foot">Ítems con entrega menor a lo remitido</span>
          </div>
        </div>

        <div className="admin-kpi-card" onClick={() => onNavigateTab('devoluciones')} role="button" tabIndex={0}>
          <div className="admin-kpi-icon kpi-red">
            <RotateCcw size={22} />
          </div>
          <div className="admin-kpi-body">
            <span className="admin-kpi-label">Devoluciones</span>
            <strong className="admin-kpi-value">{kpis.total_devoluciones_cabeceras ?? 0}</strong>
            <span className="admin-kpi-foot">
              {kpis.total_devoluciones_items ?? 0} líneas • {Number(kpis.total_unidades_devueltas || 0).toLocaleString('es-AR')} un.
            </span>
          </div>
        </div>

        <div className="admin-kpi-card" onClick={() => onNavigateTab('cajones')} role="button" tabIndex={0}>
          <div className="admin-kpi-icon kpi-indigo">
            <Package size={22} />
          </div>
          <div className="admin-kpi-body">
            <span className="admin-kpi-label">Balance de Cajones</span>
            <strong className="admin-kpi-value">
              {Number(kpis.cajones_diferencia || 0) > 0 ? `+${kpis.cajones_diferencia}` : (kpis.cajones_diferencia ?? 0)}
            </strong>
            <span className="admin-kpi-foot">
              Ent: {kpis.cajones_entregados ?? 0} | Dev: {kpis.cajones_devueltos ?? 0}
            </span>
          </div>
        </div>

        <div className="admin-kpi-card" onClick={() => onNavigateTab('usuarios')} role="button" tabIndex={0}>
          <div className="admin-kpi-icon kpi-slate">
            <Users size={22} />
          </div>
          <div className="admin-kpi-body">
            <span className="admin-kpi-label">Usuarios Activos</span>
            <strong className="admin-kpi-value">
              {(kpis.usuarios_por_rol?.sysadmin || 0) +
                (kpis.usuarios_por_rol?.logistica || 0) +
                (kpis.usuarios_por_rol?.chofer || 0)}
            </strong>
            <span className="admin-kpi-foot">
              {kpis.usuarios_por_rol?.chofer || 0} choferes • {kpis.usuarios_por_rol?.logistica || 0} logística • {kpis.usuarios_por_rol?.sysadmin || 0} sysadmin
            </span>
          </div>
        </div>
      </div>

      {/* Progreso general & Roadmap Notas de Crédito */}
      <div className="admin-two-col">
        <div className="admin-card">
          <div className="admin-card-header">
            <h3>Avance Global de Descargas</h3>
            <span className="admin-badge admin-badge-blue">{pctConfirmado}% completado</span>
          </div>
          <div className="admin-progress-track">
            <div className="admin-progress-fill" style={{ width: `${pctConfirmado}%` }} />
          </div>
          <div className="admin-progress-stats">
            <div>
              <span>Unidades Remitidas</span>
              <strong>{Number(kpis.total_unidades_remitidas || 0).toLocaleString('es-AR')}</strong>
            </div>
            <div>
              <span>Unidades Entregadas</span>
              <strong>{Number(kpis.total_unidades_entregadas || 0).toLocaleString('es-AR')}</strong>
            </div>
            <div>
              <span>Unidades Devueltas</span>
              <strong>{Number(kpis.total_unidades_devueltas || 0).toLocaleString('es-AR')}</strong>
            </div>
          </div>
        </div>

        <div className="admin-card admin-card-highlight">
          <div className="admin-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileSpreadsheet size={20} style={{ color: 'var(--dy-blue)' }} />
              <h3>Solicitudes de Notas de Crédito (Próximo Módulo)</h3>
            </div>
            <span className="admin-badge admin-badge-amber">En preparación</span>
          </div>
          <p className="admin-muted-text" style={{ margin: '8px 0 14px' }}>
            Las devoluciones y faltantes confirmados desde la app de choferes ya quedan consolidados en la pestaña{' '}
            <strong>Devoluciones &amp; Faltantes</strong> para su futura emisión de solicitudes de Notas de Crédito desde Logística.
          </p>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={() => onNavigateTab('devoluciones')}
          >
            <span>Revisar Devoluciones y Faltantes</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Últimas Hojas de Ruta */}
      <div className="admin-card">
        <div className="admin-card-header">
          <h3>Últimas Hojas de Ruta a Entregar</h3>
          <button
            type="button"
            className="admin-link-btn"
            onClick={() => onNavigateTab('hojas_ruta')}
          >
            Ver todas <ArrowRight size={15} />
          </button>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Hoja de Ruta</th>
                <th>Fecha</th>
                <th>Viaje</th>
                <th>Chofer / Transporte</th>
                <th>Paradas</th>
                <th>Avance</th>
                <th>Diferencias</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ultimasHr.length === 0 ? (
                <tr>
                  <td colSpan={8} className="admin-empty-cell">
                    No hay hojas de ruta activas en este momento.
                  </td>
                </tr>
              ) : (
                ultimasHr.map((hr) => {
                  const pct = hr.total_items > 0
                    ? Math.round((Number(hr.items_confirmados || 0) / Number(hr.total_items)) * 100)
                    : 0;
                  return (
                    <tr key={hr.Transaccionid}>
                      <td><strong>{hr.Hoja_de_ruta}</strong></td>
                      <td>{hr.Fecha ? String(hr.Fecha).slice(0, 10) : '—'}</td>
                      <td>{hr.Viaje || '—'}</td>
                      <td>
                        <div>{hr.Chofer || 'Sin asignar'}</div>
                        <small className="admin-muted-text">{hr.Transporte || ''}</small>
                      </td>
                      <td>{hr.total_paradas}</td>
                      <td>
                        <span className={`admin-badge ${pct === 100 ? 'admin-badge-green' : pct > 0 ? 'admin-badge-blue' : 'admin-badge-gray'}`}>
                          {hr.items_confirmados}/{hr.total_items} ({pct}%)
                        </span>
                      </td>
                      <td>
                        {Number(hr.items_con_diferencia || 0) > 0 ? (
                          <span className="admin-badge admin-badge-amber">{hr.items_con_diferencia} dif.</span>
                        ) : (
                          <span className="admin-muted-text">0</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="admin-btn admin-btn-sm admin-btn-secondary"
                          onClick={() => onOpenHojaRuta(hr.Transaccionid)}
                        >
                          Seguimiento
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

      {/* Últimos eventos de auditoría (solo sysadmin) */}
      {user?.rol === 'sysadmin' && (
        <div className="admin-card">
          <div className="admin-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={18} style={{ color: 'var(--dy-red)' }} />
              <h3>Actividad Reciente de Auditoría (Triggers DB)</h3>
            </div>
            <button
              type="button"
              className="admin-link-btn"
              onClick={() => onNavigateTab('auditoria')}
            >
              Ver bitácora completa <ArrowRight size={15} />
            </button>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Fecha/Hora</th>
                  <th>Tabla</th>
                  <th>Operación</th>
                  <th>PK</th>
                  <th>Usuario App</th>
                  <th>Rol</th>
                </tr>
              </thead>
              <tbody>
                {ultimosAudit.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="admin-empty-cell">
                      Aún no se registran eventos en la tabla AUDITORIA.
                    </td>
                  </tr>
                ) : (
                  ultimosAudit.map((ev) => (
                    <tr key={ev.id_auditoria}>
                      <td>#{ev.id_auditoria}</td>
                      <td>{ev.fecha_hora ? new Date(ev.fecha_hora).toLocaleString('es-AR') : '—'}</td>
                      <td><code>{ev.tabla_nombre}</code></td>
                      <td>
                        <span className={`admin-badge op-${String(ev.operacion || '').toLowerCase()}`}>
                          {ev.operacion}
                        </span>
                      </td>
                      <td><code>{ev.registro_pk}</code></td>
                      <td>{ev.usuario_app || ev.usuario_db || '—'}</td>
                      <td>{ev.usuario_rol || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
