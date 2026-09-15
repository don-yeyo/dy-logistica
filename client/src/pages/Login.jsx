import React, { useState, useEffect } from 'react';
import { useAuth } from '../config/AuthContext';
import { fetchUsersList } from '../services/api';
import { Truck, ShieldCheck, LogIn, AlertCircle } from 'lucide-react';

export default function Login() {
  const { loginWithMicrosoft, loginMock, loading, error } = useAuth();
  const [testUsers, setTestUsers] = useState([]);
  const [selectedMockEmail, setSelectedMockEmail] = useState('chofer.perez@donyeyo.com.ar');
  const isMockAllowed = import.meta.env.VITE_MOCK_AUTH === 'true';

  useEffect(() => {
    if (isMockAllowed) {
      fetchUsersList()
        .then((res) => {
          if (res && res.users) {
            setTestUsers(res.users);
          }
        })
        .catch(() => {});
    }
  }, [isMockAllowed]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'linear-gradient(135deg, #071936 0%, #0d2c5c 50%, #1a4b8c 100%)', color: '#fff' }}>
      <div style={{ maxWidth: '420px', width: '100%', background: 'rgba(255, 255, 255, 0.95)', color: '#0f172a', borderRadius: '24px', padding: '32px 24px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Logo y Encabezado */}
        <div>
          <img
            src="/logo.png"
            alt="Don Yeyo"
            style={{ height: '56px', width: 'auto', marginBottom: '12px' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dy-blue)', letterSpacing: '-0.02em' }}>
            Don Yeyo Logística
          </h1>
          <p style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '4px' }}>
            Control de Firmas y Recepción de Remitos para Choferes
          </p>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left' }}>
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Botón SSO Microsoft Entra ID */}
        <button
          type="button"
          onClick={loginWithMicrosoft}
          disabled={loading}
          style={{
            minHeight: '56px',
            borderRadius: '16px',
            border: '2px solid #cbd5e1',
            background: '#ffffff',
            color: '#1e293b',
            fontSize: '1rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            cursor: 'pointer',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.08)',
            transition: 'transform 0.15s ease'
          }}
        >
          <svg width="22" height="22" viewBox="0 0 23 23">
            <path fill="#f35325" d="M1 1h10v10H1z"/>
            <path fill="#81bc06" d="M12 1h10v10H12z"/>
            <path fill="#05a6f0" d="M1 12h10v10H1z"/>
            <path fill="#ffba08" d="M12 12h10v10H12z"/>
          </svg>
          <span>Ingresar con Microsoft SSO</span>
        </button>

        {/* Sección de desarrollo / Test Users */}
        {isMockAllowed && (
          <div style={{ marginTop: '10px', paddingTop: '16px', borderTop: '1px dashed #cbd5e1', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Modo Desarrollo: Acceso Rápido Chofer
            </span>

            <select
              value={selectedMockEmail}
              onChange={(e) => setSelectedMockEmail(e.target.value)}
              style={{
                height: '48px',
                padding: '0 12px',
                borderRadius: '12px',
                border: '1.5px solid #cbd5e1',
                fontSize: '0.9rem',
                fontWeight: 600,
                background: '#f8fafc',
                color: '#0f172a'
              }}
            >
              {testUsers.length > 0 ? (
                testUsers.map((u) => (
                  <option key={u.id} value={u.email}>
                    {u.nombre} ({u.codigo_chofer ? `Chofer #${u.codigo_chofer}` : u.rol})
                  </option>
                ))
              ) : (
                <>
                  <option value="chofer.perez@donyeyo.com.ar">Juan Carlos Pérez (Chofer #32355)</option>
                  <option value="chofer.gomez@donyeyo.com.ar">Carlos Alberto Gómez (Chofer #32356)</option>
                  <option value="chofer.rodriguez@donyeyo.com.ar">Marcos Rodríguez (Chofer #32357)</option>
                  <option value="gabrielt@donyeyo.com.ar">Gabriel T. (Admin)</option>
                </>
              )}
            </select>

            <button
              type="button"
              onClick={() => loginMock(selectedMockEmail)}
              disabled={loading}
              style={{
                height: '48px',
                borderRadius: '12px',
                border: 'none',
                background: 'var(--dy-blue)',
                color: '#fff',
                fontSize: '0.95rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer'
              }}
            >
              <LogIn size={18} />
              <span>Ingresar como Chofer Seleccionado</span>
            </button>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.78rem', color: '#94a3b8' }}>
          <ShieldCheck size={14} />
          <span>Acceso seguro corporativo Don Yeyo S.A.</span>
        </div>
      </div>
    </div>
  );
}
