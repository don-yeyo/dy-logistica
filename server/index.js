const app = require('./app');
const path = require('path');

const PORT = process.env.PORT || 5000;
const uploadsDirectory = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads');

// Inicialización del servidor HTTP local
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
