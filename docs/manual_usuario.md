# Manual de Usuario — Don Yeyo Logística (App Móvil para Choferes)
**Don Yeyo S.A. — Versión PWA 1.0.0**

---

## 1. Introducción y Objetivo
La aplicación **Don Yeyo Logística** es una Aplicación Web Progresiva (**PWA**) destinada a choferes de camiones propios y de empresas de transporte contratadas para registrar y validar digitalmente:
1. **Confirmación de Descarga (Entregas)**
2. **Devolución de Mercadería**
3. **Entrega y Devolución de Cajones**
4. **Firma y Control de Remitos**

---

## 2. Validación de Usuario (Microsoft Entra ID)
1. Al abrir la app en su teléfono móvil, ingrese su **correo corporativo** (formato email) y **contraseña**, o presione **"Inicia sesión con Microsoft"** para autenticarse mediante SSO con Microsoft Entra ID.
2. La aplicación valida las credenciales sin almacenar su contraseña en el teléfono.
3. Si las credenciales son rechazadas, se informará el error y no se permitirá el ingreso a los módulos operativos.

---

## 3. Selección de Hoja de Ruta (Pantalla Principal)
1. Tras iniciar sesión, visualizará el listado de **Hojas de Ruta a Entregar** asignadas a su correo, mostrando únicamente:
   * Número de **Hoja de Ruta**
   * **Fecha**
   * **Chofer**
   * **Patente Camión** y **Patente Acoplado**
2. Seleccione una Hoja de Ruta del listado para habilitar las 4 operaciones de la barra inferior: **Entregas**, **Devoluciones**, **Cajones** y **Remitos**.
3. No es posible registrar operaciones sin haber seleccionado previamente una Hoja de Ruta.

---

## 4. Módulos Operativos

### 4.1 Logística DY - Entregas (Confirmación de Descarga)
1. Muestra el encabezado de la hoja de ruta (`Hoja de Ruta`, `Fecha`, `Viaje`, `Chofer`, `Transporte`).
2. Los productos se agrupan en dos niveles: primero por **Lugar de Entrega** y luego por **Remito**.
3. En cada grilla (`Producto` | `Remitido` | `Entregado`), únicamente la columna **Entregado** es editable y acepta números enteros positivos (también cuenta con el atajo **"Completar vacíos con Remitido"**).
4. Presione **Guardar** al finalizar para registrar las cantidades efectivamente descargadas.

### 4.2 Logística DY - Devoluciones
1. Muestra los **Lugares de Entrega** y **Clientes** en tarjetas expandibles/colapsables. Si un lugar de entrega no tiene clientes asignados, permite buscar y agregar un cliente.
2. Dentro de cada cliente expandido, registre cada producto devuelto indicando: **Producto**, **Cantidad** (entero positivo > 0), **Vencimiento**, **Motivo** (obligatorio) y **Tipo** (**Físico** o **Virtual**).
3. Utilice el botón **+ Agregar** para sumar nuevos ítems y presione **Guardar** al pie para generar o actualizar los remitos de devolución.

### 4.3 Logística DY - Cajones
1. Permite registrar por cada cliente / parada de la hoja de ruta la cantidad de **Cajones Entregados**, **Cajones Devueltos**, visualizando automáticamente la **Diferencia** y permitiendo agregar **Observaciones**.
2. Presione **Guardar** para registrar el saldo con fecha, hora y usuario.

### 4.4 Logística DY - Remitos (Escaneo y Firma Digital)
1. Lista los remitos de la hoja de ruta seleccionada y permite presionar **"Escanear Código de Barras 1D del Remito"** (o usar **Ingreso Manual**).
2. En la ficha del remito, seleccione **Ejemplar**, **Estado de Firma** (`Cliente`, `Intermediario`, `No Firmado`), capture la **Firma Digital en Pantalla** (con aclaración y DNI opcional), tome la **Fotografía** (comprimida al 70% JPEG y enviada a SharePoint) y agregue observaciones antes de presionar **Confirmar y Guardar**.

---

## 5. Funcionamiento sin Señal (Modo Offline)
* Si pierde conexión a Internet en ruta, las entregas, devoluciones, cajones y controles de remitos se guardan localmente en **IndexedDB**.
* Al recuperar señal 4G/WiFi, la app sincroniza automáticamente todos los registros pendientes con el servidor central.
