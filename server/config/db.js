const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

// Cargar variables si están en archivo .env local
if (!process.env.DB_HOST) {
  dotenv.config({ path: path.join(__dirname, '..', '.env') });
}

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'Firma_de_remitos',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '5', 10),
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  dateStrings: true,
  connectTimeout: 10000
};

// Si conecta a AWS RDS o DB_SSL está activado
if (process.env.DB_SSL === 'true' || (dbConfig.host && dbConfig.host.includes('rds.amazonaws.com'))) {
  dbConfig.ssl = { rejectUnauthorized: false };
}

let pool = null;

try {
  pool = mysql.createPool(dbConfig);
  console.log(`[DB] Pool MySQL configurado -> Host: ${dbConfig.host}:${dbConfig.port} | BD: ${dbConfig.database} | User: ${dbConfig.user}`);
} catch (e) {
  console.error(`❌ [DB] Error al inicializar Pool MySQL: ${e.message}`);
}

// Test no bloqueante
async function testConnection() {
  if (!pool) return false;
  try {
    const connection = await pool.getConnection();
    console.log('✔ [DB] Conexión establecida exitosamente con la base de datos MySQL.');
    connection.release();
    return true;
  } catch (error) {
    console.warn(`⚠️ [DB] Aviso de conexión a MySQL (${error.code || error.message}).`);
    return false;
  }
}

// Ejecutar test sólo si no estamos en entorno de testing
if (process.env.NODE_ENV !== 'test') {
  testConnection();
}

module.exports = {
  pool,
  testConnection,
  dbConfig
};
