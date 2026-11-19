import React, { useState, useEffect, useMemo, useCallback } from 'react';
import HojaRutaHeader from '../components/HojaRutaHeader';
import AlertModal from '../components/AlertModal';
import { fetchEntregasHojaRuta, saveEntregasHojaRuta } from '../services/api';
import {
  cacheEntregas,
  getCachedEntregas,
  queuePendingControl
} from '../services/offlineStorage';
import { useAuth } from '../config/AuthContext';
import {
  Save,
  RefreshCw,
  Check,
  CheckCheck,
  Inbox,
  MapPin,
  FileText
} from 'lucide-react';

const POSITIVE_INT_REGEX = /^\d+$/;

/**
 * Módulo 4.2.1: Confirmación de Descarga (Logística DY - Entregas).
 * Agrupa ítems de ITEMS_A_ENTREGAR por Lugar_de_Entrega -> Remito.
 * Conserva internamente Transaccionid y Hojarutaitemid sin mostrarlos.
 */
export default function EntregasPage({ hojaRuta, onChangeHojaRuta }) {
  const { refreshPendingCount } = useAuth();
  const [headerInfo, setHeaderInfo] = useState(hojaRuta);
  const [items, setItems] = useState([]);
  const [entregadoMap, setEntregadoMap] = useState({});
  const [invalidIds, setInvalidIds] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

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

      const initialMap = {};
      for (const it of loadedItems) {
        initialMap[it.Hojarutaitemid] =
          it.Entregado !== null && it.Entregado !== undefined ? String(it.Entregado) : '';
      }
      setEntregadoMap(initialMap);
      setInvalidIds({});
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message || 'Error al cargar los ítems a entregar.');
    } finally {
      setLoading(false);
    }
  }, [hojaRuta]);

  useEffect(() => {
    loadEntregas();
  }, [loadEntregas]);

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

  const handleEntregadoChange = (hojaRutaItemId, rawValue) => {
    // Bloquear caracteres no numéricos (negativos, decimales, texto, símbolos)
    if (rawValue !== '' && !POSITIVE_INT_REGEX.test(rawValue)) {
      return;
    }

    setEntregadoMap((prev) => ({
      ...prev,
      [hojaRutaItemId]: rawValue
    }));

    if (invalidIds[hojaRutaItemId] && POSITIVE_INT_REGEX.test(rawValue)) {
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

  const handlePrefillAllWithRemitido = () => {
    const nextMap = { ...entregadoMap };
    for (const it of items) {
      if (nextMap[it.Hojarutaitemid] === '' || nextMap[it.Hojarutaitemid] === undefined) {
        nextMap[it.Hojarutaitemid] = String(it.Remitido ?? 0);
      }
    }
    setEntregadoMap(nextMap);
    setInvalidIds({});
  };

  const handleGuardar = async () => {
    if (items.length === 0) return;

    const newInvalids = {};
    const payloadItems = [];

    for (const item of items) {
      const valStr = String(entregadoMap[item.Hojarutaitemid] ?? '').trim();
      if (!POSITIVE_INT_REGEX.test(valStr)) {
        newInvalids[item.Hojarutaitemid] = true;
      } else {
        payloadItems.push({
          Hojarutaitemid: item.Hojarutaitemid,
          Entregado: parseInt(valStr, 10)
        });
      }
    }

    if (Object.keys(newInvalids).length > 0) {
      setInvalidIds(newInvalids);
      setErrorMsg(
        'Todos los productos deben tener una cantidad entregada válida (únicamente números enteros positivos, sin decimales, negativos ni campos vacíos).'
      );
      return;
    }

    try {
      setSaving(true);
      setErrorMsg(null);

      const updatedItemsList = items.map((it) => ({
        ...it,
        Entregado: parseInt(String(entregadoMap[it.Hojarutaitemid]).trim(), 10)
      }));

      if (navigator.onLine) {
        const res = await saveEntregasHojaRuta(hojaRuta.Transaccionid, payloadItems);
        const finalItems = res?.items || updatedItemsList;
        setItems(finalItems);
        await cacheEntregas(hojaRuta.Transaccionid, {
          hoja_ruta: headerInfo,
          items: finalItems
        });
        setSuccessMsg(res?.message || 'Descarga confirmada correctamente.');
      } else {
        await queuePendingControl({
          op_type: 'entregas',
          transaccionId: hojaRuta.Transaccionid,
          items: payloadItems
        });
        setItems(updatedItemsList);
        await cacheEntregas(hojaRuta.Transaccionid, {
          hoja_ruta: headerInfo,
          items: updatedItemsList
        });
        await refreshPendingCount();
        setSuccessMsg('Sin conexión: confirmación guardada localmente y encolada para sincronizar.');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message || 'No se pudo guardar la confirmación de descarga.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="module-page page-transition">
      <HojaRutaHeader
        hojaRuta={headerInfo}
        title="Logística DY - Entregas"
        onChangeHojaRuta={onChangeHojaRuta}
      />

      {/* Barra de acción rápida para agilizar la carga en móvil */}
      {!loading && items.length > 0 && (
        <div className="module-toolbar">
          <span className="module-count-text">
            {items.length} ítems en {groupedData.length} lugar(es) de entrega
          </span>
          <button
            type="button"
            className="module-helper-btn"
            onClick={handlePrefillAllWithRemitido}
          >
            <CheckCheck size={15} />
            <span>Completar vacíos con Remitido</span>
          </button>
        </div>
      )}

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
          {groupedData.map((lugarGroup) => (
            <section key={lugarGroup.lugar} className="lugar-section">
              {/* Primer Corte: Lugar de Entrega */}
              <div className="lugar-header-banner">
                <MapPin size={16} />
                <span>Lugar de entrega: <strong>{lugarGroup.lugar}</strong></span>
              </div>

              {/* Segundo Corte: Remitos dentro de este Lugar de Entrega */}
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
                            <th style={{ width: '74px', textAlign: 'center' }}>Remitido</th>
                            <th style={{ width: '88px', textAlign: 'center' }}>Entregado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {remitoGroup.productos.map((prod) => {
                            const isInvalid = Boolean(invalidIds[prod.Hojarutaitemid]);
                            return (
                              <tr key={prod.Hojarutaitemid}>
                                <td className="prod-name-cell">{prod.Producto}</td>
                                <td className="remitido-cell">{prod.Remitido}</td>
                                <td className="entregado-cell">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    aria-label={`Cantidad entregada de ${prod.Producto}`}
                                    className={`entregado-input ${isInvalid ? 'invalid' : ''}`}
                                    value={entregadoMap[prod.Hojarutaitemid] ?? ''}
                                    onKeyDown={handleKeyDownNumeric}
                                    onChange={(e) => handleEntregadoChange(prod.Hojarutaitemid, e.target.value)}
                                    placeholder="0"
                                  />
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
            </section>
          ))}

          {/* Botón Guardar al final del detalle */}
          <div className="module-save-footer">
            <button
              type="button"
              className="module-save-btn"
              onClick={handleGuardar}
              disabled={saving}
            >
              {saving ? (
                <>
                  <RefreshCw size={19} className="spin" />
                  <span>Guardando descarga...</span>
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

      <AlertModal
        isOpen={Boolean(errorMsg)}
        onClose={() => setErrorMsg(null)}
        type="error"
        title="Validación de Entregas"
        message={errorMsg}
        confirmText="Corregir"
      />

      <AlertModal
        isOpen={Boolean(successMsg)}
        onClose={() => setSuccessMsg(null)}
        type="success"
        title="Descarga Confirmada"
        message={successMsg}
        confirmText="Aceptar"
      />
    </div>
  );
}
