import React from 'react';
import { createPortal } from 'react-dom';
import { Save, RefreshCw } from 'lucide-react';

/**
 * Floating Action Button (FAB) de guardado global montado vía portal en document.body
 * para garantizar position: fixed respecto al viewport y estilo uniforme azul Don Yeyo.
 */
export default function SaveFab({
  onClick,
  disabled = false,
  saving = false,
  title = 'Confirmar y guardar cambios'
}) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <button
      type="button"
      className="save-fab"
      onClick={onClick}
      disabled={disabled || saving}
      title={title}
      aria-label={title}
    >
      {saving ? <RefreshCw size={22} className="spin" /> : <Save size={22} />}
    </button>,
    document.body
  );
}
