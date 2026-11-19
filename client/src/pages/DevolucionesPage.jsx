import React from 'react';
import HojaRutaHeader from '../components/HojaRutaHeader';

export default function DevolucionesPage({ hojaRuta, onChangeHojaRuta }) {
  return (
    <div className="module-page page-transition">
      <HojaRutaHeader
        hojaRuta={hojaRuta}
        title="Logística DY - Devoluciones"
        onChangeHojaRuta={onChangeHojaRuta}
      />
      <div className="hr-empty-state">
        <p>Cargando módulo de devoluciones...</p>
      </div>
    </div>
  );
}
