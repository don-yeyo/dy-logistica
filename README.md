# Don Yeyo S.A. - App Móvil para Choferes (DY-LOGISTICA-APP)

Aplicación Web Progresiva (**PWA**) mobile-first para choferes de camiones propios y empresas de transporte contratadas de Don Yeyo S.A., diseñada para registrar y validar digitalmente las operaciones de la hoja de ruta:

1. **Autenticación corporativa Microsoft Entra ID** (Email + Contraseña o SSO Popup).
2. **Selección de Hoja de Ruta** desde `HOJAS_DE_RUTA_A_ENTREGAR` filtrada por el email del chofer.
3. **Logística DY - Entregas**: Confirmación de descarga por `Lugar_de_Entrega` y `Remito` (`ITEMS_A_ENTREGAR` -> `HOJA_RUTA_ITEM_REMITO`).
4. **Logística DY - Devoluciones**: Registro maestro-detalle por `Lugar_de_Entrega` y `Cliente` expandibles (`HOJA_DE_RUTA_DEVOLUCIONES` -> `REMITO_DEVOLUCIONES` y `REMITO_DEVOLUCIONES_ITEMS`), con productos `Físico` / `Virtual`.
5. **Logística DY - Cajones**: Control de entrega, devolución, diferencias calculadas y observaciones (`HOJA_RUTA_CAJONES`).
6. **Logística DY - Remitos**: Escaneo 1D (Code 128 / Code 39), ingreso manual, ejemplar, receptor, **Firma Digital en pantalla**, foto comprimida al 70% JPEG y subida a SharePoint / Power Automate.

---

## 🚀 Características Principales

* 🔐 **Validación de Usuario (Sección 4.1)**: Login mediante email y contraseña contra Microsoft Entra ID (sin almacenar la contraseña en el dispositivo) y soporte SSO Microsoft Popup (`@azure/msal-browser`).
* 📋 **Hojas de Ruta a Entregar (Sección 4.2)**: Pantalla inicial post-login consultando `HOJAS_DE_RUTA_A_ENTREGAR` filtrada por `EMail`, exhibiendo únicamente `Hoja_de_ruta`, `Fecha`, `Chofer`, `Patente_camion` y `Patente_acoplado` (conservando `Transaccionid` y `EMail` internamente).
* 📦 **Confirmación de Descarga — `Entregas` (Sección 4.2.1)**: Agrupación en dos cortes de control (`Lugar_de_Entrega` -> `Remito`), grilla con `Producto`, `Remitido` y campo editable `Entregado` validado estrictamente para enteros positivos. Actualiza `HOJA_RUTA_ITEM_REMITO.cantidad_descargada_Chofer` por `Hojarutaitemid`.
* 🔄 **Devolución de Mercadería — `Devoluciones` (Sección 4.2.2)**: Acordeones en dos niveles (`Lugar_de_Entrega` -> `Cliente`), buscador para agregar clientes/productos, campos `Producto`, `Cantidad`, `Vencimiento`, `Motivo` y `Tipo` (`Físico` o `Virtual`), y guardado transaccional en `REMITO_DEVOLUCIONES` y `REMITO_DEVOLUCIONES_ITEMS`.
* 🗃️ **Movimiento de Cajones — `Cajones` (Sección 4.2.3)**: Registro de cajones entregados, devueltos, cálculo automático de diferencias y comentarios por cliente en `HOJA_RUTA_CAJONES`.
* ✍️ **Firma y Escaneo de Remitos — `Remitos` (Sección 4.2.4)**: Escáner de códigos de barras 1D con linterna y beep, captura de **Firma Digital táctil** en pantalla (`SignaturePad`) con aclaración/DNI, selección de ejemplar, compresión de foto al 70% JPEG y envío a SharePoint vía Power Automate.
* 📶 **Modo Offline Completo**: Almacena cachés y encola operaciones de `entregas`, `devoluciones`, `cajones` y `remito` en IndexedDB (`idb`) para sincronizar automáticamente al recuperar señal.
* 💬 **Asistente Virtual / Ayuda y Modo Oscuro/Claro**: Chatbot basado en [`docs/manual_usuario.md`](file:///c:/Users/gabrielt/Documents/Proyectos/Logistica/dy_logistica_app/docs/manual_usuario.md) y soporte de temas Claro/Oscuro.

---

## 📁 Estructura del Monorepo

```
dy_logistica_app/
├── package.json               # Scripts globales con concurrently
├── .gitignore                 # Reglas Git para Node, Vite y entornos
├── netlify.toml               # Configuración de despliegue Netlify + Functions
├── README.md                  # Documentación del proyecto
├── schema.sql                 # Script SQL completo (tablas y vistas)
├── docs/
│   ├── manual_usuario.md      # Manual de usuario para choferes (Base del Chatbot)
│   └── Especificacion Funcional app Choferes.docx
├── netlify/functions/api.js   # Wrapper serverless para Express API
├── client/                    # Frontend React 18 + Vite + PWA
│   ├── package.json
│   ├── vite.config.js         # Configuración Vite + VitePWA
│   ├── .env.template          # Plantilla de entorno del Frontend
│   └── src/
│       ├── index.css          # Vanilla CSS con tokens Don Yeyo y dark-theme
│       ├── App.jsx            # Flujo principal: Hoja de Ruta -> Módulos
│       ├── config/
│       │   ├── AuthContext.jsx # Autenticación Entra ID + Sync Offline unificado
│       │   ├── ThemeContext.jsx
│       │   └── msalConfig.js
│       ├── components/
│       │   ├── Header.jsx
│       │   ├── Drawer.jsx
│       │   ├── BottomNav.jsx  # Entregas, Devoluciones, Cajones, Remitos
│       │   ├── HojaRutaHeader.jsx # Encabezado operativo reutilizable
│       │   ├── SignaturePad.jsx # Lienzo táctil de firma digital
│       │   ├── HelpChatModal.jsx
│       │   ├── AlertModal.jsx
│       │   ├── SearchBar.jsx
│       │   ├── RemitoCard.jsx
│       │   ├── CameraCapture.jsx
│       │   ├── BottomBar.jsx
│       │   └── OfflineBanner.jsx
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── HojasRutaPage.jsx # Listado de hojas de ruta asignadas
│       │   ├── EntregasPage.jsx  # Logística DY - Entregas
│       │   ├── DevolucionesPage.jsx # Logística DY - Devoluciones
│       │   ├── CajonesPage.jsx   # Logística DY - Cajones
│       │   ├── RemitosList.jsx   # Logística DY - Remitos
│       │   ├── ScanHome.jsx      # Escáner 1D con cámara
│       │   └── RemitoDetail.jsx  # Control, firma digital y fotografía
│       └── services/
│           ├── api.js
│           ├── imageCompressor.js
│           └── offlineStorage.js
└── server/                    # Backend API Express.js
    ├── package.json
    ├── .env.template
    ├── index.js
    ├── app.js
    ├── migrate.js             # Migración idempotente RDS + vistas SQL
    ├── config/db.js
    ├── middlewares/
    │   ├── authMiddleware.js
    │   └── uploadMiddleware.js
    ├── services/
    │   └── sharepointService.js
    ├── controllers/
    │   ├── authController.js
    │   ├── hojasRutaController.js
    │   └── remitosController.js
    └── routes/
        ├── authRoutes.js
        ├── hojasRutaRoutes.js
        └── remitosRoutes.js
```

---

## 🛠️ Instalación y Puesta en Marcha

### 1. Requisitos Previos
* Node.js v18 o superior.
* MySQL 8.x / AWS RDS (`Firma_de_remitos`).

### 2. Instalación de Dependencias
```bash
npm run install-all
```

### 3. Base de Datos y Migración
Ejecutar la migración idempotente contra MySQL/RDS (crea/actualiza tablas, catálogos, vistas `HOJAS_DE_RUTA_A_ENTREGAR`, `ITEMS_A_ENTREGAR`, `HOJA_DE_RUTA_DEVOLUCIONES` y datos semilla):
```bash
node server/migrate.js
```
O importar desde cero con [`schema.sql`](file:///c:/Users/gabrielt/Documents/Proyectos/Logistica/dy_logistica_app/schema.sql).

### 4. Variables de Entorno

#### Backend (`server/.env`)
| Variable | Ejemplo / Descripción |
| :--- | :--- |
| `NODE_ENV` | `development` / `production` |
| `PORT` | `5000` |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSL`, `DB_CONNECTION_LIMIT` | Conexión a MySQL / AWS RDS `Firma_de_remitos` |
| `MAX_VIAJES_HISTORICOS_DEFAULT` | `4` (cantidad histórica de remitos) |
| `MAX_HOJAS_RUTA_LIST` | `20` (cantidad máxima de hojas de ruta en pantalla inicial) |
| `AZURE_AD_TENANT_ID`, `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET` | Credenciales de Microsoft Entra ID |
| `ALLOW_DEV_PASSWORD_LOGIN`, `DEV_LOGIN_PASSWORD` | Validación local controlada de pruebas (`false` en producción) |
| `ENABLE_SHAREPOINT_UPLOAD`, `POWERAUTOMATE_URL`, `SHAREPOINT_FQDN` | Envío de fotos a SharePoint |

#### Frontend (`client/.env`)
| Variable | Ejemplo / Descripción |
| :--- | :--- |
| `VITE_API_URL` | `/api` |
| `VITE_AZURE_AD_CLIENT_ID`, `VITE_AZURE_AD_TENANT_ID`, `VITE_AZURE_AD_REDIRECT_URI` | Configuración MSAL Entra ID |
| `VITE_MOCK_AUTH`, `VITE_DEFAULT_MOCK_EMAIL` | Selector rápido de desarrollo (`false` en producción) |
| `VITE_IMAGE_COMPRESSION_QUALITY`, `VITE_IMAGE_MAX_WIDTH`, `VITE_IMAGE_MAX_HEIGHT` | Compresión de imágenes JPEG al 70% |

### 5. Iniciar en Modo Desarrollo
```bash
npm run dev
```
* **Frontend**: `http://localhost:3000`
* **Backend API**: `http://localhost:5000`

---

## 🔌 Endpoints Principales de la API

* `POST /api/auth/login` — Valida email + contraseña contra Microsoft Entra ID (y modo dev configurado).
* `GET /api/auth/me` — Datos del chofer autenticado.
* `GET /api/hojas-ruta` — Lista `HOJAS_DE_RUTA_A_ENTREGAR` filtrando por `EMail`.
* `GET /api/hojas-ruta/:transaccionId/entregas` — Consulta `ITEMS_A_ENTREGAR` por `Transaccionid`.
* `PUT /api/hojas-ruta/:transaccionId/entregas` — Actualiza `HOJA_RUTA_ITEM_REMITO.cantidad_descargada_Chofer` por `Hojarutaitemid`.
* `GET /api/hojas-ruta/:transaccionId/devoluciones` — Consulta `HOJA_DE_RUTA_DEVOLUCIONES` y catálogos.
* `POST /api/hojas-ruta/:transaccionId/devoluciones` — Inserta/actualiza `REMITO_DEVOLUCIONES` y `REMITO_DEVOLUCIONES_ITEMS`.
* `GET /api/hojas-ruta/:transaccionId/cajones` y `POST /api/hojas-ruta/:transaccionId/cajones` — Consulta y guarda movimientos en `HOJA_RUTA_CAJONES`.
* `GET /api/remitos/mis-remitos`, `GET /api/remitos/buscar`, `PUT /api/remitos/:id/control`, `POST /api/remitos/upload-foto`, `POST /api/remitos/sync-offline`.
