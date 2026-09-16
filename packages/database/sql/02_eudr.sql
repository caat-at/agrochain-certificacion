-- =============================================================================
-- AGROCHAIN - Modulo EUDR (Reglamento UE 2023/1115, deforestacion-cero)
-- Requisito para certificacion PNSS 0000404 (STBN) de PlanetAI Nature Space.
-- Vinculado a nivel de LOTE (area de produccion especifica), no de Predio:
-- el documento STBN exige georreferenciar "production areas" y el certificado
-- de ejemplo pide area + producto especifico — un mismo predio puede tener
-- lotes con historiales de uso de suelo distintos.
-- Solo modelo de datos + flujo manual: SIN integracion a APIs satelitales.
-- =============================================================================

-- ── Poligono georreferenciado del lote ──────────────────────────────────────
-- Complementa (no reemplaza) latitud/longitud puntual ya existente en `lotes`
-- via `plantas`. GeoJSON crudo, sin PostGIS: no hay consultas espaciales
-- automaticas todavia (se podria agregar una columna `geom geometry` derivada
-- despues, sin migracion destructiva, si se integra una API satelital).
CREATE TABLE lote_poligonos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id            uuid NOT NULL REFERENCES lotes(id),
  geojson            jsonb NOT NULL,
  area_ha_calculada  double precision,
  fuente             varchar(50) NOT NULL DEFAULT 'DIBUJADO_MANUAL', -- DIBUJADO_MANUAL | GPS_CAMPO | KML_IMPORTADO
  version            integer NOT NULL DEFAULT 1,
  vigente            boolean NOT NULL DEFAULT true,
  creado_por         uuid NOT NULL REFERENCES usuarios(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lote_id, version)
);
CREATE UNIQUE INDEX idx_lote_poligono_vigente ON lote_poligonos(lote_id) WHERE vigente;

-- ── Declaracion de cumplimiento EUDR ─────────────────────────────────────────
-- Una declaracion vigente por lote. fecha_corte fija por regulacion (31-dic-2020)
-- pero se deja como columna, no constante hardcodeada, por si la UE la cambia
-- en una version futura de EUDR.
CREATE TABLE eudr_declaraciones (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id             uuid NOT NULL REFERENCES lotes(id),
  poligono_id         uuid NOT NULL REFERENCES lote_poligonos(id),
  fecha_corte         date NOT NULL DEFAULT '2020-12-31',
  libre_deforestacion boolean NOT NULL,
  fecha_declaracion   timestamptz NOT NULL DEFAULT now(),
  declarado_por       uuid NOT NULL REFERENCES usuarios(id),
  -- SHA256(loteId + poligonoId + fechaCorte + libreDeforestacion + declaradoPor + timestamp)
  -- generado con generarContentHashDeclaracionEudr (packages/database/src/lib/hash.ts)
  content_hash        varchar(64) UNIQUE NOT NULL,
  estado              varchar(20) NOT NULL DEFAULT 'BORRADOR', -- BORRADOR | FIRMADA | ANCLADA_BLOCKCHAIN | RECHAZADA
  tx_hash             varchar(66),
  observaciones       text,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_eudr_declaraciones_lote ON eudr_declaraciones(lote_id);

-- ── Evidencia satelital cargada manualmente ─────────────────────────────────
-- Documento + hash, sin API automatica. `evidencia_binaria` se crea en la
-- Fase 4 (S3) — esta tabla depende de ella, por eso el modulo EUDR se activa
-- despues de tener S3 funcionando.
CREATE TABLE eudr_evidencias_satelitales (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  declaracion_id       uuid NOT NULL REFERENCES eudr_declaraciones(id),
  tipo_evidencia       varchar(30) NOT NULL, -- IMAGEN_SATELITAL | REPORTE_NDVI | CERTIFICADO_TERCERO | OTRO
  descripcion          text,
  fecha_captura        date,
  fuente_declarada     varchar(150), -- texto libre, ej. "Sentinel-2 (descarga manual Copernicus Browser)"
  evidencia_binaria_id uuid NOT NULL, -- FK a evidencia_binaria(id), agregada en 03_evidencia.sql (Fase 4)
  cargado_por          uuid NOT NULL REFERENCES usuarios(id),
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_eudr_evidencias_declaracion ON eudr_evidencias_satelitales(declaracion_id);

-- ── Puente Certificado <-> Declaracion EUDR ─────────────────────────────────
-- Regla de negocio: un Certificado tipo STBN no puede emitirse sin una
-- declaracion EUDR FIRMADA/ANCLADA_BLOCKCHAIN con libre_deforestacion=true.
-- Se valida en la ruta de emision (apps/api/src/routes/eudr.ts), esta tabla
-- deja el vinculo trazable y auditable.
CREATE TABLE certificado_eudr_requisitos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificado_id  uuid UNIQUE NOT NULL REFERENCES certificados(id),
  declaracion_id  uuid NOT NULL REFERENCES eudr_declaraciones(id),
  cumple_umbral   boolean NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Inmutabilidad ────────────────────────────────────────────────────────────
-- Mismo principio que 01_immutability.sql: una declaracion FIRMADA/ANCLADA no
-- puede editar su content_hash ni el veredicto libre_deforestacion.
CREATE OR REPLACE FUNCTION prevent_eudr_declaracion_mutation() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.estado IN ('FIRMADA', 'ANCLADA_BLOCKCHAIN') THEN
    IF NEW.content_hash != OLD.content_hash OR NEW.libre_deforestacion != OLD.libre_deforestacion THEN
      RAISE EXCEPTION 'declaracion EUDR firmada es inmutable en su veredicto/hash (id: %)', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_eudr_declaraciones_immutable
  BEFORE UPDATE ON eudr_declaraciones
  FOR EACH ROW EXECUTE FUNCTION prevent_eudr_declaracion_mutation();

CREATE OR REPLACE FUNCTION prevent_eudr_declaracion_delete() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'eudr_declaraciones es inmutable: DELETE no permitido (id: %)', OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_eudr_declaraciones_no_delete
  BEFORE DELETE ON eudr_declaraciones
  FOR EACH ROW EXECUTE FUNCTION prevent_eudr_declaracion_delete();

-- GRANT primero (las tablas son nuevas de este archivo, el GRANT ALL TABLES
-- de 00_schema.sql corrio antes de que existieran) y REVOKE selectivo
-- despues — el orden importa: un GRANT posterior anularia el REVOKE.
GRANT SELECT, INSERT, UPDATE, DELETE ON lote_poligonos, eudr_declaraciones, eudr_evidencias_satelitales, certificado_eudr_requisitos TO agrochain_app;

REVOKE DELETE ON eudr_declaraciones FROM agrochain_app;
REVOKE TRUNCATE ON eudr_declaraciones, lote_poligonos FROM agrochain_app;
