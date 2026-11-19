import React from 'react';
import HojaRutaHeader from '../components/HojaRutaHeader';

export default function EntregasPage({ hojaRuta, onChangeHojaRuta }) {
  return (
    <div className="module-page page-transition">
      <HojaRutaHeader
        hojaRuta={hojaRuta}
        title="Logística DY - Entregas"
        onChangeHojaRuta={onChangeHojaRuta}
      />
      <div className="hr-empty-state">
        <p>Cargando módulo de confirmación de descarga...</p>
      </div>
    </div>
  );
}
