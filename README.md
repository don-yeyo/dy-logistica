# Don Yeyo S.A. - Control de Remitos para Choferes (DY-LOGISTICA-APP)

Aplicación Web Progresiva (**PWA**) mobile-first de alta velocidad diseñada específicamente para que los choferes de Don Yeyo S.A. en ruta puedan **escanear directamente con la cámara de su dispositivo el código de barras 1D (Code 128 / Code 39)** del remito en papel (correspondiente al `TransaccionId`), identificar el remito de forma instantánea y registrar:
1. **Ejemplar del comprobante** (`Original`, `Duplicado`, `Triplicado`, `Cuatriplicado`, `Recepción Valorizada`, `Otro`).
2. **Estado de firma y receptor** (Firmado por Cliente, Firmado por Intermediario, No Firmado / Rechazado).
3. **Tipo de documento de respaldo** (*Remito Tradicional*, *Recepción Valorizada*, *Otro Documento*).
4. **Observaciones con atajos táctiles**.
5. **Captura de fotografía optimizada** con compresión en el dispositivo (70% JPEG).

---

## 🚀 Características Principales

* 🧭 **Dashboard de Acciones Mobile-First**: Botonera optimizada en 2 columnas sin scroll para smartphones con acceso directo a "Registrar Remito", "Entregas", "Devoluciones", "Cajones" y "Hojas de Ruta".
* 📱 **Barra Inferior Persistente (BottomNav)**: Navegación inferior fija con soporte de área segura (`safe-area-inset-bottom`), acceso instantáneo a **Inicio**, botón central destacado para **Escanear**, **Viajes** y **Ayuda**.
* 💬 **Chatbot y Asistente Virtual Integrado**: Modal interactivo de ayuda que responde consultas de choferes en tiempo real a partir del documento [`docs/manual_usuario.md`](file:///c:/Users/gabrielt/Documents/Proyectos/Logistica/dy_logistica_app/docs/manual_usuario.md) con sugerencias rápidas (FAQ) y búsqueda contextual.
* 🌓 **Modo Oscuro / Claro**: Soporte completo de temas corporativo Don Yeyo con persistencia y toggle en Header, Drawer y Login.
* 📋 **Menú Drawer Lateral Deslizable**: Navegación categorizada con accesos rápidos y branding Don Yeyo S.A.
* 📷 **Escáner 1D con Cámara en Vivo**: Decodifica en tiempo real códigos de barras 1D (**Code 128** y **Code 39**) impresos en los remitos en papel, decodificando el `TransaccionId` de Finnegans al instante.
* 🔦 **Soporte de Linterna / Torch & Sonido Beep**: Botón de linterna integrado para condiciones de poca luz y feedback sonoro/háptico al detectar el código.
* ⌨️ **Ingreso Manual Alternativo**: Modal con teclado virtual numérico para ingresar el `TransaccionId` o `Comprobante` si el papel está deteriorado o arrugado.
* 📑 **Selector de Ejemplar**:
  * ⚪ **Original** (Blanco)
  * 🟡 **Duplicado** (Color)
  * 🔵 **Triplicado** (Contabilidad)
  * 🟣 **Cuatriplicado** (Transporte)
  * 🟢 **Recepción Valorizada** (Adjunta)
  * ⚪ **Otro** (Especial / Anexo)
* ✍️ **Botonera de Firma Simplificada**:
  * 🟢 **Firmado por CLIENTE** (Sucursal de Supermercado / Negocio).
  * 🔵 **Firmado por INTERMEDIARIO** (Distribuidor u Operador Logístico).
  * 🔴 **NO Firmado / Rechazado**.
* 📱 **PWA Mobile-First & Táctil**: Diseñada para pantalla táctil en ruta ("para dedos grandes"), con botones de alto contraste y respuesta inmediata.
* 📷 **Compresión de Fotos al 70% Client-Side**: Las fotos capturadas se redimensionan y comprimen en el navegador a JPEG al 70% antes del envío (~150-300 KB).
* ☁️ **Integración SharePoint / Power Automate**: Las fotos se envían en Base64 a Power Automate con la nomenclatura estandarizada:
  `FOTO_CAM_CHOFER_<codigoChofer>_<comprobante>_<timestamp>.jpg`.
* 📶 **Soporte Completo Offline**: Si el chofer se queda sin señal en la calle, el escaneo y los controles se consultan y guardan en IndexedDB local y se sincronizan automáticamente en segundo plano apenas se recupera la conexión.
* 🔐 **SSO Microsoft Entra ID**: Autenticación corporativa con Office 365 y resolución automática de roles y código de chofer mediante la tabla de usuarios local.

---

## 📁 Estructura del Monorepo

```
dy_logistica_app/
├── package.json               # Scripts globales con concurrently
├── .gitignore                 # Reglas Git para Node, Vite y entornos
├── README.md                  # Documentación del proyecto
├── docs/
│   ├── manual_usuario.md      # Manual de usuario para choferes (Base del Chatbot)
│   └── Especificacion Funcional app Choferes.docx
├── schema.sql                 # Script SQL para tablas MySQL y datos de prueba
├── client/                    # Frontend React 18 + Vite + PWA
│   ├── package.json
│   ├── vite.config.js         # Configuración Vite + VitePWA
│   ├── .env.template          # Plantilla de entorno exclusiva del Frontend
│   ├── public/
│   │   ├── favicon.ico
│   │   ├── logo.png
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   └── src/
│       ├── index.css          # Vanilla CSS con tokens Don Yeyo y dark-theme
│       ├── main.jsx           # Entrypoint React + ThemeProvider + PWA
│       ├── App.jsx            # Contenedor y enrutador dinámico
│       ├── config/
│       │   ├── AuthContext.jsx # Proveedor de contexto y gestor offline
│       │   ├── ThemeContext.jsx # Proveedor de tema Claro / Oscuro
│       │   └── msalConfig.js   # Configuración Microsoft Entra ID
│       ├── components/
│       │   ├── Header.jsx      # Header con menú hamburguesa, tema y avatar
│       │   ├── Drawer.jsx      # Menú lateral deslizable categorizado
│       │   ├── BottomNav.jsx   # Barra inferior persistente con safe-area
│       │   ├── HelpChatModal.jsx # Chatbot interactivo de asistencia al chofer
│       │   ├── SearchBar.jsx   # Buscador predictivo
│       │   ├── RemitoCard.jsx  # Tarjeta táctil de remito
│       │   ├── CameraCapture.jsx # Módulo de cámara con compresión 70%
│       │   ├── BottomBar.jsx   # Barra de acciones de detalle
│       │   └── OfflineBanner.jsx # Notificación flotante de sincronización
│       ├── pages/
│       │   ├── Dashboard.jsx   # Dashboard de acciones (2 columnas sin scroll)
│       │   ├── ScanHome.jsx    # Escaneo 1D con cámara activa
│       │   ├── RemitosList.jsx # Lista de remitos con selector de viajes
│       │   ├── RemitoDetail.jsx # Detalle de control y firma
│       │   └── Login.jsx       # Login Microsoft SSO y Mock Dev
│       └── services/
│           ├── api.js          # Cliente HTTP Axios
│           ├── imageCompressor.js # Compresor HTML5 Canvas al 70%
│           └── offlineStorage.js # Almacenamiento local IndexedDB
└── server/                    # Backend API Express.js
    ├── package.json
    ├── .env.template          # Plantilla de entorno exclusiva del Backend
    ├── index.js               # Entrypoint Express + Helmet + CORS + Rate Limit
    ├── config/
    │   └── db.js              # Pool MySQL2 (Promise)
    ├── middlewares/
    │   ├── authMiddleware.js  # Resolución de chofer por email
    │   └── uploadMiddleware.js # Multer para uploads de imágenes
    ├── services/
    │   └── sharepointService.js # Despacho a SharePoint / Power Automate
    ├── controllers/
    │   ├── authController.js
    │   └── remitosController.js
    └── routes/
        ├── authRoutes.js
        └── remitosRoutes.js
```

---

## 🛠️ Instalación y Puesta en Marcha

### 1. Requisitos Previos
* Node.js v18 o superior.
* MySQL / MariaDB (o instancia AWS RDS).

### 2. Instalación de Dependencias
Ejecutar en la raíz del proyecto para instalar tanto las dependencias de raíz como las de `client` y `server`:
```bash
npm run install-all
```

### 3. Configuración de Base de Datos
Importar el archivo `schema.sql` en su servidor MySQL:
```bash
mysql -u root -p < schema.sql
```
*Esto creará la base de datos `Firma_de_remitos`, las tablas `usuarios` y `remitos` extendidas y cargará datos semilla de ejemplo para los viajes `HR-8942`, `HR-8941`, `HR-8940` y `HR-8939`.*

### 4. Variables de Entorno
Cada subproyecto gestiona sus propias variables de entorno de forma desacoplada y clara:
* **Backend (`server/.env`)**: Copiar `server/.env.template` a `server/.env` y configurar conexión MySQL (`DB_HOST`, `DB_USER`, `DB_PASSWORD`), puerto, y credenciales de SharePoint / Power Automate.
* **Frontend (`client/.env`)**: Copiar `client/.env.template` a `client/.env` y configurar `VITE_AZURE_AD_CLIENT_ID`, `VITE_AZURE_AD_TENANT_ID` y opciones de compresión/mock.

### 5. Iniciar en Modo Desarrollo (Frontend + Backend en Simultáneo)
```bash
npm run dev
```
* **Frontend**: `http://localhost:3000`
* **Backend API**: `http://localhost:5000`

---

## ☁️ Despliegue en Netlify (Serverless Full-Stack)

El proyecto está 100% configurado para desplegarse en **Netlify** de forma unificada:
- **Frontend SPA / PWA**: Se compila y publica desde `client/dist`.
- **Backend API Serverless**: Se ejecuta a través de la función serverless [`netlify/functions/api.js`](file:///c:/Users/gabrielt/Documents/Proyectos/Logistica/dy_logistica_app/netlify/functions/api.js) envolviendo la app modular [`server/app.js`](file:///c:/Users/gabrielt/Documents/Proyectos/Logistica/dy_logistica_app/server/app.js) con `serverless-http`.
- **Enrutamiento y Proxy**: [`netlify.toml`](file:///c:/Users/gabrielt/Documents/Proyectos/Logistica/dy_logistica_app/netlify.toml) redirige automáticamente cualquier petición a `/api/*` hacia la función serverless y el resto a `/index.html` para la SPA.

### Variables de Entorno para Configurar en Netlify (`Site Settings > Environment Variables`)

#### 1. Variables de Frontend (PWA / Cliente)
| Variable | Valor Recomendado en Producción | Descripción |
| :--- | :--- | :--- |
| `VITE_API_URL` | `/api` | Ruta relativa para proxy transparente hacia Netlify Functions |
| `VITE_AZURE_AD_CLIENT_ID` | `8d66bceb-6e2b-4cd7-8ed3-31046f8c22ad` | ID de la aplicación registrada en Microsoft Entra ID (Público) |
| `VITE_AZURE_AD_TENANT_ID` | `fd8a7e94-3179-471f-b79c-a64f8bfc8536` | ID del Directorio / Inquilino Entra ID (Público) |
| `VITE_AZURE_AD_REDIRECT_URI` | `https://tu-sitio.netlify.app` *(o dominio personalizado)* | URL de retorno autorizada tras el login SSO |
| `VITE_MOCK_AUTH` | `false` | **Obligatorio en producción**: Exige autenticación real por SSO |
| `VITE_IMAGE_COMPRESSION_QUALITY` | `0.70` | Calidad de compresión client-side en canvas (JPEG 70%) |
| `VITE_IMAGE_MAX_WIDTH` | `1920` | Ancho máximo en px para redimensionar fotos antes de enviar |
| `VITE_IMAGE_MAX_HEIGHT` | `1920` | Alto máximo en px para redimensionar fotos antes de enviar |

#### 2. Variables de Backend (Netlify Functions Serverless)
| Variable | Valor en Producción | Descripción |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Entorno de ejecución |
| `DB_HOST` | `dydb2-instance-1.cz8kik28igwg.us-east-1.rds.amazonaws.com` | Endpoint de base de datos MySQL en AWS RDS |
| `DB_PORT` | `3306` | Puerto de conexión MySQL |
| `DB_NAME` | `Firma_de_remitos` | Nombre de la base de datos |
| `DB_USER` | `DBAdmin_Firma_de_Remitos` | Usuario de base de datos |
| `DB_PASSWORD` | *(Contraseña privada RDS)* | Contraseña segura de MySQL |
| `DB_SSL` | `true` | Conexión encriptada SSL/TLS hacia AWS RDS |
| `DB_CONNECTION_LIMIT` | `5` | Límite conservador de conexiones por instancia Lambda |
| `MAX_VIAJES_HISTORICOS_DEFAULT` | `4` | Cantidad de hojas de ruta históricas a recuperar |
| `AZURE_AD_TENANT_ID` | `fd8a7e94-3179-471f-b79c-a64f8bfc8536` | Tenant ID de Entra ID para validación de servicios |
| `AZURE_AD_CLIENT_ID` | `8d66bceb-6e2b-4cd7-8ed3-31046f8c22ad` | Client ID de la App en Entra ID |
| `AZURE_AD_CLIENT_SECRET` | *(Secreto privado Azure)* | Secreto de cliente confidencial (Sólo Backend) |
| `ENABLE_SHAREPOINT_UPLOAD` | `true` *(o `false` para pruebas)* | Activa el envío automático de fotos a Power Automate |
| `POWERAUTOMATE_URL` | *(URL de flujo Power Automate)* | Webhook HTTP de Power Automate para almacenar en SharePoint |
| `SHAREPOINT_FQDN` | `https://donyeyo.sharepoint.com` | FQDN base de SharePoint |

---

## 🔒 Flujo de Identificación y Roles

1. El chofer inicia sesión mediante el botón **"Ingresar con Microsoft SSO"** con su cuenta `@donyeyo.com.ar`.
2. El frontend envía el correo autenticado en el encabezado `x-user-email`.
3. El backend consulta la tabla `usuarios` buscando coincidencia por `email`:
   * Obtiene su `codigo_chofer` (ej. `32355`), su `nombre` y su `rol`.
4. El sistema filtra únicamente los remitos donde `transportistas` contenga dicho código o donde el chofer haya sido asignado en las últimas N hojas de ruta.

---

## 📸 Nomenclatura de Fotos en SharePoint

Cada imagen capturada por la cámara del chofer es procesada automáticamente y guardada/enviada con el formato:
```
FOTO_CAM_CHOFER_<codigoChofer>_<comprobante>_<timestamp>.jpg
```
*Ejemplo:* `FOTO_CAM_CHOFER_32355_R-0050-00487512_20260914170000.jpg`

---

## 📶 Modo de Funcionamiento Offline

La PWA utiliza `IndexedDB` y `Service Workers` de la siguiente manera:
1. Al cargar remitos con conexión, se guarda una copia en el store `remitos_cache`.
2. Si se pierde la señal, el chofer puede seguir buscando y marcando remitos.
3. El control se guarda en la cola `pending_controls` y la tarjeta actualiza su estado visual en pantalla inmediatamente.
4. Al reconectarse a Internet, la aplicación detecta el evento `online` y envía automáticamente el lote de controles pendientes al endpoint `/api/remitos/sync-offline`.

