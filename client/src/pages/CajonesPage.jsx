import React, { useState, useEffect, useMemo, useCallback } from 'react';
import HojaRutaHeader from '../components/HojaRutaHeader';
import AlertModal from '../components/AlertModal';
import { fetchCajonesHojaRuta, saveCajonesHojaRuta } from '../services/api';
import {
  cacheCajones,
  getCachedCajones,
  queuePendingControl
} from '../services/offlineStorage';
import { useAuth } from '../config/AuthContext';
import {
  Save,
  RefreshCw,
  Boxes,
  MapPin,
  Plus,
  Minus,
  Inbox,
  X
} from 'lucide-react';

const NON_NEGATIVE_INT_REGEX = /^\d+$/;

/**
 * Módulo 4.2.3: Entrega y Devolución de Cajones (Logística DY - Cajones).
 * Registra cajones entregados, devueltos, diferencia calculada y observaciones.
 */
export default function CajonesPage({ hojaRuta, onChangeHojaRuta }) {
  const { refreshPendingCount } = useAuth();
  const [headerInfo, setHeaderInfo] = useState(hojaRuta);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStop, setNewStop] = useState({ Lugar_de_Entrega: '', Cliente: '' });
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const loadCajones = useCallback(async () => {
    if (!hojaRuta?.Transaccionid) return;
    try {
      setLoading(true);
      setErrorMsg(null);
      let loadedHeader = hojaRuta;
      let loadedItems = [];

      if (navigator.onLine) {
        try {
          const res = await fetchCajonesHojaRuta(hojaRuta.Transaccionid);
          if (res && res.ok) {
            loadedHeader = res.hoja_ruta || hojaRuta;
            loadedItems = res.items || [];
            await cacheCajones(hojaRuta.Transaccionid, {
              hoja_ruta: loadedHeader,
              items: loadedItems
            });
          }
        } catch (apiErr) {
          console.warn('[CajonesPage] Error API, usando caché local:', apiErr.message);
          const cached = await getCachedCajones(hojaRuta.Transaccionid);
          if (cached) {
            loadedHeader = cached.hoja_ruta || hojaRuta;
            loadedItems = cached.items || [];
          } else {
            throw apiErr;
          }
        }
      } else {
        const cached = await getCachedCajones(hojaRuta.Transaccionid);
        if (cached) {
          loadedHeader = cached.hoja_ruta || hojaRuta;
          loadedItems = cached.items || [];
        }
      }

      setHeaderInfo(loadedHeader);
      setItems(
        loadedItems.map((it, idx) => ({
          ...it,
          localKey: `${it.Lugar_de_Entrega}__${it.Cliente || idx}`,
          cajones_entregados: String(it.cajones_entregados ?? 0),
          cajones_devueltos: String(it.cajones_devueltos ?? 0),
          observaciones: it.observaciones || ''
        }))
      );
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message || 'Error al cargar movimiento de cajones.');
    } finally {
      setLoading(false);
    }
  }, [hojaRuta]);

  useEffect(() => {
    loadCajones();
  }, [loadCajones]);

  const handleFieldChange = (localKey, field, value) => {
    if ((field === 'cajones_entregados' || field === 'cajones_devueltos') && value !== '' && !NON_NEGATIVE_INT_REGEX.test(value)) {
      return;
    }

    setItems((prev) =>
      prev.map((it) => (it.localKey === localKey ? { ...it, [field]: value } : it))
    );
  };

  const handleStepCajon = (localKey, field, currentVal, delta) => {
    const rawStr = String(currentVal ?? '').trim();
    const currentNum = NON_NEGATIVE_INT_REGEX.test(rawStr) ? parseInt(rawStr, 10) : 0;
    const nextVal = Math.max(0, currentNum + delta);
    handleFieldChange(localKey, field, String(nextVal));
  };

  const handleFocusSelectAll = (e) => {
    const input = e.target;
    input.select();
    requestAnimationFrame(() => input.select());
  };

  const handleAddStop = (e) => {
    e.preventDefault();
    const lugar = newStop.Lugar_de_Entrega.trim() || 'Entrega en Ruta';
    const cliente = newStop.Cliente.trim();
    if (!cliente) {
      setErrorMsg('Ingrese el nombre del cliente o receptor.');
      return;
    }

    const localKey = `${lugar}__${cliente}__${Date.now()}`;
    setItems((prev) => [
      ...prev,
      {
        localKey,
        Transaccionid: hojaRuta.Transaccionid,
        Lugar_de_Entrega: lugar,
        id_cliente: null,
        Cliente: cliente,
        cajones_entregados: '0',
        cajones_devueltos: '0',
        observaciones: ''
      }
    ]);
    setNewStop({ Lugar_de_Entrega: '', Cliente: '' });
    setShowAddModal(false);
  };

  const totals = useMemo(() => {
    return items.reduce(
      (acc, it) => {
        const ent = parseInt(it.cajones_entregados || '0', 10) || 0;
        const dev = parseInt(it.cajones_devueltos || '0', 10) || 0;
        acc.entregados += ent;
        acc.devueltos += dev;
        acc.diferencia += ent - dev;
        return acc;
      },
      { entregados: 0, devueltos: 0, diferencia: 0 }
    );
  }, [items]);

  const handleGuardar = async () => {
    if (items.length === 0) return;

    const payloadItems = [];
    for (const it of items) {
      const entStr = String(it.cajones_entregados ?? '').trim() || '0';
      const devStr = String(it.cajones_devueltos ?? '').trim() || '0';

      if (!NON_NEGATIVE_INT_REGEX.test(entStr) || !NON_NEGATIVE_INT_REGEX.test(devStr)) {
        setErrorMsg(`Las cantidades de cajones para "${it.Cliente}" deben ser números enteros positivos o cero.`);
        return;
      }

      payloadItems.push({
        Id_etapa: it.Id_etapa || null,
        Lugar_de_Entrega: it.Lugar_de_Entrega,
        id_cliente: it.id_cliente || null,
        Cliente: it.Cliente,
        cajones_entregados: parseInt(entStr, 10),
        cajones_devueltos: parseInt(devStr, 10),
        id_remito_cajones_entrega: it.id_remito_cajones_entrega || null,
        id_remito_cajones_item_entrega: it.id_remito_cajones_item_entrega || null,
        id_remito_cajones_devolucion: it.id_remito_cajones_devolucion || null,
        id_remito_cajones_item_devolucion: it.id_remito_cajones_item_devolucion || null,
        observaciones: it.observaciones || ''
      });
    }

    try {
      setSaving(true);
      setErrorMsg(null);

      if (navigator.onLine) {
        const res = await saveCajonesHojaRuta(hojaRuta.Transaccionid, payloadItems);
        await cacheCajones(hojaRuta.Transaccionid, {
          hoja_ruta: headerInfo,
          items: payloadItems
        });
        setSuccessMsg(res?.message || 'Movimientos de cajones guardados con éxito.');
      } else {
        await queuePendingControl({
          op_type: 'cajones',
          transaccionId: hojaRuta.Transaccionid,
          items: payloadItems
        });
        await cacheCajones(hojaRuta.Transaccionid, {
          hoja_ruta: headerInfo,
          items: payloadItems
        });
        await refreshPendingCount();
        setSuccessMsg('Sin conexión: movimientos de cajones guardados en cola local.');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message || 'No se pudieron guardar los movimientos de cajones.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="module-page page-transition">
      <HojaRutaHeader
        hojaRuta={headerInfo}
        title="Logística DY - Cajones"
        onChangeHojaRuta={onChangeHojaRuta}
      />

      {/* Resumen de Totales de Cajones */}
      {!loading && (
        <div className="cajones-summary-grid">
          <div className="cajon-stat-box">
            <span>Entregados</span>
            <strong>{totals.entregados}</strong>
          </div>
          <div className="cajon-stat-box">
            <span>Devueltos</span>
            <strong>{totals.devueltos}</strong>
          </div>
          <div className={`cajon-stat-box ${totals.diferencia !== 0 ? 'diff' : 'balanced'}`}>
            <span>Diferencia</span>
            <strong>{totals.diferencia > 0 ? `+${totals.diferencia}` : totals.diferencia}</strong>
          </div>
        </div>
      )}

      {loading ? (
        <div className="hr-empty-state">
          <RefreshCw size={30} className="spin" style={{ color: 'var(--dy-blue)' }} />
          <p>Cargando paradas y saldos de cajones...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="hr-empty-state">
          <Inbox size={42} style={{ color: 'var(--text-muted)' }} />
          <h3>Sin clientes registrados</h3>
          <p>Agrega un cliente para registrar entrega y devolución de cajones.</p>
          <button
            type="button"
            className="dev-add-btn"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={16} />
            <span>Agregar Parada / Cliente</span>
          </button>
        </div>
      ) : (
        <div className="cajones-list">
          {items.map((it) => {
            const ent = parseInt(it.cajones_entregados || '0', 10) || 0;
            const dev = parseInt(it.cajones_devueltos || '0', 10) || 0;
            const diff = ent - dev;

            return (
              <div key={it.localKey} className="cajon-card">
                <div className="cajon-card-header">
                  <div>
                    <div className="cajon-client-name">{it.Cliente}</div>
                    <div className="cajon-lugar-sub">
                      <MapPin size={12} />
                      <span>{it.Lugar_de_Entrega}</span>
                    </div>
                  </div>
                  <span className={`cajon-diff-badge ${diff === 0 ? 'zero' : diff > 0 ? 'pos' : 'neg'}`}>
                    Dif: {diff > 0 ? `+${diff}` : diff}
                  </span>
                </div>

                <div className="cajon-inputs-row">
                  <div className="cajon-input-box">
                    <label>Entregados</label>
                    <div className="entregado-stepper cajon-qty-stepper">
                      <button
                        type="button"
                        className="entregado-step-btn"
                        aria-label={`Disminuir cajones entregados de ${it.Cliente}`}
                        disabled={ent <= 0 && it.cajones_entregados !== ''}
                        onClick={() => handleStepCajon(it.localKey, 'cajones_entregados', it.cajones_entregados, -1)}
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        className="entregado-input"
                        value={it.cajones_entregados}
                        onFocus={handleFocusSelectAll}
                        onKeyDown={(e) => {
                          if (['-', '+', '.', ',', 'e', 'E'].includes(e.key)) e.preventDefault();
                        }}
                        onChange={(e) => handleFieldChange(it.localKey, 'cajones_entregados', e.target.value)}
                      />
                      <button
                        type="button"
                        className="entregado-step-btn"
                        aria-label={`Incrementar cajones entregados de ${it.Cliente}`}
                        onClick={() => handleStepCajon(it.localKey, 'cajones_entregados', it.cajones_entregados, 1)}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="cajon-input-box">
                    <label>Devueltos</label>
                    <div className="entregado-stepper cajon-qty-stepper">
                      <button
                        type="button"
                        className="entregado-step-btn"
                        aria-label={`Disminuir cajones devueltos de ${it.Cliente}`}
                        disabled={dev <= 0 && it.cajones_devueltos !== ''}
                        onClick={() => handleStepCajon(it.localKey, 'cajones_devueltos', it.cajones_devueltos, -1)}
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        className="entregado-input"
                        value={it.cajones_devueltos}
                        onFocus={handleFocusSelectAll}
                        onKeyDown={(e) => {
                          if (['-', '+', '.', ',', 'e', 'E'].includes(e.key)) e.preventDefault();
                        }}
                        onChange={(e) => handleFieldChange(it.localKey, 'cajones_devueltos', e.target.value)}
                      />
                      <button
                        type="button"
                        className="entregado-step-btn"
                        aria-label={`Incrementar cajones devueltos de ${it.Cliente}`}
                        onClick={() => handleStepCajon(it.localKey, 'cajones_devueltos', it.cajones_devueltos, 1)}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                <input
                  type="text"
                  className="cajon-obs-input"
                  placeholder="Observaciones o diferencias detectadas..."
                  value={it.observaciones}
                  onChange={(e) => handleFieldChange(it.localKey, 'observaciones', e.target.value)}
                />
              </div>
            );
          })}

          <button
            type="button"
            className="dev-add-btn"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={16} />
            <span>Agregar otro cliente / parada</span>
          </button>

          <div className="module-save-footer">
            <button
              type="button"
              className="module-save-btn cajones"
              onClick={handleGuardar}
              disabled={saving}
            >
              {saving ? (
                <>
                  <RefreshCw size={19} className="spin" />
                  <span>Guardando cajones...</span>
                </>
              ) : (
                <>
                  <Save size={19} />
                  <span>Guardar</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div
            className="modal-card glass"
            style={{ textAlign: 'left', alignItems: 'stretch', padding: '18px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Boxes size={20} style={{ color: 'var(--dy-blue)' }} />
                <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text)' }}>
                  Agregar Parada / Cliente
                </h3>
              </div>
              <button
                type="button"
                className="mode-toggle"
                style={{ width: 32, height: 32 }}
                onClick={() => setShowAddModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddStop} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="login-field-group">
                <label className="login-field-label">Lugar de Entrega</label>
                <input
                  type="text"
                  className="login-input"
                  style={{ paddingLeft: 12 }}
                  placeholder="Ej. Zona Sur - Mercado Central"
                  value={newStop.Lugar_de_Entrega}
                  onChange={(e) => setNewStop((prev) => ({ ...prev, Lugar_de_Entrega: e.target.value }))}
                />
              </div>

              <div className="login-field-group">
                <label className="login-field-label">Cliente</label>
                <input
                  type="text"
                  className="login-input"
                  style={{ paddingLeft: 12 }}
                  placeholder="Nombre del cliente"
                  value={newStop.Cliente}
                  onChange={(e) => setNewStop((prev) => ({ ...prev, Cliente: e.target.value }))}
                />
              </div>

              <button type="submit" className="btn-login-primary" style={{ marginTop: 4 }}>
                Agregar a la Lista
              </button>
            </form>
          </div>
        </div>
      )}

      <AlertModal
        isOpen={Boolean(errorMsg)}
        onClose={() => setErrorMsg(null)}
        type="error"
        title="Validación de Cajones"
        message={errorMsg}
        confirmText="Corregir"
      />

      <AlertModal
        isOpen={Boolean(successMsg)}
        onClose={() => setSuccessMsg(null)}
        type="success"
        title="Cajones Registrados"
        message={successMsg}
        confirmText="Aceptar"
      />
    </div>
  );
}
