const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'Firma_de_remitos',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  dateStrings: true
};

console.log(`[DB] Configurando Pool MySQL -> Host: ${dbConfig.host}:${dbConfig.port} | BD: ${dbConfig.database} | User: ${dbConfig.user}`);

const pool = mysql.createPool(dbConfig);

// Test inicial de conexión
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✔ [DB] Conexión establecida exitosamente con la base de datos MySQL.');
    connection.release();
    return true;
  } catch (error) {
    console.warn(`⚠️ [DB] No se pudo conectar a MySQL (${error.code || error.message}). La app continuará funcionando; revise sus variables en .env.`);
    return false;
  }
}

testConnection();

module.exports = {
  pool,
  testConnection
};
