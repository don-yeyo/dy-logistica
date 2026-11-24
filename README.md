# Don Yeyo S.A. - Portal Logístico y App Móvil para Choferes (DY-LOGISTICA-APP)

Plataforma logística integral para **Don Yeyo S.A.** conectada directamente a la base de datos real del ERP (**`Gestion_Logistica`**), compuesta por:

1. **Gestor de Escritorio** (`sysadmin` y `logistica`):
   - **Dashboard operativo** con KPIs de hojas de ruta activas, entregas confirmadas, diferencias/faltantes, devoluciones, balance de cajones y usuarios activos.
   - **Seguimiento de Hojas de Ruta, Devoluciones/Faltantes y Control de Cajones** (excluyendo firma de remitos, gestionada en otro aplicativo).
   - **Gestión de Usuarios, Roles y Mapeo ERP** (`APP_USUARIOS` vinculado a `ORGANIZACION.Organizacionid`): un `sysadmin` gestiona todos los roles (`sysadmin`, `logistica`, `chofer`); `logistica` gestiona únicamente usuarios `chofer`.
   - **Auditoría DB (Triggers MySQL)** (exclusivo `sysadmin`): bitácora completa (`AUDITORIA`) de `INSERT`, `UPDATE` y `DELETE` sobre las tablas operativas clave.
   - *(Próximo módulo)*: bandeja de devoluciones y faltantes preparada como insumo para la generación de solicitudes de **Notas de Crédito** por Logística.

2. **App Móvil PWA para Choferes** (`chofer` + vista previa opcional para `sysadmin`):
   - **Selección de Hoja de Ruta** desde `HOJAS_DE_RUTA_A_ENTREGAR`, filtrada por la organización/chofer mapeado al usuario.
   - **Entregas**: confirmación de descarga (`ITEMS_A_ENTREGAR` → `HOJA_RUTA_ITEM_REMITO`).
   - **Devoluciones**: registro maestro-detalle por cliente y producto (`REMITO_DEVOLUCIONES`, `REMITO_DEVOLUCIONES_ITEMS`).
   - **Cajones**: control de entregas, devoluciones y diferencias (`REMITOS_CAJONES_X_ETAPA` / `REMITO_CAJONES`).
   - **Remitos**: escaneo 1D, receptor, **Firma Digital**, fotografía comprimida al 70% JPEG y subida a SharePoint / Power Automate.
   - **Modo Offline completo** en IndexedDB (`idb`) con sincronización automática al recuperar señal.

---

## 🔐 Autenticación SSO y Roles (RBAC)

* **Login exclusivo con Microsoft 365 (Entra ID)**: mediante `@azure/msal-browser` (`loginPopup`). Si el token corporativo en caché sigue vigente (`acquireTokenSilent`), la sesión se restaura automáticamente sin volver a pedir credenciales.
* **Roles**:
  * `sysadmin`: acceso total al Gestor de Escritorio (incluyendo Auditoría DB y alta de cualquier rol) + vista previa de App Mobile.
  * `logistica`: acceso al Gestor de Escritorio (Dashboard, seguimiento de Hojas de Ruta, Devoluciones/Faltantes, Cajones) y gestión exclusiva de usuarios con rol `chofer`.
  * `chofer`: acceso exclusivo a la App Mobile PWA con sus hojas de ruta filtradas según su `organizacion_id` mapeado en `APP_USUARIOS`.

---

## 📁 Estructura del Monorepo

```
dy_logistica_app/
├── package.json               # Scripts globales con concurrently
├── .gitignore                 # Reglas Git para Node, Vite y entornos
├── netlify.toml               # Configuración de despliegue Netlify + Functions
├── README.md                  # Documentación del proyecto
├── schema.sql                 # Script SQL histórico de referencia
├── docs/
│   ├── manual_usuario.md      # Manual de usuario para choferes (Base del Chatbot)
│   ├── Especificacion Funcional app Choferes.docx
│   ├── dba_gestion_logistica_ajustes.sql          # Ajustes pendientes sugeridos al DBA
│   └── dba_gestion_logistica_auditoria_triggers.sql # DDL de AUDITORIA y triggers
├── netlify/functions/api.js   # Wrapper serverless para Express API
├── client/                    # Frontend React 18 + Vite + PWA
│   ├── package.json
│   ├── vite.config.js         # Configuración Vite + VitePWA
│   ├── .env.template          # Plantilla de entorno del Frontend
│   └── src/
│       ├── index.css          # Estilos PWA Mobile + Gestor de Escritorio + dark-theme
│       ├── App.jsx            # Ruteo por rol (Gestor Escritorio / App Choferes)
│       ├── config/
│       │   ├── AuthContext.jsx # SSO Microsoft + acquireTokenSilent + Sync Offline
│       │   ├── ThemeContext.jsx
│       │   └── msalConfig.js
│       ├── components/        # Componentes PWA Mobile
│       ├── pages/             # Páginas PWA Mobile + Login SSO
│       ├── pages/admin/       # Gestor de Escritorio (Dashboard, Seguimiento, Usuarios, Auditoría)
│       │   ├── AdminLayout.jsx
│       │   ├── AdminDashboard.jsx
│       │   ├── AdminHojasRuta.jsx
│       │   ├── AdminDevoluciones.jsx
│       │   ├── AdminCajones.jsx
│       │   ├── AdminUsuarios.jsx
│       │   └── AdminAuditoria.jsx
│       └── services/
│           ├── api.js
│           ├── imageCompressor.js
│           └── offlineStorage.js
└── server/                    # Backend API Express.js
    ├── package.json
    ├── .env.template
    ├── index.js
    ├── app.js
    ├── setup_glog_app.js      # Crea APP_USUARIOS, AUDITORIA y 22 triggers en Gestion_Logistica
    ├── config/db.js           # Pool único a Gestion_Logistica + withAuditConnection
    ├── middlewares/
    │   ├── authMiddleware.js  # Resolución de usuario y requireRole()
    │   └── uploadMiddleware.js
    ├── services/
    │   └── sharepointService.js
    ├── controllers/
    │   ├── authController.js
    │   ├── hojasRutaController.js
    │   ├── remitosController.js
    │   └── adminController.js # Endpoints del Gestor de Escritorio (/api/admin/*)
    └── routes/
        ├── authRoutes.js
        ├── hojasRutaRoutes.js
        ├── remitosRoutes.js
        └── adminRoutes.js
```

---

## 🛠️ Instalación y Puesta en Marcha

### 1. Requisitos Previos
* Node.js v18 o superior.
* Acceso a MySQL 8.x / AWS RDS **`Gestion_Logistica`**. *(La conexión anterior a `Firma_de_remitos` fue deprecada).*

### 2. Instalación de Dependencias
```bash
npm run install-all
```

### 3. Inicialización de Tablas de App y Triggers de Auditoría
Ejecutar una única vez (idempotente) el script de configuración en `Gestion_Logistica`, que crea `APP_USUARIOS`, `AUDITORIA` y los **22 triggers** (`AFTER INSERT/UPDATE/DELETE`) sobre `APP_USUARIOS`, `HOJA_RUTA_ITEM_REMITO`, `REMITO_DEVOLUCIONES`, `REMITO_DEVOLUCIONES_ITEMS`, `REMITO_CAJONES`, `REMITO_CAJONES_ITEMS`, `REMITOS_FIRMADOS` y `REMITO`:
```bash
node server/setup_glog_app.js
```
> Nota: El script SQL completo de auditoría y triggers también está disponible para el DBA en [`docs/dba_gestion_logistica_auditoria_triggers.sql`](file:///c:/Users/gabrielt/Documents/Proyectos/Logistica/dy_logistica_app/docs/dba_gestion_logistica_auditoria_triggers.sql), y los ajustes opcionales sobre tablas ERP existentes en [`docs/dba_gestion_logistica_ajustes.sql`](file:///c:/Users/gabrielt/Documents/Proyectos/Logistica/dy_logistica_app/docs/dba_gestion_logistica_ajustes.sql).

### 4. Variables de Entorno

#### Backend (`server/.env`)
| Variable | Ejemplo / Descripción |
| :--- | :--- |
| `NODE_ENV` | `development` / `production` |
| `PORT` | `5000` |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSL`, `DB_CONNECTION_LIMIT` | Conexión única a MySQL / AWS RDS **`Gestion_Logistica`** |
| `ALLOW_UNASSIGNED_HR_FALLBACK` | `true` en dev / `false` en producción |
| `CAJONES_TIPO_ENTREGA`, `CAJONES_TIPO_DEVOLUCION` | Códigos numéricos de `REMITO_CAJONES.tipo` (`1` entrega, `2` devolución) |
| `MAX_VIAJES_HISTORICOS_DEFAULT` | `4` (cantidad histórica de remitos) |
| `MAX_HOJAS_RUTA_LIST` | `20` (cantidad máxima de hojas de ruta en app móvil) |
| `AZURE_AD_TENANT_ID`, `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET` | Credenciales de Microsoft Entra ID |
| `ENABLE_SHAREPOINT_UPLOAD`, `POWERAUTOMATE_URL`, `SHAREPOINT_FQDN` | Envío de fotos a SharePoint |

#### Frontend (`client/.env`)
| Variable | Ejemplo / Descripción |
| :--- | :--- |
| `VITE_API_URL` | `/api` |
| `VITE_AZURE_AD_CLIENT_ID`, `VITE_AZURE_AD_TENANT_ID`, `VITE_AZURE_AD_REDIRECT_URI` | Configuración MSAL Entra ID (`localStorage` cache) |
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

### Autenticación y App Móvil
* `GET /api/auth/me` — Datos del usuario autenticado (`rol`, `organizacion_id`, `codigo_chofer`).
* `GET /api/auth/users` — Listado de usuarios de prueba (solo desarrollo).
* `GET /api/hojas-ruta` — Lista `HOJAS_DE_RUTA_A_ENTREGAR` (filtrada por `organizacion_id` cuando `rol === 'chofer'`).
* `GET /api/hojas-ruta/:transaccionId/entregas` y `PUT /api/hojas-ruta/:transaccionId/entregas`
* `GET /api/hojas-ruta/:transaccionId/devoluciones` y `POST /api/hojas-ruta/:transaccionId/devoluciones`
* `GET /api/hojas-ruta/:transaccionId/cajones` y `POST /api/hojas-ruta/:transaccionId/cajones`
* `GET /api/remitos/mis-remitos`, `GET /api/remitos/buscar`, `PUT /api/remitos/:id/control`, `POST /api/remitos/upload-foto`, `POST /api/remitos/sync-offline`.

### Gestor de Escritorio (`/api/admin`, requiere `sysadmin` o `logistica`)
* `GET /api/admin/dashboard` — KPIs operativos, avance y resumen reciente.
* `GET /api/admin/hojas-ruta` y `GET /api/admin/hojas-ruta/:transaccionId` — Seguimiento detallado de entregas, devoluciones y cajones.
* `GET /api/admin/devoluciones` — Consolidado de devoluciones y faltantes (insumo para futuras Notas de Crédito).
* `GET /api/admin/cajones` — Balance de cajones con filtro de diferencias.
* `GET/POST/PUT/DELETE /api/admin/usuarios` y `GET /api/admin/organizaciones` — Gestión de usuarios con RBAC y mapeo ERP.
* `GET /api/admin/auditoria` *(solo `sysadmin`)* — Bitácora de triggers sobre `AUDITORIA`.
