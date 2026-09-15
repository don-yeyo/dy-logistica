# Manual de Usuario — Don Yeyo Logística (App Móvil para Choferes)
**Don Yeyo S.A. — Versión PWA 1.0.0**

---

## 1. Introducción y Objetivo
La aplicación **Don Yeyo Logística** es una Aplicación Web Progresiva (**PWA**) diseñada para que los choferes en ruta (camiones propios y transportistas contratados) puedan registrar y conformar remitos, validar descargas, capturar fotografías con compresión inteligente y asegurar la trazabilidad digital de las entregas en tiempo real o en modo offline.

---

## 2. Inicio de Sesión y Autenticación
1. Al ingresar a la app en su teléfono móvil, presione el botón **"Inicia sesión con Microsoft"**.
2. Utilice su correo corporativo institucional `@donyeyo.com.ar` y contraseña de Microsoft 365.
3. El sistema reconocerá automáticamente su número de legajo de chofer y las hojas de ruta asignadas.
4. Puede alternar entre el **Modo Claro** y el **Modo Oscuro** tocando el icono de Sol/Luna en la esquina superior derecha.

---

## 3. Dashboard Principal y Navegación
Tras iniciar sesión, accederá a la pantalla principal con una botonera táctil organizada en dos columnas:
* 📄 **Registrar Remito:** Activa la cámara en vivo para escanear el código de barras 1D del remito.
* 🚚 **Entregas de Mercadería:** Confirmación de descarga por cliente y lugar de entrega (*módulo para la siguiente fase*).
* 📦 **Devoluciones:** Registro de mercadería devuelta, vencimientos y motivos (*módulo para la siguiente fase*).
* 🗃️ **Movimiento de Cajones:** Control de entrega y retiro de envases plásticos (*módulo para la siguiente fase*).
* 📑 **Hojas de Ruta:** Consulta el listado de remitos y viajes asignados.

### Barra Inferior Fija (BottomBar)
Siempre disponible en la parte inferior de la pantalla:
* 🏠 **Inicio:** Regresa al Dashboard de acciones desde cualquier pantalla.
* 📷 **Escanear:** Acceso directo e instantáneo al escáner de cámara.
* 📑 **Viajes:** Lista de remitos de las últimas hojas de ruta.
* 💬 **Ayuda / Asistente Virtual:** Abre el Chatbot interactivo con el manual de usuario incorporado para responder cualquier duda en ruta.

---

## 4. ¿Cómo Registrar un Remito Paso a Paso?

### Paso 1: Escanear o Ingresar el Código
1. Presione **"Registrar Remito"** o el icono de la cámara en la barra inferior.
2. Apunte la cámara hacia el **código de barras 1D** impreso en el remito en papel (Code 128 o Code 39).
   * Puede encender la **Linterna (Torch)** si hay poca iluminación.
   * Si el papel está roto o arrugado, toque **"Ingreso Manual"** y escriba el número de comprobante o TransaccionId.
3. Al detectarlo, sonará un aviso sonoro ("Beep") y se abrirá la ficha de control.

### Paso 2: Registrar la Conformación
1. **Seleccionar Ejemplar:** Indique la copia que está controlando (Original, Duplicado, Triplicado, Cuatriplicado, Recepción Valorizada u Otro).
2. **Estado de Firma:**
   * 🟢 **Firmado por Cliente:** Recepción sellada/firmada en local o supermercado.
   * 🔵 **Firmado por Intermediario:** Conformado por operador logístico o distribuidor.
   * 🔴 **No Firmado / Rechazado:** Indicar si el cliente rechazó la mercadería o no firmó.
3. **Observaciones:** Puede escribir notas o tocar los atajos rápidos (*"Entregado sin novedades"*, *"Falta sello del local"*, *"Mercadería observada"*, etc.).

### Paso 3: Tomar la Fotografía
1. Toque **"Tomar Foto del Remito"** y encuadre el comprobante firmado.
2. La app comprimirá automáticamente la imagen en el teléfono al 70% JPEG (~150-300 KB) para ahorrar datos móviles.
3. Presione **"Guardar y Confirmar Remito"**. La foto se enviará automáticamente a SharePoint / Power Automate.

---

## 5. Funcionamiento sin Señal (Modo Offline)
* Si pierde la conexión a Internet en la calle, la app sigue funcionando con normalidad.
* Todos los escaneos, firmas y fotos se guardan en la memoria segura del teléfono (**IndexedDB**).
* En la parte superior verá el indicador **Offline** y la cantidad de controles pendientes.
* Apenas su dispositivo recupere señal 4G/WiFi, la app sincronizará automáticamente todos los remitos pendientes con el servidor central. También puede forzar el envío tocando la barra de sincronización.

---

## 6. Preguntas Frecuentes (FAQ)

### ¿Qué hago si la cámara no lee el código de barras?
Presione el botón **"Ingreso Manual"** e ingrese el número de comprobante (ej: `R-0050-00487512`) o el `TransaccionId` de Finnegans impreso en el documento.

### ¿Qué pasa si tomo una foto borrosa?
En la pantalla de control, presione **"Volver a tomar foto"** antes de guardar para capturar una nueva toma más nítida.

### ¿Cómo sé si un remito ya fue controlado?
En la lista de remitos de la hoja de ruta, los remitos controlados aparecen con una insignia verde de **"FIRMADO CLIENTE"** o azul de **"INTERMEDIARIO"**, mientras que los no controlados indican **"PENDIENTE"**.

### ¿Cómo cambio entre tema claro y oscuro?
Toque el icono de **Sol / Luna** en la barra superior o en el menú lateral para alternar la visualización según la luz del día o la noche.
