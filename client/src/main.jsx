import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './config/AuthContext';
import { ThemeProvider } from './config/ThemeContext';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Registro automático del Service Worker PWA
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
