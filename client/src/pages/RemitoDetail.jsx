import React, { useState } from 'react';
import { submitControlRemito, uploadFotoRemito } from '../services/api';
import { queuePendingControl } from '../services/offlineStorage';
import { useAuth } from '../config/AuthContext';
import CameraCapture from '../components/CameraCapture';
import BottomBar from '../components/BottomBar';
import { 
  Building2, 
  Truck, 
  XCircle, 
  MapPin, 
  Calendar, 
  FileText, 
  CheckCircle2,
  Check, 
  AlertCircle,
  HelpCircle,
  MessageSquare
} from 'lucide-react';

const QUICK_OBSERVATIONS = [
  'Recepción Valorizada adjunta',
  'Sello de sucursal conforme',
  'Falta firma aclarada',
  'Firma de seguridad de depósito',
  'Diferencia de bultos declarada',
  'Rechazo por horario'
];

export default function RemitoDetail({ remito, onBack, onSaved }) {
  const { user, isOnline, refreshPendingCount } = useAuth();

  const [ejemplar, setEjemplar] = useState(remito.ejemplar || 'ORIGINAL');
  const [estadoFirma, setEstadoFirma] = useState(remito.estado_firma !== 'PENDIENTE' ? remito.estado_firma : 'FIRMADO_CLIENTE');
  const [tipoDocumento, setTipoDocumento] = useState(remito.tipo_documento || (remito.ejemplar === 'RECEPCION_VALORIZADA' ? 'RECEPCION_VALORIZADA' : 'REMITO'));
  const [observaciones, setObservaciones] = useState(remito.observaciones || '');
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [successModal, setSuccessModal] = useState(false);

  // Formato de fecha
  let formattedDate = remito.finne_Fecha || '';
  if (formattedDate.includes('T')) {
    formattedDate = formattedDate.split('T')[0];
  }

  // Si cambia el ejemplar a Recepción Valorizada, sincronizamos tipoDocumento
  const handleSelectEjemplar = (ej) => {
    setEjemplar(ej);
    if (ej === 'RECEPCION_VALORIZADA') {
      setTipoDocumento('RECEPCION_VALORIZADA');
    }
  };

  // Manejo de guardado del control
  const handleSave = async () => {
    try {
      setSaving(true);

      let fotoUrl = remito.foto_url;
      let fotoNombreArchivo = remito.foto_nombre_archivo;
      let fotoSharepointUrl = remito.foto_sharepoint_url;

      // 1. Si se capturó una foto nueva y hay internet, subirla al servidor
      if (capturedPhoto && capturedPhoto.file && navigator.onLine) {
        try {
          const formData = new FormData();
          formData.append('foto', capturedPhoto.file);
          formData.append('remito_id', remito.id);
          formData.append('comprobante', remito.finne_Comprobante || '');

          const uploadRes = await uploadFotoRemito(formData);
          if (uploadRes && uploadRes.ok) {
            fotoUrl = uploadRes.foto.url;
            fotoNombreArchivo = uploadRes.foto.fileName;
            fotoSharepointUrl = uploadRes.foto.sharepointUrl;
          }
        } catch (uploadErr) {
          console.warn('[RemitoDetail] Error al subir foto, se guardará referencia:', uploadErr);
        }
      }

      const payload = {
        ejemplar: ejemplar,
        estado_firma: estadoFirma,
        tipo_documento: tipoDocumento,
        observaciones: observaciones,
        foto_url: fotoUrl,
        foto_sharepoint_url: fotoSharepointUrl,
        foto_nombre_archivo: fotoNombreArchivo,
        sincronizado_offline: !navigator.onLine ? 1 : 0
      };

      if (navigator.onLine) {
        // En línea: Guardar directamente en backend
        await submitControlRemito(remito.id, payload);
      } else {
        // Sin conexión: Encolar en IndexedDB
        console.log('[RemitoDetail] Sin conexión: Guardando en cola local...');
        await queuePendingControl({
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
      }, 1200);

    } catch (error) {
      console.error('[RemitoDetail] Error al guardar control:', error);
      alert('Error al guardar control del remito: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const addQuickObservation = (text) => {
    if (observaciones.includes(text)) return;
    setObservaciones(prev => prev ? `${prev} - ${text}` : text);
    if (text.toLowerCase().includes('recepción valorizada')) {
      setTipoDocumento('RECEPCION_VALORIZADA');
    }
  };

  return (
    <div className="detail-container">
      {/* Cabecera Resumen del Remito */}
      <div className="detail-header-card">
        <div className="detail-header-title">
          <div className="detail-cbte">{remito.finne_Comprobante}</div>
          {remito.finne_transaccionID && (
            <span className="detail-tx-pill">Tx: {remito.finne_transaccionID}</span>
          )}
          {remito.nro_hoja_ruta && (
            <span className="detail-hr-pill">HR: {remito.nro_hoja_ruta}</span>
          )}
        </div>

        <div className="detail-client-box">
          <div className="detail-client-title">
            {remito.finne_CodigoCliente ? `${remito.finne_CodigoCliente} - ` : ''}
            {remito.finne_Cliente}
          </div>
          <div className="detail-client-sub">
            <MapPin size={14} style={{ color: '#fca5a5', flexShrink: 0 }} />
            <span>{remito.finne_domicilio || 'Domicilio en hoja de ruta'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem', opacity: 0.9 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Calendar size={13} />
            Fecha: {formattedDate}
          </span>
          {remito.finne_importe_total > 0 && (
            <span style={{ fontWeight: 700 }}>
              ${Number(remito.finne_importe_total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>
      </div>

      {/* 1. SELECCIÓN DE EJEMPLAR */}
      <div>
        <div className="section-label">
          <FileText size={16} style={{ color: 'var(--dy-blue)' }} />
          <span>1. ¿De cuál ejemplar se trata?</span>
        </div>

        <div className="ejemplar-grid">
          {[
            { key: 'ORIGINAL', label: 'Original', sub: 'Blanco' },
            { key: 'DUPLICADO', label: 'Duplicado', sub: 'Color' },
            { key: 'TRIPLICADO', label: 'Triplicado', sub: 'Contabilidad' },
            { key: 'CUATRIPLICADO', label: 'Cuatriplicado', sub: 'Transporte' },
            { key: 'RECEPCION_VALORIZADA', label: 'Recep. Valorizada', sub: 'Adjunta' },
            { key: 'OTRO', label: 'Otro', sub: 'Especial' }
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              className={`ejemplar-card-btn ${ejemplar === item.key ? 'selected' : ''}`}
              onClick={() => handleSelectEjemplar(item.key)}
            >
              <span className="ejemplar-main-text">{item.label}</span>
              <span className="ejemplar-sub-text">{item.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. SELECCIÓN DE FIRMA (BOTONERA TÁCTIL GRANDE) */}
      <div>
        <div className="section-label">
          <CheckCircle2 size={16} style={{ color: 'var(--dy-blue)' }} />
          <span>2. ¿Está firmado? Indicar Receptor</span>
        </div>

        <div className="touch-button-grid">
          {/* Opción 1: Cliente / Sucursal */}
          <button
            type="button"
            className={`touch-btn btn-cliente ${estadoFirma === 'FIRMADO_CLIENTE' ? 'selected' : ''}`}
            onClick={() => setEstadoFirma('FIRMADO_CLIENTE')}
          >
            <div className="touch-btn-content">
              <div className="touch-btn-icon-wrapper">
                <Building2 size={24} />
              </div>
              <div className="touch-btn-texts">
                <span className="touch-btn-title">FIRMADO POR CLIENTE</span>
                <span className="touch-btn-desc">Sucursal de Supermercado / Negocio</span>
              </div>
            </div>
            {estadoFirma === 'FIRMADO_CLIENTE' && <Check size={28} />}
          </button>

          {/* Opción 2: Intermediario / Distribuidor */}
          <button
            type="button"
            className={`touch-btn btn-interm ${estadoFirma === 'FIRMADO_INTERMEDIARIO' ? 'selected' : ''}`}
            onClick={() => setEstadoFirma('FIRMADO_INTERMEDIARIO')}
          >
            <div className="touch-btn-content">
              <div className="touch-btn-icon-wrapper">
                <Truck size={24} />
              </div>
              <div className="touch-btn-texts">
                <span className="touch-btn-title">FIRMADO POR INTERMEDIARIO</span>
                <span className="touch-btn-desc">Distribuidor u Operador Logístico</span>
              </div>
            </div>
            {estadoFirma === 'FIRMADO_INTERMEDIARIO' && <Check size={28} />}
          </button>

          {/* Opción 3: Sin Firma / Rechazo */}
          <button
            type="button"
            className={`touch-btn btn-nofirma ${estadoFirma === 'NO_FIRMADO' ? 'selected' : ''}`}
            onClick={() => setEstadoFirma('NO_FIRMADO')}
          >
            <div className="touch-btn-content">
              <div className="touch-btn-icon-wrapper">
                <XCircle size={24} />
              </div>
              <div className="touch-btn-texts">
                <span className="touch-btn-title">NO FIRMADO / RECHAZADO</span>
                <span className="touch-btn-desc">Sin conformidad o comprobante no recibido</span>
              </div>
            </div>
            {estadoFirma === 'NO_FIRMADO' && <Check size={28} />}
          </button>
        </div>
      </div>

      {/* 3. TIPO DE DOCUMENTO RECIBIDO */}
      <div>
        <div className="section-label">
          <FileText size={16} style={{ color: 'var(--dy-blue)' }} />
          <span>3. Tipo de Documento de Respaldo</span>
        </div>

        <div className="doc-type-group">
          <button
            type="button"
            className={`doc-type-btn ${tipoDocumento === 'REMITO' ? 'selected' : ''}`}
            onClick={() => setTipoDocumento('REMITO')}
          >
            <FileText size={18} />
            <span>Remito DY</span>
          </button>

          <button
            type="button"
            className={`doc-type-btn ${tipoDocumento === 'RECEPCION_VALORIZADA' ? 'selected' : ''}`}
            onClick={() => setTipoDocumento('RECEPCION_VALORIZADA')}
          >
            <CheckCircle2 size={18} />
            <span>Recep. Valorizada</span>
          </button>

          <button
            type="button"
            className={`doc-type-btn ${tipoDocumento === 'OTRO' ? 'selected' : ''}`}
            onClick={() => setTipoDocumento('OTRO')}
          >
            <HelpCircle size={18} />
            <span>Otro Doc.</span>
          </button>
        </div>
      </div>

      {/* 4. CASILLERO DE OBSERVACIONES CON ATAJOS */}
      <div className="observations-box">
        <div className="section-label">
          <MessageSquare size={16} style={{ color: 'var(--dy-blue)' }} />
          <span>4. Observaciones y Aclaraciones</span>
        </div>

        <div className="quick-chips-row">
          {QUICK_OBSERVATIONS.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              className="quick-chip"
              onClick={() => addQuickObservation(chip)}
            >
              + {chip}
            </button>
          ))}
        </div>

        <textarea
          className="obs-textarea"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          placeholder="Escriba aquí aclaraciones, número de recepción valorizada o motivo de no firma..."
        />
      </div>

      {/* 5. FOTOGRAFÍA OPCIONAL CON COMPRESIÓN AL 70% */}
      <div>
        <div className="section-label">
          <span>5. Foto del Comprobante (Opcional - JPEG 70%)</span>
        </div>

        <CameraCapture
          initialPhotoUrl={remito.foto_url}
          onPhotoCaptured={(photoData) => setCapturedPhoto(photoData)}
          onPhotoRemoved={() => setCapturedPhoto(null)}
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
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Check size={40} />
            </div>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)' }}>¡Control Registrado!</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              El estado del remito <strong>{remito.finne_Comprobante}</strong> fue guardado correctamente.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
