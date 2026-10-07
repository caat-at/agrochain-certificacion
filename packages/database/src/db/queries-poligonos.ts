import pool from "./client.js";
import type { PredioPoligono, ParcelaPoligono } from "../types.js";

// =============================================================================
// AGROCHAIN - Poligono georreferenciado de Predio y Parcela
// Mismo patron que queries-eudr.ts (lote_poligonos): SQL directo, alias
// camelCase, version + vigente, nunca se edita in-place.
// =============================================================================

// ── Predio ───────────────────────────────────────────────────────────────────

const PREDIO_POLIGONO_COLUMNS = `
  id,
  predio_id           AS "predioId",
  geojson,
  area_ha_calculada   AS "areaHaCalculada",
  fuente,
  version,
  vigente,
  creado_por          AS "creadoPor",
  created_at          AS "createdAt"
`;

export async function getPoligonoVigentePorPredio(predioId: string): Promise<PredioPoligono | null> {
  const { rows } = await pool.query<PredioPoligono>(
    `SELECT ${PREDIO_POLIGONO_COLUMNS} FROM predio_poligonos WHERE predio_id = $1 AND vigente = true`,
    [predioId]
  );
  return rows[0] ?? null;
}

export async function listPoligonosPorPredio(predioId: string): Promise<PredioPoligono[]> {
  const { rows } = await pool.query<PredioPoligono>(
    `SELECT ${PREDIO_POLIGONO_COLUMNS} FROM predio_poligonos WHERE predio_id = $1 ORDER BY version DESC`,
    [predioId]
  );
  return rows;
}

export interface CreatePredioPoligonoBody {
  predioId: string;
  geojson: Record<string, unknown>;
  areaHaCalculada?: number | null;
  fuente?: string;
  creadoPor: string;
}

export async function crearPoligonoVigentePredio(body: CreatePredioPoligonoBody): Promise<PredioPoligono> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: maxRows } = await client.query<{ max: number | null }>(
      `SELECT max(version) AS max FROM predio_poligonos WHERE predio_id = $1`,
      [body.predioId]
    );
    const nuevaVersion = (maxRows[0].max ?? 0) + 1;

    await client.query(`UPDATE predio_poligonos SET vigente = false WHERE predio_id = $1 AND vigente = true`, [
      body.predioId,
    ]);

    const { rows } = await client.query<PredioPoligono>(
      `INSERT INTO predio_poligonos (predio_id, geojson, area_ha_calculada, fuente, version, vigente, creado_por)
       VALUES ($1,$2::jsonb,$3,$4,$5,true,$6)
       RETURNING ${PREDIO_POLIGONO_COLUMNS}`,
      [
        body.predioId,
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

// Marca la version vigente como no vigente — no borra la fila (se preserva
// el historial para auditoria, mismo principio que el resto del modulo).
// Devuelve true si habia una version vigente para desactivar.
export async function desactivarPoligonoVigentePredio(predioId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE predio_poligonos SET vigente = false WHERE predio_id = $1 AND vigente = true`,
    [predioId]
  );
  return (rowCount ?? 0) > 0;
}

// ── Parcela ──────────────────────────────────────────────────────────────────

const PARCELA_POLIGONO_COLUMNS = `
  id,
  parcela_id          AS "parcelaId",
  geojson,
  area_ha_calculada   AS "areaHaCalculada",
  fuente,
  version,
  vigente,
  creado_por          AS "creadoPor",
  created_at          AS "createdAt"
`;

export async function getPoligonoVigentePorParcela(parcelaId: string): Promise<ParcelaPoligono | null> {
  const { rows } = await pool.query<ParcelaPoligono>(
    `SELECT ${PARCELA_POLIGONO_COLUMNS} FROM parcela_poligonos WHERE parcela_id = $1 AND vigente = true`,
    [parcelaId]
  );
  return rows[0] ?? null;
}

export async function listPoligonosPorParcela(parcelaId: string): Promise<ParcelaPoligono[]> {
  const { rows } = await pool.query<ParcelaPoligono>(
    `SELECT ${PARCELA_POLIGONO_COLUMNS} FROM parcela_poligonos WHERE parcela_id = $1 ORDER BY version DESC`,
    [parcelaId]
  );
  return rows;
}

export interface CreateParcelaPoligonoBody {
  parcelaId: string;
  geojson: Record<string, unknown>;
  areaHaCalculada?: number | null;
  fuente?: string;
  creadoPor: string;
}

export async function crearPoligonoVigenteParcela(body: CreateParcelaPoligonoBody): Promise<ParcelaPoligono> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: maxRows } = await client.query<{ max: number | null }>(
      `SELECT max(version) AS max FROM parcela_poligonos WHERE parcela_id = $1`,
      [body.parcelaId]
    );
    const nuevaVersion = (maxRows[0].max ?? 0) + 1;

    await client.query(`UPDATE parcela_poligonos SET vigente = false WHERE parcela_id = $1 AND vigente = true`, [
      body.parcelaId,
    ]);

    const { rows } = await client.query<ParcelaPoligono>(
      `INSERT INTO parcela_poligonos (parcela_id, geojson, area_ha_calculada, fuente, version, vigente, creado_por)
       VALUES ($1,$2::jsonb,$3,$4,$5,true,$6)
       RETURNING ${PARCELA_POLIGONO_COLUMNS}`,
      [
        body.parcelaId,
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

// Marca la version vigente como no vigente — no borra la fila (se preserva
// el historial para auditoria, mismo principio que el resto del modulo).
// Devuelve true si habia una version vigente para desactivar.
export async function desactivarPoligonoVigenteParcela(parcelaId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE parcela_poligonos SET vigente = false WHERE parcela_id = $1 AND vigente = true`,
    [parcelaId]
  );
  return (rowCount ?? 0) > 0;
}
