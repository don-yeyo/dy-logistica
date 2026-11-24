const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

if (!process.env.DB_HOST) {
  dotenv.config({ path: path.join(__dirname, '..', '.env') });
}

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'Gestion_Logistica',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '5', 10),
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  dateStrings: true,
  connectTimeout: 10000
};

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

/**
 * Ejecuta una operación obteniendo una conexión dedicada e inyectando
 * las variables de sesión MySQL @app_user_email y @app_user_rol
 * para que los triggers de AUDITORIA registren el usuario de la aplicación.
 */
async function withAuditConnection(user, callback) {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET @app_user_email = ?, @app_user_rol = ?', [
      user?.email || 'sistema',
      user?.rol || 'unknown'
    ]);
    return await callback(conn);
  } finally {
    try {
      await conn.query('SET @app_user_email = NULL, @app_user_rol = NULL');
    } catch {
      // Ignorar si la conexión ya cerró
    }
    conn.release();
  }
}

async function testConnection() {
  if (!pool) return false;
  try {
    const connection = await pool.getConnection();
    console.log(`✔ [DB] Conexión establecida con ${dbConfig.database}.`);
    connection.release();
    return true;
  } catch (error) {
    console.warn(`⚠️ [DB] Aviso de conexión a ${dbConfig.database} (${error.code || error.message}).`);
    return false;
  }
}

if (process.env.NODE_ENV !== 'test') {
  testConnection();
}

module.exports = {
  pool,
  withAuditConnection,
  testConnection,
  dbConfig
};
