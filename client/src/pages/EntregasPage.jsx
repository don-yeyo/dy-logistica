import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import HojaRutaHeader from '../components/HojaRutaHeader';
import AlertModal from '../components/AlertModal';
import { fetchEntregasHojaRuta } from '../services/api';
import {
  cacheEntregas,
  getCachedEntregas
} from '../services/offlineStorage';
import {
  getHojaRutaDraft,
  patchSectionDraft
} from '../services/draftStorage';
import { useAuth } from '../config/AuthContext';
import {
  RefreshCw,
  Inbox,
  MapPin,
  FileText,
  ChevronDown,
  ChevronRight,
  Minus,
  Plus
} from 'lucide-react';

const POSITIVE_INT_REGEX = /^\d+$/;

function computeHasEntregasChanges(currentMap, baseMap) {
  const keys = Object.keys(baseMap || {});
  for (const k of keys) {
    if (String(currentMap?.[k] ?? '') !== String(baseMap[k] ?? '')) {
      return true;
    }
  }
  return false;
}

/**
 * Módulo 4.2.1: Confirmación de Descarga (Logística DY - Entregas).
 * Mantiene estado de acordeones y borradores editados en localStorage entre pantallas.
 */
export default function EntregasPage({ hojaRuta, onChangeHojaRuta }) {
  const { user } = useAuth();
  const [headerInfo, setHeaderInfo] = useState(hojaRuta);
  const [items, setItems] = useState([]);
  const [entregadoMap, setEntregadoMap] = useState({});
  const [invalidIds, setInvalidIds] = useState({});
  const [openLugares, setOpenLugares] = useState(() => {
    const draft = getHojaRutaDraft(user?.email, hojaRuta?.Transaccionid);
    return draft.entregas?.openLugares || {};
  });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const baseEntregadoMapRef = useRef({});

  const loadEntregas = useCallback(async () => {
    if (!hojaRuta?.Transaccionid) return;
    try {
      setLoading(true);
      setErrorMsg(null);
      let loadedHeader = hojaRuta;
      let loadedItems = [];

      if (navigator.onLine) {
        try {
          const res = await fetchEntregasHojaRuta(hojaRuta.Transaccionid);
          if (res && res.ok) {
            loadedHeader = res.hoja_ruta || hojaRuta;
            loadedItems = res.items || [];
            await cacheEntregas(hojaRuta.Transaccionid, {
              hoja_ruta: loadedHeader,
              items: loadedItems
            });
          }
        } catch (apiErr) {
          console.warn('[EntregasPage] Error API, usando caché local:', apiErr.message);
          const cached = await getCachedEntregas(hojaRuta.Transaccionid);
          if (cached) {
            loadedHeader = cached.hoja_ruta || hojaRuta;
            loadedItems = cached.items || [];
          } else {
            throw apiErr;
          }
        }
      } else {
        const cached = await getCachedEntregas(hojaRuta.Transaccionid);
        if (cached) {
          loadedHeader = cached.hoja_ruta || hojaRuta;
          loadedItems = cached.items || [];
        }
      }

      setHeaderInfo(loadedHeader);
      setItems(loadedItems);

      const baseMap = {};
      for (const it of loadedItems) {
        baseMap[it.Hojarutaitemid] =
          it.Entregado !== null && it.Entregado !== undefined
            ? String(it.Entregado)
            : String(it.Remitido ?? 0);
      }
      baseEntregadoMapRef.current = baseMap;

      const hasUnconfirmed = loadedItems.some(
        (it) => it.Entregado === null || it.Entregado === undefined
      );
      const draft = getHojaRutaDraft(user?.email, hojaRuta.Transaccionid).entregas;
      const resolvedOpenLugares =
        draft?.openLugares !== undefined ? draft.openLugares : openLugares;
      if (draft?.openLugares !== undefined) {
        setOpenLugares(draft.openLugares);
      }

      let finalMap = baseMap;
      let nextDirty = false;
      if (draft?.dirty && draft?.entregadoMap) {
        const restoredMap = { ...baseMap };
        for (const it of loadedItems) {
          if (draft.entregadoMap[it.Hojarutaitemid] !== undefined) {
            restoredMap[it.Hojarutaitemid] = String(draft.entregadoMap[it.Hojarutaitemid]);
          }
        }
        finalMap = restoredMap;
        nextDirty = computeHasEntregasChanges(restoredMap, baseMap) || true;
      }

      setEntregadoMap(finalMap);
      setInvalidIds({});

      patchSectionDraft(user?.email, hojaRuta.Transaccionid, 'entregas', {
        openLugares: resolvedOpenLugares,
        entregadoMap: finalMap,
        items: loadedItems,
        headerInfo: loadedHeader,
        unconfirmedDb: hasUnconfirmed,
        dirty: nextDirty
      });
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message || 'Error al cargar los ítems a entregar.');
    } finally {
      setLoading(false);
    }
  }, [hojaRuta, user?.email]);

  useEffect(() => {
    loadEntregas();
  }, [loadEntregas]);

  useEffect(() => {
    const onExternalSaved = (e) => {
      if (
        Number(e.detail?.transaccionId) === Number(hojaRuta?.Transaccionid) &&
        Array.isArray(e.detail?.sections) &&
        e.detail.sections.includes('entregas')
      ) {
        loadEntregas();
      }
    };
    window.addEventListener('dy-draft-saved', onExternalSaved);
    return () => window.removeEventListener('dy-draft-saved', onExternalSaved);
  }, [hojaRuta?.Transaccionid, loadEntregas]);

  // Agrupación en 2 cortes de control: Lugar_de_Entrega -> Remito
  const groupedData = useMemo(() => {
    const lugares = [];
    const lugarMap = new Map();

    for (const item of items) {
      const lugarKey = item.Lugar_de_Entrega || 'Sin Lugar de Entrega';
      if (!lugarMap.has(lugarKey)) {
        const lugarObj = {
          lugar: lugarKey,
          remitos: [],
          remitoMap: new Map()
        };
        lugarMap.set(lugarKey, lugarObj);
        lugares.push(lugarObj);
      }

      const lugarObj = lugarMap.get(lugarKey);
      const remitoKey = item.Remito || 'Sin Remito';
      if (!lugarObj.remitoMap.has(remitoKey)) {
        const remitoObj = {
          remito: remitoKey,
          cliente: item.Cliente || '',
          productos: []
        };
        lugarObj.remitoMap.set(remitoKey, remitoObj);
        lugarObj.remitos.push(remitoObj);
      }

      lugarObj.remitoMap.get(remitoKey).productos.push(item);
    }

    return lugares;
  }, [items]);

  const toggleLugar = (lugarKey) => {
    setOpenLugares((prev) => {
      const next = {
        ...prev,
        [lugarKey]: !prev[lugarKey]
      };
      patchSectionDraft(user?.email, hojaRuta?.Transaccionid, 'entregas', {
        openLugares: next
      });
      return next;
    });
  };

  const syncEntregadoDraft = (nextMap) => {
    const hasChanges = computeHasEntregasChanges(nextMap, baseEntregadoMapRef.current);
    patchSectionDraft(user?.email, hojaRuta?.Transaccionid, 'entregas', {
      openLugares,
      entregadoMap: nextMap,
      items,
      headerInfo,
      dirty: hasChanges,
      dirtySince: hasChanges ? Date.now() : null
    });
  };

  const handleEntregadoChange = (hojaRutaItemId, rawValue) => {
    if (rawValue !== '' && !POSITIVE_INT_REGEX.test(rawValue)) {
      return;
    }

    const nextMap = {
      ...entregadoMap,
      [hojaRutaItemId]: rawValue
    };
    setEntregadoMap(nextMap);
    syncEntregadoDraft(nextMap);

    if (invalidIds[hojaRutaItemId] && POSITIVE_INT_REGEX.test(rawValue)) {
      setInvalidIds((prev) => {
        const next = { ...prev };
        delete next[hojaRutaItemId];
        return next;
      });
    }
  };

  const handleStepEntregado = (hojaRutaItemId, delta) => {
    const rawCurrent = String(entregadoMap[hojaRutaItemId] ?? '').trim();
    const parsedCurrent = POSITIVE_INT_REGEX.test(rawCurrent) ? parseInt(rawCurrent, 10) : 0;
    const nextVal = Math.max(0, parsedCurrent + delta);

    const nextMap = {
      ...entregadoMap,
      [hojaRutaItemId]: String(nextVal)
    };
    setEntregadoMap(nextMap);
    syncEntregadoDraft(nextMap);

    if (invalidIds[hojaRutaItemId]) {
      setInvalidIds((prev) => {
        const next = { ...prev };
        delete next[hojaRutaItemId];
        return next;
      });
    }
  };

  const handleKeyDownNumeric = (e) => {
    if (['-', '+', '.', ',', 'e', 'E'].includes(e.key)) {
      e.preventDefault();
    }
  };

  const handleFocusSelectAll = (e) => {
    const input = e.target;
    input.select();
    requestAnimationFrame(() => input.select());
  };

  return (
    <div className="module-page page-transition">
      <HojaRutaHeader
        hojaRuta={headerInfo}
        title="Logística DY - Entregas"
        onChangeHojaRuta={onChangeHojaRuta}
      />

      {loading ? (
        <div className="hr-empty-state">
          <RefreshCw size={30} className="spin" style={{ color: 'var(--dy-blue)' }} />
          <p>Cargando ítems a entregar...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="hr-empty-state">
          <Inbox size={42} style={{ color: 'var(--text-muted)' }} />
          <h3>Sin ítems para esta hoja de ruta</h3>
          <p>No se encontraron productos pendientes de entrega en ITEMS_A_ENTREGAR.</p>
        </div>
      ) : (
        <div className="entregas-groups">
          {groupedData.map((lugarGroup) => {
            const isOpen = Boolean(openLugares[lugarGroup.lugar]);
            return (
              <section key={lugarGroup.lugar} className="lugar-section">
                <button
                  type="button"
                  className={`lugar-header-banner lugar-accordion-btn ${isOpen ? 'open' : ''}`}
                  onClick={() => toggleLugar(lugarGroup.lugar)}
                  aria-expanded={isOpen}
                >
                  <div className="lugar-accordion-title">
                    <MapPin size={16} style={{ flexShrink: 0 }} />
                    <span>Lugar de entrega: <strong>{lugarGroup.lugar}</strong></span>
                  </div>
                  <div className="lugar-accordion-meta">
                    <span className="lugar-remitos-count">
                      {lugarGroup.remitos.length} rem.
                    </span>
                    {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                </button>

                {isOpen && (
                  <div className="lugar-remitos-stack">
                    {lugarGroup.remitos.map((remitoGroup) => (
                      <div key={`${lugarGroup.lugar}-${remitoGroup.remito}`} className="remito-grid-card">
                        <div className="remito-cut-header">
                          <FileText size={15} />
                          <span>
                            Remito: <strong>{remitoGroup.remito}</strong>
                            {remitoGroup.cliente ? ` / Cliente: ${remitoGroup.cliente}` : ''}
                          </span>
                        </div>

                        <div className="entregas-table-wrap">
                          <table className="entregas-table">
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'left' }}>Producto</th>
                                <th style={{ width: '64px', textAlign: 'center' }}>Remitido</th>
                                <th style={{ width: '124px', textAlign: 'center' }}>Entregado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {remitoGroup.productos.map((prod) => {
                                const rawVal = String(entregadoMap[prod.Hojarutaitemid] ?? '');
                                const currentNum = POSITIVE_INT_REGEX.test(rawVal) ? parseInt(rawVal, 10) : 0;
                                const isInvalid = Boolean(invalidIds[prod.Hojarutaitemid]);
                                const isModified =
                                  POSITIVE_INT_REGEX.test(rawVal) &&
                                  currentNum !== Number(prod.Remitido ?? 0);

                                return (
                                  <tr key={prod.Hojarutaitemid}>
                                    <td className="prod-name-cell">{prod.Producto}</td>
                                    <td className="remitido-cell">{prod.Remitido}</td>
                                    <td className="entregado-cell">
                                      <div
                                        className={`entregado-stepper ${isModified ? 'modified' : ''} ${isInvalid ? 'invalid' : ''}`}
                                      >
                                        <button
                                          type="button"
                                          className="entregado-step-btn"
                                          aria-label={`Disminuir entregado de ${prod.Producto}`}
                                          disabled={currentNum <= 0 && rawVal !== ''}
                                          onClick={() => handleStepEntregado(prod.Hojarutaitemid, -1)}
                                        >
                                          <Minus size={14} />
                                        </button>

                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          pattern="[0-9]*"
                                          aria-label={`Cantidad entregada de ${prod.Producto}`}
                                          className={`entregado-input ${isModified ? 'modified' : ''} ${isInvalid ? 'invalid' : ''}`}
                                          value={rawVal}
                                          onFocus={handleFocusSelectAll}
                                          onKeyDown={handleKeyDownNumeric}
                                          onChange={(e) => handleEntregadoChange(prod.Hojarutaitemid, e.target.value)}
                                          placeholder="0"
                                        />

                                        <button
                                          type="button"
                                          className="entregado-step-btn"
                                          aria-label={`Incrementar entregado de ${prod.Producto}`}
                                          onClick={() => handleStepEntregado(prod.Hojarutaitemid, 1)}
                                        >
                                          <Plus size={14} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <AlertModal
        isOpen={Boolean(errorMsg)}
        onClose={() => setErrorMsg(null)}
        type="error"
        title="Validación de Entregas"
        message={errorMsg}
        confirmText="Corregir"
      />
    </div>
  );
}
