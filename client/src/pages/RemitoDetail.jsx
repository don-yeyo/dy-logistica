import React, { useState, useEffect } from 'react';
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
  Check,
  Trash2,
  Camera
} from 'lucide-react';

const EJEMPLARES = [
  { key: 'ORIGINAL', label: 'Original', short: 'Orig.' },
  { key: 'DUPLICADO', label: 'Duplic.', short: 'Duplic.' },
  { key: 'TRIPLICADO', label: 'Triplic.', short: 'Triplic.' },
  { key: 'CUATRIPLICADO', label: 'Cuatrip.', short: 'Cuatrip.' },
  { key: 'RECEPCION_VALORIZADA', label: 'Recep.', subLabel: 'Val.', short: 'Recep. Val.' },
  { key: 'OTRO', label: 'Otro', short: 'Otro' }
];

function createEmptyEjemplar(key) {
  return {
    ejemplar: key,
    firmado_cliente: false,
    firmado_intermediario: false,
    no_firmado: false,
    observaciones: '',
    foto_url: null,
    foto_sharepoint_url: null,
    foto_nombre_archivo: null,
    capturedPhoto: null
  };
}

function buildInitialEjemplares(remito) {
  const map = {};

  if (Array.isArray(remito.ejemplares) && remito.ejemplares.length > 0) {
    for (const ej of remito.ejemplares) {
      if (!ej?.ejemplar) continue;
      map[ej.ejemplar] = {
        ejemplar: ej.ejemplar,
        firmado_cliente: Boolean(ej.firmado_cliente),
        firmado_intermediario: Boolean(ej.firmado_intermediario),
        no_firmado: Boolean(ej.no_firmado),
        observaciones: ej.observaciones || '',
        foto_url: ej.foto_url || null,
        foto_sharepoint_url: ej.foto_sharepoint_url || null,
        foto_nombre_archivo: ej.foto_nombre_archivo || null,
        capturedPhoto: null
      };
    }
    const keys = Object.keys(map);
    return { map, firstKey: keys[0] || null };
  }

  if (remito.estado_firma && remito.estado_firma !== 'PENDIENTE') {
    const key = remito.ejemplar || 'ORIGINAL';
    map[key] = {
      ejemplar: key,
      firmado_cliente:
        Boolean(remito.tiene_firma_cliente) ||
        remito.estado_firma === 'FIRMADO_CLIENTE' ||
        remito.estado_firma === 'FIRMADO_AMBOS',
      firmado_intermediario:
        Boolean(remito.tiene_firma_intermediario) ||
        remito.estado_firma === 'FIRMADO_INTERMEDIARIO' ||
        remito.estado_firma === 'FIRMADO_AMBOS',
      no_firmado: remito.estado_firma === 'NO_FIRMADO',
      observaciones: remito.observaciones || '',
      foto_url: remito.foto_url || null,
      foto_sharepoint_url: remito.foto_sharepoint_url || null,
      foto_nombre_archivo: remito.foto_nombre_archivo || null,
      capturedPhoto: null
    };
    return { map, firstKey: key };
  }

  return { map, firstKey: null };
}

function formatSignersShort(ej) {
  if (!ej) return '';
  if (ej.no_firmado) return 'Sin firma';
  if (ej.firmado_cliente && ej.firmado_intermediario) return 'Cliente + Interm.';
  if (ej.firmado_cliente) return 'Cliente';
  if (ej.firmado_intermediario) return 'Interm.';
  return 'Falta firmar';
}

export default function RemitoDetail({ remito, onBack, onSaved }) {
  const { refreshPendingCount } = useAuth();

  const [initialState] = useState(() => buildInitialEjemplares(remito));
  const [ejemplaresMap, setEjemplaresMap] = useState(initialState.map);
  const [activeEjemplar, setActiveEjemplar] = useState(initialState.firstKey);
  const [signatureInfo, setSignatureInfo] = useState({
    firma_digital_base64: remito.firma_digital_base64 || null,
    firma_receptor_aclaracion: remito.firma_receptor_aclaracion || '',
    firma_receptor_dni: remito.firma_receptor_dni || ''
  });
  const [saving, setSaving] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    const next = buildInitialEjemplares(remito);
    setEjemplaresMap(next.map);
    setActiveEjemplar(next.firstKey);
    setSignatureInfo({
      firma_digital_base64: remito.firma_digital_base64 || null,
      firma_receptor_aclaracion: remito.firma_receptor_aclaracion || '',
      firma_receptor_dni: remito.firma_receptor_dni || ''
    });
  }, [remito]);

  let formattedDate = remito.finne_Fecha || '';
  if (formattedDate.includes('T')) {
    formattedDate = formattedDate.split('T')[0];
  }

  const orderedEjemplares = EJEMPLARES.filter((item) => Boolean(ejemplaresMap[item.key])).map(
    (item) => ({ ...item, data: ejemplaresMap[item.key] })
  );

  const activeData = activeEjemplar ? ejemplaresMap[activeEjemplar] : null;
  const activeMeta = EJEMPLARES.find((e) => e.key === activeEjemplar);

  const handleSelectOrAddEjemplar = (key) => {
    setEjemplaresMap((prev) => {
      if (prev[key]) return prev;
      return {
        ...prev,
        [key]: createEmptyEjemplar(key)
      };
    });
    setActiveEjemplar(key);
  };

  const handleRemoveEjemplar = (key) => {
    setEjemplaresMap((prev) => {
      const next = { ...prev };
      delete next[key];
      const remaining = EJEMPLARES.map((e) => e.key).filter((k) => Boolean(next[k]));
      if (activeEjemplar === key) {
        setActiveEjemplar(remaining[0] || null);
      }
      return next;
    });
  };

  const updateActiveEjemplar = (updater) => {
    if (!activeEjemplar) return;
    setEjemplaresMap((prev) => {
      const cur = prev[activeEjemplar];
      if (!cur) return prev;
      const updated = typeof updater === 'function' ? updater(cur) : { ...cur, ...updater };
      return {
        ...prev,
        [activeEjemplar]: updated
      };
    });
  };

  const handleToggleSigner = (signer) => {
    updateActiveEjemplar((cur) => {
      if (signer === 'NO_FIRMADO') {
        const nextNoFirma = !cur.no_firmado;
        return {
          ...cur,
          no_firmado: nextNoFirma,
          firmado_cliente: nextNoFirma ? false : cur.firmado_cliente,
          firmado_intermediario: nextNoFirma ? false : cur.firmado_intermediario
        };
      }
      if (signer === 'CLIENTE') {
        const nextCliente = !cur.firmado_cliente;
        return {
          ...cur,
          firmado_cliente: nextCliente,
          no_firmado: nextCliente ? false : cur.no_firmado
        };
      }
      const nextInterm = !cur.firmado_intermediario;
      return {
        ...cur,
        firmado_intermediario: nextInterm,
        no_firmado: nextInterm ? false : cur.no_firmado
      };
    });
  };

  const handleSave = async () => {
    if (orderedEjemplares.length === 0) {
      setErrorMessage('Seleccioná al menos un ejemplar recibido (Original, Duplicado, Triplicado, Cuatriplicado, etc.).');
      return;
    }

    for (const item of orderedEjemplares) {
      const d = item.data;
      if (!d.no_firmado && !d.firmado_cliente && !d.firmado_intermediario) {
        setActiveEjemplar(item.key);
        setErrorMessage(
          `En el ejemplar "${item.short}" debés marcar al menos un firmante (Cliente, Intermediario o ambos) o "No Firmado".`
        );
        return;
      }
    }

    try {
      setSaving(true);
      const serializedEjemplares = [];

      for (const item of orderedEjemplares) {
        const d = item.data;
        let fotoUrl = d.foto_url || null;
        let fotoSharepointUrl = d.foto_sharepoint_url || null;
        let fotoNombreArchivo = d.foto_nombre_archivo || null;

        if (d.capturedPhoto && d.capturedPhoto.file && navigator.onLine) {
          try {
            const formData = new FormData();
            formData.append('foto', d.capturedPhoto.file);
            formData.append('remito_id', remito.id);
            formData.append('comprobante', remito.finne_Comprobante || '');
            formData.append('ejemplar', d.ejemplar);

            const uploadRes = await uploadFotoRemito(formData);
            if (uploadRes && uploadRes.ok && uploadRes.foto) {
              fotoUrl = uploadRes.foto.url;
              fotoNombreArchivo = uploadRes.foto.fileName;
              fotoSharepointUrl = uploadRes.foto.sharepointUrl;
            }
          } catch (uploadErr) {
            console.warn(`[RemitoDetail] Error subiendo foto de ${d.ejemplar}:`, uploadErr);
          }
        }

        serializedEjemplares.push({
          ejemplar: d.ejemplar,
          firmado_cliente: Boolean(d.firmado_cliente),
          firmado_intermediario: Boolean(d.firmado_intermediario),
          no_firmado: Boolean(d.no_firmado),
          observaciones: d.observaciones || '',
          foto_url: fotoUrl,
          foto_sharepoint_url: fotoSharepointUrl,
          foto_nombre_archivo: fotoNombreArchivo
        });
      }

      const anyCliente = serializedEjemplares.some((e) => e.firmado_cliente);
      const anyInterm = serializedEjemplares.some((e) => e.firmado_intermediario);
      const estadoFirmaConsolidado =
        anyCliente && anyInterm
          ? 'FIRMADO_AMBOS'
          : anyCliente
          ? 'FIRMADO_CLIENTE'
          : anyInterm
          ? 'FIRMADO_INTERMEDIARIO'
          : 'NO_FIRMADO';

      const payload = {
        ejemplares: serializedEjemplares,
        ejemplar: serializedEjemplares[0].ejemplar,
        estado_firma: estadoFirmaConsolidado,
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
        await queuePendingControl({
          op_type: 'remito',
          remito_id: remito.id,
          comprobante: remito.finne_Comprobante,
          ...payload
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
      setErrorMessage(
        error?.response?.data?.error ||
          error?.message ||
          'Ocurrió un error inesperado al guardar el control del remito.'
      );
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

      {/* 1. SELECCIÓN MÚLTIPLE DE EJEMPLARES */}
      <div className="detail-section-compact">
        <div className="section-label-compact">
          <FileText size={18} style={{ color: 'var(--dy-blue)' }} />
          <span>¿Qué ejemplares recibiste? (Podés elegir más de uno)</span>
        </div>

        <div className="ejemplar-grid-3col">
          {EJEMPLARES.map((item) => {
            const isConfigured = Boolean(ejemplaresMap[item.key]);
            const isActive = activeEjemplar === item.key;
            const itemKeyClass = `ejemplar-btn-${item.key.toLowerCase().replace(/_/g, '-')}`;
            return (
              <button
                key={item.key}
                type="button"
                className={`ejemplar-btn-3col ${itemKeyClass} ${isConfigured ? 'configured' : ''} ${isActive ? 'selected' : ''}`}
                onClick={() => handleSelectOrAddEjemplar(item.key)}
              >
                {isConfigured && (
                  <span className="ejemplar-configured-dot" title="Ejemplar incluido">
                    <Check size={10} />
                  </span>
                )}
                <span>{item.label}</span>
                {item.subLabel && <span className="ejemplar-btn-subline">{item.subLabel}</span>}
              </button>
            );
          })}
        </div>

        {orderedEjemplares.length > 0 && (
          <div className="ejemplares-summary-strip">
            {orderedEjemplares.map((item) => {
              const d = item.data;
              const isActive = activeEjemplar === item.key;
              const hasPhoto = Boolean(d.capturedPhoto || d.foto_sharepoint_url || d.foto_url);
              const needsSigner = !d.no_firmado && !d.firmado_cliente && !d.firmado_intermediario;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`ejemplar-summary-chip ${isActive ? 'active' : ''} ${needsSigner ? 'incomplete' : ''}`}
                  onClick={() => setActiveEjemplar(item.key)}
                >
                  <strong>{item.short}</strong>
                  <span>· {formatSignersShort(d)}</span>
                  {hasPhoto && <Camera size={12} />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. EDITOR INDIVIDUAL DEL EJEMPLAR ACTIVO */}
      {activeData && (
        <div className="ejemplar-editor-panel">
          <div className="ejemplar-editor-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={17} style={{ color: 'var(--dy-blue)' }} />
              <span>
                Editando: <strong>{activeMeta ? `${activeMeta.label}${activeMeta.subLabel ? ` ${activeMeta.subLabel}` : ''}` : activeEjemplar}</strong>
              </span>
            </div>
            <button
              type="button"
              className="ejemplar-remove-btn"
              onClick={() => handleRemoveEjemplar(activeEjemplar)}
              title="Quitar este ejemplar"
            >
              <Trash2 size={14} />
              <span>Quitar</span>
            </button>
          </div>

          <div className="firma-multi-hint">
            Marcá <strong>Cliente</strong>, <strong>Intermediario</strong> o ambos si los dos firmaron este ejemplar.
          </div>

          <div className="firma-grid-3col">
            <button
              type="button"
              className={`firma-btn-3col btn-cliente ${activeData.firmado_cliente ? 'selected' : ''}`}
              onClick={() => handleToggleSigner('CLIENTE')}
            >
              <Building2 size={19} />
              <span>Cliente</span>
            </button>

            <button
              type="button"
              className={`firma-btn-3col btn-interm ${activeData.firmado_intermediario ? 'selected' : ''}`}
              onClick={() => handleToggleSigner('INTERMEDIARIO')}
            >
              <Truck size={19} />
              <span>Intermediario</span>
            </button>

            <button
              type="button"
              className={`firma-btn-3col btn-nofirma ${activeData.no_firmado ? 'selected' : ''}`}
              onClick={() => handleToggleSigner('NO_FIRMADO')}
            >
              <XCircle size={19} />
              <span>No Firmado</span>
            </button>
          </div>

          {/* Foto opcional propia de este ejemplar */}
          <div className="detail-section-compact" style={{ marginTop: '4px' }}>
            <CameraCapture
              key={activeEjemplar}
              initialPhotoUrl={
                activeData.capturedPhoto?.dataUrl ||
                activeData.foto_sharepoint_url ||
                activeData.foto_url ||
                null
              }
              onPhotoCaptured={(photoData) => updateActiveEjemplar({ capturedPhoto: photoData })}
              onPhotoRemoved={() =>
                updateActiveEjemplar({
                  capturedPhoto: null,
                  foto_url: null,
                  foto_sharepoint_url: null,
                  foto_nombre_archivo: null
                })
              }
            />
          </div>

          {/* Observaciones propias de este ejemplar */}
          <div className="detail-section-compact detail-section-obs">
            <textarea
              className="obs-textarea-compact"
              value={activeData.observaciones || ''}
              onChange={(e) => updateActiveEjemplar({ observaciones: e.target.value })}
              placeholder={`Observaciones del ejemplar ${activeMeta?.short || activeEjemplar} (opcional)`}
            />
          </div>
        </div>
      )}

      {/* 3. FIRMA DIGITAL TÁCTIL COMPARTIDA DEL REMITO */}
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
              El remito <strong>{remito.finne_Comprobante}</strong> ({orderedEjemplares.length} ejemplar/es) fue guardado correctamente.
            </p>
          </div>
        </div>
      )}

      {/* Modal Reutilizable de Error / Alerta */}
      <AlertModal
        isOpen={Boolean(errorMessage)}
        onClose={() => setErrorMessage(null)}
        type="error"
        title="Validación de Remito"
        message="Revisá los ejemplares informados."
        detail={errorMessage}
        confirmText="Entendido"
      />
    </div>
  );
}
