-- =============================================================================
-- AGROCHAIN - Evaluacion de riesgo EUDR (Reglamento UE 2023/1115, Art. 9-11)
--
-- Separacion de responsabilidades (acordada con el usuario):
--   - Datos GENERALES (pertenecen al predio/propietario/parcela, se reutilizan
--     en cualquier certificacion): matricula_inmobiliaria, codigo_ica,
--     certif_uso_suelo, uso_previo ya existen en `predios`. Se agrega aqui el
--     unico dato general que faltaba: relacion con territorios indigenas.
--   - Evaluacion de riesgo EUDR (juicio/veredicto sobre esos datos, propio de
--     la certificacion): vive 100% en el modulo Certificacion -> EUDR, nunca
--     en las pantallas de predio/parcela.
--
-- Mapeo contra los 14 criterios del Art. 10(2) (ver docs de la sesion):
--   (a)(b)(c)(f)(h)(k) -> catalogo de pais (eudr_paises_riesgo), informativo
--   (d)(e)             -> predios.territorio_indigena (dato general nuevo)
--   (g)(i)(j)(m)        -> eudr_evaluacion_riesgo_parcela (criterios propios)
--   (l)                 -> eudr_evaluacion_riesgo_predio (historial)
--   (n)                 -> se lee de evaluacion STBN ya existente, no se duplica
-- =============================================================================

-- ── Dato general nuevo en predio (Art. 10(2)(d)(e)) ─────────────────────────
ALTER TABLE predios ADD COLUMN IF NOT EXISTS territorio_indigena boolean NOT NULL DEFAULT false;
ALTER TABLE predios ADD COLUMN IF NOT EXISTS territorio_indigena_detalle text;
COMMENT ON COLUMN predios.territorio_indigena IS 'El predio colinda o se superpone con territorio/resguardo indigena (Art. 10(2)(d)(e) EUDR)';
COMMENT ON COLUMN predios.territorio_indigena_detalle IS 'Detalle de la consulta/cooperacion con el pueblo indigena, si aplica';

-- ── Catalogo de clasificacion de riesgo por pais (Art. 10(2)(a), Art. 29) ───
-- Fuente: Commission Implementing Regulation (EU) 2025/1093 (22-may-2025),
-- publicado en https://green-forum.ec.europa.eu/countries-and-partnerships/country-classification-list_en
CREATE TABLE eudr_paises_riesgo (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_pais     varchar(2) NOT NULL UNIQUE, -- ISO 3166-1 alpha-2
  nombre_pais     varchar(100) NOT NULL,
  nivel_riesgo    varchar(20) NOT NULL CHECK (nivel_riesgo IN ('BAJO','ESTANDAR','ALTO')),
  fuente          varchar(200) NOT NULL DEFAULT 'Commission Implementing Regulation (EU) 2025/1093',
  vigente_desde   date NOT NULL DEFAULT '2025-05-22',
  created_at      timestamptz NOT NULL DEFAULT now()
);

INSERT INTO eudr_paises_riesgo (codigo_pais, nombre_pais, nivel_riesgo) VALUES
  ('CO', 'Colombia', 'ESTANDAR'),
  ('BR', 'Brasil', 'ESTANDAR'),
  ('PE', 'Peru', 'ESTANDAR'),
  ('EC', 'Ecuador', 'ESTANDAR'),
  ('HN', 'Honduras', 'ESTANDAR'),
  ('GT', 'Guatemala', 'ESTANDAR'),
  ('RU', 'Rusia', 'ALTO'),
  ('BY', 'Bielorrusia', 'ALTO'),
  ('MM', 'Myanmar', 'ALTO'),
  ('KP', 'Corea del Norte', 'ALTO')
ON CONFLICT (codigo_pais) DO NOTHING;

-- ── Evaluacion de riesgo a nivel PREDIO ─────────────────────────────────────
-- Criterios que son iguales para todas las parcelas de un mismo productor:
-- pais/region (heredado del catalogo), legalidad de tenencia (deriva de
-- matricula_inmobiliaria/codigo_ica/certif_uso_suelo ya existentes en predios),
-- historial de incumplimiento (Art. 10(2)(l)). Versionada: nunca se edita
-- in-place, se revisa al menos anual (Art. 10(4)).
CREATE TABLE eudr_evaluacion_riesgo_predio (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  predio_id                 uuid NOT NULL REFERENCES predios(id),
  -- (a)(b)(c)(f)(h)(k): informativos, derivados del catalogo de pais + contexto
  pais_codigo               varchar(2) NOT NULL DEFAULT 'CO' REFERENCES eudr_paises_riesgo(codigo_pais),
  -- (l) historial de incumplimiento propio o de la cadena de suministro
  historial_incumplimiento  boolean NOT NULL DEFAULT false,
  historial_incumplimiento_detalle text,
  -- legalidad de tenencia (deriva de datos ya existentes en predios, aqui solo
  -- se registra el JUICIO sobre esos datos, no se duplican los datos crudos)
  tenencia_legal_verificada boolean NOT NULL DEFAULT false,
  tenencia_legal_observaciones text,
  nivel_riesgo_global        varchar(10) NOT NULL CHECK (nivel_riesgo_global IN ('NULO','BAJO','MEDIO','ALTO')),
  vigente                   boolean NOT NULL DEFAULT true,
  version                   integer NOT NULL DEFAULT 1,
  evaluado_por               uuid NOT NULL REFERENCES usuarios(id),
  created_at                 timestamptz NOT NULL DEFAULT now(),
  UNIQUE (predio_id, version)
);
CREATE UNIQUE INDEX idx_eudr_eval_predio_vigente ON eudr_evaluacion_riesgo_predio(predio_id) WHERE vigente;

-- ── Evaluacion de riesgo a nivel PARCELA ────────────────────────────────────
-- Criterios especificos de la unidad de produccion: (g) fiabilidad de la
-- info/poligono, (i) complejidad de la cadena, (j) riesgo de mezcla de origen,
-- (m) informacion que apunte a no conformidad.
CREATE TABLE eudr_evaluacion_riesgo_parcela (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcela_id              uuid NOT NULL REFERENCES parcelas(id),
  fiabilidad_poligono     varchar(10) NOT NULL CHECK (fiabilidad_poligono IN ('ALTA','MEDIA','BAJA')),
  complejidad_cadena      varchar(10) NOT NULL CHECK (complejidad_cadena IN ('BAJA','MEDIA','ALTA')),
  complejidad_cadena_detalle text,
  riesgo_mezcla_origen    varchar(10) NOT NULL CHECK (riesgo_mezcla_origen IN ('NULO','BAJO','MEDIO','ALTO')),
  informacion_no_conformidad text,
  nivel_riesgo_global     varchar(10) NOT NULL CHECK (nivel_riesgo_global IN ('NULO','BAJO','MEDIO','ALTO')),
  vigente                 boolean NOT NULL DEFAULT true,
  version                 integer NOT NULL DEFAULT 1,
  evaluado_por            uuid NOT NULL REFERENCES usuarios(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parcela_id, version)
);
CREATE UNIQUE INDEX idx_eudr_eval_parcela_vigente ON eudr_evaluacion_riesgo_parcela(parcela_id) WHERE vigente;

-- ── Medidas de mitigacion (Art. 11) ──────────────────────────────────────────
-- Solo aplica cuando una evaluacion (predio o parcela) resulta MEDIO/ALTO.
CREATE TABLE eudr_medidas_mitigacion (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluacion_predio_id      uuid REFERENCES eudr_evaluacion_riesgo_predio(id),
  evaluacion_parcela_id     uuid REFERENCES eudr_evaluacion_riesgo_parcela(id),
  descripcion               text NOT NULL,
  responsable               varchar(200),
  fecha_implementacion      date,
  registrado_por            uuid NOT NULL REFERENCES usuarios(id),
  created_at                timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (evaluacion_predio_id IS NOT NULL AND evaluacion_parcela_id IS NULL) OR
    (evaluacion_predio_id IS NULL AND evaluacion_parcela_id IS NOT NULL)
  )
);
CREATE INDEX idx_eudr_mitigacion_predio ON eudr_medidas_mitigacion(evaluacion_predio_id);
CREATE INDEX idx_eudr_mitigacion_parcela ON eudr_medidas_mitigacion(evaluacion_parcela_id);

-- ── eudr_declaraciones exige evaluacion de riesgo vigente aceptable ─────────
-- La validacion de "nivel aceptable" (NULO/BAJO, o MEDIO/ALTO con mitigacion
-- documentada) se hace en el backend (routes/eudr.ts), igual que ya se valida
-- la existencia del poligono antes de crear la declaracion.

GRANT SELECT, INSERT, UPDATE, DELETE ON eudr_paises_riesgo, eudr_evaluacion_riesgo_predio, eudr_evaluacion_riesgo_parcela, eudr_medidas_mitigacion TO agrochain_app;
REVOKE TRUNCATE ON eudr_paises_riesgo, eudr_evaluacion_riesgo_predio, eudr_evaluacion_riesgo_parcela, eudr_medidas_mitigacion FROM agrochain_app;
