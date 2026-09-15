import React, { useRef, useState } from 'react';
import { Camera, Trash2, RefreshCw, CheckCircle2 } from 'lucide-react';
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
      const result = await compressImage(file, { quality: 0.70 });
      
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
    <div className="photo-module-compact">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
      />

      {previewUrl ? (
        <div className="photo-attached-strip">
          <img src={previewUrl} alt="Foto" className="photo-thumb-compact" />
          <div className="photo-attached-info">
            <div className="photo-attached-title">
              <CheckCircle2 size={14} style={{ color: '#10b981' }} />
              <span>Foto adjunta</span>
              {stats && <span className="photo-size-tag">({stats.compressedSizeKb} KB)</span>}
            </div>
          </div>
          <button
            type="button"
            className="photo-retake-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Cambiar foto"
          >
            <RefreshCw size={14} />
          </button>
          <button
            type="button"
            className="photo-delete-btn"
            onClick={handleRemove}
            title="Eliminar foto"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="camera-btn-compact"
          onClick={() => fileInputRef.current?.click()}
          disabled={compressing}
        >
          {compressing ? (
            <>
              <RefreshCw size={16} className="spin" />
              <span>Optimizando foto al 70%...</span>
            </>
          ) : (
            <>
              <Camera size={16} />
              <span>Tomar Foto del Comprobante (Opcional)</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
