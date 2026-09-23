-- =============================================================================
-- AGROCHAIN - Traduccion al espanol del catalogo STBN (PNSS 0000404)
-- El texto en ingles (nombre/descripcion_alto/descripcion_bajo) es el oficial
-- del documento del certificador y se conserva sin tocar, para trazabilidad
-- ante una auditoria internacional. Estas columnas son la traduccion que
-- ve el evaluador colombiano en la UI — sembradas en
-- packages/database/src/seed/stbn-subcriterios.ts junto con el resto del
-- catalogo.
-- =============================================================================

ALTER TABLE stbn_subcriterios
  ADD COLUMN IF NOT EXISTS nombre_es           varchar(200),
  ADD COLUMN IF NOT EXISTS descripcion_alto_es text,
  ADD COLUMN IF NOT EXISTS descripcion_bajo_es text;
