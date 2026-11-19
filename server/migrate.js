const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function runMigration() {
  console.log('Iniciando migración y sincronización de estructura en RDS:', process.env.DB_NAME);

  const connConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    dateStrings: true,
    connectTimeout: 15000
  };

  if (process.env.DB_SSL === 'true' || (connConfig.host && connConfig.host.includes('rds.amazonaws.com'))) {
    connConfig.ssl = { rejectUnauthorized: false };
  }

  const connection = await mysql.createConnection(connConfig);

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

  // 2. Insertar / Actualizar usuario admin y choferes de prueba
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
  console.log('\n3. Verificando y agregando columnas a `remitos`...');
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
    { name: 'firma_digital_base64', ddl: 'LONGTEXT DEFAULT NULL AFTER foto_nombre_archivo' },
    { name: 'firma_receptor_aclaracion', ddl: 'VARCHAR(150) DEFAULT NULL AFTER firma_digital_base64' },
    { name: 'firma_receptor_dni', ddl: 'VARCHAR(40) DEFAULT NULL AFTER firma_receptor_aclaracion' },
    { name: 'fecha_control', ddl: 'DATETIME DEFAULT NULL AFTER firma_receptor_dni' },
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

  // 4. Crear índices en `remitos`
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

  // 5. Poblar nro_hoja_ruta desde finne_Descripcion
  console.log('\n5. Extrayendo Hojas de Ruta de `finne_Descripcion`...');
  const [updateHR] = await connection.query(`
    UPDATE \`remitos\`
    SET \`nro_hoja_ruta\` = CONCAT('HR-', SUBSTRING_INDEX(SUBSTRING_INDEX(finne_Descripcion, 'HOJARUTA - ', -1), ' ', 1))
    WHERE \`finne_Descripcion\` LIKE '%HOJARUTA - %'
      AND (\`nro_hoja_ruta\` IS NULL OR \`nro_hoja_ruta\` = '')
  `);
  console.log(`✔ Filas actualizadas con Hoja de Ruta: ${updateHR.affectedRows}`);

  // 6. Crear tablas de catálogos auxiliares
  console.log('\n6. Creando tablas de catálogos auxiliares...');
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`CATALOGO_PRODUCTOS\` (
      \`id_producto\` INT NOT NULL AUTO_INCREMENT,
      \`codigo\` VARCHAR(40) DEFAULT NULL,
      \`nombre\` VARCHAR(200) NOT NULL,
      \`unidad\` VARCHAR(30) DEFAULT 'UN',
      \`activo\` TINYINT(1) NOT NULL DEFAULT 1,
      PRIMARY KEY (\`id_producto\`),
      UNIQUE KEY \`uniq_prod_codigo\` (\`codigo\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`CATALOGO_CLIENTES\` (
      \`id_cliente\` INT NOT NULL,
      \`nombre\` VARCHAR(180) NOT NULL,
      \`domicilio\` VARCHAR(255) DEFAULT NULL,
      \`activo\` TINYINT(1) NOT NULL DEFAULT 1,
      PRIMARY KEY (\`id_cliente\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`CATALOGO_MOTIVOS_DEVOLUCION\` (
      \`id_motivo\` INT NOT NULL AUTO_INCREMENT,
      \`descripcion\` VARCHAR(180) NOT NULL,
      \`activo\` TINYINT(1) NOT NULL DEFAULT 1,
      PRIMARY KEY (\`id_motivo\`),
      UNIQUE KEY \`uniq_motivo_desc\` (\`descripcion\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);

  const productosSeed = [
    ['DY-QCR-01', 'Queso Cremoso Horma x 4 kg', 'UN'],
    ['DY-MOZ-02', 'Mozzarella Cilindro x 3 kg', 'UN'],
    ['DY-TYB-03', 'Queso Tybo en Barra x 4 kg', 'UN'],
    ['DY-DDL-04', 'Dulce de Leche Repostero x 10 kg', 'BALDE'],
    ['DY-RIC-05', 'Ricotta Entera x 1 kg', 'UN'],
    ['DY-MAN-06', 'Manteca Pan x 200 g (Caja x 24)', 'CAJA']
  ];
  for (const [codigo, nombre, unidad] of productosSeed) {
    await connection.query(`
      INSERT INTO \`CATALOGO_PRODUCTOS\` (\`codigo\`, \`nombre\`, \`unidad\`)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE \`nombre\` = VALUES(\`nombre\`), \`unidad\` = VALUES(\`unidad\`)
    `, [codigo, nombre, unidad]);
  }

  const motivosSeed = [
    'Producto Vencido / Vencimiento Cercano',
    'Envase Dañado o Roto',
    'Diferencia de Pedido / Error Facturación',
    'Rechazo Parcial en Recepción',
    'Cadena de Frío / Temperatura',
    'Faltante / Sobrante de Reparto'
  ];
  for (const desc of motivosSeed) {
    await connection.query(`
      INSERT IGNORE INTO \`CATALOGO_MOTIVOS_DEVOLUCION\` (\`descripcion\`) VALUES (?)
    `, [desc]);
  }
  console.log('✔ Catálogos base creados y poblados.');

  // 7. Crear tablas de Hojas de Ruta, Entregas, Devoluciones y Cajones (con mayúsculas exactas)
  console.log('\n7. Creando tablas de especificación funcional...');
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`HOJAS_DE_RUTA_CABECERA\` (
      \`Transaccionid\` INT NOT NULL,
      \`Hoja_de_ruta\` VARCHAR(50) NOT NULL,
      \`Fecha\` DATE NOT NULL,
      \`Viaje\` VARCHAR(100) DEFAULT NULL,
      \`Chofer\` VARCHAR(120) NOT NULL,
      \`codigo_chofer\` VARCHAR(50) DEFAULT '32355',
      \`EMail\` VARCHAR(150) NOT NULL,
      \`Transporte\` VARCHAR(150) NOT NULL DEFAULT 'Logística Propia Don Yeyo S.A.',
      \`Patente_camion\` VARCHAR(30) NOT NULL DEFAULT 'AE 452 KL',
      \`Patente_acoplado\` VARCHAR(30) NOT NULL DEFAULT 'AF 891 MN',
      \`id_etapa\` INT NOT NULL DEFAULT 1,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`Transaccionid\`),
      UNIQUE KEY \`uniq_hoja_ruta\` (\`Hoja_de_ruta\`),
      INDEX \`idx_hr_email\` (\`EMail\`),
      INDEX \`idx_hr_chofer\` (\`codigo_chofer\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`HOJA_RUTA_ITEM_REMITO\` (
      \`Hojarutaitemid\` INT NOT NULL AUTO_INCREMENT,
      \`Transaccionid\` INT NOT NULL,
      \`remito_id\` BIGINT DEFAULT NULL,
      \`Lugar_de_Entrega\` VARCHAR(200) NOT NULL,
      \`Remito\` VARCHAR(60) NOT NULL,
      \`id_cliente\` INT DEFAULT NULL,
      \`Cliente\` VARCHAR(180) DEFAULT NULL,
      \`id_producto\` INT NOT NULL DEFAULT 1,
      \`Producto\` VARCHAR(200) NOT NULL,
      \`cantidad_remitida\` INT NOT NULL DEFAULT 1,
      \`cantidad_descargada_Chofer\` INT DEFAULT NULL,
      \`updated_by_email\` VARCHAR(150) DEFAULT NULL,
      \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`Hojarutaitemid\`),
      INDEX \`idx_item_transaccion\` (\`Transaccionid\`),
      INDEX \`idx_item_remito\` (\`Remito\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`REMITO_DEVOLUCIONES\` (
      \`id_remito_devoluciones\` INT NOT NULL AUTO_INCREMENT,
      \`Transaccionid\` INT NOT NULL,
      \`id_etapa\` INT NOT NULL DEFAULT 1,
      \`fecha\` DATE NOT NULL,
      \`id_cliente\` INT NOT NULL,
      \`Cliente\` VARCHAR(180) DEFAULT NULL,
      \`Lugar_de_Entrega\` VARCHAR(200) NOT NULL,
      \`usuario_email\` VARCHAR(150) DEFAULT NULL,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id_remito_devoluciones\`),
      INDEX \`idx_dev_transaccion\` (\`Transaccionid\`),
      INDEX \`idx_dev_cliente\` (\`id_cliente\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`REMITO_DEVOLUCIONES_ITEMS\` (
      \`id_remito_devoluciones_item\` INT NOT NULL AUTO_INCREMENT,
      \`id_remito_devoluciones\` INT NOT NULL,
      \`id_producto\` INT NOT NULL,
      \`Producto\` VARCHAR(200) DEFAULT NULL,
      \`cantidad_check_chofer\` INT NOT NULL DEFAULT 1,
      \`vencimiento_check_chofer\` DATE DEFAULT NULL,
      \`motivo\` VARCHAR(200) NOT NULL DEFAULT 'Diferencia de Pedido',
      \`tipo\` ENUM('Físico', 'Virtual') NOT NULL DEFAULT 'Físico',
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id_remito_devoluciones_item\`),
      INDEX \`idx_dev_item_cab\` (\`id_remito_devoluciones\`),
      FOREIGN KEY (\`id_remito_devoluciones\`) REFERENCES \`REMITO_DEVOLUCIONES\`(\`id_remito_devoluciones\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`HOJA_RUTA_CAJONES\` (
      \`id_cajon_movimiento\` INT NOT NULL AUTO_INCREMENT,
      \`Transaccionid\` INT NOT NULL,
      \`Lugar_de_Entrega\` VARCHAR(200) NOT NULL,
      \`id_cliente\` INT DEFAULT NULL,
      \`Cliente\` VARCHAR(180) DEFAULT NULL,
      \`cajones_entregados\` INT NOT NULL DEFAULT 0,
      \`cajones_devueltos\` INT NOT NULL DEFAULT 0,
      \`diferencia\` INT NOT NULL DEFAULT 0,
      \`observaciones\` VARCHAR(500) DEFAULT NULL,
      \`usuario_email\` VARCHAR(150) DEFAULT NULL,
      \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id_cajon_movimiento\`),
      UNIQUE KEY \`uniq_cajon_parada\` (\`Transaccionid\`, \`Lugar_de_Entrega\`, \`Cliente\`),
      INDEX \`idx_cajones_tx\` (\`Transaccionid\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);
  console.log('✔ Tablas de especificación funcional listas.');

  // 8. Crear / Actualizar Vistas SQL exactas según especificación
  console.log('\n8. Creando vistas SQL: HOJAS_DE_RUTA_A_ENTREGAR, ITEMS_A_ENTREGAR y HOJA_DE_RUTA_DEVOLUCIONES...');
  await connection.query(`
    CREATE OR REPLACE VIEW \`HOJAS_DE_RUTA_A_ENTREGAR\` AS
    SELECT
      h.Transaccionid,
      h.Hoja_de_ruta,
      h.Fecha,
      h.Viaje,
      h.Chofer,
      u.email AS EMail,
      h.Transporte,
      h.Patente_camion,
      h.Patente_acoplado,
      h.id_etapa
    FROM \`HOJAS_DE_RUTA_CABECERA\` h
    INNER JOIN \`usuarios\` u
      ON (u.codigo_chofer = h.codigo_chofer OR LOWER(u.email) = LOWER(h.EMail))
    WHERE u.activo = 1;
  `);

  await connection.query(`
    CREATE OR REPLACE VIEW \`ITEMS_A_ENTREGAR\` AS
    SELECT
      i.Lugar_de_Entrega,
      i.Remito,
      i.Cliente,
      i.id_cliente,
      i.Producto,
      i.cantidad_remitida AS Remitido,
      i.cantidad_descargada_Chofer AS Entregado,
      i.Transaccionid,
      i.Hojarutaitemid
    FROM \`HOJA_RUTA_ITEM_REMITO\` i;
  `);

  await connection.query(`
    CREATE OR REPLACE VIEW \`HOJA_DE_RUTA_DEVOLUCIONES\` AS
    SELECT
      base.Transaccionid,
      h.id_etapa,
      h.Fecha AS fecha,
      base.Lugar_de_Entrega,
      base.id_cliente,
      base.Cliente,
      rd.id_remito_devoluciones,
      rdi.id_remito_devoluciones_item,
      rdi.id_producto,
      COALESCE(rdi.Producto, cp.nombre) AS Producto,
      rdi.cantidad_check_chofer AS Cantidad,
      rdi.vencimiento_check_chofer AS Vencimiento,
      rdi.motivo AS Motivo,
      rdi.tipo AS Tipo
    FROM (
      SELECT DISTINCT Transaccionid, Lugar_de_Entrega, id_cliente, Cliente
      FROM \`HOJA_RUTA_ITEM_REMITO\`
      UNION
      SELECT DISTINCT Transaccionid, Lugar_de_Entrega, id_cliente, Cliente
      FROM \`REMITO_DEVOLUCIONES\`
    ) base
    INNER JOIN \`HOJAS_DE_RUTA_CABECERA\` h ON h.Transaccionid = base.Transaccionid
    LEFT JOIN \`REMITO_DEVOLUCIONES\` rd
      ON rd.Transaccionid = base.Transaccionid
      AND rd.Lugar_de_Entrega = base.Lugar_de_Entrega
      AND rd.id_cliente <=> base.id_cliente
    LEFT JOIN \`REMITO_DEVOLUCIONES_ITEMS\` rdi
      ON rdi.id_remito_devoluciones = rd.id_remito_devoluciones
    LEFT JOIN \`CATALOGO_PRODUCTOS\` cp
      ON cp.id_producto = rdi.id_producto;
  `);
  console.log('✔ Vistas SQL creadas exitosamente.');

  // 9. Poblar HOJAS_DE_RUTA_CABECERA y HOJA_RUTA_ITEM_REMITO a partir de los remitos recientes reales
  console.log('\n9. Sincronizando Hojas de Ruta e Ítems a Entregar desde remitos recientes...');
  const [recentHRs] = await connection.query(`
    SELECT nro_hoja_ruta, MAX(finne_Fecha) AS fecha, MAX(id) AS max_id
    FROM remitos
    WHERE nro_hoja_ruta IS NOT NULL AND nro_hoja_ruta != '' AND nro_hoja_ruta REGEXP '^HR-[0-9]+$'
    GROUP BY nro_hoja_ruta
    ORDER BY fecha DESC, max_id DESC
    LIMIT 6
  `);

  const [catalogProducts] = await connection.query('SELECT id_producto, nombre FROM CATALOGO_PRODUCTOS ORDER BY id_producto ASC');
  const zonasEntrega = [
    'Centro Distribución Rosario Norte',
    'Zona Sur - Mercado Central',
    'Corredor Oeste - Av. Eva Perón',
    'Sucursales Centro'
  ];

  const driverPresets = [
    { codigo: '32355', chofer: 'Juan Carlos Pérez', email: 'chofer.perez@donyeyo.com.ar', transporte: 'Flota Propia Don Yeyo', camion: 'AE 452 KL', acoplado: 'AF 891 MN' },
    { codigo: '32355', chofer: 'Juan Carlos Pérez', email: 'chofer.perez@donyeyo.com.ar', transporte: 'Flota Propia Don Yeyo', camion: 'AG 118 RT', acoplado: 'AE 774 QW' },
    { codigo: '32355', chofer: 'Juan Carlos Pérez', email: 'chofer.perez@donyeyo.com.ar', transporte: 'Transp. Litoral Express S.R.L.', camion: 'AD 903 MP', acoplado: 'AC 540 ZX' },
    { codigo: '32355', chofer: 'Juan Carlos Pérez', email: 'chofer.perez@donyeyo.com.ar', transporte: 'Flota Propia Don Yeyo', camion: 'AE 452 KL', acoplado: 'AF 891 MN' },
    { codigo: '32356', chofer: 'Carlos Alberto Gómez', email: 'chofer.gomez@donyeyo.com.ar', transporte: 'Expreso Ruta 9 S.A.', camion: 'AF 220 VC', acoplado: 'AE 612 PL' },
    { codigo: '32357', chofer: 'Marcos Rodríguez', email: 'chofer.rodriguez@donyeyo.com.ar', transporte: 'Logística Don Yeyo Terciarizada', camion: 'AG 505 NB', acoplado: 'AF 319 KL' }
  ];

  for (let idx = 0; idx < recentHRs.length; idx++) {
    const hrRow = recentHRs[idx];
    const preset = driverPresets[idx % driverPresets.length];
    const numericPart = parseInt(hrRow.nro_hoja_ruta.replace(/[^0-9]/g, ''), 10) || (25000 + idx);
    const transaccionId = numericPart;
    const viajeLabel = `VJ-${numericPart}-01`;

    // Asegurar transportistas asignado en la tabla remitos para esta HR
    await connection.query(`
      UPDATE \`remitos\`
      SET \`transportistas\` = JSON_ARRAY(JSON_OBJECT('chofer', ?, 'nombre', ?))
      WHERE \`nro_hoja_ruta\` = ? AND (\`transportistas\` IS NULL OR JSON_LENGTH(\`transportistas\`) = 0)
    `, [preset.codigo, preset.chofer, hrRow.nro_hoja_ruta]);

    // Insertar/actualizar cabecera de hoja de ruta
    await connection.query(`
      INSERT INTO \`HOJAS_DE_RUTA_CABECERA\` (
        \`Transaccionid\`, \`Hoja_de_ruta\`, \`Fecha\`, \`Viaje\`, \`Chofer\`,
        \`codigo_chofer\`, \`EMail\`, \`Transporte\`, \`Patente_camion\`, \`Patente_acoplado\`, \`id_etapa\`
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        \`Fecha\` = VALUES(\`Fecha\`),
        \`Viaje\` = VALUES(\`Viaje\`),
        \`Chofer\` = VALUES(\`Chofer\`),
        \`codigo_chofer\` = VALUES(\`codigo_chofer\`),
        \`EMail\` = VALUES(\`EMail\`),
        \`Transporte\` = VALUES(\`Transporte\`),
        \`Patente_camion\` = VALUES(\`Patente_camion\`),
        \`Patente_acoplado\` = VALUES(\`Patente_acoplado\`)
    `, [
      transaccionId,
      hrRow.nro_hoja_ruta,
      hrRow.fecha || new Date().toISOString().slice(0, 10),
      viajeLabel,
      preset.chofer,
      preset.codigo,
      preset.email,
      preset.transporte,
      preset.camion,
      preset.acoplado,
      1
    ]);

    // Verificar si ya existen ítems para esta hoja de ruta
    const [[{ count: existingItems }]] = await connection.query(
      'SELECT COUNT(*) AS count FROM `HOJA_RUTA_ITEM_REMITO` WHERE `Transaccionid` = ?',
      [transaccionId]
    );

    if (existingItems === 0 && catalogProducts.length > 0) {
      const [hrRemitos] = await connection.query(`
        SELECT id, finne_Comprobante, finne_CodigoCliente, finne_Cliente, finne_domicilio
        FROM remitos
        WHERE nro_hoja_ruta = ?
        ORDER BY id ASC
        LIMIT 8
      `, [hrRow.nro_hoja_ruta]);

      for (let rIdx = 0; rIdx < hrRemitos.length; rIdx++) {
        const rem = hrRemitos[rIdx];
        // Agrupar de a 2-3 remitos en el mismo Lugar_de_Entrega para reflejar los cortes de control de la especificación
        const lugarEntrega = zonasEntrega[Math.floor(rIdx / 3) % zonasEntrega.length];
        const clienteId = rem.finne_CodigoCliente || (20000 + rIdx);
        const clienteNombre = (rem.finne_Cliente || `Cliente ${clienteId}`).trim();

        // Guardar cliente en catálogo
        await connection.query(`
          INSERT INTO \`CATALOGO_CLIENTES\` (\`id_cliente\`, \`nombre\`, \`domicilio\`)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE \`nombre\` = VALUES(\`nombre\`)
        `, [clienteId, clienteNombre, rem.finne_domicilio || lugarEntrega]);

        // Crear 2 productos por remito
        const prodsForRem = [
          catalogProducts[rIdx % catalogProducts.length],
          catalogProducts[(rIdx + 2) % catalogProducts.length]
        ];

        for (let pIdx = 0; pIdx < prodsForRem.length; pIdx++) {
          const prod = prodsForRem[pIdx];
          const cantRemitida = ((rIdx + pIdx + 1) * 5) % 25 + 4;
          await connection.query(`
            INSERT INTO \`HOJA_RUTA_ITEM_REMITO\` (
              \`Transaccionid\`, \`remito_id\`, \`Lugar_de_Entrega\`, \`Remito\`,
              \`id_cliente\`, \`Cliente\`, \`id_producto\`, \`Producto\`, \`cantidad_remitida\`
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            transaccionId,
            rem.id,
            lugarEntrega,
            rem.finne_Comprobante || `R-0005-${rem.id}`,
            clienteId,
            clienteNombre,
            prod.id_producto,
            prod.nombre,
            cantRemitida
          ]);
        }
      }
      console.log(` -> Generados ítems de entrega para ${hrRow.nro_hoja_ruta} (Tx ${transaccionId})`);
    }
  }

  // Asegurar algunos clientes adicionales en CATALOGO_CLIENTES desde remitos recientes
  await connection.query(`
    INSERT IGNORE INTO \`CATALOGO_CLIENTES\` (\`id_cliente\`, \`nombre\`, \`domicilio\`)
    SELECT DISTINCT finne_CodigoCliente, TRIM(finne_Cliente), finne_domicilio
    FROM remitos
    WHERE finne_CodigoCliente IS NOT NULL AND finne_Cliente IS NOT NULL AND finne_Cliente != ''
    ORDER BY id DESC
    LIMIT 40
  `);

  // 10. Poblar un ejemplo inicial en Devoluciones y Cajones si están vacíos
  const [[{ count: devCount }]] = await connection.query('SELECT COUNT(*) AS count FROM `REMITO_DEVOLUCIONES`');
  if (devCount === 0 && recentHRs.length > 0) {
    const firstTx = parseInt(recentHRs[0].nro_hoja_ruta.replace(/[^0-9]/g, ''), 10);
    const [sampleItems] = await connection.query(
      'SELECT Lugar_de_Entrega, id_cliente, Cliente, id_producto, Producto FROM `HOJA_RUTA_ITEM_REMITO` WHERE `Transaccionid` = ? LIMIT 1',
      [firstTx]
    );
    if (sampleItems.length > 0) {
      const s = sampleItems[0];
      const [insCab] = await connection.query(`
        INSERT INTO \`REMITO_DEVOLUCIONES\` (\`Transaccionid\`, \`id_etapa\`, \`fecha\`, \`id_cliente\`, \`Cliente\`, \`Lugar_de_Entrega\`, \`usuario_email\`)
        VALUES (?, 1, ?, ?, ?, ?, 'chofer.perez@donyeyo.com.ar')
      `, [firstTx, recentHRs[0].fecha || new Date().toISOString().slice(0, 10), s.id_cliente, s.Cliente, s.Lugar_de_Entrega]);

      await connection.query(`
        INSERT INTO \`REMITO_DEVOLUCIONES_ITEMS\` (\`id_remito_devoluciones\`, \`id_producto\`, \`Producto\`, \`cantidad_check_chofer\`, \`vencimiento_check_chofer\`, \`motivo\`, \`tipo\`)
        VALUES (?, ?, ?, 2, DATE_ADD(CURDATE(), INTERVAL 15 DAY), 'Envase Dañado o Roto', 'Físico')
      `, [insCab.insertId, s.id_producto, s.Producto]);
      console.log(` -> Ejemplo inicial de devolución creado para Tx ${firstTx}`);
    }
  }

  console.log('\n======================================================');
  console.log('🎉 Migración y vistas completadas con éxito.');
  console.log('======================================================');

  await connection.end();
}

runMigration().catch(err => {
  console.error('Error durante la migración:', err);
  process.exit(1);
});
