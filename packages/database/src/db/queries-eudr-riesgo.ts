import pool from "./client.js";
import type {
  EudrPaisRiesgo,
  EudrEvaluacionRiesgoPredio,
  EudrEvaluacionRiesgoParcela,
  EudrMedidaMitigacion,
} from "../types.js";

// =============================================================================
// AGROCHAIN - Evaluacion de riesgo EUDR (Art. 9-11, Reglamento UE 2023/1115)
// Vive 100% en el modulo Certificacion -> EUDR. Los datos generales que ya
// existen en predios (matricula_inmobiliaria, codigo_ica, certif_uso_suelo,
// territorio_indigena) se LEEN desde ahi, no se duplican aqui.
// =============================================================================

// ── Catalogo de paises ───────────────────────────────────────────────────────

export async function listPaisesRiesgo(): Promise<EudrPaisRiesgo[]> {
  const { rows } = await pool.query<EudrPaisRiesgo>(
    `SELECT
       id, codigo_pais AS "codigoPais", nombre_pais AS "nombrePais",
       nivel_riesgo AS "nivelRiesgo", fuente, vigente_desde AS "vigenteDesde",
       created_at AS "createdAt"
     FROM eudr_paises_riesgo
     ORDER BY nombre_pais`
  );
  return rows;
}

export async function getPaisRiesgo(codigoPais: string): Promise<EudrPaisRiesgo | null> {
  const { rows } = await pool.query<EudrPaisRiesgo>(
    `SELECT
       id, codigo_pais AS "codigoPais", nombre_pais AS "nombrePais",
       nivel_riesgo AS "nivelRiesgo", fuente, vigente_desde AS "vigenteDesde",
       created_at AS "createdAt"
     FROM eudr_paises_riesgo WHERE codigo_pais = $1`,
    [codigoPais]
  );
  return rows[0] ?? null;
}

// ── Evaluacion de riesgo a nivel PREDIO ──────────────────────────────────────

const EVAL_PREDIO_COLUMNS = `
  id,
  predio_id                        AS "predioId",
  pais_codigo                      AS "paisCodigo",
  historial_incumplimiento         AS "historialIncumplimiento",
  historial_incumplimiento_detalle AS "historialIncumplimientoDetalle",
  tenencia_legal_verificada        AS "tenenciaLegalVerificada",
  tenencia_legal_observaciones     AS "tenenciaLegalObservaciones",
  nivel_riesgo_global              AS "nivelRiesgoGlobal",
  vigente,
  version,
  evaluado_por                     AS "evaluadoPor",
  created_at                       AS "createdAt"
`;

export async function getEvaluacionRiesgoVigentePredio(predioId: string): Promise<EudrEvaluacionRiesgoPredio | null> {
  const { rows } = await pool.query<EudrEvaluacionRiesgoPredio>(
    `SELECT ${EVAL_PREDIO_COLUMNS} FROM eudr_evaluacion_riesgo_predio WHERE predio_id = $1 AND vigente = true`,
    [predioId]
  );
  return rows[0] ?? null;
}

export interface CreateEvaluacionRiesgoPredioBody {
  predioId: string;
  paisCodigo?: string;
  historialIncumplimiento: boolean;
  historialIncumplimientoDetalle?: string | null;
  tenenciaLegalVerificada: boolean;
  tenenciaLegalObservaciones?: string | null;
  nivelRiesgoGlobal: "NULO" | "BAJO" | "MEDIO" | "ALTO";
  evaluadoPor: string;
}

export async function crearEvaluacionRiesgoPredio(
  body: CreateEvaluacionRiesgoPredioBody
): Promise<EudrEvaluacionRiesgoPredio> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: maxRows } = await client.query<{ max: number | null }>(
      `SELECT max(version) AS max FROM eudr_evaluacion_riesgo_predio WHERE predio_id = $1`,
      [body.predioId]
    );
    const nuevaVersion = (maxRows[0].max ?? 0) + 1;

    await client.query(
      `UPDATE eudr_evaluacion_riesgo_predio SET vigente = false WHERE predio_id = $1 AND vigente = true`,
      [body.predioId]
    );

    const { rows } = await client.query<EudrEvaluacionRiesgoPredio>(
      `INSERT INTO eudr_evaluacion_riesgo_predio
         (predio_id, pais_codigo, historial_incumplimiento, historial_incumplimiento_detalle,
          tenencia_legal_verificada, tenencia_legal_observaciones, nivel_riesgo_global, version, vigente, evaluado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9)
       RETURNING ${EVAL_PREDIO_COLUMNS}`,
      [
        body.predioId,
        body.paisCodigo ?? "CO",
        body.historialIncumplimiento,
        body.historialIncumplimientoDetalle ?? null,
        body.tenenciaLegalVerificada,
        body.tenenciaLegalObservaciones ?? null,
        body.nivelRiesgoGlobal,
        nuevaVersion,
        body.evaluadoPor,
      ]
    );

    await client.query("COMMIT");
    return rows[0];
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// ── Evaluacion de riesgo a nivel PARCELA ─────────────────────────────────────

const EVAL_PARCELA_COLUMNS = `
  id,
  parcela_id                  AS "parcelaId",
  fiabilidad_poligono         AS "fiabilidadPoligono",
  complejidad_cadena          AS "complejidadCadena",
  complejidad_cadena_detalle  AS "complejidadCadenaDetalle",
  riesgo_mezcla_origen        AS "riesgoMezclaOrigen",
  informacion_no_conformidad  AS "informacionNoConformidad",
  nivel_riesgo_global         AS "nivelRiesgoGlobal",
  vigente,
  version,
  evaluado_por                AS "evaluadoPor",
  created_at                  AS "createdAt"
`;

export async function getEvaluacionRiesgoVigenteParcela(parcelaId: string): Promise<EudrEvaluacionRiesgoParcela | null> {
  const { rows } = await pool.query<EudrEvaluacionRiesgoParcela>(
    `SELECT ${EVAL_PARCELA_COLUMNS} FROM eudr_evaluacion_riesgo_parcela WHERE parcela_id = $1 AND vigente = true`,
    [parcelaId]
  );
  return rows[0] ?? null;
}

export interface CreateEvaluacionRiesgoParcelaBody {
  parcelaId: string;
  fiabilidadPoligono: "ALTA" | "MEDIA" | "BAJA";
  complejidadCadena: "BAJA" | "MEDIA" | "ALTA";
  complejidadCadenaDetalle?: string | null;
  riesgoMezclaOrigen: "NULO" | "BAJO" | "MEDIO" | "ALTO";
  informacionNoConformidad?: string | null;
  nivelRiesgoGlobal: "NULO" | "BAJO" | "MEDIO" | "ALTO";
  evaluadoPor: string;
}

export async function crearEvaluacionRiesgoParcela(
  body: CreateEvaluacionRiesgoParcelaBody
): Promise<EudrEvaluacionRiesgoParcela> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: maxRows } = await client.query<{ max: number | null }>(
      `SELECT max(version) AS max FROM eudr_evaluacion_riesgo_parcela WHERE parcela_id = $1`,
      [body.parcelaId]
    );
    const nuevaVersion = (maxRows[0].max ?? 0) + 1;

    await client.query(
      `UPDATE eudr_evaluacion_riesgo_parcela SET vigente = false WHERE parcela_id = $1 AND vigente = true`,
      [body.parcelaId]
    );

    const { rows } = await client.query<EudrEvaluacionRiesgoParcela>(
      `INSERT INTO eudr_evaluacion_riesgo_parcela
         (parcela_id, fiabilidad_poligono, complejidad_cadena, complejidad_cadena_detalle,
          riesgo_mezcla_origen, informacion_no_conformidad, nivel_riesgo_global, version, vigente, evaluado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9)
       RETURNING ${EVAL_PARCELA_COLUMNS}`,
      [
        body.parcelaId,
        body.fiabilidadPoligono,
        body.complejidadCadena,
        body.complejidadCadenaDetalle ?? null,
        body.riesgoMezclaOrigen,
        body.informacionNoConformidad ?? null,
        body.nivelRiesgoGlobal,
        nuevaVersion,
        body.evaluadoPor,
      ]
    );

    await client.query("COMMIT");
    return rows[0];
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// ── Medidas de mitigacion (Art. 11) ─────────────────────────────────────────

export interface CreateMedidaMitigacionBody {
  evaluacionPredioId?: string | null;
  evaluacionParcelaId?: string | null;
  descripcion: string;
  responsable?: string | null;
  fechaImplementacion?: string | null;
  registradoPor: string;
}

export async function crearMedidaMitigacion(body: CreateMedidaMitigacionBody): Promise<EudrMedidaMitigacion> {
  const { rows } = await pool.query<EudrMedidaMitigacion>(
    `INSERT INTO eudr_medidas_mitigacion
       (evaluacion_predio_id, evaluacion_parcela_id, descripcion, responsable, fecha_implementacion, registrado_por)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, evaluacion_predio_id AS "evaluacionPredioId", evaluacion_parcela_id AS "evaluacionParcelaId",
               descripcion, responsable, fecha_implementacion AS "fechaImplementacion",
               registrado_por AS "registradoPor", created_at AS "createdAt"`,
    [
      body.evaluacionPredioId ?? null,
      body.evaluacionParcelaId ?? null,
      body.descripcion,
      body.responsable ?? null,
      body.fechaImplementacion ?? null,
      body.registradoPor,
    ]
  );
  return rows[0];
}

export async function listMedidasMitigacionPredio(evaluacionPredioId: string): Promise<EudrMedidaMitigacion[]> {
  const { rows } = await pool.query<EudrMedidaMitigacion>(
    `SELECT id, evaluacion_predio_id AS "evaluacionPredioId", evaluacion_parcela_id AS "evaluacionParcelaId",
            descripcion, responsable, fecha_implementacion AS "fechaImplementacion",
            registrado_por AS "registradoPor", created_at AS "createdAt"
     FROM eudr_medidas_mitigacion WHERE evaluacion_predio_id = $1 ORDER BY created_at DESC`,
    [evaluacionPredioId]
  );
  return rows;
}

export async function listMedidasMitigacionParcela(evaluacionParcelaId: string): Promise<EudrMedidaMitigacion[]> {
  const { rows } = await pool.query<EudrMedidaMitigacion>(
    `SELECT id, evaluacion_predio_id AS "evaluacionPredioId", evaluacion_parcela_id AS "evaluacionParcelaId",
            descripcion, responsable, fecha_implementacion AS "fechaImplementacion",
            registrado_por AS "registradoPor", created_at AS "createdAt"
     FROM eudr_medidas_mitigacion WHERE evaluacion_parcela_id = $1 ORDER BY created_at DESC`,
    [evaluacionParcelaId]
  );
  return rows;
}

// ── Resumen combinado para el checklist de la parcela ───────────────────────

export interface EudrEstadoRiesgo {
  predio: {
    tieneEvaluacion: boolean;
    nivelRiesgoGlobal: string | null;
    evaluacionId: string | null;
  };
  parcela: {
    tieneEvaluacion: boolean;
    nivelRiesgoGlobal: string | null;
    evaluacionId: string | null;
  };
  // Aceptable = NULO/BAJO en ambos niveles, o MEDIO/ALTO con al menos una
  // medida de mitigacion documentada (Art. 10(1): "riesgo nulo o insignificante").
  esAceptable: boolean;
}

export async function getEudrEstadoRiesgo(predioId: string, parcelaId: string): Promise<EudrEstadoRiesgo> {
  const [evalPredio, evalParcela] = await Promise.all([
    getEvaluacionRiesgoVigentePredio(predioId),
    getEvaluacionRiesgoVigenteParcela(parcelaId),
  ]);

  async function nivelEsAceptable(
    nivel: string | undefined,
    evaluacionId: string | undefined,
    listarMitigacion: (id: string) => Promise<EudrMedidaMitigacion[]>
  ): Promise<boolean> {
    if (!nivel) return false;
    if (nivel === "NULO" || nivel === "BAJO") return true;
    if (!evaluacionId) return false;
    const medidas = await listarMitigacion(evaluacionId);
    return medidas.length > 0;
  }

  const [predioAceptable, parcelaAceptable] = await Promise.all([
    nivelEsAceptable(evalPredio?.nivelRiesgoGlobal, evalPredio?.id, listMedidasMitigacionPredio),
    nivelEsAceptable(evalParcela?.nivelRiesgoGlobal, evalParcela?.id, listMedidasMitigacionParcela),
  ]);

  return {
    predio: {
      tieneEvaluacion: !!evalPredio,
      nivelRiesgoGlobal: evalPredio?.nivelRiesgoGlobal ?? null,
      evaluacionId: evalPredio?.id ?? null,
    },
    parcela: {
      tieneEvaluacion: !!evalParcela,
      nivelRiesgoGlobal: evalParcela?.nivelRiesgoGlobal ?? null,
      evaluacionId: evalParcela?.id ?? null,
    },
    esAceptable: predioAceptable && parcelaAceptable,
  };
}
