import React, { useRef, useState, useEffect } from 'react';
import { PenTool, Eraser, Check, X, Trash2 } from 'lucide-react';

/**
 * Componente táctil de Firma Digital del Receptor (Sección 4.2.4).
 * Muestra una barra compacta en pantalla y abre un lienzo cómodo en modal para firmar con el dedo.
 */
export default function SignaturePad({
  signatureDataUrl,
  aclaracion = '',
  dni = '',
  onConfirm,
  onClear
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [localAclaracion, setLocalAclaracion] = useState(aclaracion);
  const [localDni, setLocalDni] = useState(dni);
  const [hasStroke, setHasStroke] = useState(false);

  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    setLocalAclaracion(aclaracion || '');
    setLocalDni(dni || '');
  }, [aclaracion, dni]);

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setHasStroke(false);

    if (signatureDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasStroke(true);
      };
      img.src = signatureDataUrl;
    }
  }, [isOpen, signatureDataUrl]);

  const getPointerPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY
    };
  };

  const startDraw = (e) => {
    if (e.cancelable) e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pos = getPointerPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    isDrawingRef.current = true;
    setHasStroke(true);
  };

  const moveDraw = (e) => {
    if (!isDrawingRef.current || !canvasRef.current) return;
    if (e.cancelable) e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPointerPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDraw = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
  };

  const handleResetCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
  };

  const handleSaveSignature = () => {
    if (!canvasRef.current || !hasStroke) {
      setIsOpen(false);
      return;
    }
    const dataUrl = canvasRef.current.toDataURL('image/png');
    if (onConfirm) {
      onConfirm({
        firma_digital_base64: dataUrl,
        firma_receptor_aclaracion: localAclaracion.trim(),
        firma_receptor_dni: localDni.trim()
      });
    }
    setIsOpen(false);
  };

  return (
    <div className="signature-module-compact">
      {signatureDataUrl ? (
        <div className="photo-attached-strip">
          <img
            src={signatureDataUrl}
            alt="Firma"
            className="photo-thumb-compact"
            style={{ background: '#fff', objectFit: 'contain' }}
          />
          <div className="photo-attached-info">
            <div className="photo-attached-title">
              <PenTool size={14} style={{ color: '#0284c7' }} />
              <span>Firma digital capturada</span>
              {aclaracion && <span className="photo-size-tag">({aclaracion})</span>}
            </div>
          </div>
          <button
            type="button"
            className="photo-retake-btn"
            onClick={() => setIsOpen(true)}
            title="Volver a firmar"
          >
            <PenTool size={14} />
          </button>
          <button
            type="button"
            className="photo-delete-btn"
            onClick={onClear}
            title="Borrar firma"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="camera-btn-compact"
          onClick={() => setIsOpen(true)}
        >
          <PenTool size={16} />
          <span>Capturar Firma Digital en Pantalla</span>
        </button>
      )}

      {isOpen && (
        <div className="modal-overlay" onClick={() => setIsOpen(false)}>
          <div
            className="modal-card glass"
            style={{ maxWidth: '460px', textAlign: 'left', alignItems: 'stretch', padding: '18px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PenTool size={18} style={{ color: 'var(--dy-blue)' }} />
                <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text)' }}>
                  Firma Digital del Receptor
                </h3>
              </div>
              <button
                type="button"
                className="mode-toggle"
                style={{ width: 32, height: 32 }}
                onClick={() => setIsOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="signature-canvas-box">
              <canvas
                ref={canvasRef}
                width={420}
                height={190}
                className="signature-canvas"
                onMouseDown={startDraw}
                onMouseMove={moveDraw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={moveDraw}
                onTouchEnd={endDraw}
              />
              {!hasStroke && (
                <span className="signature-watermark">Firme aquí con su dedo</span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '8px' }}>
              <input
                type="text"
                className="login-input"
                style={{ paddingLeft: 10, height: 40, fontSize: '0.84rem' }}
                placeholder="Aclaración / Receptor"
                value={localAclaracion}
                onChange={(e) => setLocalAclaracion(e.target.value)}
              />
              <input
                type="text"
                className="login-input"
                style={{ paddingLeft: 10, height: 40, fontSize: '0.84rem' }}
                placeholder="DNI"
                value={localDni}
                onChange={(e) => setLocalDni(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                className="drawer-action-btn"
                style={{ width: 'auto', flex: '0 0 auto', justifyContent: 'center' }}
                onClick={handleResetCanvas}
              >
                <Eraser size={16} />
                <span>Limpiar</span>
              </button>

              <button
                type="button"
                className="btn-login-primary"
                style={{ minHeight: 44 }}
                onClick={handleSaveSignature}
              >
                <Check size={18} />
                <span>Confirmar Firma</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
