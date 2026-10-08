# Contrato de integración Terrasacha — Historial satelital de lotes

> **Estado:** BORRADOR. Pendiente la documentación oficial de la API (endpoints,
> autenticación, formato de respuesta). Este documento fija las decisiones ya
> tomadas y el contrato esperado para que mañana se construya sin fricción.

## Objetivo

Mostrar en el detalle de un **lote** un apartado **Historial** con imágenes
satelitales del área de producción (polígono de la parcela del lote), lo que
permite ver la evolución del predio en el tiempo (color real + vegetación NDVI).

## Decisiones cerradas (2026-10-07)

1. **La UI vive solo en el lote**: sección `Historial satelital` dentro de
   `apps/web/src/app/(dashboard)/lotes/[id]/page.tsx`.
2. **Tipos de imagen**: true color (RGB) **y** NDVI, en línea de tiempo.
3. **Solo consulta en vivo**: NO se persisten las imágenes en BD; cada fecha se
   consulta al proveedor bajo demanda.
4. **La API key nunca llega al browser**: se configura como variable de entorno
   del backend (`TERRASACHA_API_KEY`) y un proxy propio de AgroChain la usa.
5. **Entrada geoespacial**: el polígono vigente de la **parcela** del lote
   (`parcela_poligonos`, tabla `14_poligonos_predio_parcela.sql`) es el área de
   interés (AOI). El lote resuelve su parcela vía `parcelaId`.

## Contexto geoespacial disponible (ya existe)

- `parcela_poligonos`: GeoJSON crudo en `geojson jsonb`, versionado, índice único
  de vigente. Rutas: `GET/POST/DELETE /api/parcelas/:id/poligono`
  (`apps/api/src/routes/parcelas.ts:163-273`).
- `predio_poligonos`: mismo patrón a nivel predio (`apps/api/src/routes/predios.ts:204`).
- Mapa Leaflet ya integrado: `apps/web/src/components/PoligonoMapa.tsx` (modo
  `soloLectura` ideal para superponer imágenes sin edición).
- `GET /api/lotes/:id` (`apps/api/src/routes/lotes.ts:109`) devuelve `parcelaId`
  y `parcelaNombre`. El detalle de lote ya las consume (`lotes/[id]/page.tsx:33`).

## Arquitectura prevista

```
lotes/[id]/page.tsx (Historial satelital)
        │  GET /api/lotes/:id/satelital (autenticado, proxy propio)
        ▼
apps/api/src/routes/lotes.ts
        │  resuelve parcelaId → poligono vigente (parcela_poligonos)
        │  llama a la API de Terrasacha con TERRASACHA_API_KEY
        ▼
respuesta JSON estandarizada para la web (ver contrato abajo)
```

## Contrato de respuesta esperado del proxy (a zapear cuando llegue la API real)

```jsonc
{
  "loteId": "uuid",
  "parcelaId": "uuid",
  "poligono": { "geojson": {...}, "areaHaCalculada": 12.5, "fuente": "manual" },
  "imagenes": [
    {
      "tipo": "TRUE_COLOR" | "NDVI" | "TRUE_COLOR_MASKED" | "NDVI_MASKED",
      "fecha": "2026-09-15",
      "url": "https://cdn.terrasatcha.../imagen.png",
      "coberturaNube": 8.2,
      "resolucionM": 10
    }
  ]
}
```

> El contrato real se define al leer los docs del proveedor; hoy es una plantilla
> razonable que la UI puede consumir.

## Pendientes (requerido para construir)

- [ ] Documentación oficial de la API Terrasacha (endpoints, auth por API key).
- [ ] Crear la imagen/Área de interés en Terrasacha a partir del GeoJSON,
      o endpoint que acepte el polígono directo (según el proveedor).
- [ ] Mapear: lote → parcela → polígono → AOI del proveedor.
- [ ] Definir env `TERRASACHA_API_KEY` en `apps/api/.env` + `.env.example`.
- [ ] Determinar si la API soporta fechas históricas (para el historial) o solo
      "última imagen disponible".

## Checklist de build (cuando haya endpoints)

1. Ruta proxy `GET /api/lotes/:id/satelital` en `lotes.ts`, autenticada, que
   resuelve el polígono de la parcela y consulta el proveedor.
2. Cliente Terrasacha aislado en `apps/api/src/lib/` (fetch + key + tipos).
3. Manejo de errores: proveedor caído / lote sin polígono / parcela sin polígono
   → respuestas 400/502 claras, sin key expuesta.
4. Componente `HistorialSatelital.tsx` en `lotes/[id]/` (fetch, línea de tiempo,
   selector TRUE_COLOR/NDVI, mapa Leaflet de solo lectura con el polígono).
5. Docs de la integración (este archivo) marcado como VIGENTE.