# Contrato de integración Terrasacha — Historial satelital de lotes

> **Estado:** VIGENTE. Contrato verificado contra el código del proveedor
> (repos `geoMapasDocker` backend FastAPI, `oraculo_terrasacha` Flutter) el
> 2026-10-07. Implementado en AgroChain en los commits `75f34af`, `8deac2b`
> y `a011dfd`.

## Objetivo

Mostrar en el detalle de un **lote** un apartado **Historial satelital** con
imágenes del área de producción (polígono de la parcela del lote) para ver la
evolución del predio en el tiempo.

## Decisiones cerradas

1. **La UI vive solo en el lote**: componente `HistorialSatelital.tsx` dentro de
   `apps/web/src/app/(dashboard)/lotes/[id]/page.tsx`.
2. **Solo true color (RGB)**. NDVI **no** está expuesto por la API de imágenes
   del proveedor (solo existe en el pipeline de ML/biomasa de `analisis/routes.py`,
   fuera de alcance). Los satélites true color usan `B4,B3,B2`.
3. **Solo consulta en vivo**: NO se persisten las imágenes en BD; cada búsqueda
   va contra el proveedor bajo demanda.
4. **Las credenciales nunca llegan al browser**: viven en env del backend
   (`TERRASACHA_USERNAME` / `TERRASACHA_PASSWORD`) y el proxy propio de AgroChain
   las usa. Auth por **cuenta de servicio Cognito** (USER_PASSWORD_AUTH).
5. **Entrada geoespacial**: el polígono vigente de la **parcela** del lote
   (`parcela_poligonos`, tabla `14_poligonos_predio_parcela.sql`) es el área de
   interés (AOI). El lote resuelve su parcela vía `parcelaId`.

## Backend del proveedor

- **Base URL:** `https://qi3fmd7w53.us-east-1.awsapprunner.com` (FastAPI, App Runner).
- **Auth:** `POST /api/v1/login` con
  `{ "AuthFlow": "USER_PASSWORD_AUTH", "ClientId": "5hqqat9foeutr909sr19o7jse0",
     "AuthParameters": { "USERNAME": "...", "PASSWORD": "..." } }`
  → `AuthenticationResult.IdToken` (Bearer en el resto de llamadas).
  - La cuenta de servicio necesita permiso sobre el tag **`analisis`**
    (`require_permission`; admin o grupo `DNT_DEFAULT_GROUP` pasan).
  - `X-Internal-Token` existe en el código pero **no está cableado**: no sirve de bypass.
- **Endpoints usados:**
  - `POST /api/v1/satellites-imagenes/search`
    - body: `{ satellite, coordenadas: [[lon,lat],...], year_initial, month_initial,
      day_initial, year_final, month_final, day_final, nubosidad }`
    - resp: `{ images: [{ id, fecha, satellite_id, satelite, nubosidad }], total_encontradas }`
  - `POST /api/v1/previsualizar-imagen`
    - body: `{ image_id, satellite, bandas: ["B4","B3","B2"], coordenadas: [[lon,lat],...] }`
    - resp: `{ tiles, min, max, name }` — `tiles` es una plantilla XYZ de Earth Engine.
  - `GET /api/v1/satellites/catalog` — catálogo de satélites y bandas (no usado aún).
- **Satélites soportados:** `S2` (Sentinel-2 SR, 10 m — recomendado), `LC08`/`LC09`
  (Landsat 8/9, 30 m), `S1` (SAR, solo polarizaciones), `ALOS`, `MOD13A1`/`MOD11A1`/`MOD14A1`.
- **Formato de coordenadas:** anillo **cerrado** `[[lon,lat],...]` (el backend
  lo pasa a `ee.Geometry.Polygon`).

## Arquitectura implementada

```
lotes/[id]/page.tsx
  └─ HistorialSatelital.tsx (client, Leaflet)
        │  GET /api/lotes/:id/satelital?satellite&desde&hasta&nubosidad
        │  GET /api/lotes/:id/satelital/preview?imageId&satellite&bandas
        ▼
apps/web/src/app/api/lotes/[id]/satelital/...  (route handlers proxy → API)
        ▼
apps/api/src/routes/lotes.ts  (autenticado, acotado por alcance)
        │  resuelve parcelaId → polígono vigente (parcela_poligonos)
        ▼
apps/api/src/services/terrasacha.ts  (login cacheado + buscarEscenas + previsualizar)
        ▼
API Terrasacha
```

### Piezas

| Archivo | Rol |
|---|---|
| `apps/api/src/services/terrasacha.ts` | Cliente: login Cognito con caché de IdToken, `buscarEscenas`, `previsualizarEscena`, `coordenadasParcelaDesdeGeoJson`, `isTerrasachaConfigured`. |
| `apps/api/src/routes/lotes.ts` | Rutas proxy `GET /api/lotes/:id/satelital` y `.../satelital/preview`. |
| `apps/web/src/app/api/lotes/[id]/satelital/route.ts` | Route handler proxy (busca escenas). |
| `apps/web/src/app/api/lotes/[id]/satelital/preview/route.ts` | Route handler proxy (previsualización). |
| `apps/web/src/app/(dashboard)/lotes/[id]/HistorialSatelital.tsx` | UI Leaflet: filtros, lista de escenas, overlay de tiles. |

## Respuesta del proxy (la que consume la web)

`GET /api/lotes/:id/satelital`:

```jsonc
{
  "success": true,
  "satelite": "S2",
  "desde": "2025-10-07",
  "hasta": "2026-10-07",
  "images": [
    { "id": "COPERNICUS/S2_SR_HARMONIZED/...", "fecha": "2026-09-15",
      "satellite_id": "S2", "satelite": "Sentinel 2 SR - Surface Reflectance", "nubosidad": 8.2 }
  ],
  "total_encontradas": 12
}
```

`GET /api/lotes/:id/satelital/preview`:

```jsonc
{ "success": true, "tiles": "https://earthengine.googleapis.com/.../{z}/{x}/{y}", "min": 0, "max": 0.3, "name": "Imagen Sentinel 2 SR" }
```

## Manejo de errores

| Situación | HTTP |
|---|---|
| Credenciales Terrasacha vacías | `503` (proxy responde claro, no falla) |
| Lote fuera del alcance del usuario | `403`/`404` |
| Parcela sin polígono vigente / geometría inválida | `400` con motivo |
| Satélite o parámetros inválidos (proveedor) | `400` |
| Credenciales rechazadas por Terrasacha | `502` |
| Proveedor caído / timeout (30 s) | `502`/`504` |

## Configuración

Variables en `.env.example` (raíz) y `apps/api/.env`:

```
TERRASACHA_API_BASE_URL=https://qi3fmd7w53.us-east-1.awsapprunner.com
TERRASACHA_CLIENT_ID=5hqqat9foeutr909sr19o7jse0
TERRASACHA_USERNAME=
TERRASACHA_PASSWORD=
```

Con `USERNAME`/`PASSWORD` vacíos el proxy responde `503`; el usuario debe
llenarlas con las credenciales de la cuenta de servicio.

## Pendientes

- [ ] Credenciales de la cuenta de servicio (`TERRASACHA_USERNAME`/`PASSWORD`).
- [ ] Verificación end-to-end con datos reales una vez configuradas.
- [ ] Evaluar exponer el catálogo (`GET /api/v1/satellites/catalog`) para poblar
      bandas por satélite en la UI (hoy hardcodeadas `B4,B3,B2`).
