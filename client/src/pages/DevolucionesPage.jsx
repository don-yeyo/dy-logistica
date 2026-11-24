import React, { useState, useEffect, useCallback } from 'react';
import HojaRutaHeader from '../components/HojaRutaHeader';
import AlertModal from '../components/AlertModal';
import { fetchDevolucionesHojaRuta, saveDevolucionesHojaRuta } from '../services/api';
import {
  cacheDevoluciones,
  getCachedDevoluciones,
  queuePendingControl
} from '../services/offlineStorage';
import { useAuth } from '../config/AuthContext';
import {
  Save,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Search,
  Plus,
  Trash2,
  MapPin,
  UserPlus,
  Inbox,
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
        id_producto: row.id_producto || 1,
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

/**
 * Módulo 4.2.2: Devolución de Mercadería (Logística DY - Devoluciones).
 * Datos desde HOJA_DE_RUTA_DEVOLUCIONES agrupados por Lugar_de_Entrega y Cliente (expandibles/colapsables).
 */
export default function DevolucionesPage({ hojaRuta, onChangeHojaRuta }) {
  const { refreshPendingCount } = useAuth();
  const [headerInfo, setHeaderInfo] = useState(hojaRuta);
  const [grupos, setGrupos] = useState([]);
  const [catalogos, setCatalogos] = useState({ productos: [], clientes: [], motivos: [] });
  const [expandedLugares, setExpandedLugares] = useState({});
  const [expandedClientes, setExpandedClientes] = useState({});
  const [clientModalLugar, setClientModalLugar] = useState(null);
  const [clientSearch, setClientSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const applyLoadedData = useCallback((loadedHeader, rows, loadedCatalogos) => {
    setHeaderInfo(loadedHeader || hojaRuta);
    const tree = buildDevolucionesTree(rows || []);
    setGrupos(tree);
    setCatalogos(loadedCatalogos || { productos: [], clientes: [], motivos: [] });

    // Expandir el primer lugar de entrega y clientes con devoluciones ya cargadas
    const nextLugares = {};
    const nextClientes = {};
    tree.forEach((g, idx) => {
      const hasItems = g.clientes.some((c) => c.productos.length > 0);
      if (idx === 0 || hasItems) {
        nextLugares[g.lugar] = true;
      }
      g.clientes.forEach((c) => {
        if (c.productos.length > 0) {
          nextClientes[c.clientKey] = true;
        }
      });
    });
    setExpandedLugares(nextLugares);
    setExpandedClientes(nextClientes);
  }, [hojaRuta]);

  const loadDevoluciones = useCallback(async () => {
    if (!hojaRuta?.Transaccionid) return;
    try {
      setLoading(true);
      setErrorMsg(null);

      if (navigator.onLine) {
        try {
          const res = await fetchDevolucionesHojaRuta(hojaRuta.Transaccionid);
          if (res && res.ok) {
            await cacheDevoluciones(hojaRuta.Transaccionid, {
              hoja_ruta: res.hoja_ruta,
              rows: res.rows,
              catalogos: res.catalogos
            });
            applyLoadedData(res.hoja_ruta, res.rows, res.catalogos);
            return;
          }
        } catch (apiErr) {
          console.warn('[DevolucionesPage] Error API, usando caché local:', apiErr.message);
          const cached = await getCachedDevoluciones(hojaRuta.Transaccionid);
          if (cached) {
            applyLoadedData(cached.hoja_ruta, cached.rows, cached.catalogos);
            return;
          }
          throw apiErr;
        }
      } else {
        const cached = await getCachedDevoluciones(hojaRuta.Transaccionid);
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
  }, [hojaRuta, applyLoadedData]);

  useEffect(() => {
    loadDevoluciones();
  }, [loadDevoluciones]);

  const toggleLugar = (lugar) => {
    setExpandedLugares((prev) => ({ ...prev, [lugar]: !prev[lugar] }));
  };

  const toggleCliente = (clientKey) => {
    setExpandedClientes((prev) => ({ ...prev, [clientKey]: !prev[clientKey] }));
  };

  const handleAddProduct = (lugarName, clientKey) => {
    const defaultProd = catalogos.productos[0] || { id_producto: 1, nombre: 'Producto General' };
    const defaultMotivo = catalogos.motivos[0] || null;

    setGrupos((prev) =>
      prev.map((g) => {
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
                  id_producto: defaultProd.id_producto,
                  Producto: defaultProd.nombre,
                  Cantidad: '1',
                  Vencimiento: '',
                  codigo_motivo_dif: defaultMotivo?.id_motivo || null,
                  Motivo: defaultMotivo?.descripcion || '',
                  Tipo: 'Físico'
                }
              ]
            };
          })
        };
      })
    );

    setExpandedLugares((prev) => ({ ...prev, [lugarName]: true }));
    setExpandedClientes((prev) => ({ ...prev, [clientKey]: true }));
  };

  const handleRemoveUnsavedProduct = (lugarName, clientKey, localId) => {
    setGrupos((prev) =>
      prev.map((g) => {
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
      })
    );
  };

  const handleProductFieldChange = (lugarName, clientKey, localId, field, value) => {
    if (field === 'Cantidad' && value !== '' && !/^\d+$/.test(value)) {
      return;
    }

    setGrupos((prev) =>
      prev.map((g) => {
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
                  const found = catalogos.productos.find((cp) => Number(cp.id_producto) === Number(value));
                  return {
                    ...p,
                    id_producto: Number(value),
                    Producto: found ? found.nombre : p.Producto
                  };
                }
                if (field === 'codigo_motivo_dif') {
                  const foundMot = catalogos.motivos.find((m) => Number(m.id_motivo) === Number(value));
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
      })
    );
  };

  const handleSelectClienteForLugar = (clienteCatalogo) => {
    const lugarName = clientModalLugar;
    if (!lugarName) return;

    const newKey = `${lugarName}__${clienteCatalogo.id_cliente}::${clienteCatalogo.nombre}`;

    setGrupos((prev) => {
      const targetExists = prev.some((g) => g.lugar === lugarName);
      const baseList = targetExists ? prev : [...prev, { lugar: lugarName, clientes: [] }];

      return baseList.map((g) => {
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
    });

    setExpandedLugares((prev) => ({ ...prev, [lugarName]: true }));
    setExpandedClientes((prev) => ({ ...prev, [newKey]: true }));
    setClientModalLugar(null);
    setClientSearch('');
  };

  const handleGuardar = async () => {
    const clientesConProductos = [];

    for (const grupo of grupos) {
      for (const cli of grupo.clientes) {
        if (!cli.productos || cli.productos.length === 0) continue;

        for (const prod of cli.productos) {
          const cantStr = String(prod.Cantidad ?? '').trim();
          if (!POSITIVE_INT_NONZERO.test(cantStr)) {
            setErrorMsg(`La cantidad devuelta para "${prod.Producto || 'Producto'}" en ${cli.Cliente} debe ser un entero mayor a 0.`);
            return;
          }
          if (!prod.Motivo || !String(prod.Motivo).trim()) {
            setErrorMsg(`Debe indicar al menos un motivo de devolución para "${prod.Producto || 'Producto'}" en ${cli.Cliente}.`);
            return;
          }
        }

        clientesConProductos.push({
          Lugar_de_Entrega: cli.Lugar_de_Entrega,
          id_cliente: cli.id_cliente,
          Cliente: cli.Cliente,
          id_etapa: cli.id_etapa || `${hojaRuta.Transaccionid}-${cli.id_cliente}`,
          fecha: cli.fecha || (headerInfo?.Fecha ? String(headerInfo.Fecha).slice(0, 10) : new Date().toISOString().slice(0, 10)),
          id_remito_devoluciones: cli.id_remito_devoluciones || null,
          productos: cli.productos.map((p) => ({
            id_remito_devoluciones_item: p.id_remito_devoluciones_item || null,
            id_producto: p.id_producto,
            Producto: p.Producto,
            Cantidad: parseInt(String(p.Cantidad).trim(), 10),
            Vencimiento: p.Vencimiento || null,
            codigo_motivo_dif: p.codigo_motivo_dif || null,
            Motivo: p.Motivo.trim(),
            Tipo: p.Tipo === 'Virtual' ? 'Virtual' : 'Físico'
          }))
        });
      }
    }

    if (clientesConProductos.length === 0) {
      setErrorMsg('Agregue al menos un producto devuelto con cantidad y motivo antes de guardar.');
      return;
    }

    try {
      setSaving(true);
      setErrorMsg(null);

      if (navigator.onLine) {
        const res = await saveDevolucionesHojaRuta(hojaRuta.Transaccionid, clientesConProductos);
        if (res && res.ok) {
          await cacheDevoluciones(hojaRuta.Transaccionid, {
            hoja_ruta: headerInfo,
            rows: res.rows,
            catalogos
          });
          applyLoadedData(headerInfo, res.rows, catalogos);
          setSuccessMsg(res.message || 'Devoluciones registradas correctamente.');
        }
      } else {
        await queuePendingControl({
          op_type: 'devoluciones',
          transaccionId: hojaRuta.Transaccionid,
          clientes: clientesConProductos
        });
        await refreshPendingCount();
        setSuccessMsg('Sin conexión: devoluciones guardadas localmente para sincronizar automáticamente.');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message || 'Error al guardar las devoluciones.');
    } finally {
      setSaving(false);
    }
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
        title="Logística DY - Devoluciones"
        onChangeHojaRuta={onChangeHojaRuta}
      />

      {loading ? (
        <div className="hr-empty-state">
          <RefreshCw size={30} className="spin" style={{ color: 'var(--dy-blue)' }} />
          <p>Cargando lugares de entrega y devoluciones...</p>
        </div>
      ) : grupos.length === 0 ? (
        <div className="hr-empty-state">
          <Inbox size={42} style={{ color: 'var(--text-muted)' }} />
          <h3>Sin paradas cargadas en esta hoja de ruta</h3>
          <p>Puedes agregar un cliente manualmente para registrar una devolución.</p>
          <button
            type="button"
            className="dev-add-btn"
            onClick={() => setClientModalLugar('Entrega Directa / Ruta')}
          >
            <UserPlus size={16} />
            <span>Agregar Cliente</span>
          </button>
        </div>
      ) : (
        <div className="dev-groups-list">
          {grupos.map((grupo) => {
            const isLugarExpanded = Boolean(expandedLugares[grupo.lugar]);
            const totalDevsLugar = grupo.clientes.reduce((acc, c) => acc + c.productos.length, 0);

            return (
              <section key={grupo.lugar} className="dev-lugar-card">
                {/* Nivel 1: Barra celeste Lugar de Entrega (Expandible / Colapsable) */}
                <button
                  type="button"
                  className="dev-lugar-toggle"
                  onClick={() => toggleLugar(grupo.lugar)}
                >
                  <div className="dev-lugar-left">
                    {isLugarExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    <MapPin size={15} />
                    <span>Lugar de entrega: <strong>{grupo.lugar}</strong></span>
                  </div>
                  <span className={`dev-count-pill ${totalDevsLugar > 0 ? 'has-items' : ''}`}>
                    {totalDevsLugar} ítem(s)
                  </span>
                </button>

                {isLugarExpanded && (
                  <div className="dev-lugar-body">
                    {grupo.clientes.length === 0 ? (
                      <div className="dev-empty-client-row">
                        <span>Cliente: <em>Sin clientes asignados</em></span>
                        <button
                          type="button"
                          className="dev-search-client-btn"
                          onClick={() => setClientModalLugar(grupo.lugar)}
                        >
                          <Search size={15} />
                          <span>Agregar Cliente</span>
                        </button>
                      </div>
                    ) : (
                      grupo.clientes.map((cli) => {
                        const isCliExpanded = Boolean(expandedClientes[cli.clientKey]);
                        return (
                          <div key={cli.clientKey} className="dev-client-card">
                            {/* Nivel 2: Barra Cliente (Expandible / Colapsable) */}
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
                                    {cli.productos.map((prod) => (
                                      <div key={prod.localId} className="dev-product-row-card">
                                        <div className="dev-prod-top-row">
                                          <div className="dev-field-full">
                                            <label className="dev-col-label">Producto</label>
                                            <select
                                              className="dev-select-plain"
                                              value={prod.id_producto || ''}
                                              onChange={(e) =>
                                                handleProductFieldChange(
                                                  grupo.lugar,
                                                  cli.clientKey,
                                                  prod.localId,
                                                  'id_producto',
                                                  e.target.value
                                                )
                                              }
                                            >
                                              {(catalogos.productos || []).map((cp) => (
                                                <option key={cp.id_producto} value={cp.id_producto}>
                                                  {cp.nombre}
                                                </option>
                                              ))}
                                            </select>
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
                                            <input
                                              type="text"
                                              inputMode="numeric"
                                              pattern="[0-9]*"
                                              className="dev-green-input center"
                                              value={prod.Cantidad}
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

                                          <div className="dev-green-cell">
                                            <label className="dev-col-label">Motivo</label>
                                            <select
                                              className="dev-green-input"
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
                                              <option value="">Seleccionar...</option>
                                              {(catalogos.motivos || []).map((m) => (
                                                <option key={m.id_motivo} value={m.id_motivo}>
                                                  {m.descripcion}
                                                </option>
                                              ))}
                                            </select>
                                          </div>

                                          <div className="dev-green-cell">
                                            <label className="dev-col-label">Tipo</label>
                                            <select
                                              className="dev-green-input"
                                              value={prod.Tipo}
                                              onChange={(e) =>
                                                handleProductFieldChange(
                                                  grupo.lugar,
                                                  cli.clientKey,
                                                  prod.localId,
                                                  'Tipo',
                                                  e.target.value
                                                )
                                              }
                                            >
                                              <option value="Físico">Físico</option>
                                              <option value="Virtual">Virtual</option>
                                            </select>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <button
                                  type="button"
                                  className="dev-add-btn"
                                  onClick={() => handleAddProduct(grupo.lugar, cli.clientKey)}
                                >
                                  <Plus size={16} />
                                  <span>Agregar</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}

                    {/* Botón para agregar otro cliente dentro del mismo Lugar de Entrega */}
                    <button
                      type="button"
                      className="dev-add-client-link"
                      onClick={() => setClientModalLugar(grupo.lugar)}
                    >
                      <UserPlus size={15} />
                      <span>Agregar cliente en {grupo.lugar}</span>
                    </button>
                  </div>
                )}
              </section>
            );
          })}

          {/* Botón Guardar al final de la pantalla */}
          <div className="module-save-footer">
            <button
              type="button"
              className="module-save-btn devoluciones"
              onClick={handleGuardar}
              disabled={saving}
            >
              {saving ? (
                <>
                  <RefreshCw size={19} className="spin" />
                  <span>Guardando devoluciones...</span>
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

      <AlertModal
        isOpen={Boolean(successMsg)}
        onClose={() => setSuccessMsg(null)}
        type="success"
        title="Devoluciones Guardadas"
        message={successMsg}
        confirmText="Aceptar"
      />
    </div>
  );
}
