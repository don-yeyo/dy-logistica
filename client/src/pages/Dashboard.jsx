import React, { useState } from 'react';
import { 
  ScanLine, 
  Truck, 
  PackageMinus, 
  Boxes, 
  FileText, 
  RefreshCw 
} from 'lucide-react';
import { useAuth } from '../config/AuthContext';

export default function Dashboard({ onStartScan, onOpenHojasRuta }) {
  const { user, pendingSyncCount, triggerSyncOffline, syncing } = useAuth();
  const [modalInfo, setModalInfo] = useState(null);

  const handleModuleClick = (moduleName, description, icon) => {
    setModalInfo({
      title: moduleName,
      description: description,
      icon: icon
    });
  };

  const firstName = user?.nombre?.split(' ')[0] || 'Chofer';

  return (
    <div className="dashboard-container page-transition">
      {/* Saludo Simple y Limpio */}
      <div style={{ padding: '8px 4px 4px 4px' }}>
        <h2 style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>
          ¡Hola, {firstName}!
        </h2>
      </div>

      {/* Grid de 2 Columnas de Botones / Acciones */}
      <div className="dashboard-grid">
        {/* 1. Registrar Remito (Botón Principal Destacado) */}
        <div
          className="dashboard-card card-primary-action"
          onClick={onStartScan}
        >
          <div className="dashboard-card-icon">
            <ScanLine size={30} />
          </div>
          <div className="dashboard-card-title" style={{ fontSize: '1.2rem' }}>
            Registrar Remito
          </div>
          <div className="dashboard-card-desc" style={{ fontSize: '0.82rem' }}>
            Escanear código 1D o ingresar remito manualmente
          </div>
        </div>

        {/* 2. Entregas de Mercadería */}
        <div
          className="dashboard-card card-emerald"
          onClick={() => handleModuleClick(
            'Entregas de Mercadería',
            'Este módulo permitirá la confirmación de descarga de productos por lugar de entrega y remito (según vista ITEMS_A_ENTREGAR).',
            <Truck size={36} color="#34d399" />
          )}
        >
          <div className="dashboard-card-icon">
            <Truck size={26} />
          </div>
          <div className="dashboard-card-title">
            Entregas
          </div>
          <div className="dashboard-card-desc">
            Confirmación de descarga
          </div>
        </div>

        {/* 3. Devoluciones */}
        <div
          className="dashboard-card card-amber"
          onClick={() => handleModuleClick(
            'Devolución de Mercadería',
            'Este módulo permitirá registrar productos devueltos, cantidades, motivos y vencimientos por cliente (según vista HOJA_DE_RUTA_DEVOLUCIONES).',
            <PackageMinus size={26} color="#fb923c" />
          )}
        >
          <div className="dashboard-card-icon">
            <PackageMinus size={26} />
          </div>
          <div className="dashboard-card-title">
            Devoluciones
          </div>
          <div className="dashboard-card-desc">
            Mercadería y motivos
          </div>
        </div>

        {/* 4. Movimiento de Cajones */}
        <div
          className="dashboard-card card-purple"
          onClick={() => handleModuleClick(
            'Movimiento de Cajones',
            'Este módulo registrará la cantidad de cajones plásticos entregados, devueltos y diferencias detectadas.',
            <Boxes size={26} color="#c084fc" />
          )}
        >
          <div className="dashboard-card-icon">
            <Boxes size={26} />
          </div>
          <div className="dashboard-card-title">
            Cajones
          </div>
          <div className="dashboard-card-desc">
            Entrega y devolución
          </div>
        </div>

        {/* 5. Mis Hojas de Ruta */}
        <div
          className="dashboard-card card-blue"
          onClick={onOpenHojasRuta}
        >
          <div className="dashboard-card-icon">
            <FileText size={26} />
          </div>
          <div className="dashboard-card-title">
            Hojas de Ruta
          </div>
          <div className="dashboard-card-desc">
            Ver remitos del viaje
          </div>
        </div>
      </div>

      {/* Barra de Estado Rápida / Sync */}
      <div 
        className="glass" 
        onClick={triggerSyncOffline}
        style={{
          padding: '10px 14px',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          cursor: pendingSyncCount > 0 ? 'pointer' : 'default',
          fontSize: '0.8rem',
          color: 'var(--text)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={15} className={syncing ? 'spin' : ''} style={{ color: pendingSyncCount > 0 ? '#f59e0b' : '#10b981' }} />
          <span style={{ fontWeight: 600 }}>
            {pendingSyncCount > 0
              ? `${pendingSyncCount} remitos guardados offline listos para enviar`
              : 'Todos los remitos sincronizados'}
          </span>
        </div>
        {pendingSyncCount > 0 && (
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--dy-blue)', textDecoration: 'underline' }}>
            Sincronizar ahora
          </span>
        )}
      </div>

      {/* Modal Informativo para Módulos de la Próxima Fase */}
      {modalInfo && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1500
          }}
          onClick={() => setModalInfo(null)}
        >
          <div 
            className="glass page-transition"
            style={{
              width: '100%',
              maxWidth: '380px',
              background: 'var(--surface)',
              color: 'var(--text)',
              borderRadius: '24px',
              padding: '26px 20px',
              textAlign: 'center',
              border: '1px solid var(--border)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '14px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '12px', borderRadius: '50%', background: 'var(--surface-active)' }}>
              {modalInfo.icon}
            </div>

            <h3 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, color: 'var(--text)' }}>
              {modalInfo.title}
            </h3>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: 0 }}>
              {modalInfo.description}
            </p>

            <div style={{
              background: 'rgba(13, 44, 92, 0.08)',
              padding: '8px 12px',
              borderRadius: '10px',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--dy-blue)'
            }}>
              Módulo contemplado para la siguiente fase operativa
            </div>

            <button
              onClick={() => setModalInfo(null)}
              style={{
                width: '100%',
                height: '46px',
                borderRadius: '12px',
                border: 'none',
                background: 'var(--dy-blue)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.92rem',
                cursor: 'pointer',
                marginTop: '4px'
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
