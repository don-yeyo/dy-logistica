import React from 'react';
import { WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { useAuth } from '../config/AuthContext';

export default function OfflineBanner() {
  const { isOnline, pendingSyncCount, syncing, triggerSyncOffline } = useAuth();

  if (isOnline && pendingSyncCount === 0) return null;

  return (
    <div className="offline-sync-banner" style={{ background: isOnline ? '#0284c7' : '#f59e0b' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {isOnline ? (
          <AlertTriangle size={18} />
        ) : (
          <WifiOff size={18} />
        )}
        <span>
          {!isOnline
            ? 'Modo Offline: Puedes seguir marcando remitos.'
            : `${pendingSyncCount} controles guardados localmente.`}
        </span>
      </div>

      {isOnline && pendingSyncCount > 0 && (
        <button
          type="button"
          className="sync-now-btn"
          onClick={triggerSyncOffline}
          disabled={syncing}
        >
          {syncing ? 'Sincronizando...' : 'Sincronizar Ya'}
        </button>
      )}
    </div>
  );
}
