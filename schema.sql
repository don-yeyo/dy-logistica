-- ==============================================================================
-- BASE DE DATOS: Firma_de_remitos / dy_logistica_app
-- Don Yeyo S.A. - App Móvil para Choferes (Entregas, Devoluciones, Cajones y Remitos)
-- Nota: MySQL RDS con lower_case_table_names=0 -> respetar mayúsculas exactas.
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS `Firma_de_remitos` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE `Firma_de_remitos`;

-- ------------------------------------------------------------------------------
-- 1. Tabla de Usuarios y Choferes
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `usuarios`;
CREATE TABLE `usuarios` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `nombre` VARCHAR(120) NOT NULL,
  `codigo_chofer` VARCHAR(50) DEFAULT NULL,
  `rol` ENUM('admin', 'chofer', 'supervisor') NOT NULL DEFAULT 'chofer',
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_email` (`email`),
  INDEX `idx_codigo_chofer` (`codigo_chofer`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------------------------
-- 2. Tabla de Remitos (Control de Firmas y Compatibilidad Histórica)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `remitos`;
CREATE TABLE `remitos` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `finne_transaccionID` INT DEFAULT NULL,
  `finne_Copias` TINYINT DEFAULT 2,
  `finne_Fecha` DATE DEFAULT NULL,
  `finne_CodigoCliente` INT DEFAULT NULL,
  `finne_Cliente` VARCHAR(120) DEFAULT NULL,
  `finne_domicilio` VARCHAR(255) DEFAULT NULL,
  `finne_importe_total` DECIMAL(19,4) DEFAULT 0.0000,
  `finne_Comprobante` VARCHAR(40) DEFAULT NULL,
  `finne_Reclamado` TINYINT(1) DEFAULT 0,
  `finne_FechaUltimoReclamo` DATE DEFAULT NULL,
  `finne_DocNroInterno` VARCHAR(100) DEFAULT NULL,
  `finne_Descripcion` VARCHAR(255) DEFAULT NULL,
  `finne_cbte_relacionado` VARCHAR(50) DEFAULT NULL,

  -- Atributos de Logística y Hojas de Ruta
  `nro_hoja_ruta` VARCHAR(50) DEFAULT NULL,
  `transportistas` JSON DEFAULT NULL COMMENT 'Ejemplo: [{"chofer":"32355", "nombre":"Juan Pérez"}]',

  -- Control de Firma registrado por Chofer en PWA
  `ejemplar` ENUM('ORIGINAL', 'DUPLICADO', 'TRIPLICADO', 'CUATRIPLICADO', 'RECEPCION_VALORIZADA', 'OTRO') NOT NULL DEFAULT 'ORIGINAL',
  `estado_firma` ENUM('PENDIENTE', 'FIRMADO_CLIENTE', 'FIRMADO_INTERMEDIARIO', 'NO_FIRMADO') NOT NULL DEFAULT 'PENDIENTE',
  `tipo_documento` ENUM('REMITO', 'RECEPCION_VALORIZADA', 'OTRO') DEFAULT 'REMITO',
  `observaciones` TEXT DEFAULT NULL,
  `foto_url` VARCHAR(500) DEFAULT NULL,
  `foto_sharepoint_url` VARCHAR(500) DEFAULT NULL,
  `foto_nombre_archivo` VARCHAR(255) DEFAULT NULL,
  `firma_digital_base64` LONGTEXT DEFAULT NULL,
  `firma_receptor_aclaracion` VARCHAR(150) DEFAULT NULL,
  `firma_receptor_dni` VARCHAR(40) DEFAULT NULL,
  `fecha_control` DATETIME DEFAULT NULL,
  `controlado_por_chofer_id` INT DEFAULT NULL,
  `controlado_por_chofer_email` VARCHAR(150) DEFAULT NULL,
  `sincronizado_offline` TINYINT(1) DEFAULT 0,

  -- Compatibilidad con proyecto anterior
  `ocr_original` JSON DEFAULT NULL,
  `ocr_duplicado` JSON DEFAULT NULL,
  `ocr_triplicado` JSON DEFAULT NULL,
  `ocr_cuatriplcado` JSON DEFAULT NULL,
  `bot_confirmado_cliente` TINYINT(1) DEFAULT 0,
  `bot_confirmado_distribuidor` TINYINT(1) DEFAULT 0,

  PRIMARY KEY (`id`),
  INDEX `idx_finne_transaccion` (`finne_transaccionID`),
  INDEX `idx_comprobante` (`finne_Comprobante`),
  INDEX `idx_hoja_ruta` (`nro_hoja_ruta`),
  INDEX `idx_estado_firma` (`estado_firma`),
  INDEX `idx_fecha` (`finne_Fecha`),
  FOREIGN KEY (`controlado_por_chofer_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------------------------
-- 3. Catálogos Auxiliares (Productos, Clientes y Motivos de Devolución)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `CATALOGO_PRODUCTOS` (
  `id_producto` INT NOT NULL AUTO_INCREMENT,
  `codigo` VARCHAR(40) DEFAULT NULL,
  `nombre` VARCHAR(200) NOT NULL,
  `unidad` VARCHAR(30) DEFAULT 'UN',
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id_producto`),
  UNIQUE KEY `uniq_prod_codigo` (`codigo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `CATALOGO_CLIENTES` (
  `id_cliente` INT NOT NULL,
  `nombre` VARCHAR(180) NOT NULL,
  `domicilio` VARCHAR(255) DEFAULT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id_cliente`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `CATALOGO_MOTIVOS_DEVOLUCION` (
  `id_motivo` INT NOT NULL AUTO_INCREMENT,
  `descripcion` VARCHAR(180) NOT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id_motivo`),
  UNIQUE KEY `uniq_motivo_desc` (`descripcion`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------------------------
-- 4. Hojas de Ruta, Entregas (Items a Entregar), Devoluciones y Cajones
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `HOJAS_DE_RUTA_CABECERA` (
  `Transaccionid` INT NOT NULL,
  `Hoja_de_ruta` VARCHAR(50) NOT NULL,
  `Fecha` DATE NOT NULL,
  `Viaje` VARCHAR(100) DEFAULT NULL,
  `Chofer` VARCHAR(120) NOT NULL,
  `codigo_chofer` VARCHAR(50) DEFAULT '32355',
  `EMail` VARCHAR(150) NOT NULL,
  `Transporte` VARCHAR(150) NOT NULL DEFAULT 'Logística Propia Don Yeyo S.A.',
  `Patente_camion` VARCHAR(30) NOT NULL DEFAULT 'AE 452 KL',
  `Patente_acoplado` VARCHAR(30) NOT NULL DEFAULT 'AF 891 MN',
  `id_etapa` INT NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`Transaccionid`),
  UNIQUE KEY `uniq_hoja_ruta` (`Hoja_de_ruta`),
  INDEX `idx_hr_email` (`EMail`),
  INDEX `idx_hr_chofer` (`codigo_chofer`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `HOJA_RUTA_ITEM_REMITO` (
  `Hojarutaitemid` INT NOT NULL AUTO_INCREMENT,
  `Transaccionid` INT NOT NULL,
  `remito_id` BIGINT DEFAULT NULL,
  `Lugar_de_Entrega` VARCHAR(200) NOT NULL,
  `Remito` VARCHAR(60) NOT NULL,
  `id_cliente` INT DEFAULT NULL,
  `Cliente` VARCHAR(180) DEFAULT NULL,
  `id_producto` INT NOT NULL DEFAULT 1,
  `Producto` VARCHAR(200) NOT NULL,
  `cantidad_remitida` INT NOT NULL DEFAULT 1,
  `cantidad_descargada_Chofer` INT DEFAULT NULL,
  `updated_by_email` VARCHAR(150) DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`Hojarutaitemid`),
  INDEX `idx_item_transaccion` (`Transaccionid`),
  INDEX `idx_item_remito` (`Remito`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `REMITO_DEVOLUCIONES` (
  `id_remito_devoluciones` INT NOT NULL AUTO_INCREMENT,
  `Transaccionid` INT NOT NULL,
  `id_etapa` INT NOT NULL DEFAULT 1,
  `fecha` DATE NOT NULL,
  `id_cliente` INT NOT NULL,
  `Cliente` VARCHAR(180) DEFAULT NULL,
  `Lugar_de_Entrega` VARCHAR(200) NOT NULL,
  `usuario_email` VARCHAR(150) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_remito_devoluciones`),
  INDEX `idx_dev_transaccion` (`Transaccionid`),
  INDEX `idx_dev_cliente` (`id_cliente`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `REMITO_DEVOLUCIONES_ITEMS` (
  `id_remito_devoluciones_item` INT NOT NULL AUTO_INCREMENT,
  `id_remito_devoluciones` INT NOT NULL,
  `id_producto` INT NOT NULL,
  `Producto` VARCHAR(200) DEFAULT NULL,
  `cantidad_check_chofer` INT NOT NULL DEFAULT 1,
  `vencimiento_check_chofer` DATE DEFAULT NULL,
  `motivo` VARCHAR(200) NOT NULL DEFAULT 'Diferencia de Pedido',
  `tipo` ENUM('Físico', 'Virtual') NOT NULL DEFAULT 'Físico',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_remito_devoluciones_item`),
  INDEX `idx_dev_item_cab` (`id_remito_devoluciones`),
  FOREIGN KEY (`id_remito_devoluciones`) REFERENCES `REMITO_DEVOLUCIONES`(`id_remito_devoluciones`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `HOJA_RUTA_CAJONES` (
  `id_cajon_movimiento` INT NOT NULL AUTO_INCREMENT,
  `Transaccionid` INT NOT NULL,
  `Lugar_de_Entrega` VARCHAR(200) NOT NULL,
  `id_cliente` INT DEFAULT NULL,
  `Cliente` VARCHAR(180) DEFAULT NULL,
  `cajones_entregados` INT NOT NULL DEFAULT 0,
  `cajones_devueltos` INT NOT NULL DEFAULT 0,
  `diferencia` INT NOT NULL DEFAULT 0,
  `observaciones` VARCHAR(500) DEFAULT NULL,
  `usuario_email` VARCHAR(150) DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_cajon_movimiento`),
  UNIQUE KEY `uniq_cajon_parada` (`Transaccionid`, `Lugar_de_Entrega`, `Cliente`),
  INDEX `idx_cajones_tx` (`Transaccionid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------------------------
-- 5. Vistas Requeridas por la Especificación Funcional
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW `HOJAS_DE_RUTA_A_ENTREGAR` AS
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
FROM `HOJAS_DE_RUTA_CABECERA` h
INNER JOIN `usuarios` u
  ON (u.codigo_chofer = h.codigo_chofer OR LOWER(u.email) = LOWER(h.EMail))
WHERE u.activo = 1;

CREATE OR REPLACE VIEW `ITEMS_A_ENTREGAR` AS
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
FROM `HOJA_RUTA_ITEM_REMITO` i;

CREATE OR REPLACE VIEW `HOJA_DE_RUTA_DEVOLUCIONES` AS
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
  FROM `HOJA_RUTA_ITEM_REMITO`
  UNION
  SELECT DISTINCT Transaccionid, Lugar_de_Entrega, id_cliente, Cliente
  FROM `REMITO_DEVOLUCIONES`
) base
INNER JOIN `HOJAS_DE_RUTA_CABECERA` h ON h.Transaccionid = base.Transaccionid
LEFT JOIN `REMITO_DEVOLUCIONES` rd
  ON rd.Transaccionid = base.Transaccionid
  AND rd.Lugar_de_Entrega = base.Lugar_de_Entrega
  AND rd.id_cliente <=> base.id_cliente
LEFT JOIN `REMITO_DEVOLUCIONES_ITEMS` rdi
  ON rdi.id_remito_devoluciones = rd.id_remito_devoluciones
LEFT JOIN `CATALOGO_PRODUCTOS` cp
  ON cp.id_producto = rdi.id_producto;

-- ------------------------------------------------------------------------------
-- 6. Datos Semilla de Prueba
-- ------------------------------------------------------------------------------
INSERT INTO `usuarios` (`email`, `nombre`, `codigo_chofer`, `rol`, `activo`) VALUES
('chofer.perez@donyeyo.com.ar', 'Juan Carlos Pérez', '32355', 'chofer', 1),
('chofer.gomez@donyeyo.com.ar', 'Carlos Alberto Gómez', '32356', 'chofer', 1),
('chofer.rodriguez@donyeyo.com.ar', 'Marcos Rodríguez', '32357', 'chofer', 1),
('gabrielt@donyeyo.com.ar', 'Gabriel T. (Admin / Logística)', '32355', 'admin', 1);

INSERT INTO `CATALOGO_PRODUCTOS` (`codigo`, `nombre`, `unidad`) VALUES
('DY-QCR-01', 'Queso Cremoso Horma x 4 kg', 'UN'),
('DY-MOZ-02', 'Mozzarella Cilindro x 3 kg', 'UN'),
('DY-TYB-03', 'Queso Tybo en Barra x 4 kg', 'UN'),
('DY-DDL-04', 'Dulce de Leche Repostero x 10 kg', 'BALDE'),
('DY-RIC-05', 'Ricotta Entera x 1 kg', 'UN'),
('DY-MAN-06', 'Manteca Pan x 200 g (Caja x 24)', 'CAJA');

INSERT INTO `CATALOGO_MOTIVOS_DEVOLUCION` (`descripcion`) VALUES
('Producto Vencido / Vencimiento Cercano'),
('Envase Dañado o Roto'),
('Diferencia de Pedido / Error Facturación'),
('Rechazo Parcial en Recepción'),
('Cadena de Frío / Temperatura'),
('Faltante / Sobrante de Reparto');
