import React, { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Trash2, CheckCircle, RefreshCw, Sparkles } from 'lucide-react';
import { compressImage } from '../services/imageCompressor';

export default function CameraCapture({ initialPhotoUrl, onPhotoCaptured, onPhotoRemoved }) {
  const fileInputRef = useRef(null);
  const [compressing, setCompressing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(initialPhotoUrl || null);
  const [stats, setStats] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setCompressing(true);
      console.log(`[Camera] Procesando foto original: ${file.name} (${(file.size / 1024).toFixed(1)} KB)...`);
      
      const result = await compressImage(file, { quality: 0.70 });
      
      console.log(`✔ [Camera] Foto comprimida al 70%: ${(result.compressedSizeKb)} KB (Ahorro: ${result.reductionPct}%)`);
      
      setPreviewUrl(result.dataUrl);
      setStats({
        originalSizeKb: result.originalSizeKb,
        compressedSizeKb: result.compressedSizeKb,
        reductionPct: result.reductionPct
      });

      if (onPhotoCaptured) {
        onPhotoCaptured({
          file: result.file,
          dataUrl: result.dataUrl,
          blob: result.blob,
          stats: {
            originalSizeKb: result.originalSizeKb,
            compressedSizeKb: result.compressedSizeKb,
            reductionPct: result.reductionPct
          }
        });
      }
    } catch (error) {
      console.error('[Camera] Error al comprimir imagen:', error);
      alert('Error al procesar la imagen: ' + error.message);
    } finally {
      setCompressing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    setStats(null);
    if (onPhotoRemoved) {
      onPhotoRemoved();
    }
  };

  return (
    <div className="photo-module">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
      />

      {previewUrl ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="photo-preview-box">
            <img src={previewUrl} alt="Foto del remito" className="photo-preview-img" />
            <button
              type="button"
              className="photo-remove-btn"
              onClick={handleRemove}
              title="Eliminar foto"
            >
              <Trash2 size={16} />
            </button>
          </div>

          {stats && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
              <span className="compression-badge">
                <Sparkles size={13} />
                Comprimida al 70%: {stats.compressedSizeKb} KB
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Original: {stats.originalSizeKb} KB (-{stats.reductionPct}%)
              </span>
            </div>
          )}

          <button
            type="button"
            className="camera-action-btn"
            style={{ minHeight: '44px', fontSize: '0.9rem' }}
            onClick={() => fileInputRef.current?.click()}
          >
            <RefreshCw size={16} />
            <span>Tomar otra foto</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="camera-action-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={compressing}
        >
          {compressing ? (
            <>
              <RefreshCw size={20} className="spin" />
              <span>Optimizando foto al 70%...</span>
            </>
          ) : (
            <>
              <Camera size={22} />
              <span>Sacar Foto del Remito / Comprobante</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
