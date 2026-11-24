import {
  saveEntregasHojaRuta,
  saveDevolucionesHojaRuta,
  saveCajonesHojaRuta
} from './api';
import {
  cacheEntregas,
  cacheDevoluciones,
  cacheCajones,
  queuePendingControl
} from './offlineStorage';
import { getHojaRutaDraft, clearSectionDirty } from './draftStorage';

const NON_NEGATIVE_INT_REGEX = /^\d+$/;
const POSITIVE_INT_NONZERO = /^[1-9]\d*$/;

export function dispatchDraftSaved(transaccionId, sections = []) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('dy-draft-saved', {
      detail: { transaccionId, sections }
    })
  );
}

export async function saveDraftSection(section, { email, hojaRuta, draftSection, refreshPendingCount }) {
  if (!hojaRuta?.Transaccionid || !email) {
    throw new Error('Falta información de hoja de ruta o usuario.');
  }

  const txId = hojaRuta.Transaccionid;
  const draft = draftSection || getHojaRutaDraft(email, txId)[section];
  if (!draft) return { ok: true, skipped: true };

  if (section === 'entregas') {
    const items = draft.items || [];
    const entregadoMap = draft.entregadoMap || {};
    const payloadItems = [];

    for (const item of items) {
      const valStr = String(entregadoMap[item.Hojarutaitemid] ?? '').trim();
      if (!NON_NEGATIVE_INT_REGEX.test(valStr)) {
        throw new Error(
          `En Entregas, "${item.Producto || 'Producto'}" debe tener una cantidad entera válida (>= 0).`
        );
      }
      payloadItems.push({
        Hojarutaitemid: item.Hojarutaitemid,
        Entregado: parseInt(valStr, 10)
      });
    }

    if (payloadItems.length === 0) {
      clearSectionDirty(email, txId, 'entregas', { openLugares: draft.openLugares || {} });
      return { ok: true };
    }

    const updatedItemsList = items.map((it) => ({
      ...it,
      Entregado: parseInt(String(entregadoMap[it.Hojarutaitemid]).trim(), 10)
    }));

    if (navigator.onLine) {
      const res = await saveEntregasHojaRuta(txId, payloadItems);
      const finalItems = res?.items || updatedItemsList;
      await cacheEntregas(txId, {
        hoja_ruta: draft.headerInfo || hojaRuta,
        items: finalItems
      });
    } else {
      await queuePendingControl({
        op_type: 'entregas',
        transaccionId: txId,
        items: payloadItems
      });
      await cacheEntregas(txId, {
        hoja_ruta: draft.headerInfo || hojaRuta,
        items: updatedItemsList
      });
      if (refreshPendingCount) await refreshPendingCount();
    }

    clearSectionDirty(email, txId, 'entregas', { openLugares: draft.openLugares || {} });
    dispatchDraftSaved(txId, ['entregas']);
    return { ok: true };
  }

  if (section === 'devoluciones') {
    const grupos = draft.grupos || [];
    const headerInfo = draft.headerInfo || hojaRuta;
    const clientesConProductos = [];

    for (const grupo of grupos) {
      for (const cli of grupo.clientes || []) {
        if (!cli.productos || cli.productos.length === 0) continue;

        for (const prod of cli.productos) {
          if (!prod.id_producto) {
            throw new Error(
              `En Devoluciones (${cli.Cliente}), debés seleccionar un producto válido de la lista.`
            );
          }
          const cantStr = String(prod.Cantidad ?? '').trim();
          if (!POSITIVE_INT_NONZERO.test(cantStr)) {
            throw new Error(
              `En Devoluciones (${cli.Cliente}), "${prod.Producto || 'Producto'}" debe tener cantidad > 0.`
            );
          }
          if (!prod.codigo_motivo_dif || !prod.Motivo || !String(prod.Motivo).trim()) {
            throw new Error(
              `En Devoluciones (${cli.Cliente}), el motivo es obligatorio para "${prod.Producto || 'Producto'}".`
            );
          }
        }

        clientesConProductos.push({
          Lugar_de_Entrega: cli.Lugar_de_Entrega,
          id_cliente: cli.id_cliente,
          Cliente: cli.Cliente,
          id_etapa: cli.id_etapa || `${txId}-${cli.id_cliente}`,
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

    if (clientesConProductos.length > 0) {
      if (navigator.onLine) {
        const res = await saveDevolucionesHojaRuta(txId, clientesConProductos);
        if (res && res.ok) {
          await cacheDevoluciones(txId, {
            hoja_ruta: headerInfo,
            rows: res.rows,
            catalogos: draft.catalogos || { productos: [], clientes: [], motivos: [] }
          });
        }
      } else {
        await queuePendingControl({
          op_type: 'devoluciones',
          transaccionId: txId,
          clientes: clientesConProductos
        });
        if (refreshPendingCount) await refreshPendingCount();
      }
    }

    clearSectionDirty(email, txId, 'devoluciones', {
      expandedLugares: draft.expandedLugares || {},
      expandedClientes: draft.expandedClientes || {}
    });
    dispatchDraftSaved(txId, ['devoluciones']);
    return { ok: true };
  }

  if (section === 'cajones') {
    const items = draft.items || [];
    const headerInfo = draft.headerInfo || hojaRuta;
    const payloadItems = [];

    for (const it of items) {
      const entStr = String(it.cajones_entregados ?? '').trim() || '0';
      const devStr = String(it.cajones_devueltos ?? '').trim() || '0';
      if (!NON_NEGATIVE_INT_REGEX.test(entStr) || !NON_NEGATIVE_INT_REGEX.test(devStr)) {
        throw new Error(`En Cajones ("${it.Cliente}"), las cantidades deben ser enteros >= 0.`);
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

    if (payloadItems.length > 0) {
      if (navigator.onLine) {
        await saveCajonesHojaRuta(txId, payloadItems);
        await cacheCajones(txId, {
          hoja_ruta: headerInfo,
          items: payloadItems
        });
      } else {
        await queuePendingControl({
          op_type: 'cajones',
          transaccionId: txId,
          items: payloadItems
        });
        await cacheCajones(txId, {
          hoja_ruta: headerInfo,
          items: payloadItems
        });
        if (refreshPendingCount) await refreshPendingCount();
      }
    }

    clearSectionDirty(email, txId, 'cajones');
    dispatchDraftSaved(txId, ['cajones']);
    return { ok: true };
  }

  return { ok: false };
}
