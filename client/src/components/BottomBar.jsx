import React from 'react';
import { ArrowLeft, Camera, Check, RefreshCw } from 'lucide-react';

export default function BottomBar({
  onBack,
  onSave,
  onCameraClick,
  saving = false,
  saveDisabled = false,
  saveLabel = 'Guardar Control'
}) {
  return (
    <div className="bottom-bar">
      <div className="bottom-bar-inner">
        {onBack && (
          <button
            type="button"
            className="btn-back-square"
            onClick={onBack}
            title="Volver al listado de remitos"
          >
            <ArrowLeft size={24} />
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
}
