-- =============================================================================
-- AGROCHAIN - Eliminar lotes.predio_id (redundante con lotes.parcela_id ->
-- parcelas.predio_id)
--
-- Contexto: lotes tenia predio_id y parcela_id simultaneamente. Como una
-- parcela ya sabe a que predio pertenece, guardar tambien predio_id en lotes
-- duplicaba el dato -- y al mover una parcela de predio (ver
-- EditarParcelaBtn.tsx), los lotes que ya tenia quedaban con predio_id
-- desincronizado (bug real detectado: lote COL-05-2026-00005 seguia
-- apuntando al predio viejo tras mover su parcela). Todo el codigo que leia
-- lotes.predio_id ya fue migrado para resolverlo via JOIN con parcelas
-- (packages/database/src/db/queries.ts).
-- =============================================================================

DROP INDEX IF EXISTS idx_lotes_predio;
ALTER TABLE lotes DROP COLUMN IF EXISTS predio_id;
