import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Lightbulb, Send, X, CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';
import { useAuth } from '../config/AuthContext';
import { enviarSugerencia } from '../services/api';

const CATEGORIAS = [
  { id: 'MEJORA', label: 'Mejora funcional' },
  { id: 'UX_UI', label: 'Diseño / Usabilidad' },
  { id: 'ERROR', label: 'Error / Problema' },
  { id: 'OTRO', label: 'Otra sugerencia' }
];

export default function SugerenciaModal({ isOpen, onClose, currentModule = 'General' }) {
  const { user } = useAuth();
  const [categoria, setCategoria] = useState('MEJORA');
  const [asunto, setAsunto] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [sentInfo, setSentInfo] = useState(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    setErrorMsg(null);
    setSentInfo(null);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !sending) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, sending, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleClose = () => {
    if (sending) return;
    setAsunto('');
    setMensaje('');
    setCategoria('MEJORA');
    setErrorMsg(null);
    setSentInfo(null);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!navigator.onLine) {
      setErrorMsg('Necesitás conexión a internet para enviar la sugerencia por correo.');
      return;
    }

    const cleanAsunto = asunto.trim();
    const cleanMensaje = mensaje.trim();

    if (cleanAsunto.length < 3) {
      setErrorMsg('Ingresá un asunto breve de al menos 3 caracteres.');
      return;
    }
    if (cleanMensaje.length < 5) {
      setErrorMsg('Contanos un poco más de detalle (al menos 5 caracteres).');
      return;
    }

    try {
      setSending(true);
      const res = await enviarSugerencia({
        categoria,
        modulo: currentModule,
        asunto: cleanAsunto,
        mensaje: cleanMensaje
      });
      setSentInfo({
        id: res?.id,
        message: res?.message || '¡Gracias! Tu sugerencia fue enviada correctamente.'
      });
      setAsunto('');
      setMensaje('');
    } catch (err) {
      setErrorMsg(
        err?.response?.data?.error ||
        err?.message ||
        'No se pudo enviar la sugerencia en este momento.'
      );
    } finally {
      setSending(false);
    }
  };

  return createPortal(
    <div
      className="modal-overlay sugerencia-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Sugerir una mejora del sistema"
      onClick={handleClose}
    >
      <div
        className="modal-card glass sugerencia-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="sugerencia-icon-badge">
              <Lightbulb size={20} />
            </div>
            <div>
              <h3 className="sugerencia-title">Sugerir una mejora</h3>
              <span className="sugerencia-subtitle">
                Pantalla actual: <strong>{currentModule}</strong>
              </span>
            </div>
          </div>
          <button
            type="button"
            className="mode-toggle"
            style={{ width: 34, height: 34 }}
            onClick={handleClose}
            disabled={sending}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {sentInfo ? (
          <div className="sugerencia-success-box">
            <div className="sugerencia-success-icon">
              <CheckCircle2 size={36} />
            </div>
            <h4>¡Sugerencia enviada!</h4>
            <p>{sentInfo.message}</p>
            {sentInfo.id && (
              <span className="sugerencia-ticket-tag">Registro #{sentInfo.id}</span>
            )}
            <button
              type="button"
              className="btn-login-primary"
              style={{ marginTop: 8 }}
              onClick={handleClose}
            >
              Volver al sistema
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="sugerencia-form">
            <div className="sugerencia-meta-pill">
              Enviado por: <strong>{user?.nombre || user?.email}</strong>
            </div>

            <div className="sugerencia-field">
              <label>Tipo de sugerencia</label>
              <div className="sugerencia-cats">
                {CATEGORIAS.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`sugerencia-cat-btn ${categoria === cat.id ? 'active' : ''}`}
                    onClick={() => setCategoria(cat.id)}
                    disabled={sending}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="sugerencia-field">
              <label htmlFor="sugerencia-asunto">Asunto *</label>
              <input
                id="sugerencia-asunto"
                type="text"
                maxLength={200}
                className="sugerencia-input"
                placeholder="Ej: Botón más grande para confirmar remito"
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
                disabled={sending}
                required
              />
            </div>

            <div className="sugerencia-field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="sugerencia-mensaje">Detalle *</label>
                <span className="sugerencia-counter">{mensaje.length}/4000</span>
              </div>
              <textarea
                id="sugerencia-mensaje"
                rows={4}
                maxLength={4000}
                className="sugerencia-textarea"
                placeholder="Describí tu idea, qué mejorarías o qué inconveniente encontraste..."
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                disabled={sending}
                required
              />
            </div>

            {errorMsg && (
              <div className="sugerencia-error-banner">
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="sugerencia-actions">
              <button
                type="button"
                className="unsaved-btn-secondary"
                onClick={handleClose}
                disabled={sending}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="unsaved-btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                disabled={sending}
              >
                {sending ? (
                  <>
                    <RefreshCw size={16} className="spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>Enviar sugerencia</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
