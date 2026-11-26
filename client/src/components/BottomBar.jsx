import React from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Camera, Check, RefreshCw } from 'lucide-react';

export default function BottomBar({
  onBack,
  backLabel = '',
  onSave,
  onCameraClick,
  saving = false,
  saveDisabled = false,
  saveLabel = 'Guardar Control'
}) {
  const barElement = (
    <div className="bottom-bar">
      <div className="bottom-bar-inner">
        {onBack && (
          <button
            type="button"
            className={`btn-back-square${backLabel ? ' btn-back-labeled' : ''}`}
            onClick={onBack}
            title={backLabel || 'Volver al listado de remitos'}
          >
            <ArrowLeft size={backLabel ? 19 : 24} />
            {backLabel && <span>{backLabel}</span>}
          </button>
        )}

        {onCameraClick && (
          <button
            type="button"
            className="btn-back-square"
            style={{ background: '#eff6ff', color: 'var(--dy-blue)', borderColor: '#bfdbfe' }}
            onClick={onCameraClick}
            title="Tomar Foto"
          >
            <Camera size={24} />
          </button>
        )}

        {onSave && (
          <button
            type="button"
            className="btn-primary-action"
            onClick={onSave}
            disabled={saving || saveDisabled}
          >
            {saving ? (
              <>
                <RefreshCw size={22} className="spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Check size={24} />
                <span>{saveLabel}</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(barElement, document.body)
    : barElement;
}

