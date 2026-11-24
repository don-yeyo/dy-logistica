import React from 'react';
import { FileText, Calendar, Truck } from 'lucide-react';

/**
 * Encabezado reutilizable de Hoja de Ruta para las pantallas operativas:
 * Hoja_de_ruta, Fecha, Viaje y Transporte (omite Chofer porque el usuario autenticado es el chofer).
 */
export default function HojaRutaHeader({ hojaRuta }) {
  if (!hojaRuta) return null;

  let formattedDate = hojaRuta.Fecha || '';
  if (formattedDate.includes('T')) {
    formattedDate = formattedDate.split('T')[0];
  }

  return (
    <div className="hr-detail-header-card">
      <div className="hr-detail-title-bar">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <FileText size={16} />
          <span>Hoja de Ruta: <strong>{hojaRuta.Hoja_de_ruta}</strong></span>
        </span>
      </div>

      <div className="hr-detail-meta">
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
            <Truck size={14} />
            <span>Transporte: <strong>{hojaRuta.Transporte}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
