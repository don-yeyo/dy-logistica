const DRAFT_PREFIX = 'dy_hr_draft::';

export function buildDraftKey(email, transaccionId, lugar = '') {
  if (!email || !transaccionId) return null;
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanLugar = String(lugar || '').trim().toLowerCase();
  return cleanLugar
    ? `${DRAFT_PREFIX}${cleanEmail}::${transaccionId}::${cleanLugar}`
    : `${DRAFT_PREFIX}${cleanEmail}::${transaccionId}`;
}

export function getHojaRutaDraft(email, transaccionId, lugar = '') {
  const key = buildDraftKey(email, transaccionId, lugar);
  if (!key) return {};
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveHojaRutaDraft(email, transaccionId, nextDraft, lugar = '') {
  const key = buildDraftKey(email, transaccionId, lugar);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(nextDraft));
  } catch (err) {
    console.warn('[DraftStorage] No se pudo guardar en localStorage:', err?.message);
  }
}

export function dispatchDraftChanged(email, transaccionId, section, lugar = '') {
  if (typeof window === 'undefined') return;
  const emit = () => {
    window.dispatchEvent(
      new CustomEvent('dy-draft-changed', {
        detail: { email, transaccionId, section, lugar }
      })
    );
  };

  if (typeof queueMicrotask === 'function') {
    queueMicrotask(emit);
  } else {
    setTimeout(emit, 0);
  }
}

export function patchSectionDraft(email, transaccionId, section, patch, lugar = '') {
  if (!email || !transaccionId || !section) return;
  const current = getHojaRutaDraft(email, transaccionId, lugar);
  const currentSec = current[section] || {};
  const nextSec = {
    ...currentSec,
    ...patch
  };

  if (patch.dirty === true && !currentSec.dirtySince && !patch.dirtySince) {
    nextSec.dirtySince = Date.now();
  }
  if (patch.dirty === false) {
    nextSec.dirtySince = null;
  }

  const nextDraft = {
    ...current,
    ...(lugar ? { lugarLabel: String(lugar).trim() } : {}),
    [section]: nextSec,
    updatedAt: Date.now()
  };

  saveHojaRutaDraft(email, transaccionId, nextDraft, lugar);
  dispatchDraftChanged(email, transaccionId, section, lugar);
}

export function patchRemitoItemDraft(email, transaccionId, remitoId, remitoDraft, lugar = '') {
  if (!email || !transaccionId || !remitoId) return;
  const current = getHojaRutaDraft(email, transaccionId, lugar);
  const prevByRemito = { ...(current.remitos?.byRemitoId || {}) };
  const key = String(remitoId);

  if (remitoDraft) {
    prevByRemito[key] = remitoDraft;
  } else {
    delete prevByRemito[key];
  }

  const hasDirty = Object.keys(prevByRemito).length > 0;
  patchSectionDraft(
    email,
    transaccionId,
    'remitos',
    {
      byRemitoId: prevByRemito,
      dirty: hasDirty,
      dirtySince: hasDirty ? Date.now() : null
    },
    lugar
  );
}

export function clearSectionDirty(email, transaccionId, section, uiStateToKeep = {}, lugar = '') {
  if (!email || !transaccionId || !section) return;
  const current = getHojaRutaDraft(email, transaccionId, lugar);
  const prevSec = current[section] || {};
  const cleanedSec = {
    ...uiStateToKeep,
    dirty: false,
    dirtySince: null
  };

  if (prevSec.openLugares !== undefined && cleanedSec.openLugares === undefined) {
    cleanedSec.openLugares = prevSec.openLugares;
  }
  if (prevSec.expandedLugares !== undefined && cleanedSec.expandedLugares === undefined) {
    cleanedSec.expandedLugares = prevSec.expandedLugares;
  }
  if (prevSec.expandedClientes !== undefined && cleanedSec.expandedClientes === undefined) {
    cleanedSec.expandedClientes = prevSec.expandedClientes;
  }

  const nextDraft = {
    ...current,
    ...(lugar ? { lugarLabel: String(lugar).trim() } : {}),
    [section]: cleanedSec,
    updatedAt: Date.now()
  };

  saveHojaRutaDraft(email, transaccionId, nextDraft, lugar);
  dispatchDraftChanged(email, transaccionId, section, lugar);
}

export function getDirtySummary(email, transaccionId, lugar = '') {
  const draft = getHojaRutaDraft(email, transaccionId, lugar);
  const entregas = Boolean(draft.entregas?.dirty);
  const devoluciones = Boolean(draft.devoluciones?.dirty);
  const cajones = Boolean(draft.cajones?.dirty);
  const remitos = Boolean(draft.remitos?.dirty);
  const entregasUnconfirmed = Boolean(draft.entregas?.unconfirmedDb);
  const dirtySections = [];
  const dirtyTimes = [];

  if (entregas) {
    dirtySections.push('entregas');
    if (draft.entregas?.dirtySince) dirtyTimes.push(draft.entregas.dirtySince);
  }
  if (devoluciones) {
    dirtySections.push('devoluciones');
    if (draft.devoluciones?.dirtySince) dirtyTimes.push(draft.devoluciones.dirtySince);
  }
  if (cajones) {
    dirtySections.push('cajones');
    if (draft.cajones?.dirtySince) dirtyTimes.push(draft.cajones.dirtySince);
  }
  if (remitos) {
    dirtySections.push('remitos');
    if (draft.remitos?.dirtySince) dirtyTimes.push(draft.remitos.dirtySince);
  }

  return {
    entregas,
    devoluciones,
    cajones,
    remitos,
    entregasUnconfirmed,
    anyDirty: dirtySections.length > 0,
    dirtySections,
    lastDirtyAt: dirtyTimes.length > 0 ? Math.max(...dirtyTimes) : null
  };
}

export function getLugaresDirtyMap(email, transaccionId) {
  const map = {};
  if (!email || !transaccionId) return map;
  const cleanEmail = String(email).trim().toLowerCase();
  const prefix = `${DRAFT_PREFIX}${cleanEmail}::${transaccionId}::`;
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const isDirty = Boolean(
        parsed?.entregas?.dirty ||
          parsed?.devoluciones?.dirty ||
          parsed?.cajones?.dirty ||
          parsed?.remitos?.dirty
      );
      if (isDirty) {
        const lugarKey = (parsed.lugarLabel || k.slice(prefix.length)).trim().toLowerCase();
        map[lugarKey] = true;
      }
    }
  } catch (err) {
    console.warn('[DraftStorage] Error leyendo dirty por lugar:', err?.message);
  }
  return map;
}

export function clearAllDrafts() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(DRAFT_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    console.warn('[DraftStorage] Error limpiando borradores:', err?.message);
  }
}
