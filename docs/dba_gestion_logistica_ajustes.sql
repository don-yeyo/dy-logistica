-- ==============================================================================
-- SCRIPT PARA EL DBA — AJUSTES EN BASE DE DATOS REAL ERP: Gestion_Logistica
-- ==============================================================================
-- Objetivo: Corregir incompatibilidades de tipos/claves detectadas al enlazar la
-- App Móvil para Choferes con las tablas y vistas reales del ERP.
-- Nota: Este script NO fue ejecutado por la aplicación; debe revisarlo y correrlo el DBA.
-- ==============================================================================

USE `Gestion_Logistica`;

-- ------------------------------------------------------------------------------
-- 1. CRÍTICO: Alinear tipo de columna id_etapa / Id_etapa con HOJA_RUTA_ETAPA.Id_etapa
--    En HOJA_RUTA_ETAPA, Id_etapa es VARCHAR(45) con formato "<Transaccionid>-<Organizacionid>"
--    (ej. "2143599-3913"), pero en las tablas operativas está definido como INT.
-- ------------------------------------------------------------------------------
ALTER TABLE `REMITO_DEVOLUCIONES`
  MODIFY COLUMN `id_etapa` VARCHAR(45) NULL;

ALTER TABLE `REMITO_CAJONES`
  MODIFY COLUMN `id_etapa` VARCHAR(45) NULL;

ALTER TABLE `REMITOS_FIRMADOS`
  MODIFY COLUMN `Id_etapa` VARCHAR(45) NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. CRÍTICO: Habilitar AUTO_INCREMENT en REMITO_DEVOLUCIONES y REMITO_DEVOLUCIONES_ITEMS
--    Actualmente ninguna de las dos tablas tiene AUTO_INCREMENT en su PK.
-- ------------------------------------------------------------------------------
ALTER TABLE `REMITO_DEVOLUCIONES`
  MODIFY COLUMN `id_remito_devoluciones` INT NOT NULL AUTO_INCREMENT;

ALTER TABLE `REMITO_DEVOLUCIONES_ITEMS`
  MODIFY COLUMN `id_remito_devoluciones_item` INT NOT NULL AUTO_INCREMENT;

-- ------------------------------------------------------------------------------
-- 3. RECOMENDADO: Ampliar URL de imagen y agregar metadatos de firma/auditoría
--    Las URLs de SharePoint suelen superar los 150 caracteres.
--    Nota: El soporte multi-ejemplar y múltiples firmantes por ejemplar ya quedó
--    resuelto mediante la tabla propia de aplicación APP_REMITO_EJEMPLARES
--    (ver docs/dba_gestion_logistica_auditoria_triggers.sql) sin alterar el ERP.
-- ------------------------------------------------------------------------------
ALTER TABLE `REMITOS_FIRMADOS`
  MODIFY COLUMN `Url_imagen` VARCHAR(500) NULL,
  ADD COLUMN `ejemplar` ENUM('ORIGINAL','DUPLICADO','TRIPLICADO','CUATRIPLICADO','RECEPCION_VALORIZADA','OTRO') NULL AFTER `Nro_remito`,
  ADD COLUMN `observaciones` TEXT NULL AFTER `ejemplar`,
  ADD COLUMN `firma_digital_base64` LONGTEXT NULL AFTER `observaciones`,
  ADD COLUMN `firma_receptor_aclaracion` VARCHAR(150) NULL AFTER `firma_digital_base64`,
  ADD COLUMN `firma_receptor_dni` VARCHAR(40) NULL AFTER `firma_receptor_aclaracion`;

ALTER TABLE `REMITO`
  MODIFY COLUMN `firma_cliente_url` VARCHAR(500) NULL,
  MODIFY COLUMN `firma_distribuidor_url` VARCHAR(500) NULL;

ALTER TABLE `REMITO_CAJONES`
  ADD COLUMN `observaciones` VARCHAR(500) NULL AFTER `tipo`;

ALTER TABLE `HOJA_RUTA_ITEM_REMITO`
  ADD COLUMN `updated_by_email` VARCHAR(150) NULL AFTER `codigo_motivo_dif`,
  ADD COLUMN `fecha_descarga` DATETIME NULL AFTER `updated_by_email`;

-- ------------------------------------------------------------------------------
-- 4. CRÍTICO PARA AUTENTICACIÓN ENTRA ID: Poblar EMail en ORGANIZACION
--    Actualmente los 1453 registros de ORGANIZACION tienen EMail = NULL,
--    por lo que HOJAS_DE_RUTA_A_ENTREGAR devuelve EMail = NULL en todas las filas.
--    Ejemplo de carga para transportistas / choferes:
-- ------------------------------------------------------------------------------
-- UPDATE `ORGANIZACION` SET `EMail` = 'chofer@donyeyo.com.ar' WHERE `Organizacionid` = 406;

-- ------------------------------------------------------------------------------
-- 5. MEJORAS EN VISTAS (Para exponer Transporte, Viaje, id_cliente, id_producto, Motivo e id_remito_cajones)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW `HOJAS_DE_RUTA_A_ENTREGAR` AS
SELECT
  `HR`.`Numerocomprobante` AS `Hoja_de_ruta`,
  `HR`.`Fecha` AS `Fecha`,
  `HR`.`Usr_viaje` AS `Viaje`,
  `ch`.`Nombre` AS `Chofer`,
  `tr`.`Nombre` AS `Transporte`,
  `HR`.`Patente_camion` AS `Patente_camion`,
  `HR`.`Patente_acoplado` AS `Patente_acoplado`,
  `HR`.`Transaccionid` AS `Transaccionid`,
  COALESCE(`ch`.`EMail`, `tr`.`EMail`) AS `EMail`
FROM `HOJA_DE_RUTA` `HR`
LEFT JOIN `ORGANIZACION` `tr` ON `HR`.`Organizacionid_transportista` = `tr`.`Organizacionid`
LEFT JOIN `ORGANIZACION` `ch` ON `HR`.`Organizacionid_chofer` = `ch`.`Organizacionid`
WHERE `HR`.`Usr_estadohojaruta` = 1;

CREATE OR REPLACE VIEW `HOJA_DE_RUTA_DEVOLUCIONES` AS
SELECT
  `HR`.`Hoja_de_ruta` AS `Hoja_de_ruta`,
  `HR`.`Fecha` AS `Fecha`,
  `HR`.`Chofer` AS `Chofer`,
  `ETAPA`.`Id_etapa` AS `id_etapa`,
  `ETAPA`.`Direccionentrega` AS `Direccionentrega`,
  COALESCE(`DE`.`id_cliente`, `ETAPA`.`Organizacionidoperador`) AS `id_cliente`,
  COALESCE(`CL`.`Nombre`, `CL_OP`.`Nombre`) AS `Operador`,
  `HR`.`Transaccionid` AS `Transaccionid`,
  `DE`.`id_remito_devoluciones` AS `id_remito_devoluciones`,
  `DI`.`id_producto` AS `id_producto`,
  `PRD`.`Nombre` AS `Nombre`,
  `DI`.`cantidad_check_chofer` AS `cantidad_check_chofer`,
  `DI`.`vencimiento_check_chofer` AS `vencimiento_check_chofer`,
  `DI`.`codigo_motivo_dif` AS `codigo_motivo_dif`,
  `MD`.`Descripcion` AS `Motivo`,
  `DI`.`tipo` AS `tipo`,
  `DI`.`id_remito_devoluciones_item` AS `id_remito_devoluciones_item`
FROM `HOJAS_DE_RUTA_A_ENTREGAR` `HR`
LEFT JOIN `HOJA_RUTA_ETAPA` `ETAPA` ON `HR`.`Transaccionid` = `ETAPA`.`Transaccionid_hoja_de_ruta`
LEFT JOIN `ORGANIZACION` `CL_OP` ON `CL_OP`.`Organizacionid` = `ETAPA`.`Organizacionidoperador`
LEFT JOIN `REMITO_DEVOLUCIONES` `DE` ON `DE`.`id_etapa` = `ETAPA`.`Id_etapa`
LEFT JOIN `ORGANIZACION` `CL` ON `CL`.`Organizacionid` = `DE`.`id_cliente`
LEFT JOIN `REMITO_DEVOLUCIONES_ITEMS` `DI` ON `DE`.`id_remito_devoluciones` = `DI`.`id_remito_devoluciones`
LEFT JOIN `PRODUCTO` `PRD` ON `PRD`.`Productoid` = `DI`.`id_producto`
LEFT JOIN `MOTIVO_DIFERENCIA` `MD` ON CAST(TRIM(`MD`.`Codigo`) AS UNSIGNED) = `DI`.`codigo_motivo_dif`;

CREATE OR REPLACE VIEW `REMITOS_CAJONES_X_ETAPA` AS
SELECT
  `HR`.`Hoja_de_ruta` AS `Hoja_de_ruta`,
  `HR`.`Fecha` AS `Fecha`,
  `HR`.`Chofer` AS `Chofer`,
  `ETAPA`.`Direccionentrega` AS `Direccionentrega`,
  `CL`.`Nombre` AS `Cliente`,
  `ETAPA`.`Organizacionidoperador` AS `Id_cliente`,
  `HR`.`Transaccionid` AS `Transaccionid`,
  `ETAPA`.`Id_etapa` AS `Id_etapa`,
  `RC`.`id_remito_cajones` AS `id_remito_cajones`,
  `RC`.`tipo` AS `tipo`,
  `RCI`.`id_remito_cajones_item` AS `id_remito_cajones_item`,
  `RCI`.`cantidad_check_chofer` AS `cantidad_check_chofer`
FROM `HOJAS_DE_RUTA_A_ENTREGAR` `HR`
LEFT JOIN `HOJA_RUTA_ETAPA` `ETAPA` ON `HR`.`Transaccionid` = `ETAPA`.`Transaccionid_hoja_de_ruta`
LEFT JOIN `ORGANIZACION` `CL` ON `CL`.`Organizacionid` = `ETAPA`.`Organizacionidoperador`
LEFT JOIN `REMITO_CAJONES` `RC` ON `RC`.`id_etapa` = `ETAPA`.`Id_etapa`
LEFT JOIN `REMITO_CAJONES_ITEMS` `RCI` ON `RCI`.`id_remito_cajones` = `RC`.`id_remito_cajones`;

-- ------------------------------------------------------------------------------
-- 6. COLUMNAS COMERCIALES EN ORGANIZACION (EJEMPLARES DE REMITO Y DEVOLUCIÓN LIBRE)
--    Ya aplicadas en Gestion_Logistica por setup_glog_app.js; DDL de referencia y
--    ejemplos de carga para el DBA.
-- ------------------------------------------------------------------------------
-- ALTER TABLE `ORGANIZACION`
--   ADD COLUMN `cant_ejemplares_remito` TINYINT UNSIGNED NULL DEFAULT NULL
--     COMMENT 'Cantidad de copias/ejemplares de remito esperados por cliente (NULL usa default del sistema)' AFTER `EMail`,
--   ADD COLUMN `permite_devolucion_libre` TINYINT(1) NOT NULL DEFAULT 0
--     COMMENT '1 si el cliente soporta devolucion libre (foto + total sin discriminar items), 0 normal' AFTER `cant_ejemplares_remito`;
--
-- Ejemplos de población por cliente:
-- UPDATE `ORGANIZACION` SET `cant_ejemplares_remito` = 3, `permite_devolucion_libre` = 1 WHERE `Organizacionid` = 1234;
-- UPDATE `ORGANIZACION` SET `cant_ejemplares_remito` = 2 WHERE `permite_devolucion_libre` = 0;
