import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Flashlight, FlashlightOff, Camera, Keyboard, AlertCircle, RefreshCw, Volume2, VolumeX } from 'lucide-react';

/**
 * Reproduce un tono 'beep' de confirmación usando Web Audio API.
 */
function playBeepSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1050, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  } catch (e) {
    console.debug('Audio not supported or permitted yet:', e);
  }
}

export default function BarcodeScanner({ onScanSuccess, onError, isPaused = false }) {
  const [scannerId] = useState(() => `reader-${Math.random().toString(36).substring(2, 9)}`);
  const [cameraActive, setCameraActive] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [showManualModal, setShowManualModal] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const html5QrCodeRef = useRef(null);
  const lastScannedTimeRef = useRef(0);

  useEffect(() => {
    let isMounted = true;

    async function startScanner() {
      try {
        setErrorMessage(null);
        const formatsToSupport = [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE
        ];

        const html5QrCode = new Html5Qrcode(scannerId, {
          formatsToSupport,
          verbose: false
        });
        html5QrCodeRef.current = html5QrCode;

        const config = {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            // Rectángulo horizontal adaptado a códigos de barra 1D en papel
            const width = Math.min(viewfinderWidth * 0.88, 360);
            const height = Math.min(viewfinderHeight * 0.45, 140);
            return { width: Math.floor(width), height: Math.floor(height) };
          },
          aspectRatio: 1.0,
          disableFlip: false
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText, decodedResult) => {
            if (!isMounted || isPaused) return;

            const now = Date.now();
            if (now - lastScannedTimeRef.current < 1500) {
              return; // Evitar disparos repetidos consecutivos en milisegundos
            }
            lastScannedTimeRef.current = now;

            // Feedback sonoro y háptico
            if (soundEnabled) playBeepSound();
            if (navigator.vibrate) {
              try { navigator.vibrate([80, 40, 80]); } catch (e) { }
            }

            console.log(`[BarcodeScanner] Código 1D detectado: ${decodedText}`);
            if (onScanSuccess) {
              onScanSuccess(decodedText.trim(), decodedResult);
            }
          },
          (errorMessage) => {
            // Lectura continua de frames
          }
        );

        if (isMounted) {
          setCameraActive(true);
          // Verificar soporte de linterna / torch
          try {
            const track = html5QrCode.getRunningTrackCameraCapabilities();
            if (track && track.torchFeature && track.torchFeature().isSupported()) {
              setTorchSupported(true);
            }
          } catch (tErr) {
            console.debug('Torch feature check:', tErr);
          }
        }
      } catch (err) {
        console.warn('[BarcodeScanner] Error al iniciar cámara:', err);
        if (isMounted) {
          setCameraActive(false);
          setErrorMessage(
            err.message?.includes('Permission')
              ? 'Permiso de cámara denegado. Habilite el acceso a la cámara en los permisos de su navegador.'
              : 'No se pudo acceder a la cámara trasera. Puede ingresar el código manualmente.'
          );
          if (onError) onError(err);
        }
      }
    }

    startScanner();

    return () => {
      isMounted = false;
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            html5QrCodeRef.current.stop().then(() => {
              html5QrCodeRef.current.clear();
            }).catch(e => console.debug('Stop scanner err:', e));
          } else {
            html5QrCodeRef.current.clear();
          }
        } catch (e) {
          console.debug('Cleanup scanner err:', e);
        }
      }
    };
  }, [scannerId, isPaused]);

  // Alternar linterna / torch
  const toggleTorch = async () => {
    if (!html5QrCodeRef.current || !torchSupported) return;
    try {
      const nextState = !torchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState }]
      });
      setTorchOn(nextState);
    } catch (e) {
      console.warn('Error al activar linterna:', e);
    }
  };

  // Manejo de envío manual
  const handleManualSubmit = (e) => {
    e.preventDefault();
    const clean = manualCode.trim();
    if (!clean) return;
    setShowManualModal(false);
    setManualCode('');
    if (soundEnabled) playBeepSound();
    if (onScanSuccess) onScanSuccess(clean);
  };

  return (
    <div className="scanner-container">
      {/* Marco de video del escáner */}
      <div className="scanner-viewport-wrapper">
        <div id={scannerId} className="scanner-viewport"></div>

        {/* Overlay con mira guía Don Yeyo */}
        <div className="scanner-overlay-guide">
          <div className="scanner-target-box">
            <div className="scanner-laser-line"></div>
            <div className="scanner-corner top-left"></div>
            <div className="scanner-corner top-right"></div>
            <div className="scanner-corner bottom-left"></div>
            <div className="scanner-corner bottom-right"></div>
          </div>
          <p className="scanner-tip-text">
            Alinee el <strong>código de barras del remito</strong> dentro del recuadro
          </p>
        </div>

        {/* Barra superior de utilidades flotante */}
        <div className="scanner-top-actions">
          {torchSupported && (
            <button
              type="button"
              className={`scanner-tool-btn ${torchOn ? 'active' : ''}`}
              onClick={toggleTorch}
              title={torchOn ? 'Apagar linterna' : 'Encender linterna'}
            >
              {torchOn ? <FlashlightOff size={18} /> : <Flashlight size={18} />}
              <span>{torchOn ? 'Linterna ON' : 'Linterna'}</span>
            </button>
          )}

          <button
            type="button"
            className="scanner-tool-btn"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Silenciar beep' : 'Activar sonido'}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </div>
      </div>

      {/* Mensaje de error de cámara si ocurre */}
      {errorMessage && (
        <div className="scanner-error-card">
          <AlertCircle size={24} style={{ color: 'var(--dy-red)', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text)' }}>Acceso a cámara</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{errorMessage}</div>
          </div>
        </div>
      )}

      {/* Botón de Entrada Manual Rápida */}
      <div className="scanner-manual-trigger-wrapper">
        <button
          type="button"
          className="scanner-manual-btn"
          onClick={() => setShowManualModal(true)}
        >
          <Keyboard size={18} />
          <span>Ingresar número manualmente</span>
        </button>
      </div>

      {/* Modal de Ingreso Manual */}
      {showManualModal && (
        <div className="modal-overlay" onClick={() => setShowManualModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="modal-header-icon">
                  <Keyboard size={24} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-main)' }}>Ingreso Manual</h3>
              </div>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: '8px 0 16px' }}>
              Ingrese el número que figura debajo del código de barras impreso en el remito.
            </p>

            <form onSubmit={handleManualSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <input
                  type="text"
                  autoFocus
                  inputMode="numeric"
                  className="scanner-manual-input"
                  placeholder="Ej: 1048751"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-cancel"
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '12px',
                    background: 'var(--surface-hover)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border)',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                  onClick={() => setShowManualModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!manualCode.trim()}
                  className="btn-primary"
                  style={{
                    flex: 2,
                    padding: '12px',
                    borderRadius: '12px',
                    background: 'var(--dy-blue)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Buscar Remito
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
