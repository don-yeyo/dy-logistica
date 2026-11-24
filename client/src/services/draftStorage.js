const DRAFT_PREFIX = 'dy_hr_draft::';

export function buildDraftKey(email, transaccionId) {
  if (!email || !transaccionId) return null;
  return `${DRAFT_PREFIX}${String(email).trim().toLowerCase()}::${transaccionId}`;
}

export function getHojaRutaDraft(email, transaccionId) {
  const key = buildDraftKey(email, transaccionId);
  if (!key) return {};
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveHojaRutaDraft(email, transaccionId, nextDraft) {
  const key = buildDraftKey(email, transaccionId);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(nextDraft));
  } catch (err) {
    console.warn('[DraftStorage] No se pudo guardar en localStorage:', err?.message);
  }
}

export function dispatchDraftChanged(email, transaccionId, section) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('dy-draft-changed', {
      detail: { email, transaccionId, section }
    })
  );
}

export function patchSectionDraft(email, transaccionId, section, patch) {
  if (!email || !transaccionId || !section) return;
  const current = getHojaRutaDraft(email, transaccionId);
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
    [section]: nextSec,
    updatedAt: Date.now()
  };

  saveHojaRutaDraft(email, transaccionId, nextDraft);
  dispatchDraftChanged(email, transaccionId, section);
}

export function clearSectionDirty(email, transaccionId, section, uiStateToKeep = {}) {
  if (!email || !transaccionId || !section) return;
  const current = getHojaRutaDraft(email, transaccionId);
  const prevSec = current[section] || {};
  const cleanedSec = {
    ...uiStateToKeep,
    dirty: false,
    dirtySince: null
  };

  // Preservar estado de acordeones si existía en la sección y no se sobrescribió
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
    [section]: cleanedSec,
    updatedAt: Date.now()
  };

  saveHojaRutaDraft(email, transaccionId, nextDraft);
  dispatchDraftChanged(email, transaccionId, section);
}

export function getDirtySummary(email, transaccionId) {
  const draft = getHojaRutaDraft(email, transaccionId);
  const entregas = Boolean(draft.entregas?.dirty);
  const devoluciones = Boolean(draft.devoluciones?.dirty);
  const cajones = Boolean(draft.cajones?.dirty);
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

  return {
    entregas,
    devoluciones,
    cajones,
    anyDirty: dirtySections.length > 0,
    dirtySections,
    lastDirtyAt: dirtyTimes.length > 0 ? Math.max(...dirtyTimes) : null
  };
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
