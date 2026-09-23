-- =============================================================================
-- AGROCHAIN - Pilares STBN restantes (PNSS 0000404, PlanetAI Nature Space)
-- Conservacion (15pts), Comunidad (10pts), Justicia Social (10pts),
-- Tecnologia (10pts), Derechos Humanos (15pts) = 60 de los 100 puntos.
-- El pilar EUDR (40pts) vive en 02_eudr.sql y se combina en TypeScript
-- (packages/database/src/db/queries-stbn.ts, calcularPuntajeStbnLote).
--
-- Vinculado a nivel de PREDIO (no Lote como EUDR): son atributos del
-- territorio/comunidad, no cambian por cada lote/cultivo dentro del mismo
-- predio. Solo modelo de datos + flujo manual: evaluacion humana explicita
-- por subcriterio (documento Seccion 8 — "PNS Technical Committee will
-- conduct a comprehensive evaluation"), sin scoring automatico.
-- =============================================================================

-- ── Evidencia narrativa por pilar ────────────────────────────────────────────
-- Descripcion de la practica/compromiso/accion que el evaluador revisa antes
-- de calificar. Una narrativa puede tener varios adjuntos (fotos, PDFs) via
-- la tabla puente de abajo.
CREATE TABLE stbn_evidencias_pilar (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  predio_id      uuid NOT NULL REFERENCES predios(id),
  pilar          varchar(30) NOT NULL, -- CONSERVACION | COMUNIDAD | JUSTICIA_SOCIAL | TECNOLOGIA | DERECHOS_HUMANOS
  titulo         varchar(200) NOT NULL,
  narrativa      text NOT NULL,
  periodo_desde  date,
  periodo_hasta  date,
  registrado_por uuid NOT NULL REFERENCES usuarios(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_stbn_evidencias_predio_pilar ON stbn_evidencias_pilar(predio_id, pilar);

-- Tabla puente N:N — una narrativa puede respaldarse con varios archivos
-- (evidencia_binaria ya existe desde 03_evidencia.sql, tipo 'stbn_pilar').
CREATE TABLE stbn_evidencias_pilar_binarios (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidencia_pilar_id   uuid NOT NULL REFERENCES stbn_evidencias_pilar(id),
  evidencia_binaria_id uuid NOT NULL REFERENCES evidencia_binaria(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evidencia_pilar_id, evidencia_binaria_id)
);

-- ── Catalogo estatico de subcriterios ────────────────────────────────────────
-- 10 filas fijas, texto exacto del documento MT_STBN V3.0_EN Seccion 8.
-- Sembrado en seed/stbn-subcriterios.ts, nunca editado desde la app (mismo
-- patron que numerales_ntc5400).
CREATE TABLE stbn_subcriterios (
  codigo              varchar(20) PRIMARY KEY, -- ej. CONS_A, CONS_B, COMU_A...
  pilar               varchar(30) NOT NULL,
  nombre              varchar(200) NOT NULL,   -- texto oficial en ingles (documento PNSS 0000404)
  orden               integer NOT NULL,        -- posicion dentro del pilar (A=1, B=2)
  puntaje_alto        numeric(4,1) NOT NULL,
  puntaje_bajo        numeric(4,1) NOT NULL,
  descripcion_alto    text NOT NULL,
  descripcion_bajo    text NOT NULL,
  -- Traduccion al espanol para la UI del evaluador colombiano — el ingles
  -- de arriba se conserva intacto como referencia al documento del
  -- certificador (ver 05_stbn_traduccion.sql para la version ALTER TABLE
  -- que aplica sobre una base ya existente).
  nombre_es           varchar(200),
  descripcion_alto_es text,
  descripcion_bajo_es text
);

-- ── Evaluacion (cabecera) ─────────────────────────────────────────────────────
-- Versionada igual que lote_poligonos: una nueva evaluacion no edita la
-- anterior, crea una fila nueva y marca vigente=false en la vieja — preserva
-- el historial completo de re-evaluaciones periodicas para auditoria.
CREATE TABLE stbn_evaluaciones (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  predio_id          uuid NOT NULL REFERENCES predios(id),
  estado             varchar(20) NOT NULL DEFAULT 'EN_PROGRESO', -- EN_PROGRESO | FINALIZADA
  -- Subtotal cacheado de los 5 pilares humanos (0-60). NO incluye EUDR —
  -- el puntaje /100 combinado se calcula en calcularPuntajeStbnLote().
  puntaje_total      numeric(5,1),
  -- SHA256 de los 10 puntajes asignados, generado solo al finalizar
  -- (generarContentHashEvaluacionStbn en packages/database/src/lib/hash.ts).
  resultado_hash     varchar(64),
  tx_hash            varchar(66),
  iniciada_por       uuid NOT NULL REFERENCES usuarios(id),
  finalizada_por     uuid REFERENCES usuarios(id),
  fecha_finalizacion timestamptz,
  version            integer NOT NULL DEFAULT 1,
  vigente            boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (predio_id, version)
);
CREATE UNIQUE INDEX idx_stbn_evaluacion_vigente ON stbn_evaluaciones(predio_id) WHERE vigente;

-- ── Calificacion por subcriterio ─────────────────────────────────────────────
-- 10 filas por evaluacion. puntaje_asignado se copia del catalogo al momento
-- de calificar (denormalizado a proposito: si el catalogo cambiara en el
-- futuro, la calificacion historica no debe mutar retroactivamente).
CREATE TABLE stbn_evaluaciones_subcriterio (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluacion_id      uuid NOT NULL REFERENCES stbn_evaluaciones(id),
  subcriterio_codigo varchar(20) NOT NULL REFERENCES stbn_subcriterios(codigo),
  nivel              varchar(10) NOT NULL, -- ALTO | BAJO
  puntaje_asignado   numeric(4,1) NOT NULL,
  justificacion      text,
  evaluado_por       uuid NOT NULL REFERENCES usuarios(id),
  evaluado_en        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evaluacion_id, subcriterio_codigo)
);
CREATE INDEX idx_stbn_eval_subcriterio_evaluacion ON stbn_evaluaciones_subcriterio(evaluacion_id);

-- ── Funcion de recalculo del subtotal (0-60) ─────────────────────────────────
-- El pilar EUDR (40pts, por Lote) se combina en TypeScript, no aqui — evita
-- un join cruzado Lote<->Predio dentro de una funcion SQL.
CREATE OR REPLACE FUNCTION fn_stbn_puntaje_pilares(p_evaluacion_id uuid) RETURNS numeric AS $$
  SELECT COALESCE(SUM(puntaje_asignado), 0)
  FROM stbn_evaluaciones_subcriterio
  WHERE evaluacion_id = p_evaluacion_id;
$$ LANGUAGE sql STABLE;

-- ── Inmutabilidad ────────────────────────────────────────────────────────────
-- Mismo principio que 02_eudr.sql: una evaluacion FINALIZADA no puede editar
-- sus calificaciones ni su hash/puntaje final.
CREATE OR REPLACE FUNCTION prevent_stbn_eval_subcriterio_mutation() RETURNS TRIGGER AS $$
DECLARE
  v_estado varchar(20);
BEGIN
  SELECT estado INTO v_estado FROM stbn_evaluaciones WHERE id = OLD.evaluacion_id;
  IF v_estado = 'FINALIZADA' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'evaluacion STBN finalizada es inmutable: DELETE no permitido (id: %)', OLD.id;
    END IF;
    IF NEW.puntaje_asignado != OLD.puntaje_asignado OR NEW.nivel != OLD.nivel THEN
      RAISE EXCEPTION 'calificacion de evaluacion STBN finalizada es inmutable (id: %)', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stbn_eval_subcriterio_immutable
  BEFORE UPDATE OR DELETE ON stbn_evaluaciones_subcriterio
  FOR EACH ROW EXECUTE FUNCTION prevent_stbn_eval_subcriterio_mutation();

CREATE OR REPLACE FUNCTION prevent_stbn_evaluacion_mutation() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'stbn_evaluaciones es inmutable: DELETE no permitido (id: %)', OLD.id;
  END IF;
  IF OLD.estado = 'FINALIZADA' THEN
    IF NEW.resultado_hash IS DISTINCT FROM OLD.resultado_hash AND OLD.resultado_hash IS NOT NULL THEN
      RAISE EXCEPTION 'resultado_hash de evaluacion STBN finalizada es inmutable (id: %)', OLD.id;
    END IF;
    IF NEW.puntaje_total IS DISTINCT FROM OLD.puntaje_total THEN
      RAISE EXCEPTION 'puntaje_total de evaluacion STBN finalizada es inmutable (id: %)', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stbn_evaluacion_immutable
  BEFORE UPDATE OR DELETE ON stbn_evaluaciones
  FOR EACH ROW EXECUTE FUNCTION prevent_stbn_evaluacion_mutation();

-- GRANT primero, REVOKE selectivo despues — el orden importa: un GRANT
-- posterior anularia el REVOKE (bug encontrado y corregido tambien en
-- 02_eudr.sql, que tenia el mismo problema de orden).
GRANT SELECT, INSERT, UPDATE, DELETE ON
  stbn_evidencias_pilar, stbn_evidencias_pilar_binarios, stbn_subcriterios,
  stbn_evaluaciones, stbn_evaluaciones_subcriterio
  TO agrochain_app;

REVOKE DELETE ON stbn_evaluaciones, stbn_evaluaciones_subcriterio FROM agrochain_app;
REVOKE TRUNCATE ON stbn_evaluaciones, stbn_evaluaciones_subcriterio, stbn_evidencias_pilar FROM agrochain_app;
