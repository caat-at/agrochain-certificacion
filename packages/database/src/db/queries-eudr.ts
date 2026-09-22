import pool from "./client.js";
import type { LotePoligono, EudrDeclaracion, EudrEvidenciaSatelital } from "../types.js";

// =============================================================================
// AGROCHAIN - Modulo EUDR (Reglamento UE 2023/1115, deforestacion-cero)
// Vinculado a nivel de LOTE (ver packages/database/sql/02_eudr.sql).
// Mismo patron: SQL directo, alias camelCase, seccion separada de queries.ts
// por dominio, igual que queries-campanas.ts.
// =============================================================================

// ── Poligono georreferenciado ────────────────────────────────────────────────

const POLIGONO_COLUMNS = `
  id,
  lote_id             AS "loteId",
  geojson,
  area_ha_calculada   AS "areaHaCalculada",
  fuente,
  version,
  vigente,
  creado_por          AS "creadoPor",
  created_at          AS "createdAt"
`;

export async function getPoligonoVigentePorLote(loteId: string): Promise<LotePoligono | null> {
  const { rows } = await pool.query<LotePoligono>(
    `SELECT ${POLIGONO_COLUMNS} FROM lote_poligonos WHERE lote_id = $1 AND vigente = true`,
    [loteId]
  );
  return rows[0] ?? null;
}

export async function listPoligonosPorLote(loteId: string): Promise<LotePoligono[]> {
  const { rows } = await pool.query<LotePoligono>(
    `SELECT ${POLIGONO_COLUMNS} FROM lote_poligonos WHERE lote_id = $1 ORDER BY version DESC`,
    [loteId]
  );
  return rows;
}

export async function getPoligonoById(id: string): Promise<LotePoligono | null> {
  const { rows } = await pool.query<LotePoligono>(`SELECT ${POLIGONO_COLUMNS} FROM lote_poligonos WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export interface CreatePoligonoBody {
  loteId: string;
  geojson: Record<string, unknown>;
  areaHaCalculada?: number | null;
  fuente?: string;
  creadoPor: string;
}

// Crea una nueva version del poligono del lote, marcando la anterior como no
// vigente — nunca se edita in-place, se versiona (mismo principio que el
// resto del sistema: preservar el historial para auditoria).
export async function crearPoligonoVigente(body: CreatePoligonoBody): Promise<LotePoligono> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: maxRows } = await client.query<{ max: number | null }>(
      `SELECT max(version) AS max FROM lote_poligonos WHERE lote_id = $1`,
      [body.loteId]
    );
    const nuevaVersion = (maxRows[0].max ?? 0) + 1;

    await client.query(`UPDATE lote_poligonos SET vigente = false WHERE lote_id = $1 AND vigente = true`, [body.loteId]);

    const { rows } = await client.query<LotePoligono>(
      `INSERT INTO lote_poligonos (lote_id, geojson, area_ha_calculada, fuente, version, vigente, creado_por)
       VALUES ($1,$2::jsonb,$3,$4,$5,true,$6)
       RETURNING ${POLIGONO_COLUMNS}`,
      [
        body.loteId,
        JSON.stringify(body.geojson),
        body.areaHaCalculada ?? null,
        body.fuente ?? "DIBUJADO_MANUAL",
        nuevaVersion,
        body.creadoPor,
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

// ── Declaracion EUDR ─────────────────────────────────────────────────────────

const DECLARACION_COLUMNS = `
  id,
  lote_id               AS "loteId",
  poligono_id           AS "poligonoId",
  fecha_corte           AS "fechaCorte",
  libre_deforestacion   AS "libreDeforestacion",
  fecha_declaracion     AS "fechaDeclaracion",
  declarado_por         AS "declaradoPor",
  content_hash          AS "contentHash",
  estado,
  tx_hash               AS "txHash",
  observaciones,
  created_at            AS "createdAt"
`;

export async function getDeclaracionVigentePorLote(loteId: string): Promise<EudrDeclaracion | null> {
  const { rows } = await pool.query<EudrDeclaracion>(
    `SELECT ${DECLARACION_COLUMNS} FROM eudr_declaraciones
     WHERE lote_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [loteId]
  );
  return rows[0] ?? null;
}

export async function getDeclaracionById(id: string): Promise<EudrDeclaracion | null> {
  const { rows } = await pool.query<EudrDeclaracion>(
    `SELECT ${DECLARACION_COLUMNS} FROM eudr_declaraciones WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export interface CreateDeclaracionBody {
  loteId: string;
  poligonoId: string;
  fechaCorte?: string; // default '2020-12-31' en DB
  libreDeforestacion: boolean;
  declaradoPor: string;
  contentHash: string;
  observaciones?: string | null;
}

export async function createDeclaracionEudr(body: CreateDeclaracionBody): Promise<EudrDeclaracion> {
  const { rows } = await pool.query<EudrDeclaracion>(
    `INSERT INTO eudr_declaraciones
       (lote_id, poligono_id, fecha_corte, libre_deforestacion, declarado_por, content_hash, observaciones, estado)
     VALUES ($1,$2,COALESCE($3::date,'2020-12-31'),$4,$5,$6,$7,'BORRADOR')
     RETURNING ${DECLARACION_COLUMNS}`,
    [
      body.loteId,
      body.poligonoId,
      body.fechaCorte ?? null,
      body.libreDeforestacion,
      body.declaradoPor,
      body.contentHash,
      body.observaciones ?? null,
    ]
  );
  return rows[0];
}

export async function firmarDeclaracionEudr(id: string): Promise<EudrDeclaracion> {
  const { rows } = await pool.query<EudrDeclaracion>(
    `UPDATE eudr_declaraciones SET estado = 'FIRMADA' WHERE id = $1 AND estado = 'BORRADOR'
     RETURNING ${DECLARACION_COLUMNS}`,
    [id]
  );
  return rows[0];
}

export async function updateDeclaracionTxHash(id: string, txHash: string): Promise<EudrDeclaracion> {
  const { rows } = await pool.query<EudrDeclaracion>(
    `UPDATE eudr_declaraciones SET estado = 'ANCLADA_BLOCKCHAIN', tx_hash = $1 WHERE id = $2
     RETURNING ${DECLARACION_COLUMNS}`,
    [txHash, id]
  );
  return rows[0];
}

// ── Evidencia satelital ──────────────────────────────────────────────────────

export interface CreateEvidenciaSatelitalBody {
  declaracionId: string;
  tipoEvidencia: string;
  descripcion?: string | null;
  fechaCaptura?: string | null;
  fuenteDeclarada?: string | null;
  evidenciaBinariaId: string;
  cargadoPor: string;
}

export async function createEvidenciaSatelital(body: CreateEvidenciaSatelitalBody): Promise<EudrEvidenciaSatelital> {
  const { rows } = await pool.query<EudrEvidenciaSatelital>(
    `INSERT INTO eudr_evidencias_satelitales
       (declaracion_id, tipo_evidencia, descripcion, fecha_captura, fuente_declarada, evidencia_binaria_id, cargado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, declaracion_id AS "declaracionId", tipo_evidencia AS "tipoEvidencia",
               descripcion, fecha_captura AS "fechaCaptura", fuente_declarada AS "fuenteDeclarada",
               evidencia_binaria_id AS "evidenciaBinariaId", cargado_por AS "cargadoPor", created_at AS "createdAt"`,
    [
      body.declaracionId,
      body.tipoEvidencia,
      body.descripcion ?? null,
      body.fechaCaptura ?? null,
      body.fuenteDeclarada ?? null,
      body.evidenciaBinariaId,
      body.cargadoPor,
    ]
  );
  return rows[0];
}

export async function listEvidenciasSatelitales(declaracionId: string): Promise<unknown[]> {
  const { rows } = await pool.query(
    `SELECT
       es.id, es.declaracion_id AS "declaracionId", es.tipo_evidencia AS "tipoEvidencia",
       es.descripcion, es.fecha_captura AS "fechaCaptura", es.fuente_declarada AS "fuenteDeclarada",
       es.cargado_por AS "cargadoPor", es.created_at AS "createdAt",
       eb.storage_key AS "storageKey", eb.original_name AS "originalName", eb.mimetype, eb.sha256
     FROM eudr_evidencias_satelitales es
     JOIN evidencia_binaria eb ON eb.id = es.evidencia_binaria_id
     WHERE es.declaracion_id = $1
     ORDER BY es.created_at ASC`,
    [declaracionId]
  );
  return rows;
}

// ── Estado resumen y elegibilidad para certificado STBN ──────────────────────

export interface EudrEstadoLote {
  loteId: string;
  tienePoligono: boolean;
  poligonoVersion: number | null;
  tieneDeclaracionVigente: boolean;
  declaracionId: string | null;
  declaracionEstado: string | null;
  libreDeforestacion: boolean | null;
  cumpleUmbral: boolean;
  evidenciasCount: number;
}

export async function getEudrEstadoLote(loteId: string): Promise<EudrEstadoLote> {
  const poligono = await getPoligonoVigentePorLote(loteId);
  const declaracion = await getDeclaracionVigentePorLote(loteId);

  let evidenciasCount = 0;
  if (declaracion) {
    const { rows } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM eudr_evidencias_satelitales WHERE declaracion_id = $1`,
      [declaracion.id]
    );
    evidenciasCount = rows[0].n;
  }

  const cumpleUmbral =
    !!declaracion &&
    (declaracion.estado === "FIRMADA" || declaracion.estado === "ANCLADA_BLOCKCHAIN") &&
    declaracion.libreDeforestacion === true;

  return {
    loteId,
    tienePoligono: !!poligono,
    poligonoVersion: poligono?.version ?? null,
    tieneDeclaracionVigente: !!declaracion,
    declaracionId: declaracion?.id ?? null,
    declaracionEstado: declaracion?.estado ?? null,
    libreDeforestacion: declaracion?.libreDeforestacion ?? null,
    cumpleUmbral,
    evidenciasCount,
  };
}

// Vincula un certificado STBN a la declaracion EUDR que lo respalda —
// usado al emitir el certificado, deja el requisito auditable.
export async function crearCertificadoEudrRequisito(body: {
  certificadoId: string;
  declaracionId: string;
  cumpleUmbral: boolean;
}): Promise<void> {
  await pool.query(
    `INSERT INTO certificado_eudr_requisitos (certificado_id, declaracion_id, cumple_umbral)
     VALUES ($1,$2,$3)`,
    [body.certificadoId, body.declaracionId, body.cumpleUmbral]
  );
}
