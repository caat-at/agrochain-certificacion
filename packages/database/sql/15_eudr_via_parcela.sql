-- =============================================================================
-- AGROCHAIN - Modulo EUDR pasa de LOTE a PARCELA (area fisica de produccion)
-- La norma (Reglamento UE 2023/1115) exige georreferenciar el "production plot"
-- fisico, no el ciclo de cosecha — un mismo terreno (parcela) puede producir
-- muchos lotes a lo largo del tiempo, y todos comparten el mismo poligono y la
-- misma declaracion de libre-deforestacion. Vincular por lote obligaba a
-- redibujar/redeclarar lo mismo para cada cosecha, lo cual no refleja la norma.
--
-- Mismo patron de dos pasos ya usado en 12_lotes_via_parcela.sql y
-- 13_plantas_parcela.sql: agregar columna nueva + backfill + dejar la columna
-- vieja nullable/deprecated en esta migracion; el DROP real va en una
-- migracion de limpieza posterior, tras confirmar en produccion que nada la lee.
-- =============================================================================

-- ── lote_poligonos: lote_id -> parcela_id ───────────────────────────────────
ALTER TABLE lote_poligonos ADD COLUMN IF NOT EXISTS parcela_id uuid REFERENCES parcelas(id);

UPDATE lote_poligonos lp
SET parcela_id = l.parcela_id
FROM lotes l
WHERE l.id = lp.lote_id AND lp.parcela_id IS NULL;

ALTER TABLE lote_poligonos ALTER COLUMN parcela_id SET NOT NULL;

-- El indice/constraint de "una vigente por lote" pasa a "una vigente por parcela".
DROP INDEX IF EXISTS idx_lote_poligono_vigente;
CREATE UNIQUE INDEX idx_parcela_poligono_eudr_vigente ON lote_poligonos(parcela_id) WHERE vigente;

-- La version ahora es por parcela, no por lote (puede haber colisiones de
-- version si varios lotes de la misma parcela ya tenian poligono propio;
-- esto es aceptable porque los datos reales en produccion solo tienen 1
-- poligono en estado BORRADOR, sin declaraciones FIRMADAS que dependan de el).
ALTER TABLE lote_poligonos DROP CONSTRAINT IF EXISTS lote_poligonos_lote_id_version_key;
ALTER TABLE lote_poligonos ADD CONSTRAINT lote_poligonos_parcela_id_version_key UNIQUE (parcela_id, version);

ALTER TABLE lote_poligonos ALTER COLUMN lote_id DROP NOT NULL;
COMMENT ON COLUMN lote_poligonos.lote_id IS 'DEPRECATED — el poligono EUDR ahora vive en parcela_id, ver 15_eudr_via_parcela.sql';

-- ── eudr_declaraciones: lote_id -> parcela_id ───────────────────────────────
ALTER TABLE eudr_declaraciones ADD COLUMN IF NOT EXISTS parcela_id uuid REFERENCES parcelas(id);

UPDATE eudr_declaraciones ed
SET parcela_id = l.parcela_id
FROM lotes l
WHERE l.id = ed.lote_id AND ed.parcela_id IS NULL;

ALTER TABLE eudr_declaraciones ALTER COLUMN parcela_id SET NOT NULL;

DROP INDEX IF EXISTS idx_eudr_declaraciones_lote;
CREATE INDEX idx_eudr_declaraciones_parcela ON eudr_declaraciones(parcela_id);

ALTER TABLE eudr_declaraciones ALTER COLUMN lote_id DROP NOT NULL;
COMMENT ON COLUMN eudr_declaraciones.lote_id IS 'DEPRECATED — la declaracion EUDR ahora vive en parcela_id, ver 15_eudr_via_parcela.sql';
