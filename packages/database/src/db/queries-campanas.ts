import pool from "./client.js";
import type {
  Campana,
  CampanaTecnico,
  RegistroPlanta,
  AporteTecnico,
  VerificacionIntegridad,
  VerificacionHashCampana,
} from "../types.js";

// =============================================================================
// AGROCHAIN - Acceso a datos: Campanas multi-tecnico (seccion separada de
// queries.ts por su tamano y complejidad — 15 endpoints en campanas.ts).
// Mismo patron: SQL directo, alias camelCase, transacciones manuales solo en
// inserts/updates multi-tabla atomicos.
// =============================================================================

const CAMPANA_COLUMNS = `
  c.id,
  c.lote_id                 AS "loteId",
  c.nombre, c.codigo, c.descripcion, c.estado,
  c.campos_requeridos       AS "camposRequeridos",
  c.campana_hash            AS "campanaHash",
  c.tx_hash                 AS "txHash",
  c.sync_estado             AS "syncEstado",
  c.cierre_con_advertencia  AS "cierreConAdvertencia",
  c.motivo_cierre           AS "motivoCierre",
  c.creada_por              AS "creadaPor",
  c.cerrada_por             AS "cerradaPor",
  c.fecha_apertura          AS "fechaApertura",
  c.fecha_cierre            AS "fechaCierre",
  c.created_at              AS "createdAt",
  c.updated_at              AS "updatedAt"
`;
const CAMPANA_COLUMNS_RETURNING = CAMPANA_COLUMNS.replace(/c\./g, "");

const REGISTRO_COLUMNS = `
  rp.id,
  rp.campana_id                  AS "campanaId",
  rp.planta_id                   AS "plantaId",
  rp.estado, rp.consecutivo,
  rp.fecha_evento                AS "fechaEvento",
  rp.content_hash                AS "contentHash",
  rp.tx_hash                     AS "txHash",
  rp.sync_estado                 AS "syncEstado",
  rp.adulterado_detectado_en     AS "adulteradoDetectadoEn",
  rp.adulterado_detectado_por    AS "adulteradoDetectadoPor",
  rp.registro_reemplazante_id    AS "registroReemplazanteId",
  rp.created_at                  AS "createdAt",
  rp.updated_at                  AS "updatedAt"
`;
const REGISTRO_COLUMNS_RETURNING = REGISTRO_COLUMNS.replace(/rp\./g, "");

const APORTE_COLUMNS = `
  a.id,
  a.registro_planta_id  AS "registroPlantaId",
  a.campana_id          AS "campanaId",
  a.tecnico_id          AS "tecnicoId",
  a.posicion, a.campos,
  a.foto_hash           AS "fotoHash",
  a.foto_uri            AS "fotoUri",
  a.audio_hash          AS "audioHash",
  a.audio_uri           AS "audioUri",
  a.content_hash        AS "contentHash",
  a.hash_verificado     AS "hashVerificado",
  a.hash_rechaz_motivo  AS "hashRechazMotivo",
  a.latitud, a.longitud,
  a.fecha_aporte        AS "fechaAporte",
  a.sync_estado         AS "syncEstado",
  a.created_at          AS "createdAt"
`;

// ── Campanas ─────────────────────────────────────────────────────────────────

export async function listCampanas(filtros: { loteId?: string } = {}): Promise<unknown[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filtros.loteId) {
    params.push(filtros.loteId);
    conditions.push(`c.lote_id = $${params.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows: campanas } = await pool.query<Campana>(
    `SELECT ${CAMPANA_COLUMNS},
       l.codigo_lote AS "loteCodigoLote", l.especie AS "loteEspecie", l.variedad AS "loteVariedad",
       uc.nombres AS "creadorNombres", uc.apellidos AS "creadorApellidos",
       ux.nombres AS "cerradorNombres", ux.apellidos AS "cerradorApellidos",
       (SELECT count(*)::int FROM registros_planta rp WHERE rp.campana_id = c.id) AS "totalRegistros"
     FROM campanas c
     JOIN lotes l ON l.id = c.lote_id
     JOIN usuarios uc ON uc.id = c.creada_por
     LEFT JOIN usuarios ux ON ux.id = c.cerrada_por
     ${where}
     ORDER BY c.created_at DESC`,
    params
  );
  if (campanas.length === 0) return [];

  const campanaIds = campanas.map((c: any) => c.id);
  const { rows: tecnicos } = await pool.query(
    `SELECT ct.campana_id AS "campanaId", ct.id, ct.posicion, ct.campos_asignados AS "camposAsignados",
            u.id AS "tecnicoUsuarioId", u.nombres AS "tecnicoNombres", u.apellidos AS "tecnicoApellidos"
     FROM campana_tecnicos ct
     JOIN usuarios u ON u.id = ct.tecnico_id
     WHERE ct.campana_id = ANY($1)
     ORDER BY ct.posicion ASC`,
    [campanaIds]
  );
  const tecnicosPorCampana = new Map<string, any[]>();
  for (const t of tecnicos) {
    const arr = tecnicosPorCampana.get(t.campanaId) ?? [];
    arr.push({
      id: t.id,
      posicion: t.posicion,
      camposAsignados: t.camposAsignados,
      tecnico: { id: t.tecnicoUsuarioId, nombres: t.tecnicoNombres, apellidos: t.tecnicoApellidos },
    });
    tecnicosPorCampana.set(t.campanaId, arr);
  }

  return campanas.map((c: any) => ({
    ...c,
    lote: { codigoLote: c.loteCodigoLote, especie: c.loteEspecie, variedad: c.loteVariedad },
    creador: { nombres: c.creadorNombres, apellidos: c.creadorApellidos },
    cerrador: c.cerradorNombres ? { nombres: c.cerradorNombres, apellidos: c.cerradorApellidos } : null,
    tecnicos: tecnicosPorCampana.get(c.id) ?? [],
    // apps/web hereda el shape _count de Prisma — se mantiene por compatibilidad
    // con el componente React existente en vez de tocar el frontend.
    _count: { registros: c.totalRegistros },
  }));
}

export async function getCampanaById(id: string): Promise<Campana | null> {
  const { rows } = await pool.query<Campana>(`SELECT ${CAMPANA_COLUMNS} FROM campanas c WHERE c.id = $1`, [id]);
  return rows[0] ?? null;
}

// Campana + registros activos (no INVALIDADO) + plantas del lote — usado para
// intentarCierreAutomatico (necesita saber si todas las plantas ya estan COMPLETO).
export async function getCampanaParaCierreAutomatico(campanaId: string): Promise<
  | (Campana & { registros: RegistroPlanta[]; totalPlantasLote: number })
  | null
> {
  const campana = await getCampanaById(campanaId);
  if (!campana) return null;

  const [registros, totalPlantasLote] = await Promise.all([
    pool
      .query<RegistroPlanta>(
        `SELECT ${REGISTRO_COLUMNS} FROM registros_planta rp WHERE rp.campana_id = $1 AND rp.estado != 'INVALIDADO'`,
        [campanaId]
      )
      .then((r) => r.rows),
    pool
      .query<{ n: number }>(`SELECT count(*)::int AS n FROM plantas WHERE lote_id = $1 AND activo = true`, [campana.loteId])
      .then((r) => r.rows[0].n),
  ]);

  return { ...campana, registros, totalPlantasLote };
}

export interface CreateCampanaBody {
  loteId: string;
  nombre: string;
  codigo?: string | null;
  descripcion?: string | null;
  camposRequeridos: string[];
  creadaPor: string;
}

export async function createCampana(body: CreateCampanaBody): Promise<Campana> {
  const { rows } = await pool.query<Campana>(
    `INSERT INTO campanas (lote_id, nombre, codigo, descripcion, campos_requeridos, estado, creada_por)
     VALUES ($1,$2,$3,$4,$5::jsonb,'ACTIVA',$6)
     RETURNING ${CAMPANA_COLUMNS_RETURNING}`,
    [body.loteId, body.nombre, body.codigo ?? null, body.descripcion ?? null, JSON.stringify(body.camposRequeridos), body.creadaPor]
  );
  return rows[0];
}

export async function getCampanaActivaOAbiertaPorLote(loteId: string): Promise<Campana | null> {
  const { rows } = await pool.query<Campana>(
    `SELECT ${CAMPANA_COLUMNS} FROM campanas c WHERE c.lote_id = $1 AND c.estado IN ('ACTIVA', 'ABIERTA') LIMIT 1`,
    [loteId]
  );
  return rows[0] ?? null;
}

export async function getCampanaPorCodigo(codigo: string): Promise<Campana | null> {
  const { rows } = await pool.query<Campana>(`SELECT ${CAMPANA_COLUMNS} FROM campanas c WHERE c.codigo = $1`, [codigo]);
  return rows[0] ?? null;
}

// Detalle completo: campana + tecnicos + registros (con planta + aportes con tecnico) —
// replica el `include` de 4 niveles del GET /:id original.
export async function getCampanaDetalle(id: string): Promise<unknown | null> {
  const campana = await getCampanaById(id);
  if (!campana) return null;

  const [lote, creador, cerrador, tecnicos, registros] = await Promise.all([
    pool
      .query(`SELECT codigo_lote AS "codigoLote", especie, variedad, tx_registro AS "txRegistro" FROM lotes WHERE id = $1`, [campana.loteId])
      .then((r) => r.rows[0] ?? null),
    pool.query(`SELECT nombres, apellidos FROM usuarios WHERE id = $1`, [campana.creadaPor]).then((r) => r.rows[0] ?? null),
    campana.cerradaPor
      ? pool.query(`SELECT nombres, apellidos FROM usuarios WHERE id = $1`, [campana.cerradaPor]).then((r) => r.rows[0] ?? null)
      : Promise.resolve(null),
    pool
      .query(
        `SELECT ct.id, ct.posicion, ct.campos_asignados AS "camposAsignados",
                u.id AS "tecnicoId", u.nombres AS "tecnicoNombres", u.apellidos AS "tecnicoApellidos"
         FROM campana_tecnicos ct JOIN usuarios u ON u.id = ct.tecnico_id
         WHERE ct.campana_id = $1 ORDER BY ct.posicion ASC`,
        [id]
      )
      .then((r) =>
        r.rows.map((t: any) => ({
          id: t.id,
          posicion: t.posicion,
          camposAsignados: t.camposAsignados,
          tecnico: { id: t.tecnicoId, nombres: t.tecnicoNombres, apellidos: t.tecnicoApellidos },
        }))
      ),
    pool
      .query(
        `SELECT ${REGISTRO_COLUMNS},
                pl.codigo_planta AS "plantaCodigoPlanta", pl.numero_planta AS "plantaNumeroPlanta",
                pl.latitud AS "plantaLatitud", pl.longitud AS "plantaLongitud"
         FROM registros_planta rp
         JOIN plantas pl ON pl.id = rp.planta_id
         WHERE rp.campana_id = $1
         ORDER BY rp.created_at ASC`,
        [id]
      )
      .then((r) => r.rows),
  ]);

  const registroIds = (registros as any[]).map((r) => r.id);
  let aportesPorRegistro = new Map<string, any[]>();
  if (registroIds.length > 0) {
    const { rows: aportes } = await pool.query(
      `SELECT ${APORTE_COLUMNS}, u.nombres AS "tecnicoNombres", u.apellidos AS "tecnicoApellidos", u.rol AS "tecnicoRol"
       FROM aportes_tecnicos a JOIN usuarios u ON u.id = a.tecnico_id
       WHERE a.registro_planta_id = ANY($1) ORDER BY a.posicion ASC`,
      [registroIds]
    );
    for (const a of aportes) {
      const arr = aportesPorRegistro.get(a.registroPlantaId) ?? [];
      arr.push({ ...a, tecnico: { nombres: a.tecnicoNombres, apellidos: a.tecnicoApellidos, rol: a.tecnicoRol } });
      aportesPorRegistro.set(a.registroPlantaId, arr);
    }
  }

  const registrosConDatos = (registros as any[]).map((r) => ({
    ...r,
    planta: {
      codigoPlanta: r.plantaCodigoPlanta,
      numeroPlanta: r.plantaNumeroPlanta,
      latitud: r.plantaLatitud,
      longitud: r.plantaLongitud,
    },
    aportes: aportesPorRegistro.get(r.id) ?? [],
  }));

  return { ...campana, lote, creador, cerrador, tecnicos, registros: registrosConDatos };
}

export interface CerrarCampanaBody {
  campanaHash: string;
  cerradaPor?: string;
  cierreConAdvertencia: boolean;
  motivoCierre?: string | null;
}

export async function cerrarCampana(id: string, body: CerrarCampanaBody): Promise<Campana> {
  const { rows } = await pool.query<Campana>(
    `UPDATE campanas SET
       estado = 'CERRADA', campana_hash = $1, cerrada_por = $2,
       fecha_cierre = now(), cierre_con_advertencia = $3, motivo_cierre = $4
     WHERE id = $5
     RETURNING ${CAMPANA_COLUMNS_RETURNING}`,
    [body.campanaHash, body.cerradaPor ?? null, body.cierreConAdvertencia, body.motivoCierre ?? null, id]
  );
  return rows[0];
}

export async function abrirCampana(id: string): Promise<Campana> {
  const { rows } = await pool.query<Campana>(
    `UPDATE campanas SET estado = 'ABIERTA' WHERE id = $1 RETURNING ${CAMPANA_COLUMNS_RETURNING}`,
    [id]
  );
  return rows[0];
}

export async function updateCampanaTxHash(id: string, txHash: string): Promise<Campana> {
  const { rows } = await pool.query<Campana>(
    `UPDATE campanas SET tx_hash = $1 WHERE id = $2 RETURNING ${CAMPANA_COLUMNS_RETURNING}`,
    [txHash, id]
  );
  return rows[0];
}

// ── Campana-Tecnicos ─────────────────────────────────────────────────────────

export async function countTecnicosByCampana(campanaId: string): Promise<number> {
  const { rows } = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM campana_tecnicos WHERE campana_id = $1`,
    [campanaId]
  );
  return rows[0].n;
}

export interface AsignarTecnicoBody {
  campanaId: string;
  posicion: number;
  tecnicoId: string;
  camposAsignados: string[];
}

export async function upsertCampanaTecnico(body: AsignarTecnicoBody): Promise<unknown> {
  const { rows } = await pool.query(
    `INSERT INTO campana_tecnicos (campana_id, posicion, tecnico_id, campos_asignados)
     VALUES ($1,$2,$3,$4::jsonb)
     ON CONFLICT (campana_id, posicion)
     DO UPDATE SET tecnico_id = EXCLUDED.tecnico_id, campos_asignados = EXCLUDED.campos_asignados
     RETURNING id, campana_id AS "campanaId", posicion, tecnico_id AS "tecnicoId", campos_asignados AS "camposAsignados"`,
    [body.campanaId, body.posicion, body.tecnicoId, JSON.stringify(body.camposAsignados)]
  );
  const asignacion = rows[0];
  const { rows: tecnicoRows } = await pool.query(
    `SELECT nombres, apellidos FROM usuarios WHERE id = $1`,
    [body.tecnicoId]
  );
  return { ...asignacion, tecnico: tecnicoRows[0] ?? null };
}

export async function listCampanaTecnicos(campanaId: string): Promise<unknown[]> {
  const { rows } = await pool.query(
    `SELECT ct.id, ct.campana_id AS "campanaId", ct.posicion, ct.campos_asignados AS "camposAsignados", ct.created_at AS "createdAt",
            u.id AS "tecnicoId", u.nombres AS "tecnicoNombres", u.apellidos AS "tecnicoApellidos", u.email AS "tecnicoEmail"
     FROM campana_tecnicos ct
     JOIN usuarios u ON u.id = ct.tecnico_id
     WHERE ct.campana_id = $1
     ORDER BY ct.posicion ASC`,
    [campanaId]
  );
  return rows.map((t: any) => ({
    id: t.id,
    campanaId: t.campanaId,
    posicion: t.posicion,
    camposAsignados: t.camposAsignados,
    createdAt: t.createdAt,
    tecnico: { id: t.tecnicoId, nombres: t.tecnicoNombres, apellidos: t.tecnicoApellidos, email: t.tecnicoEmail },
  }));
}

export async function listCampanaTecnicosRaw(campanaId: string): Promise<CampanaTecnico[]> {
  const { rows } = await pool.query<CampanaTecnico>(
    `SELECT id, campana_id AS "campanaId", tecnico_id AS "tecnicoId", posicion,
            campos_asignados AS "camposAsignados", created_at AS "createdAt"
     FROM campana_tecnicos WHERE campana_id = $1 ORDER BY posicion ASC`,
    [campanaId]
  );
  return rows;
}

// ── Registros de planta ──────────────────────────────────────────────────────

export async function getRegistroActivoPorPlanta(campanaId: string, plantaId: string): Promise<
  (RegistroPlanta & { aportes: AporteTecnico[] }) | null
> {
  const { rows } = await pool.query<RegistroPlanta>(
    `SELECT ${REGISTRO_COLUMNS} FROM registros_planta rp
     WHERE rp.campana_id = $1 AND rp.planta_id = $2 AND rp.estado != 'INVALIDADO'
     LIMIT 1`,
    [campanaId, plantaId]
  );
  const registro = rows[0];
  if (!registro) return null;

  const { rows: aportes } = await pool.query<AporteTecnico>(
    `SELECT ${APORTE_COLUMNS} FROM aportes_tecnicos a WHERE a.registro_planta_id = $1`,
    [registro.id]
  );
  return { ...registro, aportes };
}

export async function getMaxConsecutivoCampana(campanaId: string): Promise<number> {
  const { rows } = await pool.query<{ max: number | null }>(
    `SELECT max(consecutivo) AS max FROM registros_planta WHERE campana_id = $1`,
    [campanaId]
  );
  return rows[0].max ?? 0;
}

export async function createRegistroPlanta(body: {
  campanaId: string;
  plantaId: string;
  consecutivo: number;
}): Promise<RegistroPlanta & { aportes: AporteTecnico[] }> {
  const { rows } = await pool.query<RegistroPlanta>(
    `INSERT INTO registros_planta (campana_id, planta_id, consecutivo, fecha_evento)
     VALUES ($1,$2,$3, now())
     RETURNING ${REGISTRO_COLUMNS_RETURNING}`,
    [body.campanaId, body.plantaId, body.consecutivo]
  );
  return { ...rows[0], aportes: [] };
}

export async function updateRegistroPlantaEstado(
  id: string,
  fields: { estado: string; contentHash?: string | null }
): Promise<RegistroPlanta> {
  const { rows } = await pool.query<RegistroPlanta>(
    `UPDATE registros_planta SET estado = $1, content_hash = COALESCE($2, content_hash) WHERE id = $3
     RETURNING ${REGISTRO_COLUMNS_RETURNING}`,
    [fields.estado, fields.contentHash ?? null, id]
  );
  return rows[0];
}

export async function getRegistroAdulterado(campanaId: string, plantaId: string): Promise<RegistroPlanta | null> {
  const { rows } = await pool.query<RegistroPlanta>(
    `SELECT ${REGISTRO_COLUMNS} FROM registros_planta rp
     WHERE rp.campana_id = $1 AND rp.planta_id = $2 AND rp.estado = 'ADULTERADO'
     LIMIT 1`,
    [campanaId, plantaId]
  );
  return rows[0] ?? null;
}

export async function invalidarRegistro(id: string, adulteradoDetectadoEn: Date): Promise<RegistroPlanta> {
  const { rows } = await pool.query<RegistroPlanta>(
    `UPDATE registros_planta SET estado = 'INVALIDADO', adulterado_detectado_en = COALESCE(adulterado_detectado_en, $1)
     WHERE id = $2 RETURNING ${REGISTRO_COLUMNS_RETURNING}`,
    [adulteradoDetectadoEn, id]
  );
  return rows[0];
}

export async function linkRegistroReemplazante(registroInvalidadoId: string, nuevoRegistroId: string): Promise<void> {
  await pool.query(`UPDATE registros_planta SET registro_reemplazante_id = $1 WHERE id = $2`, [
    nuevoRegistroId,
    registroInvalidadoId,
  ]);
}

export async function marcarRegistroAdulterado(id: string): Promise<void> {
  await pool.query(
    `UPDATE registros_planta SET estado = 'ADULTERADO', adulterado_detectado_en = now(), adulterado_detectado_por = 'sistema'
     WHERE id = $1`,
    [id]
  );
}

// ── Aportes de tecnico ───────────────────────────────────────────────────────

export interface CreateAporteBody {
  registroPlantaId: string;
  campanaId: string;
  tecnicoId: string;
  posicion: number;
  campos: Record<string, unknown>;
  fotoHash: string | null;
  audioHash: string | null;
  contentHash: string;
  hashVerificado: boolean;
  hashRechazMotivo: string | null;
  latitud: number | null;
  longitud: number | null;
  fechaAporte: Date;
}

export async function createAporteTecnico(body: CreateAporteBody): Promise<AporteTecnico> {
  const { rows } = await pool.query<AporteTecnico>(
    `INSERT INTO aportes_tecnicos
       (registro_planta_id, campana_id, tecnico_id, posicion, campos, foto_hash, audio_hash,
        content_hash, hash_verificado, hash_rechaz_motivo, latitud, longitud, fecha_aporte, sync_estado)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,'SINCRONIZADO')
     RETURNING ${APORTE_COLUMNS.replace(/a\./g, "")}`,
    [
      body.registroPlantaId,
      body.campanaId,
      body.tecnicoId,
      body.posicion,
      JSON.stringify(body.campos),
      body.fotoHash,
      body.audioHash,
      body.contentHash,
      body.hashVerificado,
      body.hashRechazMotivo,
      body.latitud,
      body.longitud,
      body.fechaAporte,
    ]
  );
  return rows[0];
}

export async function listAportesByRegistro(registroPlantaId: string): Promise<AporteTecnico[]> {
  const { rows } = await pool.query<AporteTecnico>(
    `SELECT ${APORTE_COLUMNS} FROM aportes_tecnicos a WHERE a.registro_planta_id = $1`,
    [registroPlantaId]
  );
  return rows;
}

// ── Vista movil ──────────────────────────────────────────────────────────────

export async function getCampanaMovilPorLote(loteId: string): Promise<unknown | null> {
  const campana = await getCampanaActivaOAbiertaPorLote(loteId);
  if (!campana) return null;

  const [lote, creador, tecnicos] = await Promise.all([
    pool
      .query(`SELECT codigo_lote AS "codigoLote", especie, variedad FROM lotes WHERE id = $1`, [loteId])
      .then((r) => r.rows[0] ?? null),
    pool.query(`SELECT nombres, apellidos FROM usuarios WHERE id = $1`, [campana.creadaPor]).then((r) => r.rows[0] ?? null),
    listCampanaTecnicosRaw(campana.id),
  ]);

  if (campana.estado === "ACTIVA") {
    return { campana: { ...campana, lote, creador }, registros: [], tecnicos };
  }

  const { rows: registros } = await pool.query(
    `SELECT ${REGISTRO_COLUMNS} FROM registros_planta rp WHERE rp.campana_id = $1 AND rp.estado != 'INVALIDADO'`,
    [campana.id]
  );
  const registroIds = registros.map((r: any) => r.id);
  let aportesPorRegistro = new Map<string, any[]>();
  if (registroIds.length > 0) {
    const { rows: aportes } = await pool.query(
      `SELECT id, registro_planta_id AS "registroPlantaId", tecnico_id AS "tecnicoId", posicion, campos,
              foto_hash AS "fotoHash", audio_hash AS "audioHash",
              fecha_aporte AS "fechaAporte", latitud, longitud, content_hash AS "contentHash"
       FROM aportes_tecnicos WHERE registro_planta_id = ANY($1)`,
      [registroIds]
    );
    for (const a of aportes) {
      const arr = aportesPorRegistro.get(a.registroPlantaId) ?? [];
      arr.push(a);
      aportesPorRegistro.set(a.registroPlantaId, arr);
    }
  }
  const registrosConAportes = registros.map((r: any) => ({ ...r, aportes: aportesPorRegistro.get(r.id) ?? [] }));

  return { campana: { ...campana, lote, creador }, registros: registrosConAportes, tecnicos };
}

export async function listRegistrosConAportesPorPlanta(plantaId: string): Promise<unknown[]> {
  const { rows: registros } = await pool.query(
    `SELECT ${REGISTRO_COLUMNS}, c.id AS "campanaCampanaId", c.nombre AS "campanaNombre", c.codigo AS "campanaCodigo"
     FROM registros_planta rp
     JOIN campanas c ON c.id = rp.campana_id
     WHERE rp.planta_id = $1 AND rp.estado != 'INVALIDADO'
     ORDER BY rp.fecha_evento DESC`,
    [plantaId]
  );
  if (registros.length === 0) return [];

  const registroIds = registros.map((r: any) => r.id);
  const { rows: aportes } = await pool.query(
    `SELECT id, registro_planta_id AS "registroPlantaId", tecnico_id AS "tecnicoId", posicion, campos,
            foto_hash AS "fotoHash", audio_hash AS "audioHash",
            fecha_aporte AS "fechaAporte", latitud, longitud, content_hash AS "contentHash", hash_verificado AS "hashVerificado"
     FROM aportes_tecnicos WHERE registro_planta_id = ANY($1) ORDER BY posicion ASC`,
    [registroIds]
  );
  const aportesPorRegistro = new Map<string, any[]>();
  for (const a of aportes) {
    const arr = aportesPorRegistro.get(a.registroPlantaId) ?? [];
    arr.push(a);
    aportesPorRegistro.set(a.registroPlantaId, arr);
  }

  return registros.map((r: any) => ({
    id: r.id,
    consecutivo: r.consecutivo,
    estado: r.estado,
    fechaEvento: r.fechaEvento,
    campana: { id: r.campanaCampanaId, nombre: r.campanaNombre, codigo: r.campanaCodigo },
    aportes: aportesPorRegistro.get(r.id) ?? [],
  }));
}

// ── Verificaciones de integridad ─────────────────────────────────────────────

export async function crearVerificacionIntegridad(body: {
  campanaId: string;
  ejecutadoPorId: string;
  totalRegistros: number;
  aprobados: number;
  adulterados: number;
  ok: boolean;
  detalles: Array<{ registroId: string; plantaId: string; hashGuardado: string; hashCalculado: string; resultado: string }>;
}): Promise<VerificacionIntegridad> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<VerificacionIntegridad>(
      `INSERT INTO verificaciones_integridad
         (campana_id, ejecutado_por_id, total_registros, aprobados, adulterados, ok)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, campana_id AS "campanaId", ejecutado_por_id AS "ejecutadoPorId",
                 fecha_verificacion AS "fechaVerificacion", total_registros AS "totalRegistros",
                 aprobados, adulterados, ok`,
      [body.campanaId, body.ejecutadoPorId, body.totalRegistros, body.aprobados, body.adulterados, body.ok]
    );
    const verificacion = rows[0];

    for (const d of body.detalles) {
      await client.query(
        `INSERT INTO verificaciones_registro_detalle
           (verificacion_id, registro_id, planta_id, hash_guardado, hash_calculado, resultado)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [verificacion.id, d.registroId, d.plantaId, d.hashGuardado, d.hashCalculado, d.resultado]
      );
    }

    await client.query("COMMIT");
    return verificacion;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function listVerificacionesIntegridad(campanaId: string): Promise<unknown[]> {
  const { rows: verificaciones } = await pool.query(
    `SELECT v.id, v.campana_id AS "campanaId", v.ejecutado_por_id AS "ejecutadoPorId",
            v.fecha_verificacion AS "fechaVerificacion", v.total_registros AS "totalRegistros",
            v.aprobados, v.adulterados, v.ok,
            u.nombres AS "ejecutadoPorNombres", u.apellidos AS "ejecutadoPorApellidos"
     FROM verificaciones_integridad v
     JOIN usuarios u ON u.id = v.ejecutado_por_id
     WHERE v.campana_id = $1
     ORDER BY v.fecha_verificacion DESC`,
    [campanaId]
  );
  if (verificaciones.length === 0) return [];

  const verifIds = verificaciones.map((v: any) => v.id);
  const { rows: detalles } = await pool.query(
    `SELECT id, verificacion_id AS "verificacionId", registro_id AS "registroId", planta_id AS "plantaId",
            hash_guardado AS "hashGuardado", hash_calculado AS "hashCalculado", resultado
     FROM verificaciones_registro_detalle
     WHERE verificacion_id = ANY($1)
     ORDER BY planta_id ASC`,
    [verifIds]
  );
  const detallesPorVerificacion = new Map<string, any[]>();
  for (const d of detalles) {
    const arr = detallesPorVerificacion.get(d.verificacionId) ?? [];
    arr.push(d);
    detallesPorVerificacion.set(d.verificacionId, arr);
  }

  return verificaciones.map((v: any) => ({
    ...v,
    ejecutadoPor: { nombres: v.ejecutadoPorNombres, apellidos: v.ejecutadoPorApellidos },
    detalles: detallesPorVerificacion.get(v.id) ?? [],
  }));
}

export async function listRegistrosConCampanaCodigo(campanaId: string): Promise<
  Array<{ id: string; consecutivo: number | null; campanaCodigo: string | null }>
> {
  const { rows } = await pool.query(
    `SELECT rp.id, rp.consecutivo, c.codigo AS "campanaCodigo"
     FROM registros_planta rp JOIN campanas c ON c.id = rp.campana_id
     WHERE rp.campana_id = $1`,
    [campanaId]
  );
  return rows;
}

// ── Verificacion de hash de campana (nivel 3, vs Polygon) ────────────────────

export async function getCampanaParaVerificarHash(campanaId: string): Promise<
  | (Pick<Campana, "campanaHash" | "txHash" | "estado"> & {
      registros: Array<{ plantaId: string; contentHash: string | null }>;
    })
  | null
> {
  const campana = await getCampanaById(campanaId);
  if (!campana) return null;

  const { rows: registros } = await pool.query<{ plantaId: string; contentHash: string | null }>(
    `SELECT planta_id AS "plantaId", content_hash AS "contentHash"
     FROM registros_planta WHERE campana_id = $1 AND estado = 'COMPLETO' ORDER BY planta_id ASC`,
    [campanaId]
  );

  return { campanaHash: campana.campanaHash, txHash: campana.txHash, estado: campana.estado, registros };
}

export async function crearVerificacionHashCampana(body: {
  campanaId: string;
  ejecutadoPorId: string;
  ok: boolean;
  hashGuardado: string;
  hashRecalculado: string;
  totalRegistros: number;
  txHash: string | null;
  hashEnPolygon: string | null;
  blockNumber: number | null;
  timestampPolygon: number | null;
  okDB: boolean;
  okPolygon: boolean | null;
  polygonError: string | null;
}): Promise<VerificacionHashCampana> {
  const { rows } = await pool.query<VerificacionHashCampana>(
    `INSERT INTO verificaciones_hash_campana
       (campana_id, ejecutado_por_id, ok, hash_guardado, hash_recalculado, total_registros,
        tx_hash, hash_en_polygon, block_number, timestamp_polygon, ok_db, ok_polygon, polygon_error)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING id, campana_id AS "campanaId", ejecutado_por_id AS "ejecutadoPorId",
               fecha_verificacion AS "fechaVerificacion", ok,
               hash_guardado AS "hashGuardado", hash_recalculado AS "hashRecalculado",
               total_registros AS "totalRegistros", tx_hash AS "txHash",
               hash_en_polygon AS "hashEnPolygon", block_number AS "blockNumber",
               timestamp_polygon AS "timestampPolygon", ok_db AS "okDB", ok_polygon AS "okPolygon",
               polygon_error AS "polygonError"`,
    [
      body.campanaId,
      body.ejecutadoPorId,
      body.ok,
      body.hashGuardado,
      body.hashRecalculado,
      body.totalRegistros,
      body.txHash,
      body.hashEnPolygon,
      body.blockNumber,
      body.timestampPolygon,
      body.okDB,
      body.okPolygon,
      body.polygonError,
    ]
  );
  return rows[0];
}

export async function listHistorialHashCampana(campanaId: string): Promise<unknown[]> {
  const { rows } = await pool.query(
    `SELECT v.id, v.campana_id AS "campanaId", v.fecha_verificacion AS "fechaVerificacion", v.ok,
            v.hash_guardado AS "hashGuardado", v.hash_recalculado AS "hashRecalculado",
            v.total_registros AS "totalRegistros", v.tx_hash AS "txHash",
            v.hash_en_polygon AS "hashEnPolygon", v.block_number AS "blockNumber",
            v.timestamp_polygon AS "timestampPolygon", v.ok_db AS "okDB", v.ok_polygon AS "okPolygon",
            v.polygon_error AS "polygonError",
            u.nombres AS "ejecutadoPorNombres", u.apellidos AS "ejecutadoPorApellidos"
     FROM verificaciones_hash_campana v
     JOIN usuarios u ON u.id = v.ejecutado_por_id
     WHERE v.campana_id = $1
     ORDER BY v.fecha_verificacion DESC`,
    [campanaId]
  );
  return rows.map((v: any) => ({ ...v, ejecutadoPor: { nombres: v.ejecutadoPorNombres, apellidos: v.ejecutadoPorApellidos } }));
}

// ── Auto-sellado (checker periodico) ─────────────────────────────────────────

// Campanas ABIERTA donde TODAS las plantas activas del lote ya tienen un
// registro COMPLETO (y ningun registro activo en otro estado) — candidatas a
// cierre automatico que quedaron pendientes (ej. el servidor se reinicio
// justo despues del ultimo aporte, antes de que intentarCierreAutomatico
// corriera). Espejo de getProcessesReadyToSeal() en SSE.
export async function listCampanasListasParaSellar(): Promise<string[]> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT c.id
     FROM campanas c
     WHERE c.estado = 'ABIERTA'
       AND (SELECT count(*)::int FROM plantas p WHERE p.lote_id = c.lote_id AND p.activo = true) > 0
       AND (SELECT count(*)::int FROM plantas p WHERE p.lote_id = c.lote_id AND p.activo = true)
           = (SELECT count(*)::int FROM registros_planta rp WHERE rp.campana_id = c.id AND rp.estado = 'COMPLETO')
       AND NOT EXISTS (
         SELECT 1 FROM registros_planta rp
         WHERE rp.campana_id = c.id AND rp.estado NOT IN ('COMPLETO', 'INVALIDADO')
       )`
  );
  return rows.map((r) => r.id);
}
