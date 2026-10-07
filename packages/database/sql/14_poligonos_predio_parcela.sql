-- =============================================================================
-- AGROCHAIN - Poligono georreferenciado de Predio y Parcela
-- Mismo patron que lote_poligonos (ver 02_eudr.sql): GeoJSON crudo en jsonb,
-- versionado (nunca se edita in-place), columna "vigente" para la version
-- activa. Tabla aparte, no columna en predios/parcelas, para que los
-- listados (GET /api/predios, GET /api/parcelas) no carguen el poligono —
-- solo se consulta en el detalle cuando se necesita ver el mapa.
-- =============================================================================

CREATE TABLE predio_poligonos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  predio_id          uuid NOT NULL REFERENCES predios(id),
  geojson            jsonb NOT NULL,
  area_ha_calculada  double precision,
  fuente             varchar(50) NOT NULL DEFAULT 'DIBUJADO_MANUAL', -- DIBUJADO_MANUAL | GPS_CAMPO | KML_IMPORTADO
  version            integer NOT NULL DEFAULT 1,
  vigente            boolean NOT NULL DEFAULT true,
  creado_por         uuid NOT NULL REFERENCES usuarios(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (predio_id, version)
);
CREATE UNIQUE INDEX idx_predio_poligono_vigente ON predio_poligonos(predio_id) WHERE vigente;

CREATE TABLE parcela_poligonos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcela_id         uuid NOT NULL REFERENCES parcelas(id),
  geojson            jsonb NOT NULL,
  area_ha_calculada  double precision,
  fuente             varchar(50) NOT NULL DEFAULT 'DIBUJADO_MANUAL',
  version            integer NOT NULL DEFAULT 1,
  vigente            boolean NOT NULL DEFAULT true,
  creado_por         uuid NOT NULL REFERENCES usuarios(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parcela_id, version)
);
CREATE UNIQUE INDEX idx_parcela_poligono_vigente ON parcela_poligonos(parcela_id) WHERE vigente;

GRANT SELECT, INSERT, UPDATE, DELETE ON predio_poligonos, parcela_poligonos TO agrochain_app;
REVOKE TRUNCATE ON predio_poligonos, parcela_poligonos FROM agrochain_app;
