-- ==============================================================================
-- AUDITORÍA COMPLETA MEDIANTE TRIGGERS EN BASE DE DATOS: Gestion_Logistica
-- ==============================================================================
-- Nota para AWS RDS:
-- Si el parámetro del cluster/instancia `log_bin_trust_function_creators` es 0,
-- MySQL requiere privilegio SUPER/BINLOG_ADMIN para crear triggers.
-- El DBA puede habilitar `log_bin_trust_function_creators = 1` en el Parameter Group
-- de RDS o ejecutar este script con el usuario maestro `adminMySql`.
-- ==============================================================================

USE `Gestion_Logistica`;

CREATE TABLE IF NOT EXISTS `AUDITORIA` (
  `id_auditoria` BIGINT NOT NULL AUTO_INCREMENT,
  `tabla_nombre` VARCHAR(80) NOT NULL,
  `operacion` ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
  `registro_pk` VARCHAR(120) DEFAULT NULL,
  `usuario_app` VARCHAR(150) DEFAULT NULL,
  `usuario_rol` VARCHAR(30) DEFAULT NULL,
  `usuario_db` VARCHAR(100) NOT NULL,
  `fecha_hora` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `datos_anteriores` JSON DEFAULT NULL,
  `datos_nuevos` JSON DEFAULT NULL,
  PRIMARY KEY (`id_auditoria`),
  INDEX `idx_aud_tabla` (`tabla_nombre`),
  INDEX `idx_aud_operacion` (`operacion`),
  INDEX `idx_aud_fecha` (`fecha_hora`),
  INDEX `idx_aud_usuario` (`usuario_app`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DELIMITER $$

-- ------------------------------------------------------------------------------
-- 1. APP_USUARIOS
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_aud_app_usuarios_ai`$$
CREATE TRIGGER `trg_aud_app_usuarios_ai` AFTER INSERT ON `APP_USUARIOS` FOR EACH ROW
BEGIN
  INSERT INTO `AUDITORIA` (`tabla_nombre`, `operacion`, `registro_pk`, `usuario_app`, `usuario_rol`, `usuario_db`, `datos_anteriores`, `datos_nuevos`)
  VALUES (
    'APP_USUARIOS', 'INSERT', CAST(NEW.id AS CHAR),
    COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
    NULL,
    JSON_OBJECT('id', NEW.id, 'email', NEW.email, 'nombre', NEW.nombre, 'rol', NEW.rol, 'organizacion_id', NEW.organizacion_id, 'codigo_chofer', NEW.codigo_chofer, 'activo', NEW.activo)
  );
END$$

DROP TRIGGER IF EXISTS `trg_aud_app_usuarios_au`$$
CREATE TRIGGER `trg_aud_app_usuarios_au` AFTER UPDATE ON `APP_USUARIOS` FOR EACH ROW
BEGIN
  INSERT INTO `AUDITORIA` (`tabla_nombre`, `operacion`, `registro_pk`, `usuario_app`, `usuario_rol`, `usuario_db`, `datos_anteriores`, `datos_nuevos`)
  VALUES (
    'APP_USUARIOS', 'UPDATE', CAST(NEW.id AS CHAR),
    COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
    JSON_OBJECT('id', OLD.id, 'email', OLD.email, 'nombre', OLD.nombre, 'rol', OLD.rol, 'organizacion_id', OLD.organizacion_id, 'codigo_chofer', OLD.codigo_chofer, 'activo', OLD.activo),
    JSON_OBJECT('id', NEW.id, 'email', NEW.email, 'nombre', NEW.nombre, 'rol', NEW.rol, 'organizacion_id', NEW.organizacion_id, 'codigo_chofer', NEW.codigo_chofer, 'activo', NEW.activo)
  );
END$$

DROP TRIGGER IF EXISTS `trg_aud_app_usuarios_ad`$$
CREATE TRIGGER `trg_aud_app_usuarios_ad` AFTER DELETE ON `APP_USUARIOS` FOR EACH ROW
BEGIN
  INSERT INTO `AUDITORIA` (`tabla_nombre`, `operacion`, `registro_pk`, `usuario_app`, `usuario_rol`, `usuario_db`, `datos_anteriores`, `datos_nuevos`)
  VALUES (
    'APP_USUARIOS', 'DELETE', CAST(OLD.id AS CHAR),
    COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
    JSON_OBJECT('id', OLD.id, 'email', OLD.email, 'nombre', OLD.nombre, 'rol', OLD.rol, 'organizacion_id', OLD.organizacion_id, 'codigo_chofer', OLD.codigo_chofer, 'activo', OLD.activo),
    NULL
  );
END$$

-- ------------------------------------------------------------------------------
-- 2. HOJA_RUTA_ITEM_REMITO (Confirmación de descarga)
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_aud_hr_item_remito_ai`$$
CREATE TRIGGER `trg_aud_hr_item_remito_ai` AFTER INSERT ON `HOJA_RUTA_ITEM_REMITO` FOR EACH ROW
BEGIN
  INSERT INTO `AUDITORIA` (`tabla_nombre`, `operacion`, `registro_pk`, `usuario_app`, `usuario_rol`, `usuario_db`, `datos_anteriores`, `datos_nuevos`)
  VALUES (
    'HOJA_RUTA_ITEM_REMITO', 'INSERT', CAST(NEW.Hojarutaitemid AS CHAR),
    COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
    NULL,
    JSON_OBJECT('Hojarutaitemid', NEW.Hojarutaitemid, 'Id_etapa', NEW.Id_etapa, 'Id_transaccion_remito', NEW.Id_transaccion_remito, 'Productoid', NEW.Productoid, 'Cantidad', NEW.Cantidad, 'cantidad_descargada_Chofer', NEW.cantidad_descargada_Chofer, 'codigo_motivo_dif', NEW.codigo_motivo_dif)
  );
END$$

DROP TRIGGER IF EXISTS `trg_aud_hr_item_remito_au`$$
CREATE TRIGGER `trg_aud_hr_item_remito_au` AFTER UPDATE ON `HOJA_RUTA_ITEM_REMITO` FOR EACH ROW
BEGIN
  INSERT INTO `AUDITORIA` (`tabla_nombre`, `operacion`, `registro_pk`, `usuario_app`, `usuario_rol`, `usuario_db`, `datos_anteriores`, `datos_nuevos`)
  VALUES (
    'HOJA_RUTA_ITEM_REMITO', 'UPDATE', CAST(NEW.Hojarutaitemid AS CHAR),
    COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
    JSON_OBJECT('Hojarutaitemid', OLD.Hojarutaitemid, 'Cantidad', OLD.Cantidad, 'cantidad_descargada_Chofer', OLD.cantidad_descargada_Chofer, 'cantidad_descargada_Distribuidor', OLD.cantidad_descargada_Distribuidor, 'codigo_motivo_dif', OLD.codigo_motivo_dif),
    JSON_OBJECT('Hojarutaitemid', NEW.Hojarutaitemid, 'Cantidad', NEW.Cantidad, 'cantidad_descargada_Chofer', NEW.cantidad_descargada_Chofer, 'cantidad_descargada_Distribuidor', NEW.cantidad_descargada_Distribuidor, 'codigo_motivo_dif', NEW.codigo_motivo_dif)
  );
END$$

DROP TRIGGER IF EXISTS `trg_aud_hr_item_remito_ad`$$
CREATE TRIGGER `trg_aud_hr_item_remito_ad` AFTER DELETE ON `HOJA_RUTA_ITEM_REMITO` FOR EACH ROW
BEGIN
  INSERT INTO `AUDITORIA` (`tabla_nombre`, `operacion`, `registro_pk`, `usuario_app`, `usuario_rol`, `usuario_db`, `datos_anteriores`, `datos_nuevos`)
  VALUES (
    'HOJA_RUTA_ITEM_REMITO', 'DELETE', CAST(OLD.Hojarutaitemid AS CHAR),
    COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
    JSON_OBJECT('Hojarutaitemid', OLD.Hojarutaitemid, 'Id_etapa', OLD.Id_etapa, 'Id_transaccion_remito', OLD.Id_transaccion_remito, 'Productoid', OLD.Productoid, 'Cantidad', OLD.Cantidad, 'cantidad_descargada_Chofer', OLD.cantidad_descargada_Chofer),
    NULL
  );
END$$

-- ------------------------------------------------------------------------------
-- 3. REMITO_DEVOLUCIONES
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_aud_remito_dev_ai`$$
CREATE TRIGGER `trg_aud_remito_dev_ai` AFTER INSERT ON `REMITO_DEVOLUCIONES` FOR EACH ROW
BEGIN
  INSERT INTO `AUDITORIA` (`tabla_nombre`, `operacion`, `registro_pk`, `usuario_app`, `usuario_rol`, `usuario_db`, `datos_anteriores`, `datos_nuevos`)
  VALUES (
    'REMITO_DEVOLUCIONES', 'INSERT', CAST(NEW.id_remito_devoluciones AS CHAR),
    COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
    NULL,
    JSON_OBJECT('id_remito_devoluciones', NEW.id_remito_devoluciones, 'id_etapa', NEW.id_etapa, 'fecha', NEW.fecha, 'id_cliente', NEW.id_cliente, 'numero', NEW.numero)
  );
END$$

DROP TRIGGER IF EXISTS `trg_aud_remito_dev_au`$$
CREATE TRIGGER `trg_aud_remito_dev_au` AFTER UPDATE ON `REMITO_DEVOLUCIONES` FOR EACH ROW
BEGIN
  INSERT INTO `AUDITORIA` (`tabla_nombre`, `operacion`, `registro_pk`, `usuario_app`, `usuario_rol`, `usuario_db`, `datos_anteriores`, `datos_nuevos`)
  VALUES (
    'REMITO_DEVOLUCIONES', 'UPDATE', CAST(NEW.id_remito_devoluciones AS CHAR),
    COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
    JSON_OBJECT('id_remito_devoluciones', OLD.id_remito_devoluciones, 'id_etapa', OLD.id_etapa, 'fecha', OLD.fecha, 'id_cliente', OLD.id_cliente, 'numero', OLD.numero),
    JSON_OBJECT('id_remito_devoluciones', NEW.id_remito_devoluciones, 'id_etapa', NEW.id_etapa, 'fecha', NEW.fecha, 'id_cliente', NEW.id_cliente, 'numero', NEW.numero)
  );
END$$

DROP TRIGGER IF EXISTS `trg_aud_remito_dev_ad`$$
CREATE TRIGGER `trg_aud_remito_dev_ad` AFTER DELETE ON `REMITO_DEVOLUCIONES` FOR EACH ROW
BEGIN
  INSERT INTO `AUDITORIA` (`tabla_nombre`, `operacion`, `registro_pk`, `usuario_app`, `usuario_rol`, `usuario_db`, `datos_anteriores`, `datos_nuevos`)
  VALUES (
    'REMITO_DEVOLUCIONES', 'DELETE', CAST(OLD.id_remito_devoluciones AS CHAR),
    COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
    JSON_OBJECT('id_remito_devoluciones', OLD.id_remito_devoluciones, 'id_etapa', OLD.id_etapa, 'fecha', OLD.fecha, 'id_cliente', OLD.id_cliente, 'numero', OLD.numero),
    NULL
  );
END$$

-- ------------------------------------------------------------------------------
-- 4. REMITO_DEVOLUCIONES_ITEMS
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_aud_remito_dev_items_ai`$$
CREATE TRIGGER `trg_aud_remito_dev_items_ai` AFTER INSERT ON `REMITO_DEVOLUCIONES_ITEMS` FOR EACH ROW
BEGIN
  INSERT INTO `AUDITORIA` (`tabla_nombre`, `operacion`, `registro_pk`, `usuario_app`, `usuario_rol`, `usuario_db`, `datos_anteriores`, `datos_nuevos`)
  VALUES (
    'REMITO_DEVOLUCIONES_ITEMS', 'INSERT', CAST(NEW.id_remito_devoluciones_item AS CHAR),
    COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
    NULL,
    JSON_OBJECT('id_remito_devoluciones_item', NEW.id_remito_devoluciones_item, 'id_remito_devoluciones', NEW.id_remito_devoluciones, 'id_producto', NEW.id_producto, 'cantidad_check_chofer', NEW.cantidad_check_chofer, 'vencimiento_check_chofer', NEW.vencimiento_check_chofer, 'tipo', NEW.tipo, 'codigo_motivo_dif', NEW.codigo_motivo_dif)
  );
END$$

DROP TRIGGER IF EXISTS `trg_aud_remito_dev_items_au`$$
CREATE TRIGGER `trg_aud_remito_dev_items_au` AFTER UPDATE ON `REMITO_DEVOLUCIONES_ITEMS` FOR EACH ROW
BEGIN
  INSERT INTO `AUDITORIA` (`tabla_nombre`, `operacion`, `registro_pk`, `usuario_app`, `usuario_rol`, `usuario_db`, `datos_anteriores`, `datos_nuevos`)
  VALUES (
    'REMITO_DEVOLUCIONES_ITEMS', 'UPDATE', CAST(NEW.id_remito_devoluciones_item AS CHAR),
    COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
    JSON_OBJECT('id_remito_devoluciones_item', OLD.id_remito_devoluciones_item, 'id_producto', OLD.id_producto, 'cantidad_check_chofer', OLD.cantidad_check_chofer, 'vencimiento_check_chofer', OLD.vencimiento_check_chofer, 'tipo', OLD.tipo, 'codigo_motivo_dif', OLD.codigo_motivo_dif),
    JSON_OBJECT('id_remito_devoluciones_item', NEW.id_remito_devoluciones_item, 'id_producto', NEW.id_producto, 'cantidad_check_chofer', NEW.cantidad_check_chofer, 'vencimiento_check_chofer', NEW.vencimiento_check_chofer, 'tipo', NEW.tipo, 'codigo_motivo_dif', NEW.codigo_motivo_dif)
  );
END$$

DROP TRIGGER IF EXISTS `trg_aud_remito_dev_items_ad`$$
CREATE TRIGGER `trg_aud_remito_dev_items_ad` AFTER DELETE ON `REMITO_DEVOLUCIONES_ITEMS` FOR EACH ROW
BEGIN
  INSERT INTO `AUDITORIA` (`tabla_nombre`, `operacion`, `registro_pk`, `usuario_app`, `usuario_rol`, `usuario_db`, `datos_anteriores`, `datos_nuevos`)
  VALUES (
    'REMITO_DEVOLUCIONES_ITEMS', 'DELETE', CAST(OLD.id_remito_devoluciones_item AS CHAR),
    COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
    JSON_OBJECT('id_remito_devoluciones_item', OLD.id_remito_devoluciones_item, 'id_remito_devoluciones', OLD.id_remito_devoluciones, 'id_producto', OLD.id_producto, 'cantidad_check_chofer', OLD.cantidad_check_chofer, 'tipo', OLD.tipo),
    NULL
  );
END$$

-- ------------------------------------------------------------------------------
-- 5. REMITO_CAJONES
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_aud_remito_cajones_ai`$$
CREATE TRIGGER `trg_aud_remito_cajones_ai` AFTER INSERT ON `REMITO_CAJONES` FOR EACH ROW
BEGIN
  INSERT INTO `AUDITORIA` (`tabla_nombre`, `operacion`, `registro_pk`, `usuario_app`, `usuario_rol`, `usuario_db`, `datos_anteriores`, `datos_nuevos`)
  VALUES (
    'REMITO_CAJONES', 'INSERT', CAST(NEW.id_remito_cajones AS CHAR),
    COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
    NULL,
    JSON_OBJECT('id_remito_cajones', NEW.id_remito_cajones, 'id_etapa', NEW.id_etapa, 'fecha', NEW.fecha, 'id_cliente', NEW.id_cliente, 'tipo', NEW.tipo)
  );
END$$

DROP TRIGGER IF EXISTS `trg_aud_remito_cajones_au`$$
CREATE TRIGGER `trg_aud_remito_cajones_au` AFTER UPDATE ON `REMITO_CAJONES` FOR EACH ROW
BEGIN
  INSERT INTO `AUDITORIA` (`tabla_nombre`, `operacion`, `registro_pk`, `usuario_app`, `usuario_rol`, `usuario_db`, `datos_anteriores`, `datos_nuevos`)
  VALUES (
    'REMITO_CAJONES', 'UPDATE', CAST(NEW.id_remito_cajones AS CHAR),
    COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
    JSON_OBJECT('id_remito_cajones', OLD.id_remito_cajones, 'id_etapa', OLD.id_etapa, 'fecha', OLD.fecha, 'id_cliente', OLD.id_cliente, 'tipo', OLD.tipo),
    JSON_OBJECT('id_remito_cajones', NEW.id_remito_cajones, 'id_etapa', NEW.id_etapa, 'fecha', NEW.fecha, 'id_cliente', NEW.id_cliente, 'tipo', NEW.tipo)
  );
END$$

DROP TRIGGER IF EXISTS `trg_aud_remito_cajones_ad`$$
CREATE TRIGGER `trg_aud_remito_cajones_ad` AFTER DELETE ON `REMITO_CAJONES` FOR EACH ROW
BEGIN
  INSERT INTO `AUDITORIA` (`tabla_nombre`, `operacion`, `registro_pk`, `usuario_app`, `usuario_rol`, `usuario_db`, `datos_anteriores`, `datos_nuevos`)
  VALUES (
    'REMITO_CAJONES', 'DELETE', CAST(OLD.id_remito_cajones AS CHAR),
    COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
    JSON_OBJECT('id_remito_cajones', OLD.id_remito_cajones, 'id_etapa', OLD.id_etapa, 'fecha', OLD.fecha, 'id_cliente', OLD.id_cliente, 'tipo', OLD.tipo),
    NULL
  );
END$$

-- ------------------------------------------------------------------------------
-- 6. REMITO_CAJONES_ITEMS
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_aud_remito_cajones_items_ai`$$
CREATE TRIGGER `trg_aud_remito_cajones_items_ai` AFTER INSERT ON `REMITO_CAJONES_ITEMS` FOR EACH ROW
BEGIN
  INSERT INTO `AUDITORIA` (`tabla_nombre`, `operacion`, `registro_pk`, `usuario_app`, `usuario_rol`, `usuario_db`, `datos_anteriores`, `datos_nuevos`)
  VALUES (
    'REMITO_CAJONES_ITEMS', 'INSERT', CAST(NEW.id_remito_cajones_item AS CHAR),
    COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
    NULL,
    JSON_OBJECT('id_remito_cajones_item', NEW.id_remito_cajones_item, 'id_remito_cajones', NEW.id_remito_cajones, 'cantidad', NEW.cantidad, 'cantidad_check_chofer', NEW.cantidad_check_chofer)
  );
END$$

DROP TRIGGER IF EXISTS `trg_aud_remito_cajones_items_au`$$
CREATE TRIGGER `trg_aud_remito_cajones_items_au` AFTER UPDATE ON `REMITO_CAJONES_ITEMS` FOR EACH ROW
BEGIN
  INSERT INTO `AUDITORIA` (`tabla_nombre`, `operacion`, `registro_pk`, `usuario_app`, `usuario_rol`, `usuario_db`, `datos_anteriores`, `datos_nuevos`)
  VALUES (
    'REMITO_CAJONES_ITEMS', 'UPDATE', CAST(NEW.id_remito_cajones_item AS CHAR),
    COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
    JSON_OBJECT('id_remito_cajones_item', OLD.id_remito_cajones_item, 'id_remito_cajones', OLD.id_remito_cajones, 'cantidad', OLD.cantidad, 'cantidad_check_chofer', OLD.cantidad_check_chofer, 'cantidad_check_sector_cajones', OLD.cantidad_check_sector_cajones),
    JSON_OBJECT('id_remito_cajones_item', NEW.id_remito_cajones_item, 'id_remito_cajones', NEW.id_remito_cajones, 'cantidad', NEW.cantidad, 'cantidad_check_chofer', NEW.cantidad_check_chofer, 'cantidad_check_sector_cajones', NEW.cantidad_check_sector_cajones)
  );
END$$

DROP TRIGGER IF EXISTS `trg_aud_remito_cajones_items_ad`$$
CREATE TRIGGER `trg_aud_remito_cajones_items_ad` AFTER DELETE ON `REMITO_CAJONES_ITEMS` FOR EACH ROW
BEGIN
  INSERT INTO `AUDITORIA` (`tabla_nombre`, `operacion`, `registro_pk`, `usuario_app`, `usuario_rol`, `usuario_db`, `datos_anteriores`, `datos_nuevos`)
  VALUES (
    'REMITO_CAJONES_ITEMS', 'DELETE', CAST(OLD.id_remito_cajones_item AS CHAR),
    COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
    JSON_OBJECT('id_remito_cajones_item', OLD.id_remito_cajones_item, 'id_remito_cajones', OLD.id_remito_cajones, 'cantidad_check_chofer', OLD.cantidad_check_chofer),
    NULL
  );
END$$

-- ------------------------------------------------------------------------------
-- 7. REMITOS_FIRMADOS
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_aud_remitos_firmados_ai`$$
CREATE TRIGGER `trg_aud_remitos_firmados_ai` AFTER INSERT ON `REMITOS_FIRMADOS` FOR EACH ROW
BEGIN
  INSERT INTO `AUDITORIA` (`tabla_nombre`, `operacion`, `registro_pk`, `usuario_app`, `usuario_rol`, `usuario_db`, `datos_anteriores`, `datos_nuevos`)
  VALUES (
    'REMITOS_FIRMADOS', 'INSERT', CAST(NEW.Id_remito_firmado AS CHAR),
    COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
    NULL,
    JSON_OBJECT('Id_remito_firmado', NEW.Id_remito_firmado, 'Id_etapa', NEW.Id_etapa, 'Id_transaccion_remito', NEW.Id_transaccion_remito, 'Nro_remito', NEW.Nro_remito, 'Firmado_cliente', NEW.Firmado_cliente, 'Firmado_distribuidor', NEW.Firmado_distribuidor, 'Url_imagen', NEW.Url_imagen)
  );
END$$

DROP TRIGGER IF EXISTS `trg_aud_remitos_firmados_au`$$
CREATE TRIGGER `trg_aud_remitos_firmados_au` AFTER UPDATE ON `REMITOS_FIRMADOS` FOR EACH ROW
BEGIN
  INSERT INTO `AUDITORIA` (`tabla_nombre`, `operacion`, `registro_pk`, `usuario_app`, `usuario_rol`, `usuario_db`, `datos_anteriores`, `datos_nuevos`)
  VALUES (
    'REMITOS_FIRMADOS', 'UPDATE', CAST(NEW.Id_remito_firmado AS CHAR),
    COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
    JSON_OBJECT('Id_remito_firmado', OLD.Id_remito_firmado, 'Firmado_cliente', OLD.Firmado_cliente, 'Firmado_distribuidor', OLD.Firmado_distribuidor, 'Url_imagen', OLD.Url_imagen),
    JSON_OBJECT('Id_remito_firmado', NEW.Id_remito_firmado, 'Firmado_cliente', NEW.Firmado_cliente, 'Firmado_distribuidor', NEW.Firmado_distribuidor, 'Url_imagen', NEW.Url_imagen)
  );
END$$

DROP TRIGGER IF EXISTS `trg_aud_remitos_firmados_ad`$$
CREATE TRIGGER `trg_aud_remitos_firmados_ad` AFTER DELETE ON `REMITOS_FIRMADOS` FOR EACH ROW
BEGIN
  INSERT INTO `AUDITORIA` (`tabla_nombre`, `operacion`, `registro_pk`, `usuario_app`, `usuario_rol`, `usuario_db`, `datos_anteriores`, `datos_nuevos`)
  VALUES (
    'REMITOS_FIRMADOS', 'DELETE', CAST(OLD.Id_remito_firmado AS CHAR),
    COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
    JSON_OBJECT('Id_remito_firmado', OLD.Id_remito_firmado, 'Id_transaccion_remito', OLD.Id_transaccion_remito, 'Nro_remito', OLD.Nro_remito),
    NULL
  );
END$$

-- ------------------------------------------------------------------------------
-- 8. REMITO (actualizaciones de URLs de firma)
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_aud_remito_au`$$
CREATE TRIGGER `trg_aud_remito_au` AFTER UPDATE ON `REMITO` FOR EACH ROW
BEGIN
  INSERT INTO `AUDITORIA` (`tabla_nombre`, `operacion`, `registro_pk`, `usuario_app`, `usuario_rol`, `usuario_db`, `datos_anteriores`, `datos_nuevos`)
  VALUES (
    'REMITO', 'UPDATE', CAST(NEW.Id_transaccion_remito AS CHAR),
    COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
    JSON_OBJECT('Id_transaccion_remito', OLD.Id_transaccion_remito, 'Numeroremito', OLD.Numeroremito, 'firma_cliente_url', OLD.firma_cliente_url, 'firma_distribuidor_url', OLD.firma_distribuidor_url),
    JSON_OBJECT('Id_transaccion_remito', NEW.Id_transaccion_remito, 'Numeroremito', NEW.Numeroremito, 'firma_cliente_url', NEW.firma_cliente_url, 'firma_distribuidor_url', NEW.firma_distribuidor_url)
  );
END$$

DELIMITER ;
