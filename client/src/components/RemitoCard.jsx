import React from 'react';
import { MapPin, Calendar, Camera, FileText, CheckCircle2, AlertCircle, Clock, ChevronRight, History } from 'lucide-react';

const STATUS_CONFIG = {
  PENDIENTE: {
    label: 'Pendiente',
    icon: Clock,
    className: 'PENDIENTE'
  },
  FIRMADO_CLIENTE: {
    label: 'Firmado (Cliente)',
    icon: CheckCircle2,
    className: 'FIRMADO_CLIENTE'
  },
  FIRMADO_INTERMEDIARIO: {
    label: 'Firmado (Intermediario)',
    icon: CheckCircle2,
    className: 'FIRMADO_INTERMEDIARIO'
  },
  FIRMADO_AMBOS: {
    label: 'Firmado (Ambos)',
    icon: CheckCircle2,
    className: 'FIRMADO_AMBOS'
  },
  NO_FIRMADO: {
    label: 'Sin Firma / Rechazado',
    icon: AlertCircle,
    className: 'NO_FIRMADO'
  }
};

const EJEMPLAR_SHORT = {
  ORIGINAL: 'Orig.',
  DUPLICADO: 'Duplic.',
  TRIPLICADO: 'Triplic.',
  CUATRIPLICADO: 'Cuatrip.',
  RECEPCION_VALORIZADA: 'Recep. Val.',
  OTRO: 'Otro'
};

function formatEjemplarTag(ej) {
  const name = EJEMPLAR_SHORT[ej.ejemplar] || ej.ejemplar;
  if (ej.no_firmado) return `${name} · Sin firma`;
  if (ej.firmado_cliente && ej.firmado_intermediario) return `${name} · Cliente + Interm.`;
  if (ej.firmado_cliente) return `${name} · Cliente`;
  if (ej.firmado_intermediario) return `${name} · Interm.`;
  return name;
}

export default function RemitoCard({ remito, onSelect }) {
  const ejemplaresList = Array.isArray(remito.ejemplares) ? remito.ejemplares : [];
  const regCount =
    remito.ejemplares_registrados !== undefined ? Number(remito.ejemplares_registrados) : ejemplaresList.length;
  const espCount =
    remito.ejemplares_esperados !== undefined ? Number(remito.ejemplares_esperados) : 2;
  const isPendiente =
    remito.pendiente_ejemplares !== undefined
      ? Boolean(remito.pendiente_ejemplares)
      : remito.estado_firma === 'PENDIENTE';

  const baseStatus = STATUS_CONFIG[remito.estado_firma] || STATUS_CONFIG.PENDIENTE;
  const statusInfo = isPendiente
    ? {
        label: `Pendiente (${regCount}/${espCount} ej.)`,
        icon: Clock,
        className: 'PENDIENTE'
      }
    : baseStatus;
  const StatusIcon = statusInfo.icon;

  let formattedDate = remito.finne_Fecha || '';
  if (formattedDate.includes('T')) {
    formattedDate = formattedDate.split('T')[0];
  }

  return (
    <div
      className={`remito-card status-${statusInfo.className}`}
      onClick={() => onSelect(remito)}
    >
      <div className="card-header-row">
        <div>
          <div className="comprobante-code">{remito.finne_Comprobante || 'Sin Comprobante'}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', flexWrap: 'wrap' }}>
            <Calendar size={13} />
            <span>{formattedDate}</span>
            {remito.nro_hoja_ruta && (
              <>
                <span>•</span>
                <span style={{ fontWeight: 700, color: 'var(--dy-blue)' }}>HR: {remito.nro_hoja_ruta}</span>
              </>
            )}
            {remito.es_viaje_actual === false && (
              <span className="viaje-anterior-badge">
                <History size={11} />
                Viaje anterior
              </span>
            )}
          </div>
        </div>

        <div className={`status-badge ${statusInfo.className}`}>
          <StatusIcon size={14} />
          <span>{statusInfo.label}</span>
        </div>
      </div>

      <div className="cliente-info-row">
        <div className="cliente-name">
          {remito.finne_CodigoCliente ? `${remito.finne_CodigoCliente} - ` : ''}
          {remito.finne_Cliente || 'Cliente no especificado'}
        </div>
        <div className="cliente-address">
          <MapPin size={14} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
          <span>{remito.finne_domicilio || 'Domicilio en hoja de ruta'}</span>
        </div>
      </div>

      {ejemplaresList.length > 0 && (
        <div className="remito-ejemplares-chips">
          {ejemplaresList.map((ej) => (
            <span key={ej.ejemplar} className="remito-ejemplar-pill">
              <FileText size={11} />
              <span>{formatEjemplarTag(ej)}</span>
            </span>
          ))}
        </div>
      )}

      <div className="remito-footer-meta">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {(remito.foto_sharepoint_url || remito.foto_url) && (
            <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
              <Camera size={14} /> Foto
            </span>
          )}
        </div>
        <span style={{ color: 'var(--dy-blue)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px' }}>
          Controlar <ChevronRight size={15} />
        </span>
      </div>
    </div>
  );
}
