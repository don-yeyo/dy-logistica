-- ==============================================================================
-- BASE DE DATOS: Firma_de_remitos / dy_logistica_app
-- Don Yeyo S.A. - Control de Firmas de Remitos para Choferes (PWA Móvil)
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
-- 2. Tabla de Remitos (Extendida con Hoja de Ruta, Transportistas y Control PWA)
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
-- 3. Datos Semilla de Prueba (Usuarios Choferes y Remitos con Hojas de Ruta)
-- ------------------------------------------------------------------------------

INSERT INTO `usuarios` (`email`, `nombre`, `codigo_chofer`, `rol`, `activo`) VALUES
('chofer.perez@donyeyo.com.ar', 'Juan Carlos Pérez', '32355', 'chofer', 1),
('chofer.gomez@donyeyo.com.ar', 'Carlos Alberto Gómez', '32356', 'chofer', 1),
('chofer.rodriguez@donyeyo.com.ar', 'Marcos Rodríguez', '32357', 'chofer', 1),
('gabrielt@donyeyo.com.ar', 'Gabriel T. (Admin / Logística)', '32355', 'admin', 1);

-- Remitos de las últimas 4 Hojas de Ruta para Chofer 32355 (HR-8942 actual, HR-8941, HR-8940, HR-8939)
INSERT INTO `remitos` (
  `finne_transaccionID`, `finne_Copias`, `finne_Fecha`, `finne_CodigoCliente`, 
  `finne_Cliente`, `finne_domicilio`, `finne_importe_total`, `finne_Comprobante`, 
  `nro_hoja_ruta`, `transportistas`, `estado_firma`, `tipo_documento`
) VALUES
-- Hoja de Ruta Actual: HR-8942
(1048751, 2, CURDATE(), 1042, 'COTO C.I.C.S.A. - Sucursal 108 Caballito', 'Av. Rivadavia 5600, CABA', 458920.00, 'R-0050-00487512', 'HR-8942', '[{"chofer":"32355", "nombre":"Juan Carlos Pérez"}]', 'PENDIENTE', 'REMITO'),
(1048752, 2, CURDATE(), 1088, 'CARREFOUR ARGENTINA - Hipermercado Vicente López', 'Av. del Libertador 215, Vicente López', 892100.50, 'R-0050-00487513', 'HR-8942', '[{"chofer":"32355", "nombre":"Juan Carlos Pérez"}]', 'PENDIENTE', 'REMITO'),
(1048753, 2, CURDATE(), 1120, 'DISTRIBUIDORA NORTE LOGÍSTICA S.A.', 'Ruta 8 Km 54, Parque Ind. Pilar', 1450000.00, 'R-0050-00487514', 'HR-8942', '[{"chofer":"32355", "nombre":"Juan Carlos Pérez"}]', 'PENDIENTE', 'REMITO'),
(1048754, 2, CURDATE(), 1015, 'DIA ARGENTINA S.A. - Tienda 45 Villa Urquiza', 'Av. Triunvirato 4200, CABA', 215400.00, 'R-0050-00487515', 'HR-8942', '[{"chofer":"32355", "nombre":"Juan Carlos Pérez"}]', 'PENDIENTE', 'REMITO'),

-- Hoja de Ruta Anterior 1: HR-8941
(1048601, 2, DATE_SUB(CURDATE(), INTERVAL 1 DAY), 1055, 'JUMBO RETAIL - Portal Palermo', 'Av. Int. Bullrich 345, CABA', 789400.00, 'R-0050-00487380', 'HR-8941', '[{"chofer":"32355", "nombre":"Juan Carlos Pérez"}]', 'FIRMADO_CLIENTE', 'REMITO'),
(1048602, 2, DATE_SUB(CURDATE(), INTERVAL 1 DAY), 1042, 'COTO C.I.C.S.A. - Sucursal 160 Belgrano', 'Monroe 3200, CABA', 620300.00, 'R-0050-00487381', 'HR-8941', '[{"chofer":"32355", "nombre":"Juan Carlos Pérez"}]', 'PENDIENTE', 'REMITO'),
(1048603, 2, DATE_SUB(CURDATE(), INTERVAL 1 DAY), 1340, 'LOGÍSTICA LA SERENÍSIMA DEPÓSITO SUR', 'Av. Hipólito Yrigoyen 8900, Lomas de Zamora', 1980000.00, 'R-0050-00487382', 'HR-8941', '[{"chofer":"32355", "nombre":"Juan Carlos Pérez"}]', 'FIRMADO_INTERMEDIARIO', 'REMITO'),

-- Hoja de Ruta Anterior 2: HR-8940
(1048450, 2, DATE_SUB(CURDATE(), INTERVAL 2 DAY), 1099, 'LA ANÓNIMA S.A. - Centro Distribución', 'Colectora Oeste 1200, Escobar', 1120000.00, 'R-0050-00487120', 'HR-8940', '[{"chofer":"32355", "nombre":"Juan Carlos Pérez"}]', 'PENDIENTE', 'REMITO'),
(1048451, 2, DATE_SUB(CURDATE(), INTERVAL 2 DAY), 1015, 'DIA ARGENTINA S.A. - Tienda 120 San Isidro', 'Av. Centenario 450, San Isidro', 312000.00, 'R-0050-00487121', 'HR-8940', '[{"chofer":"32355", "nombre":"Juan Carlos Pérez"}]', 'FIRMADO_CLIENTE', 'RECEPCION_VALORIZADA'),

-- Hoja de Ruta Anterior 3: HR-8939
(1048301, 2, DATE_SUB(CURDATE(), INTERVAL 3 DAY), 1042, 'COTO C.I.C.S.A. - Sucursal 60 Flores', 'Av. Directorio 2500, CABA', 540200.00, 'R-0050-00486950', 'HR-8939', '[{"chofer":"32355", "nombre":"Juan Carlos Pérez"}]', 'PENDIENTE', 'REMITO'),
(1048302, 2, DATE_SUB(CURDATE(), INTERVAL 3 DAY), 1205, 'EXPRESO BIO-LOGÍSTICA S.R.L.', 'Av. Mitre 4500, Avellaneda', 870500.00, 'R-0050-00486951', 'HR-8939', '[{"chofer":"32355", "nombre":"Juan Carlos Pérez"}]', 'NO_FIRMADO', 'REMITO');
