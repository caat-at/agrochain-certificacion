import pool from "./client.js";
import { getLoteById } from "./queries.js";
import { getEudrEstadoLote } from "./queries-eudr.js";
import type {
  StbnSubcriterio,
  StbnEvidenciaPilar,
  StbnEvaluacion,
  StbnEvaluacionSubcriterio,
  PuntajeStbnLote,
  PilarStbnResumen,
  PilarStbn,
  NivelCalificacionStbn,
} from "../types.js";

// =============================================================================
// AGROCHAIN - Modulo STBN, pilares evaluables manualmente (PNSS 0000404)
// Vinculado a nivel de PREDIO (ver packages/database/sql/04_pilares_stbn.sql).
// El pilar EUDR (40pts, por Lote) vive en queries-eudr.ts y se combina aqui
// en calcularPuntajeStbnLote() — sin modificar ese modulo.
// =============================================================================

const PILARES_HUMANOS: PilarStbn[] = ["CONSERVACION", "COMUNIDAD", "JUSTICIA_SOCIAL", "TECNOLOGIA", "DERECHOS_HUMANOS"];

// ── Catalogo estatico ────────────────────────────────────────────────────────

const SUBCRITERIO_COLUMNS = `
  codigo,
  pilar,
  nombre,
  orden,
  puntaje_alto        AS "puntajeAlto",
  puntaje_bajo        AS "puntajeBajo",
  descripcion_alto    AS "descripcionAlto",
  descripcion_bajo    AS "descripcionBajo",
  nombre_es           AS "nombreEs",
  descripcion_alto_es AS "descripcionAltoEs",
  descripcion_bajo_es AS "descripcionBajoEs"
`;

export async function listSubcriteriosStbn(): Promise<StbnSubcriterio[]> {
  const { rows } = await pool.query<StbnSubcriterio>(
    `SELECT ${SUBCRITERIO_COLUMNS} FROM stbn_subcriterios ORDER BY pilar, orden`
  );
  return rows;
}

export async function getSubcriterioByCodigo(codigo: string): Promise<StbnSubcriterio | null> {
  const { rows } = await pool.query<StbnSubcriterio>(
    `SELECT ${SUBCRITERIO_COLUMNS} FROM stbn_subcriterios WHERE codigo = $1`,
    [codigo]
  );
  return rows[0] ?? null;
}

// ── Evidencia narrativa por pilar ────────────────────────────────────────────

const EVIDENCIA_PILAR_COLUMNS = `
  id,
  predio_id      AS "predioId",
  pilar,
  titulo,
  narrativa,
  periodo_desde  AS "periodoDesde",
  periodo_hasta  AS "periodoHasta",
  registrado_por AS "registradoPor",
  created_at     AS "createdAt"
`;

export interface CreateEvidenciaPilarBody {
  predioId: string;
  pilar: PilarStbn;
  titulo: string;
  narrativa: string;
  periodoDesde?: string | null;
  periodoHasta?: string | null;
  registradoPor: string;
}

export async function createEvidenciaPilar(body: CreateEvidenciaPilarBody): Promise<StbnEvidenciaPilar> {
  const { rows } = await pool.query<StbnEvidenciaPilar>(
    `INSERT INTO stbn_evidencias_pilar (predio_id, pilar, titulo, narrativa, periodo_desde, periodo_hasta, registrado_por)
     VALUES ($1,$2,$3,$4,$5::date,$6::date,$7)
     RETURNING ${EVIDENCIA_PILAR_COLUMNS}`,
    [
      body.predioId,
      body.pilar,
      body.titulo,
      body.narrativa,
      body.periodoDesde ?? null,
      body.periodoHasta ?? null,
      body.registradoPor,
    ]
  );
  return rows[0];
}

export async function listEvidenciasPorPredioPilar(predioId: string, pilar?: PilarStbn): Promise<StbnEvidenciaPilar[]> {
  if (pilar) {
    const { rows } = await pool.query<StbnEvidenciaPilar>(
      `SELECT ${EVIDENCIA_PILAR_COLUMNS} FROM stbn_evidencias_pilar WHERE predio_id = $1 AND pilar = $2 ORDER BY created_at DESC`,
      [predioId, pilar]
    );
    return rows;
  }
  const { rows } = await pool.query<StbnEvidenciaPilar>(
    `SELECT ${EVIDENCIA_PILAR_COLUMNS} FROM stbn_evidencias_pilar WHERE predio_id = $1 ORDER BY pilar, created_at DESC`,
    [predioId]
  );
  return rows;
}

export async function getEvidenciaPilarById(id: string): Promise<StbnEvidenciaPilar | null> {
  const { rows } = await pool.query<StbnEvidenciaPilar>(
    `SELECT ${EVIDENCIA_PILAR_COLUMNS} FROM stbn_evidencias_pilar WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function vincularEvidenciaBinariaAPilar(evidenciaPilarId: string, evidenciaBinariaId: string): Promise<void> {
  await pool.query(
    `INSERT INTO stbn_evidencias_pilar_binarios (evidencia_pilar_id, evidencia_binaria_id)
     VALUES ($1,$2)
     ON CONFLICT (evidencia_pilar_id, evidencia_binaria_id) DO NOTHING`,
    [evidenciaPilarId, evidenciaBinariaId]
  );
}

export async function listAdjuntosPorEvidenciaPilar(evidenciaPilarId: string): Promise<unknown[]> {
  const { rows } = await pool.query(
    `SELECT eb.id, eb.storage_key AS "storageKey", eb.original_name AS "originalName",
            eb.mimetype, eb.size_bytes AS "sizeBytes", eb.sha256, eb.created_at AS "createdAt"
     FROM stbn_evidencias_pilar_binarios epb
     JOIN evidencia_binaria eb ON eb.id = epb.evidencia_binaria_id
     WHERE epb.evidencia_pilar_id = $1
     ORDER BY eb.created_at ASC`,
    [evidenciaPilarId]
  );
  return rows;
}

// ── Evaluacion (cabecera) ─────────────────────────────────────────────────────

const EVALUACION_COLUMNS = `
  id,
  predio_id          AS "predioId",
  estado,
  puntaje_total      AS "puntajeTotal",
  resultado_hash     AS "resultadoHash",
  tx_hash            AS "txHash",
  iniciada_por       AS "iniciadaPor",
  finalizada_por     AS "finalizadaPor",
  fecha_finalizacion AS "fechaFinalizacion",
  version,
  vigente,
  created_at         AS "createdAt"
`;

export async function getEvaluacionVigentePorPredio(predioId: string): Promise<StbnEvaluacion | null> {
  const { rows } = await pool.query<StbnEvaluacion>(
    `SELECT ${EVALUACION_COLUMNS} FROM stbn_evaluaciones WHERE predio_id = $1 AND vigente = true`,
    [predioId]
  );
  return rows[0] ?? null;
}

export async function getEvaluacionById(id: string): Promise<StbnEvaluacion | null> {
  const { rows } = await pool.query<StbnEvaluacion>(`SELECT ${EVALUACION_COLUMNS} FROM stbn_evaluaciones WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

// Crea una nueva evaluacion versionada para el predio (o retorna la vigente
// EN_PROGRESO si ya existe una abierta — no tiene sentido abrir dos en paralelo).
export async function crearEvaluacionStbn(body: { predioId: string; iniciadaPor: string }): Promise<StbnEvaluacion> {
  const existente = await getEvaluacionVigentePorPredio(body.predioId);
  if (existente && existente.estado === "EN_PROGRESO") {
    return existente;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: maxRows } = await client.query<{ max: number | null }>(
      `SELECT max(version) AS max FROM stbn_evaluaciones WHERE predio_id = $1`,
      [body.predioId]
    );
    const nuevaVersion = (maxRows[0].max ?? 0) + 1;

    await client.query(`UPDATE stbn_evaluaciones SET vigente = false WHERE predio_id = $1 AND vigente = true`, [
      body.predioId,
    ]);

    const { rows } = await client.query<StbnEvaluacion>(
      `INSERT INTO stbn_evaluaciones (predio_id, estado, version, vigente, iniciada_por)
       VALUES ($1,'EN_PROGRESO',$2,true,$3)
       RETURNING ${EVALUACION_COLUMNS}`,
      [body.predioId, nuevaVersion, body.iniciadaPor]
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

// ── Calificacion por subcriterio ─────────────────────────────────────────────

const CALIFICACION_COLUMNS = `
  id,
  evaluacion_id      AS "evaluacionId",
  subcriterio_codigo AS "subcriterioCodigo",
  nivel,
  puntaje_asignado   AS "puntajeAsignado",
  justificacion,
  evaluado_por       AS "evaluadoPor",
  evaluado_en        AS "evaluadoEn"
`;

export interface CalificarSubcriterioBody {
  evaluacionId: string;
  subcriterioCodigo: string;
  nivel: NivelCalificacionStbn;
  justificacion?: string | null;
  evaluadoPor: string;
}

// El puntaje se copia del catalogo al momento de calificar (denormalizado a
// proposito: si el catalogo cambia despues, la calificacion historica no muta).
export async function calificarSubcriterio(body: CalificarSubcriterioBody): Promise<StbnEvaluacionSubcriterio> {
  const subcriterio = await getSubcriterioByCodigo(body.subcriterioCodigo);
  if (!subcriterio) {
    throw new Error(`subcriterio STBN no existe: ${body.subcriterioCodigo}`);
  }
  const puntajeAsignado = body.nivel === "ALTO" ? subcriterio.puntajeAlto : subcriterio.puntajeBajo;

  const { rows } = await pool.query<StbnEvaluacionSubcriterio>(
    `INSERT INTO stbn_evaluaciones_subcriterio (evaluacion_id, subcriterio_codigo, nivel, puntaje_asignado, justificacion, evaluado_por)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (evaluacion_id, subcriterio_codigo)
     DO UPDATE SET nivel = $3, puntaje_asignado = $4, justificacion = $5, evaluado_por = $6, evaluado_en = now()
     RETURNING ${CALIFICACION_COLUMNS}`,
    [body.evaluacionId, body.subcriterioCodigo, body.nivel, puntajeAsignado, body.justificacion ?? null, body.evaluadoPor]
  );

  await recalcularPuntajePilares(body.evaluacionId);
  return rows[0];
}

export async function listCalificacionesPorEvaluacion(evaluacionId: string): Promise<StbnEvaluacionSubcriterio[]> {
  const { rows } = await pool.query<StbnEvaluacionSubcriterio>(
    `SELECT ${CALIFICACION_COLUMNS} FROM stbn_evaluaciones_subcriterio WHERE evaluacion_id = $1`,
    [evaluacionId]
  );
  return rows;
}

export async function recalcularPuntajePilares(evaluacionId: string): Promise<number> {
  const { rows } = await pool.query<{ puntaje: string }>(
    `SELECT fn_stbn_puntaje_pilares($1) AS puntaje`,
    [evaluacionId]
  );
  const puntaje = Number(rows[0].puntaje);
  await pool.query(`UPDATE stbn_evaluaciones SET puntaje_total = $1 WHERE id = $2`, [puntaje, evaluacionId]);
  return puntaje;
}

export async function finalizarEvaluacionStbn(
  evaluacionId: string,
  finalizadaPor: string,
  resultadoHash: string
): Promise<StbnEvaluacion> {
  const calificaciones = await listCalificacionesPorEvaluacion(evaluacionId);
  if (calificaciones.length < 10) {
    throw new Error(`evaluacion STBN incompleta: ${calificaciones.length}/10 subcriterios calificados`);
  }

  const { rows } = await pool.query<StbnEvaluacion>(
    `UPDATE stbn_evaluaciones
     SET estado = 'FINALIZADA', resultado_hash = $1, finalizada_por = $2, fecha_finalizacion = now()
     WHERE id = $3 AND estado = 'EN_PROGRESO'
     RETURNING ${EVALUACION_COLUMNS}`,
    [resultadoHash, finalizadaPor, evaluacionId]
  );
  if (!rows[0]) {
    throw new Error("evaluacion STBN no encontrada o ya finalizada");
  }
  return rows[0];
}

export async function updateEvaluacionTxHash(evaluacionId: string, txHash: string): Promise<StbnEvaluacion> {
  const { rows } = await pool.query<StbnEvaluacion>(
    `UPDATE stbn_evaluaciones SET tx_hash = $1 WHERE id = $2 RETURNING ${EVALUACION_COLUMNS}`,
    [txHash, evaluacionId]
  );
  return rows[0];
}

// ── Combinador: puntaje /100 en contexto de Lote ─────────────────────────────
// Resuelve predioId desde el lote, trae la evaluacion vigente de los 5 pilares
// humanos (0-60) y el estado EUDR del lote (0-40, via queries-eudr.ts sin
// modificarlo) — el certificado es por lote, no por predio, porque dos lotes
// del mismo predio pueden tener distinto estado EUDR.

// pg no parsea `numeric` a number por defecto (llega como string) — se
// castea explicitamente aqui para evitar concatenacion en las sumas.
function resumenPilarVacio(subcriterios: StbnSubcriterio[], pilar: PilarStbn, mapa: Map<string, StbnEvaluacionSubcriterio>): PilarStbnResumen {
  const delPilar = subcriterios.filter((s) => s.pilar === pilar).sort((a, b) => a.orden - b.orden);
  const items = delPilar.map((s) => {
    const cal = mapa.get(s.codigo);
    return {
      codigo: s.codigo,
      nombre: s.nombre,
      nivel: cal?.nivel ?? null,
      puntajeAsignado: cal ? Number(cal.puntajeAsignado) : null,
      puntajeMaximo: Number(s.puntajeAlto),
    };
  });
  const subtotal = items.reduce((acc, i) => acc + (i.puntajeAsignado ?? 0), 0);
  const maximo = items.reduce((acc, i) => acc + i.puntajeMaximo, 0);
  return { subcriterios: items, subtotal, maximo };
}

export async function calcularPuntajeStbnLote(loteId: string): Promise<PuntajeStbnLote> {
  const lote = await getLoteById(loteId);
  if (!lote) {
    throw new Error(`lote no encontrado: ${loteId}`);
  }
  const predioId = lote.predioId;

  const [subcriterios, evaluacion, eudr] = await Promise.all([
    listSubcriteriosStbn(),
    getEvaluacionVigentePorPredio(predioId),
    getEudrEstadoLote(loteId),
  ]);

  const calificaciones = evaluacion ? await listCalificacionesPorEvaluacion(evaluacion.id) : [];
  const mapa = new Map(calificaciones.map((c) => [c.subcriterioCodigo, c]));

  const [conservacion, comunidad, justiciaSocial, tecnologia, derechosHumanos] = PILARES_HUMANOS.map((p) =>
    resumenPilarVacio(subcriterios, p, mapa)
  );

  const subtotalHumano = [conservacion, comunidad, justiciaSocial, tecnologia, derechosHumanos].reduce(
    (acc, p) => acc + p.subtotal,
    0
  );
  const eudrSubtotal = eudr.cumpleUmbral ? 40 : 0;
  const puntajeTotal = subtotalHumano + eudrSubtotal;

  const evaluacionPilaresCompleta = evaluacion?.estado === "FINALIZADA" && calificaciones.length === 10;

  let estadoElegibilidad: PuntajeStbnLote["estadoElegibilidad"];
  if (puntajeTotal >= 80) estadoElegibilidad = "APROBADO";
  else if (puntajeTotal >= 70) estadoElegibilidad = "REVISION_CONDICIONAL";
  else estadoElegibilidad = "NO_ELEGIBLE";

  return {
    loteId,
    predioId,
    pilares: {
      conservacion,
      comunidad,
      justiciaSocial,
      tecnologia,
      derechosHumanos,
      eudr: {
        cumpleUmbral: eudr.cumpleUmbral,
        declaracionEstado: eudr.declaracionEstado,
        libreDeforestacion: eudr.libreDeforestacion,
        subtotal: eudrSubtotal,
        maximo: 40,
      },
    },
    puntajeTotal,
    estadoElegibilidad,
    evaluacionPilaresCompleta: !!evaluacionPilaresCompleta,
  };
}
