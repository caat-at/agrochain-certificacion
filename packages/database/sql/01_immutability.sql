-- =============================================================================
-- AGROCHAIN - Inmutabilidad reforzada a nivel de Postgres
-- Patron replicado de SSE (db/immutability.sql): triggers BEFORE UPDATE/DELETE
-- que garantizan integridad de hashes incluso si el codigo de aplicacion falla
-- =============================================================================

-- ── aportes_tecnicos ─────────────────────────────────────────────────────────
-- El aporte de un tecnico es atomico desde el momento en que se crea: nunca se
-- borra, y sus campos/hashes declarados nunca cambian (si el tecnico se
-- equivoca, se re-registra la planta completa via reregistrar, no se edita).
CREATE OR REPLACE FUNCTION prevent_aporte_mutation() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'aportes_tecnicos es inmutable: DELETE no permitido (id: %)', OLD.id;
  END IF;
  IF NEW.content_hash != OLD.content_hash
     OR NEW.campos::text != OLD.campos::text
     OR NEW.foto_hash IS DISTINCT FROM OLD.foto_hash
     OR NEW.audio_hash IS DISTINCT FROM OLD.audio_hash THEN
    RAISE EXCEPTION 'campos/hashes de aporte son inmutables (id: %)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_aportes_immutable
  BEFORE UPDATE OR DELETE ON aportes_tecnicos
  FOR EACH ROW EXECUTE FUNCTION prevent_aporte_mutation();

-- ── registros_planta ─────────────────────────────────────────────────────────
-- El contentHash del registro (Nivel 2) es inmutable una vez estado=COMPLETO.
-- DELETE nunca permitido (un registro ADULTERADO/INVALIDADO se preserva para
-- auditoria forense; se re-registra creando uno nuevo, no borrando el viejo).
CREATE OR REPLACE FUNCTION prevent_registro_planta_mutation() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'registros_planta es inmutable: DELETE no permitido (id: %)', OLD.id;
  END IF;
  IF OLD.estado = 'COMPLETO' AND NEW.content_hash IS DISTINCT FROM OLD.content_hash THEN
    RAISE EXCEPTION 'contentHash de registro COMPLETO es inmutable (id: %)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_registros_planta_immutable
  BEFORE UPDATE OR DELETE ON registros_planta
  FOR EACH ROW EXECUTE FUNCTION prevent_registro_planta_mutation();

-- ── campanas ──────────────────────────────────────────────────────────────────
-- El campanaHash (Nivel 3, sello final) es inmutable una vez estado=CERRADA.
-- Una campana nunca se borra (es el equivalente a "processes" en SSE).
CREATE OR REPLACE FUNCTION prevent_campana_seal_mutation() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.estado = 'CERRADA' AND NEW.campana_hash IS DISTINCT FROM OLD.campana_hash THEN
    RAISE EXCEPTION 'campanaHash de campaña CERRADA es inmutable (id: %)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_campanas_seal_immutable
  BEFORE UPDATE ON campanas
  FOR EACH ROW EXECUTE FUNCTION prevent_campana_seal_mutation();

CREATE OR REPLACE FUNCTION prevent_campana_delete() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'campanas es inmutable: DELETE no permitido (id: %)', OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_campanas_no_delete
  BEFORE DELETE ON campanas
  FOR EACH ROW EXECUTE FUNCTION prevent_campana_delete();

-- ── lotes ─────────────────────────────────────────────────────────────────────
-- Una vez el lote esta anclado on-chain (lote_id_onchain no nulo), su dataHash
-- no puede cambiar sin invalidar la referencia ya sellada en Polygon.
CREATE OR REPLACE FUNCTION prevent_lote_hash_mutation() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.lote_id_onchain IS NOT NULL AND NEW.data_hash IS DISTINCT FROM OLD.data_hash THEN
    RAISE EXCEPTION 'dataHash de lote ya anclado on-chain es inmutable (id: %)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lotes_hash_immutable
  BEFORE UPDATE ON lotes
  FOR EACH ROW EXECUTE FUNCTION prevent_lote_hash_mutation();

-- ── eventos_produccion ───────────────────────────────────────────────────────
-- El contentHash del evento es inmutable siempre; el UNIQUE ya evita
-- duplicados exactos, este trigger evita alterar el mismo row via UPDATE.
CREATE OR REPLACE FUNCTION prevent_evento_mutation() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'eventos_produccion es inmutable: DELETE no permitido (id: %)', OLD.id;
  END IF;
  IF NEW.content_hash != OLD.content_hash THEN
    RAISE EXCEPTION 'contentHash de evento es inmutable (id: %)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_eventos_immutable
  BEFORE UPDATE OR DELETE ON eventos_produccion
  FOR EACH ROW EXECUTE FUNCTION prevent_evento_mutation();

-- ── Defensa en profundidad: revocar permisos destructivos al rol de aplicacion ──
-- Aunque los triggers ya bloquean DELETE, se revoca tambien el permiso crudo
-- (igual patron que SSE: REVOKE DELETE/TRUNCATE al rol sse_user).
REVOKE DELETE ON aportes_tecnicos, registros_planta, campanas, eventos_produccion FROM agrochain_app;
REVOKE TRUNCATE ON aportes_tecnicos, registros_planta, campanas, eventos_produccion, lotes FROM agrochain_app;
