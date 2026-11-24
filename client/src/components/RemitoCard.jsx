import React from 'react';
import { MapPin, Calendar, Camera, FileText, CheckCircle2, AlertCircle, Clock, ChevronRight } from 'lucide-react';

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
  const statusInfo = STATUS_CONFIG[remito.estado_firma] || STATUS_CONFIG.PENDIENTE;
  const StatusIcon = statusInfo.icon;
  const ejemplaresList = Array.isArray(remito.ejemplares) ? remito.ejemplares : [];

  let formattedDate = remito.finne_Fecha || '';
  if (formattedDate.includes('T')) {
    formattedDate = formattedDate.split('T')[0];
  }

  return (
    <div
      className={`remito-card status-${remito.estado_firma || 'PENDIENTE'}`}
      onClick={() => onSelect(remito)}
    >
      <div className="card-header-row">
        <div>
          <div className="comprobante-code">{remito.finne_Comprobante || 'Sin Comprobante'}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
            <Calendar size={13} />
            <span>{formattedDate}</span>
            {remito.nro_hoja_ruta && (
              <>
                <span>•</span>
                <span style={{ fontWeight: 700, color: 'var(--dy-blue)' }}>HR: {remito.nro_hoja_ruta}</span>
              </>
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
              {(ej.foto_sharepoint_url || ej.foto_url) && <Camera size={11} />}
            </span>
          ))}
        </div>
      )}

      <div className="card-footer-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {ejemplaresList.length === 0 && remito.tipo_documento && remito.tipo_documento !== 'REMITO' && (
            <span className="doc-tag">
              <FileText size={13} />
              {remito.tipo_documento === 'RECEPCION_VALORIZADA' ? 'Recep. Valorizada' : remito.tipo_documento}
            </span>
          )}
          {ejemplaresList.length === 0 && remito.foto_url && (
            <span className="doc-tag" style={{ background: '#dbeafe', color: '#1e40af' }}>
              <Camera size={13} />
              Foto adjunta
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 700, color: 'var(--dy-blue)' }}>
          <span>Controlar</span>
          <ChevronRight size={16} />
        </div>
      </div>
    </div>
  );
}
