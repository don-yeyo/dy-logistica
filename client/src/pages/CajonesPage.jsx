import React, { useState, useEffect, useMemo, useCallback } from 'react';
import HojaRutaHeader from '../components/HojaRutaHeader';
import AlertModal from '../components/AlertModal';
import { fetchCajonesHojaRuta } from '../services/api';
import { cacheCajones, getCachedCajones } from '../services/offlineStorage';
import { getHojaRutaDraft, patchSectionDraft } from '../services/draftStorage';
import { useAuth } from '../config/AuthContext';
import {
  RefreshCw,
  Boxes,
  MapPin,
  Plus,
  Minus,
  Inbox,
  UserPlus,
  Search,
  X
} from 'lucide-react';

const NON_NEGATIVE_INT_REGEX = /^\d+$/;

/**
 * Módulo 4.2.3: Cajones y Pallets filtrados por el Lugar de Entrega seleccionado.
 */
export default function CajonesPage({ hojaRuta, selectedLugar, onChangeLugar }) {
  const { user } = useAuth();
  const [headerInfo, setHeaderInfo] = useState(hojaRuta);
  const [items, setItems] = useState([]);
  const [clientesCatalogo, setClientesCatalogo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [manualCliente, setManualCliente] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);

  const loadCajones = useCallback(async () => {
    if (!hojaRuta?.Transaccionid || !selectedLugar) return;
    try {
      setLoading(true);
      setErrorMsg(null);
      let loadedHeader = hojaRuta;
      let loadedItems = [];
      let loadedCatalog = [];

      if (navigator.onLine) {
        try {
          const res = await fetchCajonesHojaRuta(hojaRuta.Transaccionid, selectedLugar);
          if (res && res.ok) {
            loadedHeader = res.hoja_ruta || hojaRuta;
            loadedItems = res.items || [];
            loadedCatalog = res.clientes_catalogo || [];
            await cacheCajones(
              hojaRuta.Transaccionid,
              {
                hoja_ruta: loadedHeader,
                lugar: selectedLugar,
                items: loadedItems,
                clientes_catalogo: loadedCatalog
              },
              selectedLugar
            );
          }
        } catch (apiErr) {
          console.warn('[CajonesPage] Error API, usando caché local:', apiErr.message);
          const cached = await getCachedCajones(hojaRuta.Transaccionid, selectedLugar);
          if (cached) {
            loadedHeader = cached.hoja_ruta || hojaRuta;
            loadedItems = cached.items || [];
            loadedCatalog = cached.clientes_catalogo || [];
          } else {
            throw apiErr;
          }
        }
      } else {
        const cached = await getCachedCajones(hojaRuta.Transaccionid, selectedLugar);
        if (cached) {
          loadedHeader = cached.hoja_ruta || hojaRuta;
          loadedItems = cached.items || [];
          loadedCatalog = cached.clientes_catalogo || [];
        }
      }

      setHeaderInfo(loadedHeader);
      setClientesCatalogo(loadedCatalog);

      const baseItems = loadedItems.map((it, idx) => ({
        ...it,
        Lugar_de_Entrega: it.Lugar_de_Entrega || selectedLugar,
        localKey: `${it.Id_etapa || idx}__${it.Cliente || idx}`,
        cajones_entregados: String(it.cajones_entregados ?? 0),
        cajones_devueltos: String(it.cajones_devueltos ?? 0),
        pallets_entregados: String(it.pallets_entregados ?? 0),
        pallets_devueltos: String(it.pallets_devueltos ?? 0),
        observaciones: it.observaciones || ''
      }));

      const draft = getHojaRutaDraft(user?.email, hojaRuta.Transaccionid, selectedLugar).cajones;
      if (draft?.dirty && Array.isArray(draft.items)) {
        setItems(draft.items);
      } else {
        setItems(baseItems);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message || 'Error al cargar cajones y pallets.');
    } finally {
      setLoading(false);
    }
  }, [hojaRuta, selectedLugar, user?.email]);

  useEffect(() => {
    loadCajones();
  }, [loadCajones]);

  useEffect(() => {
    const onExternalSaved = (e) => {
      const sameTx = Number(e.detail?.transaccionId) === Number(hojaRuta?.Transaccionid);
      const sameLugar =
        !e.detail?.lugar ||
        String(e.detail.lugar).trim().toLowerCase() === String(selectedLugar || '').trim().toLowerCase();
      if (sameTx && sameLugar && Array.isArray(e.detail?.sections) && e.detail.sections.includes('cajones')) {
        loadCajones();
      }
    };
    window.addEventListener('dy-draft-saved', onExternalSaved);
    return () => window.removeEventListener('dy-draft-saved', onExternalSaved);
  }, [hojaRuta?.Transaccionid, selectedLugar, loadCajones]);

  const persistCajonesDraft = (nextItems) => {
    patchSectionDraft(
      user?.email,
      hojaRuta?.Transaccionid,
      'cajones',
      {
        lugar: selectedLugar,
        items: nextItems,
        headerInfo,
        clientesCatalogo,
        dirty: true,
        dirtySince: Date.now()
      },
      selectedLugar
    );
  };

  const handleFieldChange = (localKey, field, value) => {
    const numericFields = [
      'cajones_entregados',
      'cajones_devueltos',
      'pallets_entregados',
      'pallets_devueltos'
    ];
    if (numericFields.includes(field) && value !== '' && !NON_NEGATIVE_INT_REGEX.test(value)) {
      return;
    }

    setItems((prev) => {
      const next = prev.map((it) => (it.localKey === localKey ? { ...it, [field]: value } : it));
      persistCajonesDraft(next);
      return next;
    });
  };

  const handleStep = (localKey, field, currentVal, delta) => {
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

  const appendClientItem = ({ id_cliente = null, Cliente }) => {
    const cleanName = String(Cliente || '').trim();
    if (!cleanName) {
      setErrorMsg('Ingrese o seleccione el nombre del cliente.');
      return;
    }

    const already = items.some(
      (it) =>
        (id_cliente && Number(it.id_cliente) === Number(id_cliente)) ||
        String(it.Cliente || '').trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (already) {
      setShowAddModal(false);
      setClientSearch('');
      setManualCliente('');
      return;
    }

    const localKey = `${selectedLugar}__${cleanName}__${Date.now()}`;
    setItems((prev) => {
      const next = [
        ...prev,
        {
          localKey,
          Transaccionid: hojaRuta.Transaccionid,
          Id_etapa: id_cliente ? `MANUAL-${id_cliente}` : null,
          Lugar_de_Entrega: selectedLugar,
          id_cliente,
          Cliente: cleanName,
          cajones_entregados: '0',
          cajones_devueltos: '0',
          pallets_entregados: '0',
          pallets_devueltos: '0',
          observaciones: ''
        }
      ];
      persistCajonesDraft(next);
      return next;
    });
    setClientSearch('');
    setManualCliente('');
    setShowAddModal(false);
  };

  const totals = useMemo(() => {
    return items.reduce(
      (acc, it) => {
        const cEnt = parseInt(it.cajones_entregados || '0', 10) || 0;
        const cDev = parseInt(it.cajones_devueltos || '0', 10) || 0;
        const pEnt = parseInt(it.pallets_entregados || '0', 10) || 0;
        const pDev = parseInt(it.pallets_devueltos || '0', 10) || 0;
        acc.cajEnt += cEnt;
        acc.cajDev += cDev;
        acc.cajDif += cEnt - cDev;
        acc.palEnt += pEnt;
        acc.palDev += pDev;
        acc.palDif += pEnt - pDev;
        return acc;
      },
      { cajEnt: 0, cajDev: 0, cajDif: 0, palEnt: 0, palDev: 0, palDif: 0 }
    );
  }, [items]);

  const filteredCatalog = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clientesCatalogo;
    return clientesCatalogo.filter(
      (c) =>
        String(c.nombre || '').toLowerCase().includes(q) ||
        String(c.id_cliente || '').includes(q) ||
        String(c.codigo || '').toLowerCase().includes(q)
    );
  }, [clientesCatalogo, clientSearch]);

  return (
    <div className="module-page page-transition">
      <HojaRutaHeader
        hojaRuta={headerInfo}
        selectedLugar={selectedLugar}
        onChangeLugar={onChangeLugar}
      />

      {!loading && items.length > 1 && (
        <div className="cajones-pallets-summary">
          <div className="cp-summary-header">
            <Boxes size={15} />
            <span>Resumen del lugar · {items.length} clientes</span>
          </div>

          <div className="cp-summary-block">
            <div className="cp-summary-label">
              <span className="cp-dot cajon" />
              Cajones
            </div>
            <div className="cajones-summary-grid">
              <div className="cajon-sum-card">
                <span>Entregados</span>
                <strong>{totals.cajEnt}</strong>
              </div>
              <div className="cajon-sum-card">
                <span>Devueltos</span>
                <strong>{totals.cajDev}</strong>
              </div>
              <div className={`cajon-sum-card accent ${totals.cajDif === 0 ? 'zero' : totals.cajDif > 0 ? 'pos' : 'neg'}`}>
                <span>Diferencia</span>
                <strong>{totals.cajDif > 0 ? `+${totals.cajDif}` : totals.cajDif}</strong>
              </div>
            </div>
          </div>

          <div className="cp-summary-block">
            <div className="cp-summary-label">
              <span className="cp-dot pallet" />
              Pallets
            </div>
            <div className="cajones-summary-grid">
              <div className="cajon-sum-card">
                <span>Entregados</span>
                <strong>{totals.palEnt}</strong>
              </div>
              <div className="cajon-sum-card">
                <span>Devueltos</span>
                <strong>{totals.palDev}</strong>
              </div>
              <div className={`cajon-sum-card pallet-accent ${totals.palDif === 0 ? 'zero' : totals.palDif > 0 ? 'pos' : 'neg'}`}>
                <span>Diferencia</span>
                <strong>{totals.palDif > 0 ? `+${totals.palDif}` : totals.palDif}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="hr-empty-state">
          <RefreshCw size={30} className="spin" style={{ color: 'var(--dy-blue)' }} />
          <p>Cargando cajones y pallets...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="hr-empty-state">
          <Inbox size={42} style={{ color: 'var(--text-muted)' }} />
          <h3>Sin clientes cargados en este lugar</h3>
          <p>Agregá un cliente en {selectedLugar} para registrar cajones y pallets.</p>
          <button
            type="button"
            className="dev-add-client-cta"
            onClick={() => setShowAddModal(true)}
          >
            <UserPlus size={16} />
            <span>Agregar cliente en este lugar para registrar pallets y cajones</span>
          </button>
        </div>
      ) : (
        <div className="cajones-list">
          {items.map((it) => {
            const cEnt = parseInt(it.cajones_entregados || '0', 10) || 0;
            const cDev = parseInt(it.cajones_devueltos || '0', 10) || 0;
            const cDiff = cEnt - cDev;
            const pEnt = parseInt(it.pallets_entregados || '0', 10) || 0;
            const pDev = parseInt(it.pallets_devueltos || '0', 10) || 0;
            const pDiff = pEnt - pDev;

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
                  <div className="cajon-badges-col">
                    <span className={`cajon-diff-badge ${cDiff === 0 ? 'zero' : cDiff > 0 ? 'pos' : 'neg'}`}>
                      Caj: {cDiff > 0 ? `+${cDiff}` : cDiff}
                    </span>
                    <span className={`cajon-diff-badge ${pDiff === 0 ? 'zero' : pDiff > 0 ? 'pos' : 'neg'}`}>
                      Pal: {pDiff > 0 ? `+${pDiff}` : pDiff}
                    </span>
                  </div>
                </div>

                <div className="cajon-inputs-row">
                  <div className="cajon-input-box">
                    <label>CAJONES ENTREGADOS</label>
                    <div className="entregado-stepper cajon-qty-stepper">
                      <button
                        type="button"
                        className="entregado-step-btn"
                        aria-label={`Disminuir cajones entregados de ${it.Cliente}`}
                        disabled={cEnt <= 0 && it.cajones_entregados !== ''}
                        onClick={() => handleStep(it.localKey, 'cajones_entregados', it.cajones_entregados, -1)}
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
                        onClick={() => handleStep(it.localKey, 'cajones_entregados', it.cajones_entregados, 1)}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="cajon-input-box">
                    <label>CAJONES DEVUELTOS</label>
                    <div className="entregado-stepper cajon-qty-stepper">
                      <button
                        type="button"
                        className="entregado-step-btn"
                        aria-label={`Disminuir cajones devueltos de ${it.Cliente}`}
                        disabled={cDev <= 0 && it.cajones_devueltos !== ''}
                        onClick={() => handleStep(it.localKey, 'cajones_devueltos', it.cajones_devueltos, -1)}
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
                        onClick={() => handleStep(it.localKey, 'cajones_devueltos', it.cajones_devueltos, 1)}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="cajon-inputs-row">
                  <div className="cajon-input-box pallet-input-box">
                    <label>PALLETS ENTREGADOS</label>
                    <div className="entregado-stepper cajon-qty-stepper">
                      <button
                        type="button"
                        className="entregado-step-btn"
                        aria-label={`Disminuir pallets entregados de ${it.Cliente}`}
                        disabled={pEnt <= 0 && it.pallets_entregados !== ''}
                        onClick={() => handleStep(it.localKey, 'pallets_entregados', it.pallets_entregados, -1)}
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        className="entregado-input"
                        value={it.pallets_entregados}
                        onFocus={handleFocusSelectAll}
                        onKeyDown={(e) => {
                          if (['-', '+', '.', ',', 'e', 'E'].includes(e.key)) e.preventDefault();
                        }}
                        onChange={(e) => handleFieldChange(it.localKey, 'pallets_entregados', e.target.value)}
                      />
                      <button
                        type="button"
                        className="entregado-step-btn"
                        aria-label={`Incrementar pallets entregados de ${it.Cliente}`}
                        onClick={() => handleStep(it.localKey, 'pallets_entregados', it.pallets_entregados, 1)}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="cajon-input-box pallet-input-box">
                    <label>PALLETS DEVUELTOS</label>
                    <div className="entregado-stepper cajon-qty-stepper">
                      <button
                        type="button"
                        className="entregado-step-btn"
                        aria-label={`Disminuir pallets devueltos de ${it.Cliente}`}
                        disabled={pDev <= 0 && it.pallets_devueltos !== ''}
                        onClick={() => handleStep(it.localKey, 'pallets_devueltos', it.pallets_devueltos, -1)}
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        className="entregado-input"
                        value={it.pallets_devueltos}
                        onFocus={handleFocusSelectAll}
                        onKeyDown={(e) => {
                          if (['-', '+', '.', ',', 'e', 'E'].includes(e.key)) e.preventDefault();
                        }}
                        onChange={(e) => handleFieldChange(it.localKey, 'pallets_devueltos', e.target.value)}
                      />
                      <button
                        type="button"
                        className="entregado-step-btn"
                        aria-label={`Incrementar pallets devueltos de ${it.Cliente}`}
                        onClick={() => handleStep(it.localKey, 'pallets_devueltos', it.pallets_devueltos, 1)}
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
            className="dev-add-client-cta"
            onClick={() => setShowAddModal(true)}
          >
            <UserPlus size={16} />
            <span>Agregar cliente en este lugar para registrar pallets y cajones</span>
          </button>
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div
            className="modal-card glass"
            style={{ maxHeight: '82vh', alignItems: 'stretch', textAlign: 'left', padding: '18px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Boxes size={20} style={{ color: 'var(--dy-blue)' }} />
                <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text)' }}>
                  Agregar Cliente
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

            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Lugar: <strong>{selectedLugar}</strong>
            </p>

            {clientesCatalogo.length > 0 && (
              <>
                <div style={{ position: 'relative' }}>
                  <Search
                    size={15}
                    style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                  />
                  <input
                    type="text"
                    className="login-input"
                    style={{ paddingLeft: 32 }}
                    placeholder="Buscar cliente por nombre o código..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                  />
                </div>

                <div className="dev-client-picker-list">
                  {filteredCatalog.length === 0 ? (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px' }}>
                      Sin coincidencias en catálogo. Podés cargarlo manualmente abajo.
                    </p>
                  ) : (
                    filteredCatalog.slice(0, 60).map((cli) => (
                      <button
                        key={cli.id_cliente}
                        type="button"
                        className="dev-client-picker-item"
                        onClick={() => appendClientItem({ id_cliente: cli.id_cliente, Cliente: cli.nombre })}
                      >
                        <strong>{cli.nombre}</strong>
                        <span>Cód. #{cli.id_cliente}</span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', gap: 8 }}>
              <input
                type="text"
                className="login-input"
                style={{ paddingLeft: 12, flex: 1 }}
                placeholder="O ingresá nombre manualmente..."
                value={manualCliente}
                onChange={(e) => setManualCliente(e.target.value)}
              />
              <button
                type="button"
                className="btn-login-primary"
                style={{ width: 'auto', padding: '0 14px', height: 42 }}
                onClick={() => appendClientItem({ id_cliente: null, Cliente: manualCliente })}
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertModal
        isOpen={Boolean(errorMsg)}
        onClose={() => setErrorMsg(null)}
        type="error"
        title="Validación de Cajones y Pallets"
        message={errorMsg}
        confirmText="Corregir"
      />
    </div>
  );
}
