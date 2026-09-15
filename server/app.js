const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');

// Cargar variables de entorno si existen localmente
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

// Configuración de Seguridad y Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors({
  origin: true,
  credentials: true
}));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Body Parser con límite holgado para payloads y fotos en base64
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Servir archivos estáticos de uploads (para entorno local)
const uploadsDirectory = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads');
try {
  app.use('/uploads', express.static(uploadsDirectory));
} catch (e) {
  // En serverless el directorio es temporal
}

// Rate Limiter
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  // En serverless confiar en el proxy de Netlify/Cloudflare
  trustProxy: true
});
app.use('/api', limiter);

// Rutas de la API
const authRoutes = require('./routes/authRoutes');
const remitosRoutes = require('./routes/remitosRoutes');

// Montar tanto en /api/* como en /* para total compatibilidad con rewrites serverless
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);

app.use('/api/remitos', remitosRoutes);
app.use('/remitos', remitosRoutes);

// Healthcheck y diagnóstico
const healthHandler = (req, res) => {
  res.json({
    ok: true,
    name: 'DY-LOGISTICA-API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'production',
    serverless: Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME),
    sharepoint_enabled: process.env.ENABLE_SHAREPOINT_UPLOAD === 'true'
  });
};

app.get('/api/health', healthHandler);
app.get('/health', healthHandler);

// Manejador de 404
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: `Ruta no encontrada en API: ${req.method} ${req.originalUrl}`
  });
});

// Manejador global de errores
app.use((err, req, res, next) => {
  console.error('[Error Global API]', err);
  res.status(err.status || 500).json({
    ok: false,
    error: err.message || 'Error interno del servidor.'
  });
});

module.exports = app;
