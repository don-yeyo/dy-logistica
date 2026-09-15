const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Configuración de Seguridad y Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body Parser con límite holgado para payloads
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Servir archivos estáticos de uploads (para visualizar fotos guardadas)
const uploadsDirectory = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads');
app.use('/uploads', express.static(uploadsDirectory));

// Rate Limiter
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 300, // Máximo 300 peticiones por minuto
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', limiter);

// Rutas de la API
const authRoutes = require('./routes/authRoutes');
const remitosRoutes = require('./routes/remitosRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/remitos', remitosRoutes);

// Healthcheck y diagnóstico
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    name: 'DY-LOGISTICA-API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    sharepoint_enabled: process.env.ENABLE_SHAREPOINT_UPLOAD === 'true'
  });
});

// Manejador de 404
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
  });
});

// Manejador global de errores
app.use((err, req, res, next) => {
  console.error('[Error Global]', err);
  res.status(err.status || 500).json({
    ok: false,
    error: err.message || 'Error interno del servidor.'
  });
});

// Inicialización del servidor
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  🚀 DY-LOGISTICA-APP - Servidor API Backend Express              ║
║  Host: http://localhost:${PORT}                                   ║
║  Modo: ${(process.env.NODE_ENV || 'development').toUpperCase()}                                         ║
║  Directorio Uploads: ${uploadsDirectory}
╚══════════════════════════════════════════════════════════════════╝
  `);
});
