import React, { useState } from 'react';
import { submitControlRemito, uploadFotoRemito } from '../services/api';
import { queuePendingControl } from '../services/offlineStorage';
import { useAuth } from '../config/AuthContext';
import CameraCapture from '../components/CameraCapture';
import SignaturePad from '../components/SignaturePad';
import BottomBar from '../components/BottomBar';
import AlertModal from '../components/AlertModal';
import {
  Building2,
  Truck,
  XCircle,
  MapPin,
  Calendar,
  FileText,
  CheckCircle2,
  Check
} from 'lucide-react';

const EJEMPLARES = [
  { key: 'ORIGINAL', label: 'Original' },
  { key: 'DUPLICADO', label: 'Duplic.' },
  { key: 'TRIPLICADO', label: 'Triplic.' },
  { key: 'CUATRIPLICADO', label: 'Cuatrip.' },
  { key: 'RECEPCION_VALORIZADA', label: 'Recep.', subLabel: 'Val.' },
  { key: 'OTRO', label: 'Otro' }
];

export default function RemitoDetail({ remito, onBack, onSaved }) {
  const { refreshPendingCount } = useAuth();

  const [ejemplar, setEjemplar] = useState(remito.estado_firma !== 'PENDIENTE' ? remito.ejemplar : null);
  const [estadoFirma, setEstadoFirma] = useState(remito.estado_firma !== 'PENDIENTE' ? remito.estado_firma : null);
  const [observaciones, setObservaciones] = useState(remito.observaciones || '');
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [signatureInfo, setSignatureInfo] = useState({
    firma_digital_base64: remito.firma_digital_base64 || null,
    firma_receptor_aclaracion: remito.firma_receptor_aclaracion || '',
    firma_receptor_dni: remito.firma_receptor_dni || ''
  });
  const [saving, setSaving] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Formato de fecha
  let formattedDate = remito.finne_Fecha || '';
  if (formattedDate.includes('T')) {
    formattedDate = formattedDate.split('T')[0];
  }

  // Manejo de guardado del control
  const handleSave = async () => {
    if (!ejemplar) {
      setErrorMessage('Por favor seleccione qué ejemplar del comprobante tiene en mano (Original, Duplicado, etc.).');
      return;
    }
    if (!estadoFirma) {
      setErrorMessage('Por favor especifique por quién está firmado (Cliente, Intermediario o No Firmado).');
      return;
    }

    try {
      setSaving(true);

      let fotoUrl = null;
      let fotoNombreArchivo = null;
      let fotoSharepointUrl = null;

      // 1. Si se capturó una foto nueva en esta sesión y hay internet, subirla al servidor
      if (capturedPhoto && capturedPhoto.file && navigator.onLine) {
        try {
          const formData = new FormData();
          formData.append('foto', capturedPhoto.file);
          formData.append('remito_id', remito.id);
          formData.append('comprobante', remito.finne_Comprobante || '');
          formData.append('ejemplar', ejemplar || 'ORIGINAL');

          const uploadRes = await uploadFotoRemito(formData);
          if (uploadRes && uploadRes.ok && uploadRes.foto) {
            fotoUrl = uploadRes.foto.url;
            fotoNombreArchivo = uploadRes.foto.fileName;
            fotoSharepointUrl = uploadRes.foto.sharepointUrl;
          }
        } catch (uploadErr) {
          console.warn('[RemitoDetail] Error al subir foto, se guardará referencia:', uploadErr);
        }
      }

      const tipoDocumento = ejemplar === 'RECEPCION_VALORIZADA' ? 'RECEPCION_VALORIZADA' : (remito.tipo_documento || 'REMITO');

      const payload = {
        ejemplar: ejemplar,
        estado_firma: estadoFirma,
        tipo_documento: tipoDocumento,
        observaciones: observaciones,
        foto_url: fotoUrl,
        foto_sharepoint_url: fotoSharepointUrl,
        foto_nombre_archivo: fotoNombreArchivo,
        firma_digital_base64: signatureInfo.firma_digital_base64 || null,
        firma_receptor_aclaracion: signatureInfo.firma_receptor_aclaracion || null,
        firma_receptor_dni: signatureInfo.firma_receptor_dni || null,
        id_etapa: remito.id_etapa || null,
        comprobante: remito.finne_Comprobante || null,
        sincronizado_offline: !navigator.onLine ? 1 : 0
      };

      if (navigator.onLine) {
        await submitControlRemito(remito.id, payload);
      } else {
        console.log('[RemitoDetail] Sin conexión: Guardando en cola local...');
        await queuePendingControl({
          op_type: 'remito',
          remito_id: remito.id,
          comprobante: remito.finne_Comprobante,
          ...payload,
          foto_base64: capturedPhoto?.dataUrl || null
        });
        await refreshPendingCount();
      }

      setSuccessModal(true);
      setTimeout(() => {
        setSuccessModal(false);
        if (onSaved) onSaved({ ...remito, ...payload });
        if (onBack) onBack();
      }, 1100);
    } catch (error) {
      console.error('[RemitoDetail] Error al guardar control:', error);
      setErrorMessage(error?.response?.data?.error || error?.message || 'Ocurrió un error inesperado al guardar el control del remito.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="detail-container-no-scroll">
      {/* Cabecera Resumen del Remito */}
      <div className="remito-summary-card">
        <div className="remito-summary-top">
          <span className="remito-summary-cbte">{remito.finne_Comprobante || 'Sin Comprobante'}</span>
          <span className="remito-summary-date">
            <Calendar size={12} />
            {formattedDate}
          </span>
        </div>

        <div className="remito-summary-client">
          {remito.finne_CodigoCliente ? `${remito.finne_CodigoCliente} - ` : ''}
          {remito.finne_Cliente || 'Cliente no especificado'}
        </div>

        {remito.finne_domicilio && (
          <div className="remito-summary-address">
            <MapPin size={12} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
            <span>{remito.finne_domicilio}</span>
          </div>
        )}
      </div>

      {/* 1. SELECCIÓN DE EJEMPLAR (3 Columnas x 2 Filas) */}
      <div className="detail-section-compact">
        <div className="section-label-compact">
          <FileText size={18} style={{ color: 'var(--dy-blue)' }} />
          <span>¿De cuál ejemplar se trata?</span>
        </div>

        <div className="ejemplar-grid-3col">
          {EJEMPLARES.map((item) => {
            const isSelected = ejemplar === item.key;
            const itemKeyClass = `ejemplar-btn-${item.key.toLowerCase().replace(/_/g, '-')}`;
            return (
              <button
                key={item.key}
                type="button"
                className={`ejemplar-btn-3col ${itemKeyClass} ${isSelected ? 'selected' : ''}`}
                onClick={() => setEjemplar(item.key)}
              >
                <span>{item.label}</span>
                {item.subLabel && <span className="ejemplar-btn-subline">{item.subLabel}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. SELECCIÓN DE FIRMA / RECEPTOR (3 Columnas) */}
      <div className="detail-section-compact">
        <div className="section-label-compact">
          <CheckCircle2 size={18} style={{ color: 'var(--dy-blue)' }} />
          <span>¿Está firmado? Receptor</span>
        </div>

        <div className="firma-grid-3col">
          <button
            type="button"
            className={`firma-btn-3col btn-cliente ${estadoFirma === 'FIRMADO_CLIENTE' ? 'selected' : ''}`}
            onClick={() => setEstadoFirma('FIRMADO_CLIENTE')}
          >
            <Building2 size={19} />
            <span>Cliente</span>
          </button>

          <button
            type="button"
            className={`firma-btn-3col btn-interm ${estadoFirma === 'FIRMADO_INTERMEDIARIO' ? 'selected' : ''}`}
            onClick={() => setEstadoFirma('FIRMADO_INTERMEDIARIO')}
          >
            <Truck size={19} />
            <span>Intermediario</span>
          </button>

          <button
            type="button"
            className={`firma-btn-3col btn-nofirma ${estadoFirma === 'NO_FIRMADO' ? 'selected' : ''}`}
            onClick={() => setEstadoFirma('NO_FIRMADO')}
          >
            <XCircle size={19} />
            <span>No Firmado</span>
          </button>
        </div>
      </div>

      {/* 3. CAPTURA DE FIRMA DIGITAL EN PANTALLA (Sección 4.2.4) */}
      <div className="detail-section-compact">
        <SignaturePad
          signatureDataUrl={signatureInfo.firma_digital_base64}
          aclaracion={signatureInfo.firma_receptor_aclaracion}
          dni={signatureInfo.firma_receptor_dni}
          onConfirm={(sigData) => setSignatureInfo(sigData)}
          onClear={() =>
            setSignatureInfo({
              firma_digital_base64: null,
              firma_receptor_aclaracion: '',
              firma_receptor_dni: ''
            })
          }
        />
      </div>

      {/* 4. FOTOGRAFÍA OPCIONAL */}
      <div className="detail-section-compact">
        <CameraCapture
          initialPhotoUrl={null}
          onPhotoCaptured={(photoData) => setCapturedPhoto(photoData)}
          onPhotoRemoved={() => setCapturedPhoto(null)}
        />
      </div>

      {/* 5. OBSERVACIONES */}
      <div className="detail-section-compact detail-section-obs">
        <textarea
          className="obs-textarea-compact"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          placeholder="En caso de tener aclaraciones para hacer, escríbalas aquí"
        />
      </div>

      {/* BOTTOM ACTION BAR FIJA */}
      <BottomBar
        onBack={onBack}
        onSave={handleSave}
        saving={saving}
        saveLabel="Confirmar y Guardar"
      />

      {/* Modal de Éxito Instantáneo */}
      {successModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
              <Check size={36} />
            </div>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)', margin: '0 0 4px' }}>¡Control Registrado!</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
              El remito <strong>{remito.finne_Comprobante}</strong> fue guardado correctamente.
            </p>
          </div>
        </div>
      )}

      {/* Modal Reutilizable de Error / Alerta */}
      <AlertModal
        isOpen={Boolean(errorMessage)}
        onClose={() => setErrorMessage(null)}
        type="error"
        title="Error al Guardar"
        message="No se pudo guardar el control del remito."
        detail={errorMessage}
        confirmText="Entendido"
      />
    </div>
  );
}
