import React from 'react';
import { FileText, Calendar, Truck, UserRound } from 'lucide-react';

function TrailerIcon({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      <rect x="2" y="6" width="16" height="9" rx="1.5" />
      <path d="M18 13h4" />
      <circle cx="6.5" cy="17.5" r="2" />
      <circle cx="14.5" cy="17.5" r="2" />
    </svg>
  );
}

/**
 * Componente unificado de card de Hoja de Ruta:
 * Se utiliza tanto en Inicio (listado seleccionable) como en Entregas, Devoluciones, Cajones y Remitos.
 * Muestra: Hoja_de_ruta, Fecha, Transportista (100% ancho en 1 línea) y Patentes (Camión / Acoplado).
 */
export default function HojaRutaHeader({
  hojaRuta,
  selected = true,
  interactive = false,
  onSelect = null
}) {
  if (!hojaRuta) return null;

  let formattedDate = hojaRuta.Fecha || '-';
  if (typeof formattedDate === 'string' && formattedDate.includes('T')) {
    formattedDate = formattedDate.split('T')[0];
  }

  const handleKeyDown = (e) => {
    if (!interactive || !onSelect) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(hojaRuta);
    }
  };

  const transporteText = hojaRuta.Transporte || 'No informado';

  return (
    <div
      className={`hr-card ${selected ? 'selected' : ''} ${interactive ? 'interactive' : 'static'}`}
      onClick={interactive && onSelect ? () => onSelect(hojaRuta) : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={handleKeyDown}
    >
      <div className="hr-card-top">
        <div className="hr-code-badge">
          <FileText size={16} />
          <span>{interactive ? hojaRuta.Hoja_de_ruta : `Hoja de Ruta ${hojaRuta.Hoja_de_ruta}`}</span>
        </div>

        <div className="hr-date-tag">
          <Calendar size={14} />
          <span>{formattedDate}</span>
        </div>
      </div>

      <div className="hr-card-body">
        <div className="hr-transporte-row" title={`Transporte: ${transporteText}`}>
          <UserRound size={15} style={{ flexShrink: 0 }} />
          <span className="hr-transporte-text">
            Transporte: <strong>{transporteText}</strong>
          </span>
        </div>

        <div className="hr-patentes-row">
          <div className="hr-patente-chip">
            <Truck size={14} style={{ flexShrink: 0 }} />
            <span>Camión: <strong>{hojaRuta.Patente_camion || '-'}</strong></span>
          </div>
          <div className="hr-patente-chip">
            <TrailerIcon size={14} />
            <span>Acoplado: <strong>{hojaRuta.Patente_acoplado || '-'}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
