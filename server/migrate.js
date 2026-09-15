const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function runMigration() {
  console.log('Iniciando migración y sincronización de estructura en RDS:', process.env.DB_NAME);

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  // 1. Crear tabla usuarios si no existe
  console.log('\n1. Verificando / Creando tabla `usuarios`...');
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`usuarios\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`email\` VARCHAR(150) NOT NULL,
      \`nombre\` VARCHAR(120) NOT NULL,
      \`codigo_chofer\` VARCHAR(50) DEFAULT NULL,
      \`rol\` ENUM('admin', 'chofer', 'supervisor') NOT NULL DEFAULT 'chofer',
      \`activo\` TINYINT(1) NOT NULL DEFAULT 1,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uniq_email\` (\`email\`),
      INDEX \`idx_email\` (\`email\`),
      INDEX \`idx_codigo_chofer\` (\`codigo_chofer\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);
  console.log('✔ Tabla `usuarios` lista.');

  // 2. Insertar / Actualizar usuario admin gabrielt@donyeyo.com.ar y choferes de prueba
  console.log('\n2. Creando / Actualizando usuario administrador y choferes...');
  const usersToUpsert = [
    {
      email: 'gabrielt@donyeyo.com.ar',
      nombre: 'Gabriel T. (Admin)',
      codigo_chofer: '32355',
      rol: 'admin',
      activo: 1
    },
    {
      email: 'chofer.perez@donyeyo.com.ar',
      nombre: 'Juan Carlos Pérez',
      codigo_chofer: '32355',
      rol: 'chofer',
      activo: 1
    },
    {
      email: 'chofer.gomez@donyeyo.com.ar',
      nombre: 'Carlos Alberto Gómez',
      codigo_chofer: '32356',
      rol: 'chofer',
      activo: 1
    },
    {
      email: 'chofer.rodriguez@donyeyo.com.ar',
      nombre: 'Marcos Rodríguez',
      codigo_chofer: '32357',
      rol: 'chofer',
      activo: 1
    }
  ];

  for (const u of usersToUpsert) {
    await connection.query(`
      INSERT INTO \`usuarios\` (\`email\`, \`nombre\`, \`codigo_chofer\`, \`rol\`, \`activo\`)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        \`nombre\` = VALUES(\`nombre\`),
        \`codigo_chofer\` = VALUES(\`codigo_chofer\`),
        \`rol\` = VALUES(\`rol\`),
        \`activo\` = VALUES(\`activo\`);
    `, [u.email, u.nombre, u.codigo_chofer, u.rol, u.activo]);
  }
  console.log('✔ Usuarios registrados correctamente.');

  // 3. Modificar / Extender la tabla `remitos` con las columnas requeridas
  console.log('\n3. Verificando y agregando nuevas columnas a `remitos`...');
  const [cols] = await connection.query('DESCRIBE remitos');
  const existingCols = new Set(cols.map(c => c.Field));

  const columnsToAdd = [
    { name: 'finne_domicilio', ddl: 'VARCHAR(255) DEFAULT NULL AFTER finne_Cliente' },
    { name: 'nro_hoja_ruta', ddl: 'VARCHAR(50) DEFAULT NULL AFTER finne_cbte_relacionado' },
    { name: 'transportistas', ddl: 'JSON DEFAULT NULL AFTER nro_hoja_ruta' },
    { name: 'ejemplar', ddl: "ENUM('ORIGINAL', 'DUPLICADO', 'TRIPLICADO', 'CUATRIPLICADO', 'RECEPCION_VALORIZADA', 'OTRO') NOT NULL DEFAULT 'ORIGINAL' AFTER transportistas" },
    { name: 'estado_firma', ddl: "ENUM('PENDIENTE', 'FIRMADO_CLIENTE', 'FIRMADO_INTERMEDIARIO', 'NO_FIRMADO') NOT NULL DEFAULT 'PENDIENTE' AFTER ejemplar" },
    { name: 'tipo_documento', ddl: "ENUM('REMITO', 'RECEPCION_VALORIZADA', 'OTRO') DEFAULT 'REMITO' AFTER estado_firma" },
    { name: 'observaciones', ddl: 'TEXT DEFAULT NULL AFTER tipo_documento' },
    { name: 'foto_url', ddl: 'VARCHAR(500) DEFAULT NULL AFTER observaciones' },
    { name: 'foto_sharepoint_url', ddl: 'VARCHAR(500) DEFAULT NULL AFTER foto_url' },
    { name: 'foto_nombre_archivo', ddl: 'VARCHAR(255) DEFAULT NULL AFTER foto_sharepoint_url' },
    { name: 'fecha_control', ddl: 'DATETIME DEFAULT NULL AFTER foto_nombre_archivo' },
    { name: 'controlado_por_chofer_id', ddl: 'INT DEFAULT NULL AFTER fecha_control' },
    { name: 'controlado_por_chofer_email', ddl: 'VARCHAR(150) DEFAULT NULL AFTER controlado_por_chofer_id' },
    { name: 'sincronizado_offline', ddl: 'TINYINT(1) DEFAULT 0 AFTER controlado_por_chofer_email' }
  ];

  for (const col of columnsToAdd) {
    if (!existingCols.has(col.name)) {
      console.log(` -> Agregando columna ${col.name}...`);
      await connection.query(`ALTER TABLE \`remitos\` ADD COLUMN \`${col.name}\` ${col.ddl}`);
    } else {
      console.log(` ✔ Columna ${col.name} ya existe.`);
    }
  }

  // 4. Crear índices para optimizar búsquedas y filtros sobre los 87k registros
  console.log('\n4. Verificando índices de alta velocidad en `remitos`...');
  const [indexes] = await connection.query('SHOW INDEX FROM remitos');
  const existingIndexes = new Set(indexes.map(i => i.Key_name));

  const indexesToCreate = [
    { name: 'idx_finne_transaccion', column: 'finne_transaccionID' },
    { name: 'idx_comprobante', column: 'finne_Comprobante' },
    { name: 'idx_hoja_ruta', column: 'nro_hoja_ruta' },
    { name: 'idx_estado_firma', column: 'estado_firma' },
    { name: 'idx_fecha', column: 'finne_Fecha' }
  ];

  for (const idx of indexesToCreate) {
    if (!existingIndexes.has(idx.name)) {
      console.log(` -> Creando índice ${idx.name} en ${idx.column}...`);
      await connection.query(`ALTER TABLE \`remitos\` ADD INDEX \`${idx.name}\` (\`${idx.column}\`)`);
    } else {
      console.log(` ✔ Índice ${idx.name} ya existe.`);
    }
  }

  // 5. Poblar nro_hoja_ruta en remitos donde finne_Descripcion contenga 'HOJARUTA - <numero>'
  console.log('\n5. Extrayendo automáticamente Hojas de Ruta de `finne_Descripcion` para los registros existentes...');
  const [updateHR] = await connection.query(`
    UPDATE \`remitos\`
    SET \`nro_hoja_ruta\` = CONCAT('HR-', SUBSTRING_INDEX(SUBSTRING_INDEX(finne_Descripcion, 'HOJARUTA - ', -1), ' ', 1))
    WHERE \`finne_Descripcion\` LIKE '%HOJARUTA - %' 
      AND (\`nro_hoja_ruta\` IS NULL OR \`nro_hoja_ruta\` = '')
  `);
  console.log(`✔ Filas actualizadas con Hoja de Ruta: ${updateHR.affectedRows}`);

  // 6. Asignar transportista a las hojas de ruta más recientes para pruebas si no tienen transportistas
  console.log('\n6. Asignando transportistas a los remitos recientes para permitir prueba inmediata del chofer 32355...');
  const [recentHRs] = await connection.query(`
    SELECT DISTINCT nro_hoja_ruta
    FROM remitos
    WHERE nro_hoja_ruta IS NOT NULL AND nro_hoja_ruta != ''
    ORDER BY id DESC
    LIMIT 6
  `);

  if (recentHRs.length > 0) {
    const hrList = recentHRs.map(r => r.nro_hoja_ruta);
    console.log('Hojas de ruta recientes detectadas:', hrList);
    const placeholders = hrList.map(() => '?').join(',');
    await connection.query(`
      UPDATE \`remitos\`
      SET \`transportistas\` = JSON_ARRAY(JSON_OBJECT('chofer', '32355', 'nombre', 'Juan Carlos Pérez'))
      WHERE \`nro_hoja_ruta\` IN (${placeholders}) AND \`transportistas\` IS NULL
    `, hrList);
    console.log('✔ Transportistas asignados a las hojas de ruta recientes.');
  }

  console.log('\n======================================================');
  console.log('🎉 Migración completada con éxito.');
  console.log('======================================================');

  await connection.end();
}

runMigration().catch(err => {
  console.error('Error durante la migración:', err);
  process.exit(1);
});
