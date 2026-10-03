-- =============================================================================
-- AGROCHAIN - Parcelas (subdivision fisica permanente del predio) + catalogo
-- real de ubicacion (pais/departamento/municipio con FK, en vez de texto libre)
--
-- Contexto: "lote" en este sistema es el ciclo de cosecha/produccion en curso,
-- no el espacio fisico permanente (validado con el usuario). El espacio fisico
-- permanente subdividido dentro de un predio (ej. finca de 100 ha con 10
-- parcelas de 10 ha, cada una con un cultivo distinto) no estaba modelado.
-- Se agrega "parcelas" entre predios y lotes: predio (finca completa) ->
-- parcela (subdivision fija) -> lote (cosecha que ocurre en una parcela).
--
-- De paso, predios.departamento/municipio eran varchar de texto libre sin
-- relacion real con las tablas departamentos/municipios ya existentes y
-- pobladas -- datos reales inconsistentes (codigos DANE crudos mezclados con
-- texto libre). Se agrega FK real + tabla paises.
-- =============================================================================

-- ── Paises ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS paises (
  codigo varchar(3) PRIMARY KEY,  -- ISO 3166-1 alpha-3, ej "COL"
  nombre varchar(100) NOT NULL
);
INSERT INTO paises (codigo, nombre) VALUES ('COL', 'Colombia') ON CONFLICT DO NOTHING;

ALTER TABLE departamentos ADD COLUMN IF NOT EXISTS pais_cod varchar(3) REFERENCES paises(codigo);
UPDATE departamentos SET pais_cod = 'COL' WHERE pais_cod IS NULL;
ALTER TABLE departamentos ALTER COLUMN pais_cod SET NOT NULL;
ALTER TABLE departamentos ALTER COLUMN pais_cod SET DEFAULT 'COL';

-- ── FK real departamento/municipio en predios ───────────────────────────────
-- Las columnas viejas predios.departamento/municipio (texto libre) se
-- mantienen sin DROP por ahora -- limpieza posterior fuera de este alcance,
-- ya dejan de usarse desde el formulario de creacion/edicion de predio.

ALTER TABLE predios ADD COLUMN IF NOT EXISTS departamento_cod varchar(5) REFERENCES departamentos(codigo);
ALTER TABLE predios ADD COLUMN IF NOT EXISTS municipio_cod varchar(10) REFERENCES municipios(codigo);

-- Los municipios (incluido Sonson 05756) los carga 10_divipola_completo.sql,
-- que corre justo despues de este script. Antes se insertaba '05756' aqui y
-- eso abortaba el initdb en una base nueva: FK municipios_departamento_cod_fkey
-- porque departamentos aun estaba vacia (solo la puebla el seed, que corre al
-- final, despues del initdb).

-- Mapeo manual de los 3 predios reales existentes a codigos DANE validos.
-- OJO: estos UPDATE son no-op en una base recien creada (predios vacia). Sobre
-- una base que ya tenga predios fallarian por FK, porque a este punto
-- departamentos todavia no tiene filas.
-- Nota: "Finca El Paraiso" tenia municipio='05615' en el dato viejo (texto
-- libre/codigo crudo), pero 05615 en el catalogo real es Rionegro, no lo que
-- se pretendia originalmente -- se deja apuntando a Rionegro (05615) porque
-- no hay forma de inferir la intencion original sin el usuario; corregible
-- despues via el formulario de edicion de predio si el dato correcto es otro.
UPDATE predios SET departamento_cod = '05', municipio_cod = '05615'
  WHERE id = '9b230a71-02af-4608-b8e9-9fb443dae90a'; -- Finca El Paraiso
UPDATE predios SET departamento_cod = '05', municipio_cod = '05360'
  WHERE id = '8007f6e8-7673-4c8d-ae59-45e55b727f27'; -- Finca Prueba E2E (Jardin)
UPDATE predios SET departamento_cod = '05', municipio_cod = '05756'
  WHERE id = '8e3ed525-6b90-4e5b-9a26-ac1a30f46f74'; -- Finca Sin Operador (Sonson)

-- =============================================================================
-- PARCELAS -- subdivision fisica permanente de un predio
-- =============================================================================

CREATE TABLE IF NOT EXISTS parcelas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  predio_id         uuid NOT NULL REFERENCES predios(id),
  codigo_parcela    varchar(30) UNIQUE NOT NULL,
  nombre            varchar(150),
  area_ha           double precision NOT NULL,
  latitud           double precision,
  longitud          double precision,
  uso_actual        varchar(150),
  activo            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_parcelas_predio ON parcelas(predio_id);
CREATE TRIGGER trg_parcelas_updated_at BEFORE UPDATE ON parcelas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── lotes.parcela_id obligatorio, con migracion 1:1 de lotes existentes ────
-- Cada lote existente hereda una parcela nueva creada a su medida (mismo
-- predio_id/area_ha, uso_actual = especie del lote), para no perder la
-- relacion predio->lote que ya existia mientras se llena la capa intermedia.

ALTER TABLE lotes ADD COLUMN IF NOT EXISTS parcela_id uuid REFERENCES parcelas(id);

INSERT INTO parcelas (id, predio_id, codigo_parcela, area_ha, uso_actual)
SELECT gen_random_uuid(), l.predio_id, 'PAR-MIGR-' || l.codigo_lote, l.area_ha, l.especie
FROM lotes l
WHERE l.parcela_id IS NULL;

UPDATE lotes l SET parcela_id = p.id
FROM parcelas p
WHERE p.codigo_parcela = 'PAR-MIGR-' || l.codigo_lote AND l.parcela_id IS NULL;

ALTER TABLE lotes ALTER COLUMN parcela_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lotes_parcela ON lotes(parcela_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON parcelas, paises TO agrochain_app;
