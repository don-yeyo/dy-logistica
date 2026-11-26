import React, { useState, useEffect, useCallback, useMemo } from 'react';
import HojaRutaHeader from '../components/HojaRutaHeader';
import AlertModal from '../components/AlertModal';
import ProductCombobox from '../components/ProductCombobox';
import BarcodeScanner from '../components/BarcodeScanner';
import { fetchDevolucionesHojaRuta } from '../services/api';
import {
  cacheDevoluciones,
  getCachedDevoluciones
} from '../services/offlineStorage';
import {
  getHojaRutaDraft,
  patchSectionDraft
} from '../services/draftStorage';
import { useAuth } from '../config/AuthContext';
import {
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Search,
  Plus,
  Minus,
  Trash2,
  MapPin,
  UserPlus,
  Inbox,
  ScanLine,
  X
} from 'lucide-react';

const POSITIVE_INT_NONZERO = /^[1-9]\d*$/;

/**
 * Transforma las filas planas de HOJA_DE_RUTA_DEVOLUCIONES en estructura jerárquica:
 * Lugar_de_Entrega -> Cliente -> Productos
 */
function buildDevolucionesTree(rows = []) {
  const lugares = [];
  const lugarMap = new Map();

  for (const row of rows) {
    const lugarKey = row.Lugar_de_Entrega || 'Sin Lugar de Entrega';
    if (!lugarMap.has(lugarKey)) {
      const lugarObj = {
        lugar: lugarKey,
        clientes: [],
        clienteMap: new Map()
      };
      lugarMap.set(lugarKey, lugarObj);
      lugares.push(lugarObj);
    }

    const lugarObj = lugarMap.get(lugarKey);
    const hasCliente = Boolean(row.id_cliente || row.Cliente);
    if (!hasCliente) continue;

    const clienteKey = `${row.id_cliente || 0}::${row.Cliente || ''}`;
    if (!lugarObj.clienteMap.has(clienteKey)) {
      const clienteObj = {
        clientKey: `${lugarKey}__${clienteKey}`,
        Lugar_de_Entrega: lugarKey,
        id_cliente: row.id_cliente || null,
        Cliente: row.Cliente || '',
        id_etapa: row.id_etapa || null,
        fecha: row.fecha ? String(row.fecha).slice(0, 10) : '',
        id_remito_devoluciones: row.id_remito_devoluciones || null,
        productos: []
      };
      lugarObj.clienteMap.set(clienteKey, clienteObj);
      lugarObj.clientes.push(clienteObj);
    }

    const clienteObj = lugarObj.clienteMap.get(clienteKey);
    if (!clienteObj.id_remito_devoluciones && row.id_remito_devoluciones) {
      clienteObj.id_remito_devoluciones = row.id_remito_devoluciones;
    }

    if (row.id_remito_devoluciones_item || row.id_producto || row.Producto) {
      clienteObj.productos.push({
        localId: `item-${row.id_remito_devoluciones_item || Math.random().toString(36).slice(2)}`,
        id_remito_devoluciones_item: row.id_remito_devoluciones_item || null,
        id_producto: row.id_producto || null,
        Producto: row.Producto || '',
        Cantidad: row.Cantidad !== null && row.Cantidad !== undefined ? String(row.Cantidad) : '1',
        Vencimiento: row.Vencimiento ? String(row.Vencimiento).slice(0, 10) : '',
        codigo_motivo_dif: row.codigo_motivo_dif || null,
        Motivo: row.Motivo || '',
        Tipo: row.Tipo === 'Virtual' ? 'Virtual' : 'Físico'
      });
    }
  }

  return lugares.map(({ lugar, clientes }) => ({ lugar, clientes }));
}

function normalizeBarcode(val) {
  return String(val || '').trim().replace(/^0+/, '');
}

/**
 * Módulo 4.2.2: Devolución de Mercadería (Logística DY - Devoluciones).
 * Persiste estado de acordeones y borradores en localStorage hasta confirmar en DB.
 */
export default function DevolucionesPage({ hojaRuta, selectedLugar, onChangeLugar }) {
  const { user } = useAuth();
  const [headerInfo, setHeaderInfo] = useState(hojaRuta);
  const [grupos, setGrupos] = useState([]);
  const [catalogos, setCatalogos] = useState({ productos: [], clientes: [], motivos: [] });
  const [expandedLugares, setExpandedLugares] = useState({});
  const [expandedClientes, setExpandedClientes] = useState({});
  const [clientModalLugar, setClientModalLugar] = useState(null);
  const [clientSearch, setClientSearch] = useState('');
  const [scannerTarget, setScannerTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const sortedMotivos = useMemo(() => {
    return [...(catalogos.motivos || [])].sort((a, b) =>
      String(a.descripcion || '').localeCompare(String(b.descripcion || ''), 'es', { sensitivity: 'base' })
    );
  }, [catalogos.motivos]);

  const applyLoadedData = useCallback((loadedHeader, rows, loadedCatalogos) => {
    const resolvedHeader = loadedHeader || hojaRuta;
    const resolvedCatalogos = loadedCatalogos || { productos: [], clientes: [], motivos: [] };
    setHeaderInfo(resolvedHeader);
    setCatalogos(resolvedCatalogos);

    const rawTree = buildDevolucionesTree(rows || []);
    const cleanSelected = String(selectedLugar || '').trim().toLowerCase();
    const filteredTree = cleanSelected
      ? rawTree.filter((g) => String(g.lugar || '').trim().toLowerCase() === cleanSelected)
      : rawTree;
    const tree =
      filteredTree.length > 0
        ? filteredTree
        : selectedLugar
          ? [{ lugar: selectedLugar, clientes: [] }]
          : rawTree;

    const draft = getHojaRutaDraft(user?.email, hojaRuta?.Transaccionid, selectedLugar).devoluciones;
    const resolvedGrupos = draft?.dirty && Array.isArray(draft.grupos) ? draft.grupos : tree;
    setGrupos(resolvedGrupos);

    if (draft?.expandedLugares !== undefined) {
      setExpandedLugares(draft.expandedLugares);
      const restoredClientes = { ...(draft.expandedClientes || {}) };
      resolvedGrupos.forEach((g) => {
        if (g.clientes.length === 1) {
          const onlyKey = g.clientes[0].clientKey;
          if (restoredClientes[onlyKey] === undefined) {
            restoredClientes[onlyKey] = true;
          }
        }
      });
      setExpandedClientes(restoredClientes);
    } else {
      const nextLugares = {};
      const nextClientes = {};
      resolvedGrupos.forEach((g) => {
        nextLugares[g.lugar] = true;
        const singleClient = g.clientes.length === 1;
        g.clientes.forEach((c) => {
          if (singleClient || c.productos.length > 0) {
            nextClientes[c.clientKey] = true;
          }
        });
      });
      setExpandedLugares(nextLugares);
      setExpandedClientes(nextClientes);
    }
  }, [hojaRuta, selectedLugar, user?.email]);

  const loadDevoluciones = useCallback(async () => {
    if (!hojaRuta?.Transaccionid || !selectedLugar) return;
    try {
      setLoading(true);
      setErrorMsg(null);

      if (navigator.onLine) {
        try {
          const res = await fetchDevolucionesHojaRuta(hojaRuta.Transaccionid, selectedLugar);
          if (res && res.ok) {
            await cacheDevoluciones(
              hojaRuta.Transaccionid,
              {
                hoja_ruta: res.hoja_ruta,
                lugar: selectedLugar,
                rows: res.rows,
                catalogos: res.catalogos
              },
              selectedLugar
            );
            applyLoadedData(res.hoja_ruta, res.rows, res.catalogos);
            return;
          }
        } catch (apiErr) {
          console.warn('[DevolucionesPage] Error API, usando caché local:', apiErr.message);
          const cached = await getCachedDevoluciones(hojaRuta.Transaccionid, selectedLugar);
          if (cached) {
            applyLoadedData(cached.hoja_ruta, cached.rows, cached.catalogos);
            return;
          }
          throw apiErr;
        }
      } else {
        const cached = await getCachedDevoluciones(hojaRuta.Transaccionid, selectedLugar);
        if (cached) {
          applyLoadedData(cached.hoja_ruta, cached.rows, cached.catalogos);
          return;
        }
      }

      applyLoadedData(hojaRuta, [], { productos: [], clientes: [], motivos: [] });
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message || 'Error al cargar devoluciones.');
    } finally {
      setLoading(false);
    }
  }, [hojaRuta, selectedLugar, applyLoadedData]);

  useEffect(() => {
    loadDevoluciones();
  }, [loadDevoluciones]);

  useEffect(() => {
    const onExternalSaved = (e) => {
      const sameTx = Number(e.detail?.transaccionId) === Number(hojaRuta?.Transaccionid);
      const sameLugar =
        !e.detail?.lugar ||
        String(e.detail.lugar).trim().toLowerCase() === String(selectedLugar || '').trim().toLowerCase();
      if (sameTx && sameLugar && Array.isArray(e.detail?.sections) && e.detail.sections.includes('devoluciones')) {
        loadDevoluciones();
      }
    };
    window.addEventListener('dy-draft-saved', onExternalSaved);
    return () => window.removeEventListener('dy-draft-saved', onExternalSaved);
  }, [hojaRuta?.Transaccionid, selectedLugar, loadDevoluciones]);

  const toggleCliente = (clientKey) => {
    setExpandedClientes((prev) => {
      const next = { ...prev, [clientKey]: !prev[clientKey] };
      patchSectionDraft(
        user?.email,
        hojaRuta?.Transaccionid,
        'devoluciones',
        {
          lugar: selectedLugar,
          expandedLugares,
          expandedClientes: next
        },
        selectedLugar
      );
      return next;
    });
  };

  const persistGruposDraft = (nextGrupos, nextExpLugares = expandedLugares, nextExpClientes = expandedClientes) => {
    patchSectionDraft(
      user?.email,
      hojaRuta?.Transaccionid,
      'devoluciones',
      {
        lugar: selectedLugar,
        grupos: nextGrupos,
        expandedLugares: nextExpLugares,
        expandedClientes: nextExpClientes,
        headerInfo,
        catalogos,
        dirty: true,
        dirtySince: Date.now()
      },
      selectedLugar
    );
  };

  const handleAddProduct = (lugarName, clientKey) => {
    const nextExpLugares = { ...expandedLugares, [lugarName]: true };
    const nextExpClientes = { ...expandedClientes, [clientKey]: true };
    setExpandedLugares(nextExpLugares);
    setExpandedClientes(nextExpClientes);

    setGrupos((prev) => {
      const nextGrupos = prev.map((g) => {
        if (g.lugar !== lugarName) return g;
        return {
          ...g,
          clientes: g.clientes.map((c) => {
            if (c.clientKey !== clientKey) return c;
            return {
              ...c,
              productos: [
                ...c.productos,
                {
                  localId: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  id_remito_devoluciones_item: null,
                  id_producto: null,
                  Producto: '',
                  Cantidad: '1',
                  Vencimiento: '',
                  codigo_motivo_dif: null,
                  Motivo: '',
                  Tipo: 'Físico'
                }
              ]
            };
          })
        };
      });
      persistGruposDraft(nextGrupos, nextExpLugares, nextExpClientes);
      return nextGrupos;
    });
  };

  const handleRemoveUnsavedProduct = (lugarName, clientKey, localId) => {
    setGrupos((prev) => {
      const nextGrupos = prev.map((g) => {
        if (g.lugar !== lugarName) return g;
        return {
          ...g,
          clientes: g.clientes.map((c) => {
            if (c.clientKey !== clientKey) return c;
            return {
              ...c,
              productos: c.productos.filter((p) => p.localId !== localId)
            };
          })
        };
      });
      persistGruposDraft(nextGrupos);
      return nextGrupos;
    });
  };

  const handleProductFieldChange = (lugarName, clientKey, localId, field, value) => {
    if (field === 'Cantidad' && value !== '' && !/^\d+$/.test(value)) {
      return;
    }

    setGrupos((prev) => {
      const nextGrupos = prev.map((g) => {
        if (g.lugar !== lugarName) return g;
        return {
          ...g,
          clientes: g.clientes.map((c) => {
            if (c.clientKey !== clientKey) return c;
            return {
              ...c,
              productos: c.productos.map((p) => {
                if (p.localId !== localId) return p;
                if (field === 'id_producto') {
                  if (!value) {
                    return { ...p, id_producto: null, Producto: '' };
                  }
                  const found = catalogos.productos.find((cp) => Number(cp.id_producto) === Number(value));
                  return {
                    ...p,
                    id_producto: Number(value),
                    Producto: found ? found.nombre : p.Producto
                  };
                }
                if (field === 'codigo_motivo_dif') {
                  const foundMot = sortedMotivos.find((m) => Number(m.id_motivo) === Number(value));
                  return {
                    ...p,
                    codigo_motivo_dif: Number(value) || null,
                    Motivo: foundMot ? foundMot.descripcion : ''
                  };
                }
                return { ...p, [field]: value };
              })
            };
          })
        };
      });
      persistGruposDraft(nextGrupos);
      return nextGrupos;
    });
  };

  const handleStepCantidad = (lugarName, clientKey, localId, currentVal, delta) => {
    const rawStr = String(currentVal ?? '').trim();
    const currentNum = /^\d+$/.test(rawStr) ? parseInt(rawStr, 10) : 1;
    const nextVal = Math.max(1, currentNum + delta);
    handleProductFieldChange(lugarName, clientKey, localId, 'Cantidad', String(nextVal));
  };

  const handleFocusSelectAll = (e) => {
    const input = e.target;
    input.select();
    requestAnimationFrame(() => input.select());
  };

  const handleBarcodeDetectedForProduct = (code) => {
    const target = scannerTarget;
    if (!target) return;

    const clean = String(code || '').trim();
    const norm = normalizeBarcode(clean);

    const matched =
      (catalogos.productos || []).find((p) => {
        const mtx = String(p.codigomtx || '').trim();
        return mtx && (mtx === clean || (norm && normalizeBarcode(mtx) === norm));
      }) ||
      (catalogos.productos || []).find((p) => String(p.codigo || '').trim() === clean);

    setScannerTarget(null);

    if (matched) {
      handleProductFieldChange(
        target.lugar,
        target.clientKey,
        target.localId,
        'id_producto',
        matched.id_producto
      );
    } else {
      setErrorMsg(`No se encontró ningún producto en el catálogo con código MTX "${clean}".`);
    }
  };

  const handleSelectClienteForLugar = (clienteCatalogo) => {
    const lugarName = clientModalLugar;
    if (!lugarName) return;

    const newKey = `${lugarName}__${clienteCatalogo.id_cliente}::${clienteCatalogo.nombre}`;
    const nextExpLugares = { ...expandedLugares, [lugarName]: true };
    const nextExpClientes = { ...expandedClientes, [newKey]: true };
    setExpandedLugares(nextExpLugares);
    setExpandedClientes(nextExpClientes);

    setGrupos((prev) => {
      const targetExists = prev.some((g) => g.lugar === lugarName);
      const baseList = targetExists ? prev : [...prev, { lugar: lugarName, clientes: [] }];

      const nextGrupos = baseList.map((g) => {
        if (g.lugar !== lugarName) return g;
        const alreadyInLugar = g.clientes.some(
          (c) => Number(c.id_cliente) === Number(clienteCatalogo.id_cliente)
        );
        if (alreadyInLugar) return g;

        return {
          ...g,
          clientes: [
            ...g.clientes,
            {
              clientKey: newKey,
              Lugar_de_Entrega: lugarName,
              id_cliente: clienteCatalogo.id_cliente,
              Cliente: clienteCatalogo.nombre,
              id_etapa: headerInfo?.id_etapa || 1,
              fecha: headerInfo?.Fecha ? String(headerInfo.Fecha).slice(0, 10) : new Date().toISOString().slice(0, 10),
              id_remito_devoluciones: null,
              productos: []
            }
          ]
        };
      });
      persistGruposDraft(nextGrupos, nextExpLugares, nextExpClientes);
      return nextGrupos;
    });

    setClientModalLugar(null);
    setClientSearch('');
  };

  const filteredCatalogClients = (catalogos.clientes || []).filter((c) => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      String(c.nombre || '').toLowerCase().includes(q) ||
      String(c.id_cliente || '').includes(q)
    );
  });

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
          <p>Cargando devoluciones de {selectedLugar}...</p>
        </div>
      ) : (
        <div className="dev-groups-list">
          {grupos.map((grupo) => (
            <div key={grupo.lugar} className="dev-lugar-direct">
              {grupo.clientes.length === 0 ? (
                <div className="hr-empty-state" style={{ padding: '24px 16px' }}>
                  <Inbox size={36} style={{ color: 'var(--text-muted)' }} />
                  <h3>Sin clientes cargados en {grupo.lugar}</h3>
                  <p>Agregá un cliente para registrar productos devueltos en este lugar.</p>
                </div>
              ) : (
                grupo.clientes.map((cli) => {
                  const isCliExpanded = Boolean(expandedClientes[cli.clientKey]);
                  return (
                    <div key={cli.clientKey} className="dev-client-card">
                      <div className="dev-client-header-row">
                        <button
                          type="button"
                          className="dev-client-toggle"
                          onClick={() => toggleCliente(cli.clientKey)}
                        >
                          <div className="dev-client-title">
                            {isCliExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            <span>Cliente: <strong>{cli.Cliente}</strong></span>
                          </div>
                          <div className="dev-client-right">
                            {cli.productos.length > 0 && (
                              <span className="dev-client-badge">{cli.productos.length}</span>
                            )}
                            <Search size={15} className="dev-magnify-icon" />
                          </div>
                        </button>
                      </div>

                      {isCliExpanded && (
                        <div className="dev-client-body">
                          {cli.productos.length === 0 ? (
                            <p className="dev-no-prods-hint">
                              Sin productos devueltos registrados para este cliente.
                            </p>
                          ) : (
                            <div className="dev-products-stack">
                              {cli.productos.map((prod) => {
                                const conRetorno = prod.Tipo !== 'Virtual';
                                const qtyNum = /^\d+$/.test(String(prod.Cantidad ?? ''))
                                  ? parseInt(prod.Cantidad, 10)
                                  : 1;

                                return (
                                  <div key={prod.localId} className="dev-product-row-card">
                                    <div className="dev-prod-top-row">
                                      <button
                                        type="button"
                                        className="dev-scan-btn"
                                        onClick={() =>
                                          setScannerTarget({
                                            lugar: grupo.lugar,
                                            clientKey: cli.clientKey,
                                            localId: prod.localId
                                          })
                                        }
                                        title="Escanear código de barras (MTX)"
                                        aria-label="Escanear código de barras MTX del producto"
                                      >
                                        <ScanLine size={16} />
                                      </button>

                                      <div className="dev-field-full">
                                        <label className="dev-col-label">Producto *</label>
                                        <ProductCombobox
                                          productos={catalogos.productos || []}
                                          value={prod.id_producto}
                                          selectedLabel={prod.Producto}
                                          onSelect={(picked) =>
                                            handleProductFieldChange(
                                              grupo.lugar,
                                              cli.clientKey,
                                              prod.localId,
                                              'id_producto',
                                              picked ? picked.id_producto : null
                                            )
                                          }
                                        />
                                      </div>

                                      {!prod.id_remito_devoluciones_item && (
                                        <button
                                          type="button"
                                          className="dev-del-btn"
                                          onClick={() =>
                                            handleRemoveUnsavedProduct(grupo.lugar, cli.clientKey, prod.localId)
                                          }
                                          title="Quitar ítem"
                                        >
                                          <Trash2 size={15} />
                                        </button>
                                      )}
                                    </div>

                                    <div className="dev-fields-4grid">
                                      <div className="dev-green-cell">
                                        <label className="dev-col-label">Cantidad</label>
                                        <div className="entregado-stepper dev-qty-stepper">
                                          <button
                                            type="button"
                                            className="entregado-step-btn"
                                            aria-label="Disminuir cantidad devuelta"
                                            disabled={qtyNum <= 1 && prod.Cantidad !== ''}
                                            onClick={() =>
                                              handleStepCantidad(
                                                grupo.lugar,
                                                cli.clientKey,
                                                prod.localId,
                                                prod.Cantidad,
                                                -1
                                              )
                                            }
                                          >
                                            <Minus size={14} />
                                          </button>
                                          <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            className="entregado-input"
                                            value={prod.Cantidad}
                                            onFocus={handleFocusSelectAll}
                                            onKeyDown={(e) => {
                                              if (['-', '+', '.', ',', 'e', 'E'].includes(e.key)) e.preventDefault();
                                            }}
                                            onChange={(e) =>
                                              handleProductFieldChange(
                                                grupo.lugar,
                                                cli.clientKey,
                                                prod.localId,
                                                'Cantidad',
                                                e.target.value
                                              )
                                            }
                                          />
                                          <button
                                            type="button"
                                            className="entregado-step-btn"
                                            aria-label="Incrementar cantidad devuelta"
                                            onClick={() =>
                                              handleStepCantidad(
                                                grupo.lugar,
                                                cli.clientKey,
                                                prod.localId,
                                                prod.Cantidad,
                                                1
                                              )
                                            }
                                          >
                                            <Plus size={14} />
                                          </button>
                                        </div>
                                      </div>

                                      <div className="dev-green-cell">
                                        <label className="dev-col-label">Vencimiento</label>
                                        <input
                                          type="date"
                                          className="dev-green-input"
                                          value={prod.Vencimiento}
                                          onChange={(e) =>
                                            handleProductFieldChange(
                                              grupo.lugar,
                                              cli.clientKey,
                                              prod.localId,
                                              'Vencimiento',
                                              e.target.value
                                            )
                                          }
                                        />
                                      </div>

                                      <div className="dev-green-cell dev-cell-span2">
                                        <label className="dev-col-label">Motivo *</label>
                                        <select
                                          required
                                          className={`dev-green-input ${!prod.codigo_motivo_dif ? 'empty' : ''}`}
                                          value={prod.codigo_motivo_dif || ''}
                                          onChange={(e) =>
                                            handleProductFieldChange(
                                              grupo.lugar,
                                              cli.clientKey,
                                              prod.localId,
                                              'codigo_motivo_dif',
                                              e.target.value
                                            )
                                          }
                                        >
                                          <option value="">Seleccionar motivo...</option>
                                          {sortedMotivos.map((m) => (
                                            <option key={m.id_motivo} value={m.id_motivo}>
                                              {m.descripcion}
                                            </option>
                                          ))}
                                        </select>
                                      </div>

                                      <div className="dev-green-cell dev-cell-span2">
                                        <label className="dev-col-label">Tipo de devolución</label>
                                        <button
                                          type="button"
                                          role="switch"
                                          aria-checked={conRetorno}
                                          className={`dev-toggle-btn ${conRetorno ? 'on' : 'off'}`}
                                          onClick={() =>
                                            handleProductFieldChange(
                                              grupo.lugar,
                                              cli.clientKey,
                                              prod.localId,
                                              'Tipo',
                                              conRetorno ? 'Virtual' : 'Físico'
                                            )
                                          }
                                        >
                                          <span className="dev-toggle-track">
                                            <span className="dev-toggle-thumb" />
                                          </span>
                                          <span className="dev-toggle-text">
                                            {conRetorno ? 'Con retorno del producto' : 'Sin retorno del producto'}
                                          </span>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <button
                            type="button"
                            className="dev-add-btn"
                            onClick={() => handleAddProduct(grupo.lugar, cli.clientKey)}
                          >
                            <Plus size={16} />
                            <span>Agregar producto a devolver</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              <button
                type="button"
                className="dev-add-client-cta"
                onClick={() => setClientModalLugar(grupo.lugar)}
              >
                <UserPlus size={16} />
                <span>Agregar cliente para devolución en este lugar</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal Escáner MTX de Producto */}
      {scannerTarget && (
        <div className="modal-overlay" onClick={() => setScannerTarget(null)}>
          <div
            className="modal-card glass"
            style={{ maxWidth: '460px', width: '95%', maxHeight: '90vh', overflowY: 'auto', padding: '16px', alignItems: 'stretch', textAlign: 'left' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header-row" style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ScanLine size={20} style={{ color: 'var(--dy-blue)' }} />
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text)' }}>
                  Escanear Producto (MTX)
                </h3>
              </div>
              <button
                type="button"
                className="mode-toggle"
                style={{ width: 34, height: 34 }}
                onClick={() => setScannerTarget(null)}
              >
                <X size={18} />
              </button>
            </div>

            <BarcodeScanner
              onScanSuccess={handleBarcodeDetectedForProduct}
              onError={(err) => console.warn('[Devoluciones Scanner] error:', err)}
              tipText="Alinee el código de barras del producto (MTX) dentro del recuadro"
              manualButtonLabel="Ingresar MTX manualmente"
              manualModalTitle="Ingresar Código MTX"
              manualModalDescription="Ingrese el código MTX del producto para buscarlo y seleccionarlo."
              manualPlaceholder="Ej: 7795293202158"
              manualSubmitLabel="Seleccionar Producto"
            />
          </div>
        </div>
      )}

      {/* Modal Buscador / Selector de Cliente */}
      {clientModalLugar && (
        <div className="modal-overlay" onClick={() => setClientModalLugar(null)}>
          <div
            className="modal-card glass"
            style={{ maxHeight: '80vh', alignItems: 'stretch', textAlign: 'left', padding: '18px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header-row">
              <h3 style={{ margin: 0, fontSize: '1.02rem', color: 'var(--text)' }}>
                Agregar Cliente
              </h3>
              <button
                type="button"
                className="mode-toggle"
                style={{ width: 34, height: 34 }}
                onClick={() => setClientModalLugar(null)}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Lugar: <strong>{clientModalLugar}</strong>
            </p>

            <input
              type="text"
              className="login-input"
              style={{ paddingLeft: '12px' }}
              placeholder="Buscar cliente por nombre o código..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
            />

            <div className="dev-client-picker-list">
              {filteredCatalogClients.length === 0 ? (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>
                  No se encontraron clientes con ese filtro.
                </p>
              ) : (
                filteredCatalogClients.map((cli) => (
                  <button
                    key={cli.id_cliente}
                    type="button"
                    className="dev-client-picker-item"
                    onClick={() => handleSelectClienteForLugar(cli)}
                  >
                    <strong>{cli.nombre}</strong>
                    <span>Cód. #{cli.id_cliente}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <AlertModal
        isOpen={Boolean(errorMsg)}
        onClose={() => setErrorMsg(null)}
        type="error"
        title="Validación de Devoluciones"
        message={errorMsg}
        confirmText="Revisar"
      />
    </div>
  );
}
