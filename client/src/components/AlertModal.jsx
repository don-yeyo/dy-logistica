import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const ICONS = {
  error: {
    icon: AlertCircle,
    color: '#ef4444',
    bg: '#fee2e2',
    titleDefault: 'Ha ocurrido un error'
  },
  warning: {
    icon: AlertTriangle,
    color: '#f59e0b',
    bg: '#fef3c7',
    titleDefault: 'Atención'
  },
  success: {
    icon: CheckCircle2,
    color: '#10b981',
    bg: '#ecfdf5',
    titleDefault: 'Operación Exitosa'
  },
  info: {
    icon: Info,
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.15)',
    titleDefault: 'Información'
  }
};

export default function AlertModal({
  isOpen,
  onClose,
  type = 'error',
  title,
  message,
  buttonText,
  confirmText,
  details,
  detail
}) {
  const finalButtonText = confirmText || buttonText || 'Entendido';
  const finalDetails = detail || details || null;
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const config = ICONS[type] || ICONS.error;
  const IconComponent = config.icon;

  return (
    <div className="modal-overlay page-transition" onClick={onClose}>
      <div 
        className="modal-card glass" 
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '380px',
          background: 'var(--surface)',
          borderRadius: '24px',
          padding: '24px 20px',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          position: 'relative'
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Cerrar"
        >
          <X size={20} />
        </button>

        <div style={{
          width: '54px',
          height: '54px',
          borderRadius: '50%',
          background: config.bg,
          color: config.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '6px'
        }}>
          <IconComponent size={30} />
        </div>

        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
          {title || config.titleDefault}
        </h3>

        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: 0 }}>
          {message}
        </p>

        {finalDetails && (
          <div style={{
            width: '100%',
            background: 'var(--surface-active)',
            padding: '8px 12px',
            borderRadius: '10px',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            textAlign: 'left',
            fontFamily: 'monospace',
            maxHeight: '80px',
            overflowY: 'auto'
          }}>
            {finalDetails}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            height: '46px',
            borderRadius: '14px',
            border: 'none',
            background: 'var(--dy-blue)',
            color: '#fff',
            fontWeight: 800,
            fontSize: '0.92rem',
            cursor: 'pointer',
            marginTop: '6px'
          }}
        >
          {finalButtonText}
        </button>
      </div>
    </div>
  );
}
