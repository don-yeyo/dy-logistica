import React from 'react';
import { FileText, Calendar, Truck } from 'lucide-react';

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

  const transporteText = hojaRuta.Transporte || 'Transporte No Informado';

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
          <span>{hojaRuta.Hoja_de_ruta}</span>
        </div>

        <div className="hr-date-tag">
          <Calendar size={14} />
          <span>{formattedDate}</span>
        </div>
      </div>

      <div className="hr-card-body">
        <div className="hr-transporte-row" title={transporteText}>
          <Truck size={15} style={{ flexShrink: 0 }} />
          <span className="hr-transporte-text">{transporteText}</span>
        </div>

        <div className="hr-patentes-row">
          <div className="hr-patente-chip">
            <Truck size={14} style={{ flexShrink: 0 }} />
            <span>Camión: <strong>{hojaRuta.Patente_camion || '-'}</strong></span>
          </div>
          <div className="hr-patente-chip">
            <span>Acoplado: <strong>{hojaRuta.Patente_acoplado || '-'}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
