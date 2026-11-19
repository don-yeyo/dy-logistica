import React from 'react';
import { FileText, Calendar, User, Truck, ArrowLeft } from 'lucide-react';

/**
 * Encabezado reutilizable de Hoja de Ruta para las pantallas operativas
 * (Sección 4.2.1 y 4.2.2): Hoja_de_ruta, Fecha, Viaje, Chofer y Transporte.
 * No muestra Transaccionid ni EMail en pantalla.
 */
export default function HojaRutaHeader({ hojaRuta, title, onChangeHojaRuta }) {
  if (!hojaRuta) return null;

  let formattedDate = hojaRuta.Fecha || '';
  if (formattedDate.includes('T')) {
    formattedDate = formattedDate.split('T')[0];
  }

  return (
    <div className="hr-detail-header-card">
      <div className="hr-detail-title-bar">
        <span>{title}</span>
        {onChangeHojaRuta && (
          <button
            type="button"
            className="hr-change-btn"
            onClick={onChangeHojaRuta}
            title="Volver al listado de Hojas de Ruta"
          >
            <ArrowLeft size={14} />
            <span>Hojas de Ruta</span>
          </button>
        )}
      </div>

      <div className="hr-detail-meta">
        <div className="hr-meta-row hr-meta-primary">
          <FileText size={15} />
          <span>Hoja de Ruta: <strong>{hojaRuta.Hoja_de_ruta}</strong></span>
        </div>

        <div className="hr-meta-grid">
          <div className="hr-meta-row">
            <Calendar size={14} />
            <span>Fecha: <strong>{formattedDate}</strong></span>
          </div>
          {hojaRuta.Viaje && (
            <div className="hr-meta-row">
              <span>Viaje: <strong>{hojaRuta.Viaje}</strong></span>
            </div>
          )}
          <div className="hr-meta-row">
            <User size={14} />
            <span>Chofer: <strong>{hojaRuta.Chofer}</strong></span>
          </div>
          <div className="hr-meta-row">
            <Truck size={14} />
            <span>Transporte: <strong>{hojaRuta.Transporte}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
