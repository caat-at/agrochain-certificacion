-- =============================================================================
-- AGROCHAIN - EUDR deja de tener su propio poligono (lote_poligonos) y pasa a
-- usar el poligono GENERAL de la parcela (parcela_poligonos, modulo de
-- trazabilidad georreferenciada ya existente — ver 14_poligonos_predio_parcela.sql).
-- Esto elimina el formulario duplicado de "pegar GeoJSON" dentro de EUDR: el
-- mismo poligono que el usuario dibuja con el mapa interactivo de la parcela
-- es el que ahora respalda la declaracion de libre-deforestacion.
-- =============================================================================

-- Backfill: cada declaracion EUDR existente apuntaba a un lote_poligonos cuya
-- parcela_id coincide con la de la declaracion (verificado antes de escribir
-- esta migracion). Si esa parcela ya tiene un poligono GENERAL vigente, se usa
-- ese; si no, se crea uno nuevo en parcela_poligonos con el mismo geojson que
-- tenia en lote_poligonos, preservando el dato.
INSERT INTO parcela_poligonos (parcela_id, geojson, area_ha_calculada, fuente, version, vigente, creado_por, created_at)
SELECT
  lp.parcela_id,
  lp.geojson,
  lp.area_ha_calculada,
  lp.fuente,
  COALESCE((SELECT max(version) FROM parcela_poligonos pp WHERE pp.parcela_id = lp.parcela_id), 0) + 1,
  NOT EXISTS (SELECT 1 FROM parcela_poligonos pp WHERE pp.parcela_id = lp.parcela_id AND pp.vigente),
  lp.creado_por,
  lp.created_at
FROM lote_poligonos lp
WHERE lp.vigente
  AND NOT EXISTS (SELECT 1 FROM parcela_poligonos pp WHERE pp.parcela_id = lp.parcela_id);

-- Re-apunta cada declaracion al poligono vigente de parcela_poligonos de su
-- misma parcela (ya sea el preexistente o el recien migrado arriba).
ALTER TABLE eudr_declaraciones ADD COLUMN IF NOT EXISTS poligono_parcela_id uuid REFERENCES parcela_poligonos(id);

UPDATE eudr_declaraciones ed
SET poligono_parcela_id = pp.id
FROM parcela_poligonos pp
WHERE pp.parcela_id = ed.parcela_id AND pp.vigente = true AND ed.poligono_parcela_id IS NULL;

-- Toda declaracion debe quedar resuelta (si alguna no encontro poligono
-- vigente, es un dato huerfano real que requiere revision manual antes de
-- continuar — no se fuerza NOT NULL automaticamente para no romper el deploy).
-- Verificar manualmente: SELECT * FROM eudr_declaraciones WHERE poligono_parcela_id IS NULL;

ALTER TABLE eudr_declaraciones DROP CONSTRAINT IF EXISTS eudr_declaraciones_poligono_id_fkey;
ALTER TABLE eudr_declaraciones ALTER COLUMN poligono_id DROP NOT NULL;
COMMENT ON COLUMN eudr_declaraciones.poligono_id IS 'DEPRECATED — EUDR ahora usa el poligono general de la parcela, ver poligono_parcela_id (16_eudr_usa_poligono_parcela.sql)';
COMMENT ON COLUMN eudr_declaraciones.poligono_parcela_id IS 'FK a parcela_poligonos — el poligono general de la parcela que respalda esta declaracion EUDR';

-- lote_poligonos queda deprecated por completo: ya no se escribe desde el
-- modulo EUDR (crearPoligonoVigenteEudr se elimina). Se preserva la tabla
-- (sin DROP) para no perder el historial ya migrado arriba.
COMMENT ON TABLE lote_poligonos IS 'DEPRECATED — EUDR ahora usa parcela_poligonos (modulo general de trazabilidad), ver 16_eudr_usa_poligono_parcela.sql';
