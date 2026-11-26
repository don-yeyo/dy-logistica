const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const TRIGGER_DEFINITIONS = [
  {
    name: 'trg_aud_app_usuarios_ai',
    table: 'APP_USUARIOS',
    timing: 'AFTER INSERT',
    body: `INSERT INTO \`AUDITORIA\` (\`tabla_nombre\`, \`operacion\`, \`registro_pk\`, \`usuario_app\`, \`usuario_rol\`, \`usuario_db\`, \`datos_anteriores\`, \`datos_nuevos\`)
      VALUES ('APP_USUARIOS', 'INSERT', CAST(NEW.id AS CHAR), COALESCE(@app_user_email, USER()), @app_user_rol, USER(), NULL,
      JSON_OBJECT('id', NEW.id, 'email', NEW.email, 'nombre', NEW.nombre, 'rol', NEW.rol, 'organizacion_id', NEW.organizacion_id, 'codigo_chofer', NEW.codigo_chofer, 'activo', NEW.activo))`
  },
  {
    name: 'trg_aud_app_usuarios_au',
    table: 'APP_USUARIOS',
    timing: 'AFTER UPDATE',
    body: `INSERT INTO \`AUDITORIA\` (\`tabla_nombre\`, \`operacion\`, \`registro_pk\`, \`usuario_app\`, \`usuario_rol\`, \`usuario_db\`, \`datos_anteriores\`, \`datos_nuevos\`)
      VALUES ('APP_USUARIOS', 'UPDATE', CAST(NEW.id AS CHAR), COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
      JSON_OBJECT('id', OLD.id, 'email', OLD.email, 'nombre', OLD.nombre, 'rol', OLD.rol, 'organizacion_id', OLD.organizacion_id, 'codigo_chofer', OLD.codigo_chofer, 'activo', OLD.activo),
      JSON_OBJECT('id', NEW.id, 'email', NEW.email, 'nombre', NEW.nombre, 'rol', NEW.rol, 'organizacion_id', NEW.organizacion_id, 'codigo_chofer', NEW.codigo_chofer, 'activo', NEW.activo))`
  },
  {
    name: 'trg_aud_app_usuarios_ad',
    table: 'APP_USUARIOS',
    timing: 'AFTER DELETE',
    body: `INSERT INTO \`AUDITORIA\` (\`tabla_nombre\`, \`operacion\`, \`registro_pk\`, \`usuario_app\`, \`usuario_rol\`, \`usuario_db\`, \`datos_anteriores\`, \`datos_nuevos\`)
      VALUES ('APP_USUARIOS', 'DELETE', CAST(OLD.id AS CHAR), COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
      JSON_OBJECT('id', OLD.id, 'email', OLD.email, 'nombre', OLD.nombre, 'rol', OLD.rol, 'organizacion_id', OLD.organizacion_id, 'codigo_chofer', OLD.codigo_chofer, 'activo', OLD.activo), NULL)`
  },
  {
    name: 'trg_aud_hr_item_remito_ai',
    table: 'HOJA_RUTA_ITEM_REMITO',
    timing: 'AFTER INSERT',
    body: `INSERT INTO \`AUDITORIA\` (\`tabla_nombre\`, \`operacion\`, \`registro_pk\`, \`usuario_app\`, \`usuario_rol\`, \`usuario_db\`, \`datos_anteriores\`, \`datos_nuevos\`)
      VALUES ('HOJA_RUTA_ITEM_REMITO', 'INSERT', CAST(NEW.Hojarutaitemid AS CHAR), COALESCE(@app_user_email, USER()), @app_user_rol, USER(), NULL,
      JSON_OBJECT('Hojarutaitemid', NEW.Hojarutaitemid, 'Id_etapa', NEW.Id_etapa, 'Id_transaccion_remito', NEW.Id_transaccion_remito, 'Productoid', NEW.Productoid, 'Cantidad', NEW.Cantidad, 'cantidad_descargada_Chofer', NEW.cantidad_descargada_Chofer, 'codigo_motivo_dif', NEW.codigo_motivo_dif))`
  },
  {
    name: 'trg_aud_hr_item_remito_au',
    table: 'HOJA_RUTA_ITEM_REMITO',
    timing: 'AFTER UPDATE',
    body: `INSERT INTO \`AUDITORIA\` (\`tabla_nombre\`, \`operacion\`, \`registro_pk\`, \`usuario_app\`, \`usuario_rol\`, \`usuario_db\`, \`datos_anteriores\`, \`datos_nuevos\`)
      VALUES ('HOJA_RUTA_ITEM_REMITO', 'UPDATE', CAST(NEW.Hojarutaitemid AS CHAR), COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
      JSON_OBJECT('Hojarutaitemid', OLD.Hojarutaitemid, 'Cantidad', OLD.Cantidad, 'cantidad_descargada_Chofer', OLD.cantidad_descargada_Chofer, 'cantidad_descargada_Distribuidor', OLD.cantidad_descargada_Distribuidor, 'codigo_motivo_dif', OLD.codigo_motivo_dif),
      JSON_OBJECT('Hojarutaitemid', NEW.Hojarutaitemid, 'Cantidad', NEW.Cantidad, 'cantidad_descargada_Chofer', NEW.cantidad_descargada_Chofer, 'cantidad_descargada_Distribuidor', NEW.cantidad_descargada_Distribuidor, 'codigo_motivo_dif', NEW.codigo_motivo_dif))`
  },
  {
    name: 'trg_aud_hr_item_remito_ad',
    table: 'HOJA_RUTA_ITEM_REMITO',
    timing: 'AFTER DELETE',
    body: `INSERT INTO \`AUDITORIA\` (\`tabla_nombre\`, \`operacion\`, \`registro_pk\`, \`usuario_app\`, \`usuario_rol\`, \`usuario_db\`, \`datos_anteriores\`, \`datos_nuevos\`)
      VALUES ('HOJA_RUTA_ITEM_REMITO', 'DELETE', CAST(OLD.Hojarutaitemid AS CHAR), COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
      JSON_OBJECT('Hojarutaitemid', OLD.Hojarutaitemid, 'Id_etapa', OLD.Id_etapa, 'Id_transaccion_remito', OLD.Id_transaccion_remito, 'Productoid', OLD.Productoid, 'Cantidad', OLD.Cantidad), NULL)`
  },
  {
    name: 'trg_aud_remito_dev_ai',
    table: 'REMITO_DEVOLUCIONES',
    timing: 'AFTER INSERT',
    body: `INSERT INTO \`AUDITORIA\` (\`tabla_nombre\`, \`operacion\`, \`registro_pk\`, \`usuario_app\`, \`usuario_rol\`, \`usuario_db\`, \`datos_anteriores\`, \`datos_nuevos\`)
      VALUES ('REMITO_DEVOLUCIONES', 'INSERT', CAST(NEW.id_remito_devoluciones AS CHAR), COALESCE(@app_user_email, USER()), @app_user_rol, USER(), NULL,
      JSON_OBJECT('id_remito_devoluciones', NEW.id_remito_devoluciones, 'id_etapa', NEW.id_etapa, 'fecha', NEW.fecha, 'id_cliente', NEW.id_cliente, 'numero', NEW.numero))`
  },
  {
    name: 'trg_aud_remito_dev_au',
    table: 'REMITO_DEVOLUCIONES',
    timing: 'AFTER UPDATE',
    body: `INSERT INTO \`AUDITORIA\` (\`tabla_nombre\`, \`operacion\`, \`registro_pk\`, \`usuario_app\`, \`usuario_rol\`, \`usuario_db\`, \`datos_anteriores\`, \`datos_nuevos\`)
      VALUES ('REMITO_DEVOLUCIONES', 'UPDATE', CAST(NEW.id_remito_devoluciones AS CHAR), COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
      JSON_OBJECT('id_remito_devoluciones', OLD.id_remito_devoluciones, 'id_etapa', OLD.id_etapa, 'fecha', OLD.fecha, 'id_cliente', OLD.id_cliente),
      JSON_OBJECT('id_remito_devoluciones', NEW.id_remito_devoluciones, 'id_etapa', NEW.id_etapa, 'fecha', NEW.fecha, 'id_cliente', NEW.id_cliente))`
  },
  {
    name: 'trg_aud_remito_dev_ad',
    table: 'REMITO_DEVOLUCIONES',
    timing: 'AFTER DELETE',
    body: `INSERT INTO \`AUDITORIA\` (\`tabla_nombre\`, \`operacion\`, \`registro_pk\`, \`usuario_app\`, \`usuario_rol\`, \`usuario_db\`, \`datos_anteriores\`, \`datos_nuevos\`)
      VALUES ('REMITO_DEVOLUCIONES', 'DELETE', CAST(OLD.id_remito_devoluciones AS CHAR), COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
      JSON_OBJECT('id_remito_devoluciones', OLD.id_remito_devoluciones, 'id_etapa', OLD.id_etapa, 'fecha', OLD.fecha, 'id_cliente', OLD.id_cliente), NULL)`
  },
  {
    name: 'trg_aud_remito_dev_items_ai',
    table: 'REMITO_DEVOLUCIONES_ITEMS',
    timing: 'AFTER INSERT',
    body: `INSERT INTO \`AUDITORIA\` (\`tabla_nombre\`, \`operacion\`, \`registro_pk\`, \`usuario_app\`, \`usuario_rol\`, \`usuario_db\`, \`datos_anteriores\`, \`datos_nuevos\`)
      VALUES ('REMITO_DEVOLUCIONES_ITEMS', 'INSERT', CAST(NEW.id_remito_devoluciones_item AS CHAR), COALESCE(@app_user_email, USER()), @app_user_rol, USER(), NULL,
      JSON_OBJECT('id_remito_devoluciones_item', NEW.id_remito_devoluciones_item, 'id_remito_devoluciones', NEW.id_remito_devoluciones, 'id_producto', NEW.id_producto, 'cantidad_check_chofer', NEW.cantidad_check_chofer, 'vencimiento_check_chofer', NEW.vencimiento_check_chofer, 'tipo', NEW.tipo, 'codigo_motivo_dif', NEW.codigo_motivo_dif))`
  },
  {
    name: 'trg_aud_remito_dev_items_au',
    table: 'REMITO_DEVOLUCIONES_ITEMS',
    timing: 'AFTER UPDATE',
    body: `INSERT INTO \`AUDITORIA\` (\`tabla_nombre\`, \`operacion\`, \`registro_pk\`, \`usuario_app\`, \`usuario_rol\`, \`usuario_db\`, \`datos_anteriores\`, \`datos_nuevos\`)
      VALUES ('REMITO_DEVOLUCIONES_ITEMS', 'UPDATE', CAST(NEW.id_remito_devoluciones_item AS CHAR), COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
      JSON_OBJECT('id_remito_devoluciones_item', OLD.id_remito_devoluciones_item, 'id_producto', OLD.id_producto, 'cantidad_check_chofer', OLD.cantidad_check_chofer, 'tipo', OLD.tipo, 'codigo_motivo_dif', OLD.codigo_motivo_dif),
      JSON_OBJECT('id_remito_devoluciones_item', NEW.id_remito_devoluciones_item, 'id_producto', NEW.id_producto, 'cantidad_check_chofer', NEW.cantidad_check_chofer, 'tipo', NEW.tipo, 'codigo_motivo_dif', NEW.codigo_motivo_dif))`
  },
  {
    name: 'trg_aud_remito_dev_items_ad',
    table: 'REMITO_DEVOLUCIONES_ITEMS',
    timing: 'AFTER DELETE',
    body: `INSERT INTO \`AUDITORIA\` (\`tabla_nombre\`, \`operacion\`, \`registro_pk\`, \`usuario_app\`, \`usuario_rol\`, \`usuario_db\`, \`datos_anteriores\`, \`datos_nuevos\`)
      VALUES ('REMITO_DEVOLUCIONES_ITEMS', 'DELETE', CAST(OLD.id_remito_devoluciones_item AS CHAR), COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
      JSON_OBJECT('id_remito_devoluciones_item', OLD.id_remito_devoluciones_item, 'id_remito_devoluciones', OLD.id_remito_devoluciones, 'id_producto', OLD.id_producto), NULL)`
  },
  {
    name: 'trg_aud_remito_cajones_ai',
    table: 'REMITO_CAJONES',
    timing: 'AFTER INSERT',
    body: `INSERT INTO \`AUDITORIA\` (\`tabla_nombre\`, \`operacion\`, \`registro_pk\`, \`usuario_app\`, \`usuario_rol\`, \`usuario_db\`, \`datos_anteriores\`, \`datos_nuevos\`)
      VALUES ('REMITO_CAJONES', 'INSERT', CAST(NEW.id_remito_cajones AS CHAR), COALESCE(@app_user_email, USER()), @app_user_rol, USER(), NULL,
      JSON_OBJECT('id_remito_cajones', NEW.id_remito_cajones, 'id_etapa', NEW.id_etapa, 'fecha', NEW.fecha, 'id_cliente', NEW.id_cliente, 'tipo', NEW.tipo))`
  },
  {
    name: 'trg_aud_remito_cajones_au',
    table: 'REMITO_CAJONES',
    timing: 'AFTER UPDATE',
    body: `INSERT INTO \`AUDITORIA\` (\`tabla_nombre\`, \`operacion\`, \`registro_pk\`, \`usuario_app\`, \`usuario_rol\`, \`usuario_db\`, \`datos_anteriores\`, \`datos_nuevos\`)
      VALUES ('REMITO_CAJONES', 'UPDATE', CAST(NEW.id_remito_cajones AS CHAR), COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
      JSON_OBJECT('id_remito_cajones', OLD.id_remito_cajones, 'id_etapa', OLD.id_etapa, 'tipo', OLD.tipo),
      JSON_OBJECT('id_remito_cajones', NEW.id_remito_cajones, 'id_etapa', NEW.id_etapa, 'tipo', NEW.tipo))`
  },
  {
    name: 'trg_aud_remito_cajones_ad',
    table: 'REMITO_CAJONES',
    timing: 'AFTER DELETE',
    body: `INSERT INTO \`AUDITORIA\` (\`tabla_nombre\`, \`operacion\`, \`registro_pk\`, \`usuario_app\`, \`usuario_rol\`, \`usuario_db\`, \`datos_anteriores\`, \`datos_nuevos\`)
      VALUES ('REMITO_CAJONES', 'DELETE', CAST(OLD.id_remito_cajones AS CHAR), COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
      JSON_OBJECT('id_remito_cajones', OLD.id_remito_cajones, 'id_etapa', OLD.id_etapa, 'tipo', OLD.tipo), NULL)`
  },
  {
    name: 'trg_aud_remito_cajones_items_ai',
    table: 'REMITO_CAJONES_ITEMS',
    timing: 'AFTER INSERT',
    body: `INSERT INTO \`AUDITORIA\` (\`tabla_nombre\`, \`operacion\`, \`registro_pk\`, \`usuario_app\`, \`usuario_rol\`, \`usuario_db\`, \`datos_anteriores\`, \`datos_nuevos\`)
      VALUES ('REMITO_CAJONES_ITEMS', 'INSERT', CAST(NEW.id_remito_cajones_item AS CHAR), COALESCE(@app_user_email, USER()), @app_user_rol, USER(), NULL,
      JSON_OBJECT('id_remito_cajones_item', NEW.id_remito_cajones_item, 'id_remito_cajones', NEW.id_remito_cajones, 'cantidad', NEW.cantidad, 'cantidad_check_chofer', NEW.cantidad_check_chofer))`
  },
  {
    name: 'trg_aud_remito_cajones_items_au',
    table: 'REMITO_CAJONES_ITEMS',
    timing: 'AFTER UPDATE',
    body: `INSERT INTO \`AUDITORIA\` (\`tabla_nombre\`, \`operacion\`, \`registro_pk\`, \`usuario_app\`, \`usuario_rol\`, \`usuario_db\`, \`datos_anteriores\`, \`datos_nuevos\`)
      VALUES ('REMITO_CAJONES_ITEMS', 'UPDATE', CAST(NEW.id_remito_cajones_item AS CHAR), COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
      JSON_OBJECT('id_remito_cajones_item', OLD.id_remito_cajones_item, 'cantidad_check_chofer', OLD.cantidad_check_chofer, 'cantidad_check_sector_cajones', OLD.cantidad_check_sector_cajones),
      JSON_OBJECT('id_remito_cajones_item', NEW.id_remito_cajones_item, 'cantidad_check_chofer', NEW.cantidad_check_chofer, 'cantidad_check_sector_cajones', NEW.cantidad_check_sector_cajones))`
  },
  {
    name: 'trg_aud_remito_cajones_items_ad',
    table: 'REMITO_CAJONES_ITEMS',
    timing: 'AFTER DELETE',
    body: `INSERT INTO \`AUDITORIA\` (\`tabla_nombre\`, \`operacion\`, \`registro_pk\`, \`usuario_app\`, \`usuario_rol\`, \`usuario_db\`, \`datos_anteriores\`, \`datos_nuevos\`)
      VALUES ('REMITO_CAJONES_ITEMS', 'DELETE', CAST(OLD.id_remito_cajones_item AS CHAR), COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
      JSON_OBJECT('id_remito_cajones_item', OLD.id_remito_cajones_item, 'id_remito_cajones', OLD.id_remito_cajones), NULL)`
  },
  {
    name: 'trg_aud_remitos_firmados_ai',
    table: 'REMITOS_FIRMADOS',
    timing: 'AFTER INSERT',
    body: `INSERT INTO \`AUDITORIA\` (\`tabla_nombre\`, \`operacion\`, \`registro_pk\`, \`usuario_app\`, \`usuario_rol\`, \`usuario_db\`, \`datos_anteriores\`, \`datos_nuevos\`)
      VALUES ('REMITOS_FIRMADOS', 'INSERT', CAST(NEW.Id_remito_firmado AS CHAR), COALESCE(@app_user_email, USER()), @app_user_rol, USER(), NULL,
      JSON_OBJECT('Id_remito_firmado', NEW.Id_remito_firmado, 'Id_etapa', NEW.Id_etapa, 'Id_transaccion_remito', NEW.Id_transaccion_remito, 'Nro_remito', NEW.Nro_remito, 'Firmado_cliente', NEW.Firmado_cliente, 'Firmado_distribuidor', NEW.Firmado_distribuidor))`
  },
  {
    name: 'trg_aud_remitos_firmados_au',
    table: 'REMITOS_FIRMADOS',
    timing: 'AFTER UPDATE',
    body: `INSERT INTO \`AUDITORIA\` (\`tabla_nombre\`, \`operacion\`, \`registro_pk\`, \`usuario_app\`, \`usuario_rol\`, \`usuario_db\`, \`datos_anteriores\`, \`datos_nuevos\`)
      VALUES ('REMITOS_FIRMADOS', 'UPDATE', CAST(NEW.Id_remito_firmado AS CHAR), COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
      JSON_OBJECT('Id_remito_firmado', OLD.Id_remito_firmado, 'Firmado_cliente', OLD.Firmado_cliente, 'Firmado_distribuidor', OLD.Firmado_distribuidor, 'Url_imagen', OLD.Url_imagen),
      JSON_OBJECT('Id_remito_firmado', NEW.Id_remito_firmado, 'Firmado_cliente', NEW.Firmado_cliente, 'Firmado_distribuidor', NEW.Firmado_distribuidor, 'Url_imagen', NEW.Url_imagen))`
  },
  {
    name: 'trg_aud_remitos_firmados_ad',
    table: 'REMITOS_FIRMADOS',
    timing: 'AFTER DELETE',
    body: `INSERT INTO \`AUDITORIA\` (\`tabla_nombre\`, \`operacion\`, \`registro_pk\`, \`usuario_app\`, \`usuario_rol\`, \`usuario_db\`, \`datos_anteriores\`, \`datos_nuevos\`)
      VALUES ('REMITOS_FIRMADOS', 'DELETE', CAST(OLD.Id_remito_firmado AS CHAR), COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
      JSON_OBJECT('Id_remito_firmado', OLD.Id_remito_firmado, 'Id_transaccion_remito', OLD.Id_transaccion_remito), NULL)`
  },
  {
    name: 'trg_aud_remito_au',
    table: 'REMITO',
    timing: 'AFTER UPDATE',
    body: `INSERT INTO \`AUDITORIA\` (\`tabla_nombre\`, \`operacion\`, \`registro_pk\`, \`usuario_app\`, \`usuario_rol\`, \`usuario_db\`, \`datos_anteriores\`, \`datos_nuevos\`)
      VALUES ('REMITO', 'UPDATE', CAST(NEW.Id_transaccion_remito AS CHAR), COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
      JSON_OBJECT('Id_transaccion_remito', OLD.Id_transaccion_remito, 'Numeroremito', OLD.Numeroremito, 'firma_cliente_url', OLD.firma_cliente_url, 'firma_distribuidor_url', OLD.firma_distribuidor_url),
      JSON_OBJECT('Id_transaccion_remito', NEW.Id_transaccion_remito, 'Numeroremito', NEW.Numeroremito, 'firma_cliente_url', NEW.firma_cliente_url, 'firma_distribuidor_url', NEW.firma_distribuidor_url))`
  },
  {
    name: 'trg_aud_app_remito_ejemplares_ai',
    table: 'APP_REMITO_EJEMPLARES',
    timing: 'AFTER INSERT',
    body: `INSERT INTO \`AUDITORIA\` (\`tabla_nombre\`, \`operacion\`, \`registro_pk\`, \`usuario_app\`, \`usuario_rol\`, \`usuario_db\`, \`datos_anteriores\`, \`datos_nuevos\`)
      VALUES ('APP_REMITO_EJEMPLARES', 'INSERT', CAST(NEW.id AS CHAR), COALESCE(@app_user_email, USER()), @app_user_rol, USER(), NULL,
      JSON_OBJECT('id', NEW.id, 'id_transaccion_remito', NEW.id_transaccion_remito, 'nro_remito', NEW.nro_remito, 'ejemplar', NEW.ejemplar, 'firmado_cliente', NEW.firmado_cliente, 'firmado_intermediario', NEW.firmado_intermediario, 'no_firmado', NEW.no_firmado, 'observaciones', NEW.observaciones, 'foto_url', NEW.foto_url, 'tiene_firma_digital', IF(NEW.firma_digital_base64 IS NOT NULL, 1, 0), 'usuario_email', NEW.usuario_email))`
  },
  {
    name: 'trg_aud_app_remito_ejemplares_au',
    table: 'APP_REMITO_EJEMPLARES',
    timing: 'AFTER UPDATE',
    body: `INSERT INTO \`AUDITORIA\` (\`tabla_nombre\`, \`operacion\`, \`registro_pk\`, \`usuario_app\`, \`usuario_rol\`, \`usuario_db\`, \`datos_anteriores\`, \`datos_nuevos\`)
      VALUES ('APP_REMITO_EJEMPLARES', 'UPDATE', CAST(NEW.id AS CHAR), COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
      JSON_OBJECT('id', OLD.id, 'id_transaccion_remito', OLD.id_transaccion_remito, 'ejemplar', OLD.ejemplar, 'firmado_cliente', OLD.firmado_cliente, 'firmado_intermediario', OLD.firmado_intermediario, 'no_firmado', OLD.no_firmado, 'observaciones', OLD.observaciones, 'foto_url', OLD.foto_url),
      JSON_OBJECT('id', NEW.id, 'id_transaccion_remito', NEW.id_transaccion_remito, 'ejemplar', NEW.ejemplar, 'firmado_cliente', NEW.firmado_cliente, 'firmado_intermediario', NEW.firmado_intermediario, 'no_firmado', NEW.no_firmado, 'observaciones', NEW.observaciones, 'foto_url', NEW.foto_url))`
  },
  {
    name: 'trg_aud_app_remito_ejemplares_ad',
    table: 'APP_REMITO_EJEMPLARES',
    timing: 'AFTER DELETE',
    body: `INSERT INTO \`AUDITORIA\` (\`tabla_nombre\`, \`operacion\`, \`registro_pk\`, \`usuario_app\`, \`usuario_rol\`, \`usuario_db\`, \`datos_anteriores\`, \`datos_nuevos\`)
      VALUES ('APP_REMITO_EJEMPLARES', 'DELETE', CAST(OLD.id AS CHAR), COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
      JSON_OBJECT('id', OLD.id, 'id_transaccion_remito', OLD.id_transaccion_remito, 'nro_remito', OLD.nro_remito, 'ejemplar', OLD.ejemplar, 'firmado_cliente', OLD.firmado_cliente, 'firmado_intermediario', OLD.firmado_intermediario, 'no_firmado', OLD.no_firmado), NULL)`
  },
  {
    name: 'trg_aud_app_entregas_lugar_ai',
    table: 'APP_ENTREGAS_LUGAR',
    timing: 'AFTER INSERT',
    body: `INSERT INTO \`AUDITORIA\` (\`tabla_nombre\`, \`operacion\`, \`registro_pk\`, \`usuario_app\`, \`usuario_rol\`, \`usuario_db\`, \`datos_anteriores\`, \`datos_nuevos\`)
      VALUES ('APP_ENTREGAS_LUGAR', 'INSERT', CAST(NEW.id AS CHAR), COALESCE(@app_user_email, USER()), @app_user_rol, USER(), NULL,
      JSON_OBJECT('id', NEW.id, 'transaccion_id', NEW.transaccion_id, 'lugar_entrega', NEW.lugar_entrega, 'productoid', NEW.productoid, 'remitido_total', NEW.remitido_total, 'entregado_total', NEW.entregado_total, 'usuario_email', NEW.usuario_email))`
  },
  {
    name: 'trg_aud_app_entregas_lugar_au',
    table: 'APP_ENTREGAS_LUGAR',
    timing: 'AFTER UPDATE',
    body: `INSERT INTO \`AUDITORIA\` (\`tabla_nombre\`, \`operacion\`, \`registro_pk\`, \`usuario_app\`, \`usuario_rol\`, \`usuario_db\`, \`datos_anteriores\`, \`datos_nuevos\`)
      VALUES ('APP_ENTREGAS_LUGAR', 'UPDATE', CAST(NEW.id AS CHAR), COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
      JSON_OBJECT('id', OLD.id, 'transaccion_id', OLD.transaccion_id, 'lugar_entrega', OLD.lugar_entrega, 'productoid', OLD.productoid, 'entregado_total', OLD.entregado_total),
      JSON_OBJECT('id', NEW.id, 'transaccion_id', NEW.transaccion_id, 'lugar_entrega', NEW.lugar_entrega, 'productoid', NEW.productoid, 'entregado_total', NEW.entregado_total, 'usuario_email', NEW.usuario_email))`
  },
  {
    name: 'trg_aud_app_entregas_lugar_ad',
    table: 'APP_ENTREGAS_LUGAR',
    timing: 'AFTER DELETE',
    body: `INSERT INTO \`AUDITORIA\` (\`tabla_nombre\`, \`operacion\`, \`registro_pk\`, \`usuario_app\`, \`usuario_rol\`, \`usuario_db\`, \`datos_anteriores\`, \`datos_nuevos\`)
      VALUES ('APP_ENTREGAS_LUGAR', 'DELETE', CAST(OLD.id AS CHAR), COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
      JSON_OBJECT('id', OLD.id, 'transaccion_id', OLD.transaccion_id, 'lugar_entrega', OLD.lugar_entrega, 'productoid', OLD.productoid, 'entregado_total', OLD.entregado_total), NULL)`
  },
  {
    name: 'trg_aud_app_cajones_pallets_ai',
    table: 'APP_CAJONES_PALLETS',
    timing: 'AFTER INSERT',
    body: `INSERT INTO \`AUDITORIA\` (\`tabla_nombre\`, \`operacion\`, \`registro_pk\`, \`usuario_app\`, \`usuario_rol\`, \`usuario_db\`, \`datos_anteriores\`, \`datos_nuevos\`)
      VALUES ('APP_CAJONES_PALLETS', 'INSERT', CAST(NEW.id AS CHAR), COALESCE(@app_user_email, USER()), @app_user_rol, USER(), NULL,
      JSON_OBJECT('id', NEW.id, 'transaccion_id', NEW.transaccion_id, 'id_etapa', NEW.id_etapa, 'lugar_entrega', NEW.lugar_entrega, 'id_cliente', NEW.id_cliente, 'cliente', NEW.cliente, 'cajones_entregados', NEW.cajones_entregados, 'cajones_devueltos', NEW.cajones_devueltos, 'pallets_entregados', NEW.pallets_entregados, 'pallets_devueltos', NEW.pallets_devueltos, 'observaciones', NEW.observaciones, 'usuario_email', NEW.usuario_email))`
  },
  {
    name: 'trg_aud_app_cajones_pallets_au',
    table: 'APP_CAJONES_PALLETS',
    timing: 'AFTER UPDATE',
    body: `INSERT INTO \`AUDITORIA\` (\`tabla_nombre\`, \`operacion\`, \`registro_pk\`, \`usuario_app\`, \`usuario_rol\`, \`usuario_db\`, \`datos_anteriores\`, \`datos_nuevos\`)
      VALUES ('APP_CAJONES_PALLETS', 'UPDATE', CAST(NEW.id AS CHAR), COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
      JSON_OBJECT('id', OLD.id, 'cajones_entregados', OLD.cajones_entregados, 'cajones_devueltos', OLD.cajones_devueltos, 'pallets_entregados', OLD.pallets_entregados, 'pallets_devueltos', OLD.pallets_devueltos, 'observaciones', OLD.observaciones),
      JSON_OBJECT('id', NEW.id, 'cajones_entregados', NEW.cajones_entregados, 'cajones_devueltos', NEW.cajones_devueltos, 'pallets_entregados', NEW.pallets_entregados, 'pallets_devueltos', NEW.pallets_devueltos, 'observaciones', NEW.observaciones, 'usuario_email', NEW.usuario_email))`
  },
  {
    name: 'trg_aud_app_cajones_pallets_ad',
    table: 'APP_CAJONES_PALLETS',
    timing: 'AFTER DELETE',
    body: `INSERT INTO \`AUDITORIA\` (\`tabla_nombre\`, \`operacion\`, \`registro_pk\`, \`usuario_app\`, \`usuario_rol\`, \`usuario_db\`, \`datos_anteriores\`, \`datos_nuevos\`)
      VALUES ('APP_CAJONES_PALLETS', 'DELETE', CAST(OLD.id AS CHAR), COALESCE(@app_user_email, USER()), @app_user_rol, USER(),
      JSON_OBJECT('id', OLD.id, 'transaccion_id', OLD.transaccion_id, 'lugar_entrega', OLD.lugar_entrega, 'cliente', OLD.cliente), NULL)`
  }
];

async function setup() {
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

  const conn = await mysql.createConnection(connConfig);
  console.log('Conectado a:', connConfig.database);

  // 1. Crear tabla APP_USUARIOS
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`APP_USUARIOS\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`email\` VARCHAR(150) NOT NULL,
      \`nombre\` VARCHAR(120) NOT NULL,
      \`rol\` ENUM('sysadmin', 'logistica', 'chofer') NOT NULL DEFAULT 'chofer',
      \`organizacion_id\` INT DEFAULT NULL COMMENT 'Mapeo con ORGANIZACION.Organizacionid para filtrar hojas de ruta del chofer',
      \`codigo_chofer\` VARCHAR(50) DEFAULT NULL,
      \`activo\` TINYINT(1) NOT NULL DEFAULT 1,
      \`created_by\` VARCHAR(150) DEFAULT NULL,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uniq_app_user_email\` (\`email\`),
      INDEX \`idx_app_user_rol\` (\`rol\`),
      INDEX \`idx_app_user_org\` (\`organizacion_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);
  console.log('✔ Tabla APP_USUARIOS lista.');

  // 2. Crear tabla AUDITORIA
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`AUDITORIA\` (
      \`id_auditoria\` BIGINT NOT NULL AUTO_INCREMENT,
      \`tabla_nombre\` VARCHAR(80) NOT NULL,
      \`operacion\` ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
      \`registro_pk\` VARCHAR(120) DEFAULT NULL,
      \`usuario_app\` VARCHAR(150) DEFAULT NULL,
      \`usuario_rol\` VARCHAR(30) DEFAULT NULL,
      \`usuario_db\` VARCHAR(100) NOT NULL,
      \`fecha_hora\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`datos_anteriores\` JSON DEFAULT NULL,
      \`datos_nuevos\` JSON DEFAULT NULL,
      PRIMARY KEY (\`id_auditoria\`),
      INDEX \`idx_aud_tabla\` (\`tabla_nombre\`),
      INDEX \`idx_aud_operacion\` (\`operacion\`),
      INDEX \`idx_aud_fecha\` (\`fecha_hora\`),
      INDEX \`idx_aud_usuario\` (\`usuario_app\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);
  console.log('✔ Tabla AUDITORIA lista.');

  // 2.5 Crear tabla APP_REMITO_EJEMPLARES (soporte multi-ejemplar y múltiples firmantes por remito)
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`APP_REMITO_EJEMPLARES\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`id_transaccion_remito\` INT NOT NULL,
      \`id_etapa\` VARCHAR(45) DEFAULT NULL,
      \`nro_remito\` VARCHAR(45) DEFAULT NULL,
      \`ejemplar\` ENUM('ORIGINAL','DUPLICADO','TRIPLICADO','CUATRIPLICADO','RECEPCION_VALORIZADA','OTRO') NOT NULL,
      \`firmado_cliente\` TINYINT(1) NOT NULL DEFAULT 0,
      \`firmado_intermediario\` TINYINT(1) NOT NULL DEFAULT 0,
      \`no_firmado\` TINYINT(1) NOT NULL DEFAULT 0,
      \`observaciones\` TEXT DEFAULT NULL,
      \`foto_url\` VARCHAR(500) DEFAULT NULL,
      \`foto_sharepoint_url\` VARCHAR(500) DEFAULT NULL,
      \`foto_nombre_archivo\` VARCHAR(255) DEFAULT NULL,
      \`firma_digital_base64\` LONGTEXT DEFAULT NULL,
      \`firma_receptor_aclaracion\` VARCHAR(150) DEFAULT NULL,
      \`firma_receptor_dni\` VARCHAR(40) DEFAULT NULL,
      \`organizacion_id_chofer\` INT DEFAULT NULL,
      \`usuario_email\` VARCHAR(150) DEFAULT NULL,
      \`fecha_hora\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uniq_remito_ejemplar\` (\`id_transaccion_remito\`, \`ejemplar\`),
      INDEX \`idx_are_remito\` (\`id_transaccion_remito\`),
      INDEX \`idx_are_etapa\` (\`id_etapa\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);
  console.log('✔ Tabla APP_REMITO_EJEMPLARES lista.');

  // 2.6 Crear tabla APP_ENTREGAS_LUGAR (entregas consolidadas por lugar de entrega y producto)
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`APP_ENTREGAS_LUGAR\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`transaccion_id\` INT NOT NULL,
      \`lugar_entrega\` VARCHAR(250) NOT NULL,
      \`productoid\` INT NOT NULL,
      \`producto_nombre\` VARCHAR(200) DEFAULT NULL,
      \`remitido_total\` INT NOT NULL DEFAULT 0,
      \`entregado_total\` INT NOT NULL DEFAULT 0,
      \`usuario_email\` VARCHAR(150) DEFAULT NULL,
      \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uniq_hr_lugar_prod\` (\`transaccion_id\`, \`lugar_entrega\`, \`productoid\`),
      INDEX \`idx_ael_tx\` (\`transaccion_id\`),
      INDEX \`idx_ael_prod\` (\`productoid\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);
  console.log('✔ Tabla APP_ENTREGAS_LUGAR lista.');

  // 2.7 Crear tabla APP_CAJONES_PALLETS (control unificado de cajones, pallets y observaciones por lugar/cliente)
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`APP_CAJONES_PALLETS\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`transaccion_id\` INT NOT NULL,
      \`id_etapa\` VARCHAR(45) DEFAULT NULL,
      \`lugar_entrega\` VARCHAR(250) NOT NULL,
      \`id_cliente\` INT DEFAULT NULL,
      \`cliente\` VARCHAR(200) NOT NULL,
      \`cajones_entregados\` INT NOT NULL DEFAULT 0,
      \`cajones_devueltos\` INT NOT NULL DEFAULT 0,
      \`pallets_entregados\` INT NOT NULL DEFAULT 0,
      \`pallets_devueltos\` INT NOT NULL DEFAULT 0,
      \`observaciones\` VARCHAR(500) DEFAULT NULL,
      \`usuario_email\` VARCHAR(150) DEFAULT NULL,
      \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uniq_hr_etapa_cliente\` (\`transaccion_id\`, \`id_etapa\`, \`cliente\`),
      INDEX \`idx_acp_tx_lugar\` (\`transaccion_id\`, \`lugar_entrega\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);
  console.log('✔ Tabla APP_CAJONES_PALLETS lista.');

  // 3. Sembrar usuarios iniciales
  const seedUsers = [
    {
      email: 'gabrielt@donyeyo.com.ar',
      nombre: 'Gabriel T. (SysAdmin)',
      rol: 'sysadmin',
      organizacion_id: null,
      codigo_chofer: null
    },
    {
      email: 'logistica@donyeyo.com.ar',
      nombre: 'Equipo Logística',
      rol: 'logistica',
      organizacion_id: null,
      codigo_chofer: null
    },
    {
      email: 'chofer.perez@donyeyo.com.ar',
      nombre: 'Gustavo Gorrese (Chofer Prueba)',
      rol: 'chofer',
      organizacion_id: 406,
      codigo_chofer: '20225751294'
    }
  ];

  for (const u of seedUsers) {
    await conn.query(
      `INSERT INTO \`APP_USUARIOS\` (\`email\`, \`nombre\`, \`rol\`, \`organizacion_id\`, \`codigo_chofer\`, \`activo\`, \`created_by\`)
       VALUES (?, ?, ?, ?, ?, 1, 'setup_glog_app')
       ON DUPLICATE KEY UPDATE
         \`nombre\` = VALUES(\`nombre\`),
         \`rol\` = VALUES(\`rol\`),
         \`organizacion_id\` = COALESCE(VALUES(\`organizacion_id\`), \`organizacion_id\`),
         \`codigo_chofer\` = COALESCE(VALUES(\`codigo_chofer\`), \`codigo_chofer\`),
         \`activo\` = 1`,
      [u.email, u.nombre, u.rol, u.organizacion_id, u.codigo_chofer]
    );
  }
  console.log('✔ Usuarios iniciales sembrados en APP_USUARIOS.');

  // 4. Intentar crear los triggers de AUDITORIA
  let createdCount = 0;
  let triggerBlockedReason = null;

  for (const trg of TRIGGER_DEFINITIONS) {
    try {
      await conn.query(`DROP TRIGGER IF EXISTS \`${trg.name}\``);
      await conn.query(`
        CREATE TRIGGER \`${trg.name}\` ${trg.timing} ON \`${trg.table}\`
        FOR EACH ROW
        BEGIN
          ${trg.body};
        END
      `);
      createdCount++;
    } catch (trgErr) {
      triggerBlockedReason = `${trgErr.code || trgErr.errno}: ${trgErr.message}`;
      console.warn(`⚠️ No se pudo crear trigger ${trg.name}: ${triggerBlockedReason}`);
      break;
    }
  }

  console.log(`\nTriggers creados: ${createdCount}/${TRIGGER_DEFINITIONS.length}`);
  if (triggerBlockedReason) {
    console.log('ℹ️  Para habilitar creación de triggers en AWS RDS por DBAdmin_Glog, el DBA debe configurar `log_bin_trust_function_creators = 1` en el Parameter Group de RDS o ejecutar `docs/dba_gestion_logistica_auditoria_triggers.sql` como adminMySql.');
  }

  await conn.end();
}

setup().catch((err) => {
  console.error('❌ Error en setup_glog_app:', err);
  process.exit(1);
});
