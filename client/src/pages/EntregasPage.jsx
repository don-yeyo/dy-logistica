import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import HojaRutaHeader from '../components/HojaRutaHeader';
import AlertModal from '../components/AlertModal';
import { fetchEntregasHojaRuta } from '../services/api';
import { cacheEntregas, getCachedEntregas } from '../services/offlineStorage';
import { getHojaRutaDraft, patchSectionDraft } from '../services/draftStorage';
import { useAuth } from '../config/AuthContext';
import { RefreshCw, Inbox, Minus, Plus, PackageCheck } from 'lucide-react';

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
 * Paso 3: Confirmación de Descarga consolidada por producto en el Lugar de Entrega seleccionado.
 * Suma totales remitidos por producto sin abrir remitos individuales y persiste borradores locales.
 */
export default function EntregasPage({ hojaRuta, selectedLugar, onChangeLugar }) {
  const { user } = useAuth();
  const [headerInfo, setHeaderInfo] = useState(hojaRuta);
  const [items, setItems] = useState([]);
  const [entregadoMap, setEntregadoMap] = useState({});
  const [invalidIds, setInvalidIds] = useState({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const baseEntregadoMapRef = useRef({});

  const loadEntregas = useCallback(async () => {
    if (!hojaRuta?.Transaccionid || !selectedLugar) return;
    try {
      setLoading(true);
      setErrorMsg(null);
      let loadedHeader = hojaRuta;
      let loadedItems = [];

      if (navigator.onLine) {
        try {
          const res = await fetchEntregasHojaRuta(hojaRuta.Transaccionid, selectedLugar);
          if (res && res.ok) {
            loadedHeader = res.hoja_ruta || hojaRuta;
            loadedItems = res.items || [];
            await cacheEntregas(
              hojaRuta.Transaccionid,
              {
                hoja_ruta: loadedHeader,
                lugar: selectedLugar,
                items: loadedItems
              },
              selectedLugar
            );
          }
        } catch (apiErr) {
          console.warn('[EntregasPage] Error API, usando caché local:', apiErr.message);
          const cached = await getCachedEntregas(hojaRuta.Transaccionid, selectedLugar);
          if (cached) {
            loadedHeader = cached.hoja_ruta || hojaRuta;
            loadedItems = cached.items || [];
          } else {
            throw apiErr;
          }
        }
      } else {
        const cached = await getCachedEntregas(hojaRuta.Transaccionid, selectedLugar);
        if (cached) {
          loadedHeader = cached.hoja_ruta || hojaRuta;
          loadedItems = cached.items || [];
        }
      }

      setHeaderInfo(loadedHeader);
      setItems(loadedItems);

      const baseMap = {};
      for (const it of loadedItems) {
        const key = it.Productoid ?? it.Hojarutaitemid;
        baseMap[key] =
          it.Entregado !== null && it.Entregado !== undefined
            ? String(it.Entregado)
            : String(it.Remitido ?? 0);
      }
      baseEntregadoMapRef.current = baseMap;

      const hasUnconfirmed = loadedItems.some(
        (it) => it.Entregado === null || it.Entregado === undefined
      );
      const draft = getHojaRutaDraft(user?.email, hojaRuta.Transaccionid, selectedLugar).entregas;

      let finalMap = baseMap;
      let nextDirty = false;
      if (draft?.dirty && draft?.entregadoMap) {
        const restoredMap = { ...baseMap };
        for (const it of loadedItems) {
          const key = it.Productoid ?? it.Hojarutaitemid;
          if (draft.entregadoMap[key] !== undefined) {
            restoredMap[key] = String(draft.entregadoMap[key]);
          }
        }
        finalMap = restoredMap;
        nextDirty = computeHasEntregasChanges(restoredMap, baseMap) || true;
      }

      setEntregadoMap(finalMap);
      setInvalidIds({});

      patchSectionDraft(
        user?.email,
        hojaRuta.Transaccionid,
        'entregas',
        {
          lugar: selectedLugar,
          entregadoMap: finalMap,
          items: loadedItems,
          headerInfo: loadedHeader,
          unconfirmedDb: hasUnconfirmed,
          dirty: nextDirty
        },
        selectedLugar
      );
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message || 'Error al cargar los productos a entregar.');
    } finally {
      setLoading(false);
    }
  }, [hojaRuta, selectedLugar, user?.email]);

  useEffect(() => {
    loadEntregas();
  }, [loadEntregas]);

  useEffect(() => {
    const onExternalSaved = (e) => {
      const sameTx = Number(e.detail?.transaccionId) === Number(hojaRuta?.Transaccionid);
      const sameLugar =
        !e.detail?.lugar ||
        String(e.detail.lugar).trim().toLowerCase() === String(selectedLugar || '').trim().toLowerCase();
      if (sameTx && sameLugar && Array.isArray(e.detail?.sections) && e.detail.sections.includes('entregas')) {
        loadEntregas();
      }
    };
    window.addEventListener('dy-draft-saved', onExternalSaved);
    return () => window.removeEventListener('dy-draft-saved', onExternalSaved);
  }, [hojaRuta?.Transaccionid, selectedLugar, loadEntregas]);

  const totals = useMemo(() => {
    let remitido = 0;
    let entregado = 0;
    for (const it of items) {
      const key = it.Productoid ?? it.Hojarutaitemid;
      remitido += Number(it.Remitido ?? 0);
      const raw = String(entregadoMap[key] ?? '').trim();
      entregado += POSITIVE_INT_REGEX.test(raw) ? parseInt(raw, 10) : 0;
    }
    return {
      productos: items.length,
      remitido,
      entregado
    };
  }, [items, entregadoMap]);

  const syncEntregadoDraft = (nextMap) => {
    const hasChanges = computeHasEntregasChanges(nextMap, baseEntregadoMapRef.current);
    patchSectionDraft(
      user?.email,
      hojaRuta?.Transaccionid,
      'entregas',
      {
        lugar: selectedLugar,
        entregadoMap: nextMap,
        items,
        headerInfo,
        dirty: hasChanges,
        dirtySince: hasChanges ? Date.now() : null
      },
      selectedLugar
    );
  };

  const handleEntregadoChange = (itemKey, rawValue) => {
    if (rawValue !== '' && !POSITIVE_INT_REGEX.test(rawValue)) {
      return;
    }

    const nextMap = {
      ...entregadoMap,
      [itemKey]: rawValue
    };
    setEntregadoMap(nextMap);
    syncEntregadoDraft(nextMap);

    if (invalidIds[itemKey] && POSITIVE_INT_REGEX.test(rawValue)) {
      setInvalidIds((prev) => {
        const next = { ...prev };
        delete next[itemKey];
        return next;
      });
    }
  };

  const handleStepEntregado = (itemKey, delta) => {
    const rawCurrent = String(entregadoMap[itemKey] ?? '').trim();
    const parsedCurrent = POSITIVE_INT_REGEX.test(rawCurrent) ? parseInt(rawCurrent, 10) : 0;
    const nextVal = Math.max(0, parsedCurrent + delta);

    const nextMap = {
      ...entregadoMap,
      [itemKey]: String(nextVal)
    };
    setEntregadoMap(nextMap);
    syncEntregadoDraft(nextMap);

    if (invalidIds[itemKey]) {
      setInvalidIds((prev) => {
        const next = { ...prev };
        delete next[itemKey];
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
        selectedLugar={selectedLugar}
        onChangeLugar={onChangeLugar}
      />

      {loading ? (
        <div className="hr-empty-state">
          <RefreshCw size={30} className="spin" style={{ color: 'var(--dy-blue)' }} />
          <p>Cargando productos consolidados...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="hr-empty-state">
          <Inbox size={42} style={{ color: 'var(--text-muted)' }} />
          <h3>Sin productos en este lugar</h3>
          <p>No se encontraron ítems asignados a {selectedLugar}.</p>
        </div>
      ) : (
        <>
          <div className="entregas-summary-bar">
            <span className="entregas-sum-pill">
              <PackageCheck size={14} />
              <strong>{totals.productos}</strong> {totals.productos === 1 ? 'producto' : 'productos'}
            </span>
            <span className="entregas-sum-pill">
              Remitido: <strong>{totals.remitido}</strong>
            </span>
            <span className={`entregas-sum-pill ${totals.entregado !== totals.remitido ? 'diff' : 'ok'}`}>
              Entregado: <strong>{totals.entregado}</strong>
            </span>
          </div>

          <div className="remito-grid-card entregas-consolidated-card">
            <div className="entregas-table-wrap">
              <table className="entregas-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Producto</th>
                    <th style={{ width: '68px', textAlign: 'center' }}>Remitido</th>
                    <th style={{ width: '124px', textAlign: 'center' }}>Entregado</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((prod) => {
                    const key = prod.Productoid ?? prod.Hojarutaitemid;
                    const rawVal = String(entregadoMap[key] ?? '');
                    const currentNum = POSITIVE_INT_REGEX.test(rawVal) ? parseInt(rawVal, 10) : 0;
                    const isInvalid = Boolean(invalidIds[key]);
                    const isModified =
                      POSITIVE_INT_REGEX.test(rawVal) &&
                      currentNum !== Number(prod.Remitido ?? 0);

                    return (
                      <tr key={key}>
                        <td className="prod-name-cell">
                          <div>{prod.Producto}</div>
                          {Number(prod.cantidad_lineas || 0) > 1 && (
                            <span className="prod-lines-sub">
                              Acumulado de {prod.cantidad_lineas} líneas
                            </span>
                          )}
                        </td>
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
                              onClick={() => handleStepEntregado(key, -1)}
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
                              onChange={(e) => handleEntregadoChange(key, e.target.value)}
                              placeholder="0"
                            />

                            <button
                              type="button"
                              className="entregado-step-btn"
                              aria-label={`Incrementar entregado de ${prod.Producto}`}
                              onClick={() => handleStepEntregado(key, 1)}
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
        </>
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
