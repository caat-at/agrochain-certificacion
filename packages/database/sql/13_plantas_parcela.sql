-- =============================================================================
-- AGROCHAIN - Plantas pertenecen a la parcela, no al lote
-- Hasta ahora plantas.lote_id era FK 1:1 obligatoria: cada planta pertenecia
-- a un unico lote. Esto es incorrecto para cultivos perennes (cafe, cacao,
-- platano, aguacate): la planta vive en la parcela de forma permanente, se
-- siembra una vez y se cosecha muchas veces (cada cosecha = un lote nuevo)
-- sin retirarse fisicamente. Para cultivos anuales (maiz, frijol) la planta
-- si se retira tras la cosecha y el siguiente lote necesita plantas nuevas.
--
-- Se introduce:
--   - catalogo "especies" con tipo_ciclo (PERENNE/ANUAL), para que el sistema
--     sepa si debe sugerir reusar plantas existentes de la parcela.
--   - plantas.parcela_id (la planta ahora cuelga de la parcela).
--   - tabla puente lote_plantas (relacion N:M planta<->lote/cosecha).
--
-- plantas.lote_id se deja NULLABLE (deprecated) en esta migracion; el DROP
-- real de la columna va en una migracion de limpieza posterior, mismo patron
-- de dos pasos que uso 08_parcelas_ubicacion.sql -> 12_lotes_via_parcela.sql.
-- =============================================================================

-- 1) Catalogo de especies con tipo de ciclo
CREATE TABLE IF NOT EXISTS especies (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_cientifico  varchar(150) UNIQUE NOT NULL,
  nombre_comun       varchar(100) NOT NULL,
  tipo_ciclo         varchar(20) NOT NULL CHECK (tipo_ciclo IN ('PERENNE', 'ANUAL')),
  activo             boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now()
);

INSERT INTO especies (nombre_cientifico, nombre_comun, tipo_ciclo) VALUES
  ('Coffea arabica',       'Cafe',     'PERENNE'),
  ('Theobroma cacao',      'Cacao',    'PERENNE'),
  ('Musa paradisiaca',     'Platano',  'PERENNE'),
  ('Persea americana',     'Aguacate', 'PERENNE'),
  ('Zea mays',             'Maiz',     'ANUAL'),
  ('Phaseolus vulgaris',   'Frijol',   'ANUAL'),
  ('Solanum tuberosum',    'Papa',     'ANUAL'),
  ('Oryza sativa',         'Arroz',    'ANUAL')
ON CONFLICT (nombre_cientifico) DO NOTHING;

-- 2) plantas.parcela_id + backfill desde lote_id -> lotes.parcela_id
ALTER TABLE plantas ADD COLUMN IF NOT EXISTS parcela_id uuid REFERENCES parcelas(id);

UPDATE plantas p SET parcela_id = l.parcela_id
FROM lotes l
WHERE l.id = p.lote_id AND p.parcela_id IS NULL;

ALTER TABLE plantas ALTER COLUMN parcela_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plantas_parcela ON plantas(parcela_id);

-- 3) Tabla puente lote_plantas (relacion N:M planta<->lote/cosecha)
CREATE TABLE IF NOT EXISTS lote_plantas (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id               uuid NOT NULL REFERENCES lotes(id),
  planta_id             uuid NOT NULL REFERENCES plantas(id),
  fecha_vinculacion     timestamptz NOT NULL DEFAULT now(),
  fecha_desvinculacion  timestamptz,
  vinculado_por         uuid NOT NULL REFERENCES usuarios(id),
  UNIQUE (lote_id, planta_id)
);
CREATE INDEX IF NOT EXISTS idx_lote_plantas_lote ON lote_plantas(lote_id);
CREATE INDEX IF NOT EXISTS idx_lote_plantas_planta ON lote_plantas(planta_id);

-- 4) Backfill: cada planta existente genera su vinculo 1:1 actual
INSERT INTO lote_plantas (lote_id, planta_id, fecha_vinculacion, vinculado_por)
SELECT p.lote_id, p.id, p.created_at, p.registrado_por
FROM plantas p
WHERE NOT EXISTS (
  SELECT 1 FROM lote_plantas lp WHERE lp.lote_id = p.lote_id AND lp.planta_id = p.id
);

-- 5) Unicidad de codigo/numero de planta: de (lote_id, *) a (parcela_id, *)
--    (la parcela es ahora el espacio fisico permanente, igual criterio que
--    parcelas.codigo_parcela)
ALTER TABLE plantas DROP CONSTRAINT IF EXISTS plantas_lote_id_codigo_planta_key;
ALTER TABLE plantas DROP CONSTRAINT IF EXISTS plantas_lote_id_numero_planta_key;
ALTER TABLE plantas ADD CONSTRAINT plantas_parcela_id_codigo_planta_key UNIQUE (parcela_id, codigo_planta);
ALTER TABLE plantas ADD CONSTRAINT plantas_parcela_id_numero_planta_key UNIQUE (parcela_id, numero_planta);

-- 6) plantas.lote_id pasa a deprecated (nullable). DROP real en una
--    migracion de limpieza posterior, tras confirmar que nada la lee.
ALTER TABLE plantas ALTER COLUMN lote_id DROP NOT NULL;
COMMENT ON COLUMN plantas.lote_id IS 'DEPRECATED - usar lote_plantas. Pendiente DROP en migracion de limpieza.';

GRANT SELECT, INSERT, UPDATE, DELETE ON especies, lote_plantas TO agrochain_app;
