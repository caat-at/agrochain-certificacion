import pool from "./client.js";
import type { Usuario, Organizacion, Predio, Propietario, Parcela, Pais, Departamento, Municipio, Especie, Lote, Planta, Inspeccion, Certificado, EventoProduccion, EvidenciaBinaria, AgricultorContacto } from "../types.js";

// =============================================================================
// AGROCHAIN - Acceso a datos SQL directo (sin ORM)
// Patron replicado de SSE (backend/src/db/queries.ts): funciones async por
// dominio, agrupadas por seccion, transacciones manuales solo en inserts
// multi-tabla atomicos, UPDATE dinamico con arrays sets[]/params[].
//
// Las columnas de Postgres son snake_case; cada SELECT usa alias `AS "campo"`
// para devolver camelCase y no tener que tocar el resto del codigo de rutas
// (heredado de Prisma, que ya trabajaba en camelCase).
//
// Se completa ruta por ruta segun el orden de migracion del plan.
// =============================================================================

// ── Usuarios ─────────────────────────────────────────────────────────────────

const USUARIO_COLUMNS = `
  id, nombres, apellidos,
  tipo_documento     AS "tipoDocumento",
  numero_documento   AS "numeroDocumento",
  email, username, telefono,
  wallet_address     AS "walletAddress",
  password_hash      AS "passwordHash",
  cognito_sub        AS "cognitoSub",
  rol, activo,
  created_at         AS "createdAt",
  updated_at         AS "updatedAt"
`;

export async function getUsuarioById(id: string): Promise<Usuario | null> {
  const { rows } = await pool.query<Usuario>(
    `SELECT ${USUARIO_COLUMNS} FROM usuarios WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function getUsuarioByEmail(email: string): Promise<Usuario | null> {
  const { rows } = await pool.query<Usuario>(
    `SELECT ${USUARIO_COLUMNS} FROM usuarios WHERE email = $1`,
    [email]
  );
  return rows[0] ?? null;
}

export async function getUsuarioByUsername(username: string): Promise<Usuario | null> {
  const { rows } = await pool.query<Usuario>(
    `SELECT ${USUARIO_COLUMNS} FROM usuarios WHERE username = $1`,
    [username]
  );
  return rows[0] ?? null;
}

// Login con username o email indistinto (patron SSE) — Cognito sigue usando
// email como Username inmutable, esto solo resuelve la credencial local
// antes de llamar al IdP con el email real (ver routes/auth.ts).
export async function getUsuarioByUsernameOrEmail(credencial: string): Promise<Usuario | null> {
  const { rows } = await pool.query<Usuario>(
    `SELECT ${USUARIO_COLUMNS} FROM usuarios WHERE username = $1 OR email = $1`,
    [credencial]
  );
  return rows[0] ?? null;
}

export async function getUsuarioByNumeroDocumento(numeroDocumento: string): Promise<Usuario | null> {
  const { rows } = await pool.query<Usuario>(
    `SELECT ${USUARIO_COLUMNS} FROM usuarios WHERE numero_documento = $1`,
    [numeroDocumento]
  );
  return rows[0] ?? null;
}

export async function getUsuarioByCognitoSub(cognitoSub: string): Promise<Usuario | null> {
  const { rows } = await pool.query<Usuario>(
    `SELECT ${USUARIO_COLUMNS} FROM usuarios WHERE cognito_sub = $1`,
    [cognitoSub]
  );
  return rows[0] ?? null;
}

export async function listUsuarios(filtros: { rol?: string } = {}): Promise<Usuario[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filtros.rol) {
    params.push(filtros.rol);
    conditions.push(`rol = $${params.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await pool.query<Usuario>(
    `SELECT ${USUARIO_COLUMNS} FROM usuarios ${where} ORDER BY created_at ASC`,
    params
  );
  return rows;
}

export interface CreateUsuarioBody {
  nombres: string;
  apellidos: string;
  tipoDocumento: string;
  numeroDocumento: string;
  email?: string | null;
  username?: string | null;
  telefono?: string | null;
  walletAddress?: string | null;
  passwordHash?: string | null;
  cognitoSub?: string | null;
  rol: string;
}

export async function createUsuario(body: CreateUsuarioBody): Promise<Usuario> {
  const { rows } = await pool.query<Usuario>(
    `INSERT INTO usuarios
       (nombres, apellidos, tipo_documento, numero_documento, email, telefono, wallet_address, password_hash, cognito_sub, rol, username)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING ${USUARIO_COLUMNS}`,
    [
      body.nombres,
      body.apellidos,
      body.tipoDocumento,
      body.numeroDocumento,
      body.email ?? null,
      body.telefono ?? null,
      body.walletAddress ?? null,
      body.passwordHash ?? null,
      body.cognitoSub ?? null,
      body.rol,
      body.username ?? null,
    ]
  );
  return rows[0];
}

export interface UpdateUsuarioFields {
  nombres?: string;
  apellidos?: string;
  email?: string | null;
  username?: string | null;
  telefono?: string | null;
  walletAddress?: string | null;
  passwordHash?: string;
  cognitoSub?: string | null;
  rol?: string;
  activo?: boolean;
}

export async function updateUsuario(
  id: string,
  fields: UpdateUsuarioFields
): Promise<Usuario | null | "no-changes"> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (fields.nombres !== undefined) { params.push(fields.nombres); sets.push(`nombres = $${params.length}`); }
  if (fields.apellidos !== undefined) { params.push(fields.apellidos); sets.push(`apellidos = $${params.length}`); }
  if (fields.email !== undefined) { params.push(fields.email); sets.push(`email = $${params.length}`); }
  if (fields.username !== undefined) { params.push(fields.username); sets.push(`username = $${params.length}`); }
  if (fields.telefono !== undefined) { params.push(fields.telefono); sets.push(`telefono = $${params.length}`); }
  if (fields.walletAddress !== undefined) { params.push(fields.walletAddress); sets.push(`wallet_address = $${params.length}`); }
  if (fields.passwordHash !== undefined) { params.push(fields.passwordHash); sets.push(`password_hash = $${params.length}`); }
  if (fields.cognitoSub !== undefined) { params.push(fields.cognitoSub); sets.push(`cognito_sub = $${params.length}`); }
  if (fields.rol !== undefined) { params.push(fields.rol); sets.push(`rol = $${params.length}`); }
  if (fields.activo !== undefined) { params.push(fields.activo); sets.push(`activo = $${params.length}`); }

  if (sets.length === 0) return "no-changes";

  params.push(id);
  const { rows } = await pool.query<Usuario>(
    `UPDATE usuarios SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING ${USUARIO_COLUMNS}`,
    params
  );
  return rows[0] ?? null;
}

// ── Organizaciones ───────────────────────────────────────────────────────────

const ORGANIZACION_COLUMNS = `
  id, nombre, nit, tipo, resolucion, vigencia, direccion, departamento, municipio,
  activo,
  created_at AS "createdAt"
`;

export async function getOrganizacionById(id: string): Promise<Organizacion | null> {
  const { rows } = await pool.query<Organizacion>(
    `SELECT ${ORGANIZACION_COLUMNS} FROM organizaciones WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

// ── Propietarios (dueño legal del predio, sin cuenta de usuario) ───────────────

const PROPIETARIO_COLUMNS = `
  id,
  nombres, apellidos,
  tipo_documento    AS "tipoDocumento",
  numero_documento  AS "numeroDocumento",
  email, telefono, direccion, activo,
  created_at        AS "createdAt",
  updated_at        AS "updatedAt"
`;

export async function listPropietarios(): Promise<Propietario[]> {
  const { rows } = await pool.query<Propietario>(
    `SELECT ${PROPIETARIO_COLUMNS} FROM propietarios ORDER BY created_at DESC`
  );
  return rows;
}

export async function getPropietarioById(id: string): Promise<Propietario | null> {
  const { rows } = await pool.query<Propietario>(
    `SELECT ${PROPIETARIO_COLUMNS} FROM propietarios WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export interface CreatePropietarioBody {
  nombres: string;
  apellidos: string;
  tipoDocumento: string;
  numeroDocumento: string;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
}

export async function createPropietario(body: CreatePropietarioBody): Promise<Propietario> {
  const { rows } = await pool.query<Propietario>(
    `INSERT INTO propietarios
       (nombres, apellidos, tipo_documento, numero_documento, email, telefono, direccion)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING ${PROPIETARIO_COLUMNS}`,
    [
      body.nombres,
      body.apellidos,
      body.tipoDocumento,
      body.numeroDocumento,
      body.email ?? null,
      body.telefono ?? null,
      body.direccion ?? null,
    ]
  );
  return rows[0];
}

export interface UpdatePropietarioFields {
  nombres?: string;
  apellidos?: string;
  tipoDocumento?: string;
  numeroDocumento?: string;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  activo?: boolean;
}

export async function updatePropietario(
  id: string,
  fields: UpdatePropietarioFields
): Promise<Propietario | null | "no-changes"> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (fields.nombres !== undefined) { params.push(fields.nombres); sets.push(`nombres = $${params.length}`); }
  if (fields.apellidos !== undefined) { params.push(fields.apellidos); sets.push(`apellidos = $${params.length}`); }
  if (fields.tipoDocumento !== undefined) { params.push(fields.tipoDocumento); sets.push(`tipo_documento = $${params.length}`); }
  if (fields.numeroDocumento !== undefined) { params.push(fields.numeroDocumento); sets.push(`numero_documento = $${params.length}`); }
  if (fields.email !== undefined) { params.push(fields.email); sets.push(`email = $${params.length}`); }
  if (fields.telefono !== undefined) { params.push(fields.telefono); sets.push(`telefono = $${params.length}`); }
  if (fields.direccion !== undefined) { params.push(fields.direccion); sets.push(`direccion = $${params.length}`); }
  if (fields.activo !== undefined) { params.push(fields.activo); sets.push(`activo = $${params.length}`); }

  if (sets.length === 0) return "no-changes";

  params.push(id);
  const { rows } = await pool.query<Propietario>(
    `UPDATE propietarios SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING ${PROPIETARIO_COLUMNS}`,
    params
  );
  return rows[0] ?? null;
}

// ── Catalogo de ubicacion (pais/departamento/municipio) ─────────────────────
// Lecturas simples — catalogos pequeños, sin paginacion.

export async function listPaises(): Promise<Pais[]> {
  const { rows } = await pool.query<Pais>(`SELECT codigo, nombre FROM paises ORDER BY nombre`);
  return rows;
}

export async function listDepartamentos(paisCod?: string): Promise<Departamento[]> {
  const where = paisCod ? `WHERE pais_cod = $1` : "";
  const params = paisCod ? [paisCod] : [];
  const { rows } = await pool.query<Departamento>(
    `SELECT codigo, nombre, pais_cod AS "paisCod" FROM departamentos ${where} ORDER BY nombre`,
    params
  );
  return rows;
}

export async function listMunicipios(departamentoCod?: string): Promise<Municipio[]> {
  const where = departamentoCod ? `WHERE departamento_cod = $1` : "";
  const params = departamentoCod ? [departamentoCod] : [];
  const { rows } = await pool.query<Municipio>(
    `SELECT codigo, nombre, departamento_cod AS "departamentoCod" FROM municipios ${where} ORDER BY nombre`,
    params
  );
  return rows;
}

// ── Catalogo de especies (tipo de ciclo PERENNE/ANUAL) ───────────────────────
// PERENNE: la planta vive varios ciclos de cosecha sin retirarse (cafe, cacao).
// ANUAL: la planta se retira tras cosechar, el siguiente lote necesita plantas nuevas.

export async function listEspecies(tipoCiclo?: "PERENNE" | "ANUAL"): Promise<Especie[]> {
  const where = tipoCiclo ? `WHERE tipo_ciclo = $1 AND activo = true` : `WHERE activo = true`;
  const params = tipoCiclo ? [tipoCiclo] : [];
  const { rows } = await pool.query<Especie>(
    `SELECT id, nombre_cientifico AS "nombreCientifico", nombre_comun AS "nombreComun",
            tipo_ciclo AS "tipoCiclo", activo
     FROM especies ${where} ORDER BY nombre_comun`,
    params
  );
  return rows;
}

// Resuelve el tipo de ciclo por nombre libre (cientifico o comun, case-insensitive) —
// usado al crear un lote para decidir si sugerir reuso de plantas. null si no hay match
// en el catalogo (no bloquea la creacion del lote).
export async function resolverTipoCicloPorNombre(nombreEspecie: string): Promise<"PERENNE" | "ANUAL" | null> {
  const { rows } = await pool.query<{ tipoCiclo: "PERENNE" | "ANUAL" }>(
    `SELECT tipo_ciclo AS "tipoCiclo" FROM especies
     WHERE (lower(nombre_cientifico) = lower($1) OR lower(nombre_comun) = lower($1)) AND activo = true
     LIMIT 1`,
    [nombreEspecie]
  );
  return rows[0]?.tipoCiclo ?? null;
}

// ── Parcelas (subdivision fisica permanente del predio) ─────────────────────

const PARCELA_COLUMNS = `
  id,
  predio_id       AS "predioId",
  codigo_parcela  AS "codigoParcela",
  nombre,
  area_ha         AS "areaHa",
  latitud, longitud,
  uso_actual      AS "usoActual",
  activo,
  created_at      AS "createdAt",
  updated_at      AS "updatedAt"
`;

export async function listParcelas(predioId?: string): Promise<Parcela[]> {
  const where = predioId ? `WHERE predio_id = $1` : "";
  const params = predioId ? [predioId] : [];
  const { rows } = await pool.query<Parcela>(
    `SELECT ${PARCELA_COLUMNS} FROM parcelas ${where} ORDER BY created_at DESC`,
    params
  );
  return rows;
}

export async function getParcelaById(id: string): Promise<Parcela | null> {
  const { rows } = await pool.query<Parcela>(
    `SELECT ${PARCELA_COLUMNS} FROM parcelas WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function countParcelas(): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(`SELECT count(*)::text AS count FROM parcelas`);
  return parseInt(rows[0].count, 10);
}

export interface CreateParcelaBody {
  predioId: string;
  codigoParcela: string;
  nombre?: string | null;
  areaHa: number;
  latitud?: number | null;
  longitud?: number | null;
  usoActual?: string | null;
}

export async function createParcela(body: CreateParcelaBody): Promise<Parcela> {
  const { rows } = await pool.query<Parcela>(
    `INSERT INTO parcelas (predio_id, codigo_parcela, nombre, area_ha, latitud, longitud, uso_actual)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING ${PARCELA_COLUMNS}`,
    [
      body.predioId,
      body.codigoParcela,
      body.nombre ?? null,
      body.areaHa,
      body.latitud ?? null,
      body.longitud ?? null,
      body.usoActual ?? null,
    ]
  );
  return rows[0];
}

export interface UpdateParcelaFields {
  predioId?: string;
  nombre?: string | null;
  areaHa?: number;
  latitud?: number | null;
  longitud?: number | null;
  usoActual?: string | null;
  activo?: boolean;
}

export async function updateParcela(
  id: string,
  fields: UpdateParcelaFields
): Promise<Parcela | null | "no-changes"> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (fields.predioId !== undefined) { params.push(fields.predioId); sets.push(`predio_id = $${params.length}`); }
  if (fields.nombre !== undefined) { params.push(fields.nombre); sets.push(`nombre = $${params.length}`); }
  if (fields.areaHa !== undefined) { params.push(fields.areaHa); sets.push(`area_ha = $${params.length}`); }
  if (fields.latitud !== undefined) { params.push(fields.latitud); sets.push(`latitud = $${params.length}`); }
  if (fields.longitud !== undefined) { params.push(fields.longitud); sets.push(`longitud = $${params.length}`); }
  if (fields.usoActual !== undefined) { params.push(fields.usoActual); sets.push(`uso_actual = $${params.length}`); }
  if (fields.activo !== undefined) { params.push(fields.activo); sets.push(`activo = $${params.length}`); }

  if (sets.length === 0) return "no-changes";

  params.push(id);
  const { rows } = await pool.query<Parcela>(
    `UPDATE parcelas SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING ${PARCELA_COLUMNS}`,
    params
  );
  return rows[0] ?? null;
}

// ── Predios ───────────────────────────────────────────────────────────────────

// Columnas prefijadas con "predios." (en vez de solo cuando hace falta) para
// que esta constante siga siendo segura de usar con JOIN a otras tablas
// (ej. usuarios, que comparte id/activo/created_at/updated_at) sin volver a
// producir "column reference is ambiguous".
const PREDIO_COLUMNS = `
  predios.id,
  predios.agricultor_id              AS "agricultorId",
  predios.propietario_id             AS "propietarioId",
  predios.nombre_predio              AS "nombrePredio",
  predios.codigo_predio              AS "codigoPredio",
  predios.codigo_ica                 AS "codigoIca",
  predios.matricula_inmobiliaria     AS "matriculaInmobiliaria",
  predios.departamento, predios.municipio, predios.vereda, predios.direccion,
  predios.departamento_cod           AS "departamentoCod",
  predios.municipio_cod              AS "municipioCod",
  predios.latitud, predios.longitud,
  predios.altitud_msnm               AS "altitudMsnm",
  predios.area_total_ha              AS "areaTotalHa",
  predios.area_productiva_ha         AS "areaProductivaHa",
  predios.area_bosque_ha             AS "areaBosqueHa",
  predios.area_viveros_ha            AS "areaViverosHa",
  predios.fuente_agua                AS "fuenteAgua",
  predios.tipo_suelo                 AS "tipoSuelo",
  predios.pendiente_pct              AS "pendientePct",
  predios.uso_previo                 AS "usoPrevio",
  predios.certif_uso_suelo           AS "certifUsoSuelo",
  predios.tiene_bodega_agroquimicos  AS "tieneBodegaAgroquimicos",
  predios.tiene_agua_potable         AS "tieneAguaPotable",
  predios.tiene_sss_basicas          AS "tieneSSSBasicas",
  predios.tiene_zona_acopio          AS "tieneZonaAcopio",
  predios.activo,
  predios.created_at                 AS "createdAt",
  predios.updated_at                 AS "updatedAt"
`;

// Datos de contacto del agricultor (usuario operador) del predio, si tiene —
// ahora es opcional, ver propietario_id para el dueño legal sin cuenta.
const AGRICULTOR_PREDIO_COLUMNS = `
  CASE WHEN ag.id IS NULL THEN NULL ELSE json_build_object(
    'id', ag.id,
    'nombres', ag.nombres,
    'apellidos', ag.apellidos,
    'tipoDocumento', ag.tipo_documento,
    'numeroDocumento', ag.numero_documento,
    'email', ag.email,
    'telefono', ag.telefono
  ) END AS "agricultor"
`;

// Nombres legibles de departamento/municipio resueltos contra el catalogo
// real (departamentos/municipios) — predios.departamento/municipio (texto
// libre viejo) puede contener el codigo crudo tras una edicion, no el nombre.
const UBICACION_PREDIO_COLUMNS = `
  depto.nombre AS "departamentoNombre",
  muni.nombre  AS "municipioNombre"
`;

// Datos de contacto del propietario legal del predio (sin cuenta de usuario).
const PROPIETARIO_PREDIO_COLUMNS = `
  CASE WHEN prop.id IS NULL THEN NULL ELSE json_build_object(
    'id', prop.id,
    'nombres', prop.nombres,
    'apellidos', prop.apellidos,
    'tipoDocumento', prop.tipo_documento,
    'numeroDocumento', prop.numero_documento,
    'email', prop.email,
    'telefono', prop.telefono,
    'direccion', prop.direccion
  ) END AS "propietario"
`;

export async function getPredioById(id: string): Promise<Predio | null> {
  const { rows } = await pool.query<Predio>(
    `SELECT ${PREDIO_COLUMNS} FROM predios WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

// Mismas columnas sin alias de tabla, para usar en INSERT ... RETURNING
// (patron identico a LOTE_COLUMNS_RETURNING).
const PREDIO_COLUMNS_RETURNING = `
  id,
  agricultor_id              AS "agricultorId",
  propietario_id             AS "propietarioId",
  nombre_predio              AS "nombrePredio",
  codigo_predio              AS "codigoPredio",
  codigo_ica                 AS "codigoIca",
  matricula_inmobiliaria     AS "matriculaInmobiliaria",
  departamento, municipio, vereda, direccion,
  departamento_cod           AS "departamentoCod",
  municipio_cod              AS "municipioCod",
  latitud, longitud,
  altitud_msnm               AS "altitudMsnm",
  area_total_ha              AS "areaTotalHa",
  area_productiva_ha         AS "areaProductivaHa",
  area_bosque_ha             AS "areaBosqueHa",
  area_viveros_ha            AS "areaViverosHa",
  fuente_agua                AS "fuenteAgua",
  tipo_suelo                 AS "tipoSuelo",
  pendiente_pct              AS "pendientePct",
  uso_previo                 AS "usoPrevio",
  certif_uso_suelo           AS "certifUsoSuelo",
  tiene_bodega_agroquimicos  AS "tieneBodegaAgroquimicos",
  tiene_agua_potable         AS "tieneAguaPotable",
  tiene_sss_basicas          AS "tieneSSSBasicas",
  tiene_zona_acopio          AS "tieneZonaAcopio",
  activo,
  created_at                 AS "createdAt",
  updated_at                 AS "updatedAt"
`;

export interface CreatePredioBody {
  agricultorId?: string | null;
  propietarioId: string;
  nombrePredio: string;
  codigoPredio: string;
  codigoIca?: string | null;
  matriculaInmobiliaria?: string | null;
  departamentoCod: string;
  municipioCod: string;
  vereda?: string | null;
  direccion?: string | null;
  latitud: number;
  longitud: number;
  altitudMsnm?: number | null;
  areaTotalHa: number;
  areaProductivaHa?: number | null;
  areaBosqueHa?: number | null;
  areaViverosHa?: number | null;
  fuenteAgua?: string | null;
  tipoSuelo?: string | null;
  pendientePct?: number | null;
  usoPrevio?: string | null;
  certifUsoSuelo?: string | null;
  tieneBodegaAgroquimicos?: boolean;
  tieneAguaPotable?: boolean;
  tieneSSSBasicas?: boolean;
  tieneZonaAcopio?: boolean;
}

export async function countPredios(): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(`SELECT count(*)::text AS count FROM predios`);
  return parseInt(rows[0].count, 10);
}

// Nota: departamento/municipio (texto libre, columnas viejas NOT NULL) se
// siguen llenando con el mismo codigo que departamento_cod/municipio_cod
// (las columnas reales con FK) — evita romper la restriccion NOT NULL del
// schema base mientras esas columnas viejas no se eliminan (ver 08_parcelas_ubicacion.sql).
export async function createPredio(body: CreatePredioBody): Promise<Predio> {
  const { rows } = await pool.query<Predio>(
    `INSERT INTO predios
       (agricultor_id, propietario_id, nombre_predio, codigo_predio, codigo_ica, matricula_inmobiliaria,
        departamento, municipio, departamento_cod, municipio_cod, vereda, direccion, latitud, longitud, altitud_msnm,
        area_total_ha, area_productiva_ha, area_bosque_ha, area_viveros_ha,
        fuente_agua, tipo_suelo, pendiente_pct, uso_previo, certif_uso_suelo,
        tiene_bodega_agroquimicos, tiene_agua_potable, tiene_sss_basicas, tiene_zona_acopio)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
     RETURNING ${PREDIO_COLUMNS_RETURNING}`,
    [
      body.agricultorId ?? null,
      body.propietarioId,
      body.nombrePredio,
      body.codigoPredio,
      body.codigoIca ?? null,
      body.matriculaInmobiliaria ?? null,
      body.departamentoCod,
      body.municipioCod,
      body.departamentoCod,
      body.municipioCod,
      body.vereda ?? null,
      body.direccion ?? null,
      body.latitud,
      body.longitud,
      body.altitudMsnm ?? null,
      body.areaTotalHa,
      body.areaProductivaHa ?? null,
      body.areaBosqueHa ?? null,
      body.areaViverosHa ?? null,
      body.fuenteAgua ?? null,
      body.tipoSuelo ?? null,
      body.pendientePct ?? null,
      body.usoPrevio ?? null,
      body.certifUsoSuelo ?? null,
      body.tieneBodegaAgroquimicos ?? false,
      body.tieneAguaPotable ?? false,
      body.tieneSSSBasicas ?? false,
      body.tieneZonaAcopio ?? false,
    ]
  );
  return rows[0];
}

export interface UpdatePredioFields {
  propietarioId?: string;
  agricultorId?: string | null;
  nombrePredio?: string;
  codigoIca?: string | null;
  matriculaInmobiliaria?: string | null;
  departamentoCod?: string;
  municipioCod?: string;
  vereda?: string | null;
  direccion?: string | null;
  latitud?: number;
  longitud?: number;
  altitudMsnm?: number | null;
  areaTotalHa?: number;
  areaProductivaHa?: number | null;
  areaBosqueHa?: number | null;
  areaViverosHa?: number | null;
  fuenteAgua?: string | null;
  tipoSuelo?: string | null;
  pendientePct?: number | null;
  usoPrevio?: string | null;
  certifUsoSuelo?: string | null;
  tieneBodegaAgroquimicos?: boolean;
  tieneAguaPotable?: boolean;
  tieneSSSBasicas?: boolean;
  tieneZonaAcopio?: boolean;
  activo?: boolean;
}

export async function updatePredio(
  id: string,
  fields: UpdatePredioFields
): Promise<Predio | null | "no-changes"> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (fields.propietarioId !== undefined) { params.push(fields.propietarioId); sets.push(`propietario_id = $${params.length}`); }
  if (fields.agricultorId !== undefined) { params.push(fields.agricultorId); sets.push(`agricultor_id = $${params.length}`); }
  if (fields.nombrePredio !== undefined) { params.push(fields.nombrePredio); sets.push(`nombre_predio = $${params.length}`); }
  if (fields.codigoIca !== undefined) { params.push(fields.codigoIca); sets.push(`codigo_ica = $${params.length}`); }
  if (fields.matriculaInmobiliaria !== undefined) { params.push(fields.matriculaInmobiliaria); sets.push(`matricula_inmobiliaria = $${params.length}`); }
  if (fields.departamentoCod !== undefined) {
    params.push(fields.departamentoCod); sets.push(`departamento_cod = $${params.length}`);
    params.push(fields.departamentoCod); sets.push(`departamento = $${params.length}`);
  }
  if (fields.municipioCod !== undefined) {
    params.push(fields.municipioCod); sets.push(`municipio_cod = $${params.length}`);
    params.push(fields.municipioCod); sets.push(`municipio = $${params.length}`);
  }
  if (fields.vereda !== undefined) { params.push(fields.vereda); sets.push(`vereda = $${params.length}`); }
  if (fields.direccion !== undefined) { params.push(fields.direccion); sets.push(`direccion = $${params.length}`); }
  if (fields.latitud !== undefined) { params.push(fields.latitud); sets.push(`latitud = $${params.length}`); }
  if (fields.longitud !== undefined) { params.push(fields.longitud); sets.push(`longitud = $${params.length}`); }
  if (fields.altitudMsnm !== undefined) { params.push(fields.altitudMsnm); sets.push(`altitud_msnm = $${params.length}`); }
  if (fields.areaTotalHa !== undefined) { params.push(fields.areaTotalHa); sets.push(`area_total_ha = $${params.length}`); }
  if (fields.areaProductivaHa !== undefined) { params.push(fields.areaProductivaHa); sets.push(`area_productiva_ha = $${params.length}`); }
  if (fields.areaBosqueHa !== undefined) { params.push(fields.areaBosqueHa); sets.push(`area_bosque_ha = $${params.length}`); }
  if (fields.areaViverosHa !== undefined) { params.push(fields.areaViverosHa); sets.push(`area_viveros_ha = $${params.length}`); }
  if (fields.fuenteAgua !== undefined) { params.push(fields.fuenteAgua); sets.push(`fuente_agua = $${params.length}`); }
  if (fields.tipoSuelo !== undefined) { params.push(fields.tipoSuelo); sets.push(`tipo_suelo = $${params.length}`); }
  if (fields.pendientePct !== undefined) { params.push(fields.pendientePct); sets.push(`pendiente_pct = $${params.length}`); }
  if (fields.usoPrevio !== undefined) { params.push(fields.usoPrevio); sets.push(`uso_previo = $${params.length}`); }
  if (fields.certifUsoSuelo !== undefined) { params.push(fields.certifUsoSuelo); sets.push(`certif_uso_suelo = $${params.length}`); }
  if (fields.tieneBodegaAgroquimicos !== undefined) { params.push(fields.tieneBodegaAgroquimicos); sets.push(`tiene_bodega_agroquimicos = $${params.length}`); }
  if (fields.tieneAguaPotable !== undefined) { params.push(fields.tieneAguaPotable); sets.push(`tiene_agua_potable = $${params.length}`); }
  if (fields.tieneSSSBasicas !== undefined) { params.push(fields.tieneSSSBasicas); sets.push(`tiene_sss_basicas = $${params.length}`); }
  if (fields.tieneZonaAcopio !== undefined) { params.push(fields.tieneZonaAcopio); sets.push(`tiene_zona_acopio = $${params.length}`); }
  if (fields.activo !== undefined) { params.push(fields.activo); sets.push(`activo = $${params.length}`); }

  if (sets.length === 0) return "no-changes";

  params.push(id);
  const { rows } = await pool.query<Predio>(
    `UPDATE predios SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING ${PREDIO_COLUMNS_RETURNING}`,
    params
  );
  return rows[0] ?? null;
}

export async function listPredios(filtros: { agricultorId?: string; soloActivos?: boolean } = {}): Promise<
  Array<Predio & { totalLotes: number; agricultor: AgricultorContacto | null; propietario: Propietario | null }>
> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filtros.agricultorId) {
    params.push(filtros.agricultorId);
    conditions.push(`predios.agricultor_id = $${params.length}`);
  }
  if (filtros.soloActivos) {
    conditions.push(`predios.activo = true`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await pool.query<Predio & { totalLotes: number; agricultor: AgricultorContacto | null; propietario: Propietario | null }>(
    `SELECT
       ${PREDIO_COLUMNS},
       ${AGRICULTOR_PREDIO_COLUMNS},
       ${PROPIETARIO_PREDIO_COLUMNS},
       ${UBICACION_PREDIO_COLUMNS},
       (SELECT count(*)::int FROM lotes l JOIN parcelas par ON par.id = l.parcela_id WHERE par.predio_id = predios.id) AS "totalLotes"
     FROM predios
     LEFT JOIN usuarios ag ON ag.id = predios.agricultor_id
     LEFT JOIN propietarios prop ON prop.id = predios.propietario_id
     LEFT JOIN departamentos depto ON depto.codigo = predios.departamento_cod
     LEFT JOIN municipios muni ON muni.codigo = predios.municipio_cod
     ${where}
     ORDER BY predios.created_at DESC`,
    params
  );
  return rows;
}

export async function getPredioConLotes(
  id: string,
  filtros: { agricultorId?: string } = {}
): Promise<(Predio & { agricultor: AgricultorContacto | null; propietario: Propietario | null; lotes: unknown[] }) | null> {
  const conditions: string[] = [`predios.id = $1`];
  const params: unknown[] = [id];
  if (filtros.agricultorId) {
    params.push(filtros.agricultorId);
    conditions.push(`predios.agricultor_id = $${params.length}`);
  }

  const { rows } = await pool.query<Predio & { agricultor: AgricultorContacto | null; propietario: Propietario | null }>(
    `SELECT ${PREDIO_COLUMNS}, ${AGRICULTOR_PREDIO_COLUMNS}, ${PROPIETARIO_PREDIO_COLUMNS}, ${UBICACION_PREDIO_COLUMNS}
     FROM predios
     LEFT JOIN usuarios ag ON ag.id = predios.agricultor_id
     LEFT JOIN propietarios prop ON prop.id = predios.propietario_id
     LEFT JOIN departamentos depto ON depto.codigo = predios.departamento_cod
     LEFT JOIN municipios muni ON muni.codigo = predios.municipio_cod
     WHERE ${conditions.join(" AND ")}`,
    params
  );
  const predio = rows[0];
  if (!predio) return null;

  const { rows: lotes } = await pool.query(
    `SELECT
       lotes.id, lotes.codigo_lote AS "codigoLote", lotes.especie, lotes.variedad,
       lotes.area_ha AS "areaHa",
       lotes.fecha_siembra AS "fechaSiembra", lotes.destino_produccion AS "destinoProduccion",
       lotes.sistema_riego AS "sistemaRiego", lotes.estado, lotes.data_hash AS "dataHash",
       lotes.lote_id_onchain AS "loteIdOnchain",
       lotes.created_at AS "createdAt",
       (SELECT count(*)::int FROM lote_plantas lp WHERE lp.lote_id = lotes.id) AS "totalPlantas"
     FROM lotes
     JOIN parcelas par ON par.id = lotes.parcela_id
     WHERE par.predio_id = $1 AND lotes.estado != 'REVOCADO'
     ORDER BY lotes.created_at DESC`,
    [id]
  );

  return { ...predio, lotes };
}

// ── Lotes ────────────────────────────────────────────────────────────────────

// predioId se resuelve siempre via la parcela (l.parcela_id -> parcelas.predio_id)
// — lotes.predio_id fue eliminada por ser redundante e inconsistente cuando
// una parcela cambia de predio (ver migracion 12_lotes_via_parcela.sql).
// Requiere JOIN parcelas par ON par.id = l.parcela_id en el FROM.
const LOTE_COLUMNS = `
  l.id,
  par.predio_id           AS "predioId",
  l.parcela_id           AS "parcelaId",
  l.agricultor_id        AS "agricultorId",
  l.codigo_lote          AS "codigoLote",
  l.especie, l.variedad,
  l.area_ha              AS "areaHa",
  l.fecha_siembra        AS "fechaSiembra",
  l.fecha_cosecha_est    AS "fechaCosechaEst",
  l.fecha_cosecha_real   AS "fechaCosechaReal",
  l.volumen_cosecha_kg   AS "volumenCosechaKg",
  l.destino_produccion   AS "destinoProduccion",
  l.sistema_riego        AS "sistemaRiego",
  l.distancia_siembra_m  AS "distanciaSiembraM",
  l.densidad_plantas     AS "densidadPlantas",
  l.cultivo_anterior     AS "cultivoAnterior",
  l.estado,
  l.lote_id_onchain      AS "loteIdOnchain",
  l.data_hash            AS "dataHash",
  l.tx_registro          AS "txRegistro",
  l.sync_estado          AS "syncEstado",
  l.created_at           AS "createdAt",
  l.updated_at           AS "updatedAt"
`;

// Mismas columnas sin alias de tabla, para usar en INSERT/UPDATE ... RETURNING.
// No incluye predioId (no existe columna propia, ver LOTE_COLUMNS) — createLote/
// updateLote resuelven predioId aparte via getLoteById tras el INSERT/UPDATE.
const LOTE_COLUMNS_RETURNING = `
  id,
  parcela_id           AS "parcelaId",
  agricultor_id        AS "agricultorId",
  codigo_lote          AS "codigoLote",
  especie, variedad,
  area_ha              AS "areaHa",
  fecha_siembra        AS "fechaSiembra",
  fecha_cosecha_est    AS "fechaCosechaEst",
  fecha_cosecha_real   AS "fechaCosechaReal",
  volumen_cosecha_kg   AS "volumenCosechaKg",
  destino_produccion   AS "destinoProduccion",
  sistema_riego        AS "sistemaRiego",
  distancia_siembra_m  AS "distanciaSiembraM",
  densidad_plantas     AS "densidadPlantas",
  cultivo_anterior     AS "cultivoAnterior",
  estado,
  lote_id_onchain      AS "loteIdOnchain",
  data_hash            AS "dataHash",
  tx_registro          AS "txRegistro",
  sync_estado          AS "syncEstado",
  created_at           AS "createdAt",
  updated_at           AS "updatedAt"
`;

// `agricultorId` acota el resultado a los lotes de ese agricultor. Es la unica
// forma de que la capa de datos proteja la propiedad: el filtro vive en la query,
// no en el handler, asi que ningun camino lo puede saltar por descuido.
export async function getLoteById(id: string, agricultorId?: string): Promise<Lote | null> {
  const { rows } = await pool.query<Lote>(
    `SELECT ${LOTE_COLUMNS} FROM lotes l JOIN parcelas par ON par.id = l.parcela_id
     WHERE l.id = $1${agricultorId ? " AND l.agricultor_id = $2" : ""}`,
    agricultorId ? [id, agricultorId] : [id]
  );
  return rows[0] ?? null;
}

export async function getLoteByCodigo(codigoLote: string, agricultorId?: string): Promise<Lote | null> {
  const { rows } = await pool.query<Lote>(
    `SELECT ${LOTE_COLUMNS} FROM lotes l JOIN parcelas par ON par.id = l.parcela_id
     WHERE l.codigo_lote = $1${agricultorId ? " AND l.agricultor_id = $2" : ""}`,
    agricultorId ? [codigoLote, agricultorId] : [codigoLote]
  );
  return rows[0] ?? null;
}

export async function countLotes(): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(`SELECT count(*) FROM lotes`);
  return Number(rows[0].count);
}

// Listado con predio + ultima inspeccion COMPLETADA (solo CERTIFICADORA) +
// campanas CERRADAS con hash — replica el `include` de Prisma en lotes.ts GET /.
export async function listLotesConResumen(filtros: {
  agricultorId?: string;
  incluirInspeccionYCampanas: boolean;
}): Promise<
  Array<
    Lote & {
      predioNombre: string | null;
      parcelaNombre: string | null;
      parcelaCodigo: string | null;
      inspeccion: { resultado: string; fechaRealizada: Date | null; inspectorNombres: string; inspectorApellidos: string } | null;
      campanas: Array<{ id: string; nombre: string; campanaHash: string; txHash: string | null; fechaCierre: Date | null }>;
    }
  >
> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filtros.agricultorId) {
    params.push(filtros.agricultorId);
    conditions.push(`l.agricultor_id = $${params.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows: lotes } = await pool.query<Lote & { predioNombre: string | null; parcelaNombre: string | null; parcelaCodigo: string | null }>(
    `SELECT ${LOTE_COLUMNS}, p.nombre_predio AS "predioNombre",
       par.nombre AS "parcelaNombre", par.codigo_parcela AS "parcelaCodigo"
     FROM lotes l
     JOIN parcelas par ON par.id = l.parcela_id
     LEFT JOIN predios p ON p.id = par.predio_id
     ${where}
     ORDER BY l.created_at DESC`,
    params
  );

  if (!filtros.incluirInspeccionYCampanas || lotes.length === 0) {
    return lotes.map((l) => ({ ...l, inspeccion: null, campanas: [] }));
  }

  const loteIds = lotes.map((l) => l.id);

  const { rows: inspecciones } = await pool.query<{
    loteId: string;
    resultado: string;
    fechaRealizada: Date | null;
    inspectorNombres: string;
    inspectorApellidos: string;
  }>(
    `SELECT DISTINCT ON (i.lote_id)
       i.lote_id AS "loteId", i.resultado, i.fecha_realizada AS "fechaRealizada",
       u.nombres AS "inspectorNombres", u.apellidos AS "inspectorApellidos"
     FROM inspecciones i
     JOIN usuarios u ON u.id = i.inspector_id
     WHERE i.lote_id = ANY($1) AND i.estado = 'COMPLETADA'
     ORDER BY i.lote_id, i.fecha_realizada DESC`,
    [loteIds]
  );
  const inspeccionPorLote = new Map(inspecciones.map((i) => [i.loteId, i]));

  const { rows: campanas } = await pool.query<{
    loteId: string;
    id: string;
    nombre: string;
    campanaHash: string;
    txHash: string | null;
    fechaCierre: Date | null;
  }>(
    `SELECT lote_id AS "loteId", id, nombre, campana_hash AS "campanaHash", tx_hash AS "txHash", fecha_cierre AS "fechaCierre"
     FROM campanas
     WHERE lote_id = ANY($1) AND estado = 'CERRADA' AND campana_hash IS NOT NULL`,
    [loteIds]
  );
  const campanasPorLote = new Map<string, typeof campanas>();
  for (const c of campanas) {
    const arr = campanasPorLote.get(c.loteId) ?? [];
    arr.push(c);
    campanasPorLote.set(c.loteId, arr);
  }

  return lotes.map((l) => ({
    ...l,
    inspeccion: inspeccionPorLote.get(l.id) ?? null,
    campanas: campanasPorLote.get(l.id) ?? [],
  }));
}

export async function getLoteDetalle(id: string, agricultorId?: string): Promise<
  | (Lote & {
      predio: (Predio & { propietario: Propietario | null }) | null;
      agricultor: { nombres: string; apellidos: string; numeroDocumento: string } | null;
      plantas: unknown[];
      eventos: unknown[];
      certificado: unknown | null;
      campanas: unknown[];
    })
  | null
> {
  const { rows } = await pool.query<Lote>(
    `SELECT ${LOTE_COLUMNS} FROM lotes l JOIN parcelas par ON par.id = l.parcela_id
     WHERE l.id = $1${agricultorId ? " AND l.agricultor_id = $2" : ""}`,
    agricultorId ? [id, agricultorId] : [id]
  );
  const lote = rows[0];
  if (!lote) return null;

  const [predioBase, agricultor, plantas, eventos, certificado, campanas] = await Promise.all([
    getPredioById(lote.predioId),
    pool
      .query<{ nombres: string; apellidos: string; numeroDocumento: string }>(
        `SELECT nombres, apellidos, numero_documento AS "numeroDocumento" FROM usuarios WHERE id = $1`,
        [lote.agricultorId]
      )
      .then((r) => r.rows[0] ?? null),
    listPlantasByLote(id),
    pool
      .query(
        `SELECT id, tipo_evento AS "tipoEvento", descripcion, fecha_evento AS "fechaEvento",
                latitud, longitud, content_hash AS "contentHash", created_at AS "createdAt"
         FROM eventos_produccion WHERE lote_id = $1 ORDER BY fecha_evento DESC LIMIT 20`,
        [id]
      )
      .then((r) => r.rows),
    pool
      .query(
        `SELECT id, tipo, numero_certificado AS "numeroCertificado", fecha_emision AS "fechaEmision",
                fecha_vencimiento AS "fechaVencimiento", revocado, nft_token_id AS "nftTokenId", tx_emision AS "txEmision"
         FROM certificados WHERE lote_id = $1`,
        [id]
      )
      .then((r) => r.rows[0] ?? null),
    pool
      .query(
        `SELECT id, nombre, campana_hash AS "campanaHash", tx_hash AS "txHash", fecha_cierre AS "fechaCierre"
         FROM campanas WHERE lote_id = $1 AND estado = 'CERRADA' ORDER BY fecha_cierre DESC`,
        [id]
      )
      .then((r) => r.rows),
  ]);

  const propietario = predioBase?.propietarioId
    ? await getPropietarioById(predioBase.propietarioId)
    : null;
  const predio = predioBase ? { ...predioBase, propietario } : null;

  return { ...lote, predio, agricultor, plantas, eventos, certificado, campanas };
}

export async function getLoteConDetalleByCodigo(codigoLote: string, agricultorId?: string): Promise<
  | (Lote & {
      predio: { nombrePredio: string; departamento: string; municipio: string } | null;
      agricultor: { nombres: string; apellidos: string } | null;
      eventos: unknown[];
      certificado: unknown | null;
    })
  | null
> {
  const lote = await getLoteByCodigo(codigoLote, agricultorId);
  if (!lote) return null;

  const [predio, agricultor, eventos, certificado] = await Promise.all([
    pool
      .query<{ nombrePredio: string; departamento: string; municipio: string }>(
        `SELECT nombre_predio AS "nombrePredio", departamento, municipio FROM predios WHERE id = $1`,
        [lote.predioId]
      )
      .then((r) => r.rows[0] ?? null),
    pool
      .query<{ nombres: string; apellidos: string }>(
        `SELECT nombres, apellidos FROM usuarios WHERE id = $1`,
        [lote.agricultorId]
      )
      .then((r) => r.rows[0] ?? null),
    pool
      .query(
        `SELECT id, tipo_evento AS "tipoEvento", descripcion, fecha_evento AS "fechaEvento", content_hash AS "contentHash"
         FROM eventos_produccion WHERE lote_id = $1 ORDER BY fecha_evento ASC`,
        [lote.id]
      )
      .then((r) => r.rows),
    pool
      .query(
        `SELECT id, tipo, numero_certificado AS "numeroCertificado", fecha_emision AS "fechaEmision",
                fecha_vencimiento AS "fechaVencimiento", revocado
         FROM certificados WHERE lote_id = $1`,
        [lote.id]
      )
      .then((r) => r.rows[0] ?? null),
  ]);

  return { ...lote, predio, agricultor, eventos, certificado };
}

export interface CreateLoteBody {
  parcelaId: string;
  agricultorId: string;
  codigoLote: string;
  especie: string;
  variedad: string;
  areaHa: number;
  fechaSiembra?: Date | null;
  fechaCosechaEst?: Date | null;
  destinoProduccion?: string | null;
  dataHash: string;
  syncEstado?: string;
}

// predioId no se inserta (no existe columna propia) — se resuelve via
// getLoteById tras el INSERT, que hace JOIN con parcelas.
export async function createLote(body: CreateLoteBody): Promise<Lote> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO lotes
       (parcela_id, agricultor_id, codigo_lote, especie, variedad, area_ha,
        fecha_siembra, fecha_cosecha_est, destino_produccion, data_hash, sync_estado)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id`,
    [
      body.parcelaId,
      body.agricultorId,
      body.codigoLote,
      body.especie,
      body.variedad,
      body.areaHa,
      body.fechaSiembra ?? null,
      body.fechaCosechaEst ?? null,
      body.destinoProduccion ?? null,
      body.dataHash,
      body.syncEstado ?? "PENDIENTE",
    ]
  );
  const lote = await getLoteById(rows[0].id);
  if (!lote) throw new Error("Error interno: lote recien creado no encontrado");
  return lote;
}

export interface UpdateLoteFields {
  variedad?: string;
  fechaCosechaEst?: Date | null;
  fechaCosechaReal?: Date | null;
  volumenCosechaKg?: number | null;
  destinoProduccion?: string | null;
  sistemaRiego?: string | null;
  distanciaSiembraM?: number | null;
  densidadPlantas?: number | null;
  cultivoAnterior?: string | null;
}

export async function updateLote(
  id: string,
  fields: UpdateLoteFields
): Promise<Lote | null | "no-changes"> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (fields.variedad !== undefined) { params.push(fields.variedad); sets.push(`variedad = $${params.length}`); }
  if (fields.fechaCosechaEst !== undefined) { params.push(fields.fechaCosechaEst); sets.push(`fecha_cosecha_est = $${params.length}`); }
  if (fields.fechaCosechaReal !== undefined) { params.push(fields.fechaCosechaReal); sets.push(`fecha_cosecha_real = $${params.length}`); }
  if (fields.volumenCosechaKg !== undefined) { params.push(fields.volumenCosechaKg); sets.push(`volumen_cosecha_kg = $${params.length}`); }
  if (fields.destinoProduccion !== undefined) { params.push(fields.destinoProduccion); sets.push(`destino_produccion = $${params.length}`); }
  if (fields.sistemaRiego !== undefined) { params.push(fields.sistemaRiego); sets.push(`sistema_riego = $${params.length}`); }
  if (fields.distanciaSiembraM !== undefined) { params.push(fields.distanciaSiembraM); sets.push(`distancia_siembra_m = $${params.length}`); }
  if (fields.densidadPlantas !== undefined) { params.push(fields.densidadPlantas); sets.push(`densidad_plantas = $${params.length}`); }
  if (fields.cultivoAnterior !== undefined) { params.push(fields.cultivoAnterior); sets.push(`cultivo_anterior = $${params.length}`); }

  if (sets.length === 0) return "no-changes";

  params.push(id);
  await pool.query(`UPDATE lotes SET ${sets.join(", ")} WHERE id = $${params.length}`, params);
  return getLoteById(id);
}

export async function updateLoteBlockchainTx(
  id: string,
  fields: { txRegistro: string; syncEstado: string }
): Promise<Lote> {
  await pool.query(
    `UPDATE lotes SET tx_registro = $1, sync_estado = $2 WHERE id = $3`,
    [fields.txRegistro, fields.syncEstado, id]
  );
  const lote = await getLoteById(id);
  if (!lote) throw new Error("Error interno: lote no encontrado tras actualizar tx blockchain");
  return lote;
}

export async function updateLoteEstado(id: string, estado: string): Promise<Lote> {
  await pool.query(`UPDATE lotes SET estado = $1 WHERE id = $2`, [estado, id]);
  const lote = await getLoteById(id);
  if (!lote) throw new Error("Error interno: lote no encontrado tras actualizar estado");
  return lote;
}

// ── Plantas (pertenecen a la parcela; se vinculan a lotes/cosechas via lote_plantas) ──

const PLANTA_COLUMNS = `
  p.id,
  p.parcela_id                    AS "parcelaId",
  p.codigo_planta                 AS "codigoPlanta",
  p.numero_planta                 AS "numeroPlanta",
  p.especie, p.variedad,
  p.origen_material                AS "origenMaterial",
  p.procedencia_vivero             AS "procedenciaVivero",
  p.fecha_siembra                  AS "fechaSiembra",
  p.altura_cm_inicial              AS "alturaCmInicial",
  p.diametro_tallo_cm_inicial      AS "diametroTalloCmInicial",
  p.num_hojas_inicial              AS "numHojasInicial",
  p.estado_fenologico_inicial      AS "estadoFenologicoInicial",
  p.latitud, p.longitud,
  p.altitud_msnm                   AS "altitudMsnm",
  p.activo
`;

// "Plantas de este lote" ahora se resuelve via lote_plantas, no por FK directa —
// mismo nombre/firma que antes, asi que todos los call-sites (vista movil de
// campanas, validacion de aportes, detalle de lote) quedan corregidos sin tocarlos.
export async function listPlantasByLote(loteId: string, agricultorId?: string): Promise<Planta[]> {
  const { rows } = await pool.query<Planta>(
    `SELECT ${PLANTA_COLUMNS}
     FROM plantas p
     JOIN lote_plantas lp ON lp.planta_id = p.id
     WHERE lp.lote_id = $1 AND p.activo = true
       ${agricultorId ? "AND EXISTS (SELECT 1 FROM lotes la WHERE la.id = lp.lote_id AND la.agricultor_id = $2)" : ""}
     ORDER BY p.numero_planta::int ASC`,
    agricultorId ? [loteId, agricultorId] : [loteId]
  );
  return rows;
}

export async function listPlantasByParcela(
  parcelaId: string,
  opts: { especie?: string; soloActivas?: boolean } = {}
): Promise<Planta[]> {
  const conds = [`p.parcela_id = $1`];
  const params: unknown[] = [parcelaId];
  if (opts.soloActivas !== false) conds.push(`p.activo = true`);
  if (opts.especie) { params.push(opts.especie); conds.push(`p.especie = $${params.length}`); }
  const { rows } = await pool.query<Planta>(
    `SELECT ${PLANTA_COLUMNS} FROM plantas p WHERE ${conds.join(" AND ")} ORDER BY p.numero_planta::int ASC`,
    params
  );
  return rows;
}

// Estados de lote en los que una planta sigue "comprometida" con ese ciclo —
// no puede vincularse a un lote nuevo mientras siga en uno de estos.
const ESTADOS_LOTE_ABIERTO = ["REGISTRADO", "EN_PRODUCCION", "INSPECCION_SOLICITADA", "EN_INSPECCION"];

// Plantas activas de la parcela, de la especie dada, que no estan vinculadas
// a ningun lote actualmente abierto — candidatas a reusar en un lote nuevo.
export async function listPlantasDisponiblesParaLote(parcelaId: string, especie: string): Promise<Planta[]> {
  const { rows } = await pool.query<Planta>(
    `SELECT ${PLANTA_COLUMNS}
     FROM plantas p
     WHERE p.parcela_id = $1 AND p.especie = $2 AND p.activo = true
       AND NOT EXISTS (
         SELECT 1 FROM lote_plantas lp
         JOIN lotes l ON l.id = lp.lote_id
         WHERE lp.planta_id = p.id AND l.estado = ANY($3)
       )
     ORDER BY p.numero_planta::int ASC`,
    [parcelaId, especie, ESTADOS_LOTE_ABIERTO]
  );
  return rows;
}

export async function getPlantaById(id: string): Promise<
  (Planta & { lotes: Array<{ loteId: string; codigoLote: string; fechaVinculacion: Date }> }) | null
> {
  const { rows } = await pool.query<Planta>(`SELECT ${PLANTA_COLUMNS} FROM plantas p WHERE p.id = $1`, [id]);
  const planta = rows[0];
  if (!planta) return null;

  const { rows: lotes } = await pool.query(
    `SELECT lp.lote_id AS "loteId", l.codigo_lote AS "codigoLote", lp.fecha_vinculacion AS "fechaVinculacion"
     FROM lote_plantas lp JOIN lotes l ON l.id = lp.lote_id
     WHERE lp.planta_id = $1 ORDER BY lp.fecha_vinculacion DESC`,
    [id]
  );
  return { ...planta, lotes };
}

export interface CreatePlantaBody {
  parcelaId: string;
  codigoPlanta: string;
  numeroPlanta: string;
  latitud: number;
  longitud: number;
  altitudMsnm?: number | null;
  especie?: string | null;
  variedad?: string | null;
  origenMaterial?: string | null;
  procedenciaVivero?: string | null;
  fechaSiembra?: Date | null;
  alturaCmInicial?: number | null;
  diametroTalloCmInicial?: number | null;
  numHojasInicial?: number | null;
  estadoFenologicoInicial?: string | null;
  registradoPor: string;
}

// Crea la planta en la parcela — ya NO la vincula a ningun lote automaticamente
// (la vinculacion es un paso explicito aparte, ver vincularPlantasALote).
export async function createPlanta(
  body: CreatePlantaBody
): Promise<Pick<Planta, "id" | "parcelaId" | "codigoPlanta" | "numeroPlanta" | "especie" | "latitud" | "longitud">> {
  const { rows } = await pool.query(
    `INSERT INTO plantas
       (parcela_id, codigo_planta, numero_planta, latitud, longitud, altitud_msnm,
        especie, variedad, origen_material, procedencia_vivero, fecha_siembra,
        altura_cm_inicial, diametro_tallo_cm_inicial, num_hojas_inicial,
        estado_fenologico_inicial, registrado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING id, parcela_id AS "parcelaId", codigo_planta AS "codigoPlanta",
               numero_planta AS "numeroPlanta", especie, latitud, longitud`,
    [
      body.parcelaId,
      body.codigoPlanta,
      body.numeroPlanta,
      body.latitud,
      body.longitud,
      body.altitudMsnm ?? null,
      body.especie ?? null,
      body.variedad ?? null,
      body.origenMaterial ?? null,
      body.procedenciaVivero ?? null,
      body.fechaSiembra ?? null,
      body.alturaCmInicial ?? null,
      body.diametroTalloCmInicial ?? null,
      body.numHojasInicial ?? null,
      body.estadoFenologicoInicial ?? null,
      body.registradoPor,
    ]
  );
  return rows[0];
}

export interface UpdatePlantaFields {
  especie?: string | null;
  variedad?: string | null;
  origenMaterial?: string | null;
  procedenciaVivero?: string | null;
  fechaSiembra?: Date | null;
  alturaCmInicial?: number | null;
  diametroTalloCmInicial?: number | null;
  numHojasInicial?: number | null;
  estadoFenologicoInicial?: string | null;
  activo?: boolean;
}

export async function updatePlanta(
  id: string,
  fields: UpdatePlantaFields
): Promise<Planta | null | "no-changes"> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (fields.especie !== undefined) { params.push(fields.especie); sets.push(`especie = $${params.length}`); }
  if (fields.variedad !== undefined) { params.push(fields.variedad); sets.push(`variedad = $${params.length}`); }
  if (fields.origenMaterial !== undefined) { params.push(fields.origenMaterial); sets.push(`origen_material = $${params.length}`); }
  if (fields.procedenciaVivero !== undefined) { params.push(fields.procedenciaVivero); sets.push(`procedencia_vivero = $${params.length}`); }
  if (fields.fechaSiembra !== undefined) { params.push(fields.fechaSiembra); sets.push(`fecha_siembra = $${params.length}`); }
  if (fields.alturaCmInicial !== undefined) { params.push(fields.alturaCmInicial); sets.push(`altura_cm_inicial = $${params.length}`); }
  if (fields.diametroTalloCmInicial !== undefined) { params.push(fields.diametroTalloCmInicial); sets.push(`diametro_tallo_cm_inicial = $${params.length}`); }
  if (fields.numHojasInicial !== undefined) { params.push(fields.numHojasInicial); sets.push(`num_hojas_inicial = $${params.length}`); }
  if (fields.estadoFenologicoInicial !== undefined) { params.push(fields.estadoFenologicoInicial); sets.push(`estado_fenologico_inicial = $${params.length}`); }
  if (fields.activo !== undefined) { params.push(fields.activo); sets.push(`activo = $${params.length}`); }

  if (sets.length === 0) return "no-changes";

  params.push(id);
  await pool.query(
    `UPDATE plantas SET ${sets.join(", ")} WHERE id = $${params.length}`,
    params
  );
  const { rows } = await pool.query<Planta>(`SELECT ${PLANTA_COLUMNS} FROM plantas p WHERE p.id = $1`, [id]);
  return rows[0] ?? null;
}

export interface VincularPlantasResult {
  vinculadas: string[];
  yaEnOtroLoteAbierto: string[];
}

// Vincula un lote de plantas existentes a un lote (batch). Si alguna ya esta
// vinculada a OTRO lote abierto, se excluye del INSERT y se reporta —
// no aborta toda la operacion, el caller decide como comunicarlo.
export async function vincularPlantasALote(params: {
  loteId: string;
  plantaIds: string[];
  vinculadoPor: string;
}): Promise<VincularPlantasResult> {
  if (params.plantaIds.length === 0) return { vinculadas: [], yaEnOtroLoteAbierto: [] };

  const { rows: ocupadas } = await pool.query<{ plantaId: string }>(
    `SELECT DISTINCT lp.planta_id AS "plantaId"
     FROM lote_plantas lp JOIN lotes l ON l.id = lp.lote_id
     WHERE lp.planta_id = ANY($1) AND lp.lote_id != $2 AND l.estado = ANY($3)`,
    [params.plantaIds, params.loteId, ESTADOS_LOTE_ABIERTO]
  );
  const ocupadasSet = new Set(ocupadas.map((o) => o.plantaId));
  const disponibles = params.plantaIds.filter((id) => !ocupadasSet.has(id));

  if (disponibles.length > 0) {
    await pool.query(
      `INSERT INTO lote_plantas (lote_id, planta_id, vinculado_por)
       SELECT $1, unnest($2::uuid[]), $3
       ON CONFLICT (lote_id, planta_id) DO NOTHING`,
      [params.loteId, disponibles, params.vinculadoPor]
    );
  }

  return { vinculadas: disponibles, yaEnOtroLoteAbierto: [...ocupadasSet] };
}

// ── Eventos de produccion ────────────────────────────────────────────────────

export interface ListEventosFiltros {
  loteId?: string;
  plantaId?: string;
  tipoEvento?: string;
  soloVerificados?: boolean;
  agricultorId?: string;
}

export async function listEventosProduccion(filtros: ListEventosFiltros = {}): Promise<unknown[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filtros.loteId) { params.push(filtros.loteId); conditions.push(`e.lote_id = $${params.length}`); }
  if (filtros.plantaId) { params.push(filtros.plantaId); conditions.push(`e.planta_id = $${params.length}`); }
  if (filtros.tipoEvento) { params.push(filtros.tipoEvento); conditions.push(`e.tipo_evento = $${params.length}`); }
  if (filtros.soloVerificados) { conditions.push(`e.hash_verificado = true`); }
  // EXISTS en vez de JOIN: no cambia la forma del SELECT ni el COUNT de filas,
  // que ya_inner_join con plantas y usuarios.
  if (filtros.agricultorId) {
    params.push(filtros.agricultorId);
    conditions.push(`EXISTS (SELECT 1 FROM lotes la WHERE la.id = e.lote_id AND la.agricultor_id = $${params.length})`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await pool.query(
    `SELECT
       e.id, e.lote_id AS "loteId", e.planta_id AS "plantaId", e.creado_por AS "creadoPor",
       e.tipo_evento AS "tipoEvento", e.descripcion, e.fecha_evento AS "fechaEvento",
       e.latitud, e.longitud, e.altitud_msnm AS "altitudMsnm",
       e.content_hash AS "contentHash", e.hash_verificado AS "hashVerificado",
       e.sync_estado AS "syncEstado", e.ipfs_cid AS "ipfsCid", e.tx_hash AS "txHash",
       e.created_at AS "createdAt",
       pl.codigo_planta AS "plantaCodigoPlanta", pl.numero_planta AS "plantaNumeroPlanta",
       u.nombres AS "creadorNombres", u.apellidos AS "creadorApellidos",
       aa.id AS "aplicacionAgroquimicoId", aa.nombre_producto AS "aplicacionNombreProducto",
       rr.id AS "registroRiegoId", rr.fuente_agua AS "registroRiegoFuenteAgua"
     FROM eventos_produccion e
     LEFT JOIN plantas pl ON pl.id = e.planta_id
     JOIN usuarios u ON u.id = e.creado_por
     LEFT JOIN aplicaciones_agroquimicos aa ON aa.evento_id = e.id
     LEFT JOIN registros_riego rr ON rr.evento_id = e.id
     ${where}
     ORDER BY e.fecha_evento DESC`,
    params
  );
  return rows;
}

export async function getEventoProduccionDetalle(id: string, agricultorId?: string): Promise<unknown | null> {
  const { rows } = await pool.query(
    `SELECT
       e.id, e.lote_id AS "loteId", e.planta_id AS "plantaId", e.creado_por AS "creadoPor",
       e.tipo_evento AS "tipoEvento", e.descripcion, e.fecha_evento AS "fechaEvento",
       e.latitud, e.longitud, e.altitud_msnm AS "altitudMsnm",
       e.content_hash AS "contentHash", e.hash_verificado AS "hashVerificado",
       e.sync_estado AS "syncEstado", e.ipfs_cid AS "ipfsCid", e.tx_hash AS "txHash",
       e.created_at AS "createdAt",
       l.codigo_lote AS "loteCodigoLote", l.especie AS "loteEspecie",
       u.nombres AS "creadorNombres", u.apellidos AS "creadorApellidos", u.rol AS "creadorRol"
     FROM eventos_produccion e
     JOIN lotes l ON l.id = e.lote_id
     JOIN usuarios u ON u.id = e.creado_por
     WHERE e.id = $1${agricultorId ? " AND l.agricultor_id = $2" : ""}`,
    agricultorId ? [id, agricultorId] : [id]
  );
  const evento = rows[0];
  if (!evento) return null;

  const [planta, aplicacionAgroquimico, registroRiego, documentos] = await Promise.all([
    pool.query(`SELECT * FROM plantas WHERE id = $1`, [(evento as any).plantaId]).then((r) => r.rows[0] ?? null),
    pool.query(`SELECT * FROM aplicaciones_agroquimicos WHERE evento_id = $1`, [id]).then((r) => r.rows[0] ?? null),
    pool.query(`SELECT * FROM registros_riego WHERE evento_id = $1`, [id]).then((r) => r.rows[0] ?? null),
    pool.query(`SELECT * FROM documentos WHERE evento_id = $1`, [id]).then((r) => r.rows),
  ]);

  return { ...evento, planta, aplicacionAgroquimico, registroRiego, documentos };
}

// ── Inspecciones ─────────────────────────────────────────────────────────────

const INSPECCION_COLUMNS = `
  i.id,
  i.lote_id               AS "loteId",
  i.inspector_id          AS "inspectorId",
  i.organizacion_id       AS "organizacionId",
  i.tipo_inspeccion       AS "tipoInspeccion",
  i.fecha_solicitud       AS "fechaSolicitud",
  i.fecha_programada      AS "fechaProgramada",
  i.fecha_realizada       AS "fechaRealizada",
  i.resultado, i.puntaje,
  i.hallazgos_criticos    AS "hallazgosCriticos",
  i.hallazgos_mayores     AS "hallazgosMayores",
  i.hallazgos_menores     AS "hallazgosMenores",
  i.observaciones, i.plan_mejora AS "planMejora",
  i.fecha_limite_mejora   AS "fechaLimiteMejora",
  i.reporte_cid           AS "reporteCid",
  i.reporte_hash          AS "reporteHash",
  i.tx_hash               AS "txHash",
  i.estado,
  i.created_at            AS "createdAt",
  i.updated_at            AS "updatedAt"
`;

const INSPECCION_COLUMNS_RETURNING = INSPECCION_COLUMNS.replace(/i\./g, "");

export async function listInspecciones(filtros: { inspectorId?: string } = {}): Promise<unknown[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filtros.inspectorId) {
    params.push(filtros.inspectorId);
    conditions.push(`i.inspector_id = $${params.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await pool.query(
    `SELECT
       ${INSPECCION_COLUMNS},
       l.codigo_lote AS "loteCodigoLote", l.especie AS "loteEspecie", l.estado AS "loteEstado",
       p.nombre_predio AS "predioNombrePredio",
       u.nombres AS "inspectorNombres", u.apellidos AS "inspectorApellidos"
     FROM inspecciones i
     JOIN lotes l ON l.id = i.lote_id
     JOIN parcelas par ON par.id = l.parcela_id
     LEFT JOIN predios p ON p.id = par.predio_id
     JOIN usuarios u ON u.id = i.inspector_id
     ${where}
     ORDER BY i.created_at DESC`,
    params
  );
  return rows;
}

// Inspeccion mas reciente de un tipo especifico para un lote — usado para
// exigir una inspeccion aprobada antes de emitir un certificado que la
// requiera (ej. INVIMA_INOCUIDAD exige tipo_inspeccion='INVIMA' APROBADO,
// mismo nivel de rigor que el bloqueo EUDR/STBN en certificados.ts).
export async function getInspeccionVigentePorLoteYTipo(
  loteId: string,
  tipoInspeccion: string
): Promise<Inspeccion | null> {
  const { rows } = await pool.query<Inspeccion>(
    `SELECT ${INSPECCION_COLUMNS} FROM inspecciones i
     WHERE i.lote_id = $1 AND i.tipo_inspeccion = $2
     ORDER BY i.created_at DESC
     LIMIT 1`,
    [loteId, tipoInspeccion]
  );
  return rows[0] ?? null;
}

export async function getInspeccionById(id: string): Promise<Inspeccion | null> {
  const { rows } = await pool.query<Inspeccion>(
    `SELECT ${INSPECCION_COLUMNS} FROM inspecciones i WHERE i.id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function getInspeccionDetalle(id: string): Promise<unknown | null> {
  const inspeccion = await getInspeccionById(id);
  if (!inspeccion) return null;

  const [lote, inspector] = await Promise.all([
    getLoteById(inspeccion.loteId).then(async (l) => {
      if (!l) return null;
      const [predio, agricultor] = await Promise.all([
        getPredioById(l.predioId),
        pool
          .query(`SELECT * FROM usuarios WHERE id = $1`, [l.agricultorId])
          .then((r) => r.rows[0] ?? null),
      ]);
      return { ...l, predio, agricultor };
    }),
    pool.query(`SELECT * FROM usuarios WHERE id = $1`, [inspeccion.inspectorId]).then((r) => r.rows[0] ?? null),
  ]);

  return { ...inspeccion, lote, inspector };
}

export interface CreateInspeccionBody {
  loteId: string;
  inspectorId: string;
  organizacionId: string;
  tipoInspeccion: string;
  fechaSolicitud: Date;
  fechaProgramada?: Date | null;
}

export async function createInspeccion(body: CreateInspeccionBody): Promise<Inspeccion> {
  const { rows } = await pool.query<Inspeccion>(
    `INSERT INTO inspecciones
       (lote_id, inspector_id, organizacion_id, tipo_inspeccion, fecha_solicitud, fecha_programada, estado, resultado)
     VALUES ($1,$2,$3,$4,$5,$6,'PROGRAMADA','PENDIENTE')
     RETURNING ${INSPECCION_COLUMNS_RETURNING}`,
    [
      body.loteId,
      body.inspectorId,
      body.organizacionId,
      body.tipoInspeccion,
      body.fechaSolicitud,
      body.fechaProgramada ?? null,
    ]
  );
  return rows[0];
}

export async function updateInspeccionEstado(id: string, estado: string): Promise<Inspeccion> {
  const { rows } = await pool.query<Inspeccion>(
    `UPDATE inspecciones SET estado = $1 WHERE id = $2 RETURNING ${INSPECCION_COLUMNS_RETURNING}`,
    [estado, id]
  );
  return rows[0];
}

export interface CompletarInspeccionBody {
  resultado: string;
  puntaje?: number;
  hallazgosCriticos: number;
  hallazgosMayores: number;
  hallazgosMenores: number;
  observaciones?: string;
  planMejora?: string;
  fechaRealizada: Date;
  reporteHash: string;
}

export async function completarInspeccion(id: string, body: CompletarInspeccionBody): Promise<Inspeccion> {
  const { rows } = await pool.query<Inspeccion>(
    `UPDATE inspecciones SET
       resultado = $1, puntaje = $2, hallazgos_criticos = $3, hallazgos_mayores = $4,
       hallazgos_menores = $5, observaciones = $6, plan_mejora = $7, fecha_realizada = $8,
       estado = 'COMPLETADA', reporte_hash = $9
     WHERE id = $10
     RETURNING ${INSPECCION_COLUMNS_RETURNING}`,
    [
      body.resultado,
      body.puntaje ?? null,
      body.hallazgosCriticos,
      body.hallazgosMayores,
      body.hallazgosMenores,
      body.observaciones ?? null,
      body.planMejora ?? null,
      body.fechaRealizada,
      body.reporteHash,
      id,
    ]
  );
  return rows[0];
}

export async function updateInspeccionTxHash(id: string, txHash: string): Promise<Inspeccion> {
  const { rows } = await pool.query<Inspeccion>(
    `UPDATE inspecciones SET tx_hash = $1 WHERE id = $2 RETURNING ${INSPECCION_COLUMNS_RETURNING}`,
    [txHash, id]
  );
  return rows[0];
}

// ── Certificados ─────────────────────────────────────────────────────────────

const CERTIFICADO_COLUMNS = `
  c.id,
  c.lote_id             AS "loteId",
  c.inspeccion_id       AS "inspeccionId",
  c.certificadora_id    AS "certificadoraId",
  c.aprobado_por_id     AS "aprobadoPorId",
  c.tipo,
  c.numero_certificado  AS "numeroCertificado",
  c.fecha_emision       AS "fechaEmision",
  c.fecha_vencimiento   AS "fechaVencimiento",
  c.revocado,
  c.ipfs_uri            AS "ipfsUri",
  c.nft_token_id        AS "nftTokenId",
  c.tx_emision          AS "txEmision",
  c.qr_code_url         AS "qrCodeUrl",
  c.created_at          AS "createdAt"
`;

const CERTIFICADO_COLUMNS_RETURNING = CERTIFICADO_COLUMNS.replace(/c\./g, "");

export async function listCertificadosConLote(): Promise<unknown[]> {
  const { rows: certs } = await pool.query<Certificado>(
    `SELECT ${CERTIFICADO_COLUMNS} FROM certificados c ORDER BY c.fecha_emision DESC`
  );
  if (certs.length === 0) return [];

  const loteIds = certs.map((c) => c.loteId);
  const aprobadoPorIds = certs.map((c) => c.aprobadoPorId).filter((id): id is string => !!id);

  const [lotes, aprobadoPorUsuarios] = await Promise.all([
    pool
      .query(
        `SELECT
           l.id, l.codigo_lote AS "codigoLote", l.especie, l.variedad,
           l.data_hash AS "dataHash", l.tx_registro AS "txRegistro",
           p.nombre_predio AS "predioNombrePredio"
         FROM lotes l
         JOIN parcelas par ON par.id = l.parcela_id
         LEFT JOIN predios p ON p.id = par.predio_id
         WHERE l.id = ANY($1)`,
        [loteIds]
      )
      .then((r) => new Map(r.rows.map((l: any) => [l.id, l]))),
    aprobadoPorIds.length > 0
      ? pool
          .query(`SELECT id, nombres, apellidos FROM usuarios WHERE id = ANY($1)`, [aprobadoPorIds])
          .then((r) => new Map(r.rows.map((u: any) => [u.id, u])))
      : Promise.resolve(new Map()),
  ]);

  const [inspeccionesPorLote, campanasPorLote] = await Promise.all([
    pool
      .query<{ loteId: string; resultado: string; fechaRealizada: Date | null; inspectorNombres: string; inspectorApellidos: string }>(
        `SELECT DISTINCT ON (i.lote_id)
           i.lote_id AS "loteId", i.resultado, i.fecha_realizada AS "fechaRealizada",
           u.nombres AS "inspectorNombres", u.apellidos AS "inspectorApellidos"
         FROM inspecciones i
         JOIN usuarios u ON u.id = i.inspector_id
         WHERE i.lote_id = ANY($1) AND i.estado = 'COMPLETADA'
         ORDER BY i.lote_id, i.fecha_realizada DESC`,
        [loteIds]
      )
      .then((r) => new Map(r.rows.map((i) => [i.loteId, i]))),
    pool
      .query<{ loteId: string; nombre: string; campanaHash: string; txHash: string | null }>(
        `SELECT lote_id AS "loteId", nombre, campana_hash AS "campanaHash", tx_hash AS "txHash"
         FROM campanas WHERE lote_id = ANY($1) AND estado = 'CERRADA' ORDER BY fecha_cierre DESC`,
        [loteIds]
      )
      .then((r) => {
        const map = new Map<string, typeof r.rows>();
        for (const c of r.rows) {
          const arr = map.get(c.loteId) ?? [];
          arr.push(c);
          map.set(c.loteId, arr);
        }
        return map;
      }),
  ]);

  return certs.map((c) => ({
    ...c,
    lote: lotes.get(c.loteId) ?? null,
    aprobadoPor: c.aprobadoPorId ? aprobadoPorUsuarios.get(c.aprobadoPorId) ?? null : null,
    inspeccion: inspeccionesPorLote.get(c.loteId) ?? null,
    campanas: campanasPorLote.get(c.loteId) ?? [],
  }));
}

export async function getCertificadoByNumero(numeroCertificado: string): Promise<Certificado | null> {
  const { rows } = await pool.query<Certificado>(
    `SELECT ${CERTIFICADO_COLUMNS} FROM certificados c WHERE c.numero_certificado = $1`,
    [numeroCertificado]
  );
  return rows[0] ?? null;
}

export interface CreateCertificadoBody {
  loteId: string;
  aprobadoPorId: string;
  numeroCertificado: string;
  tipo: string;
  ipfsUri: string;
  fechaEmision: Date;
  fechaVencimiento: Date;
}

export async function createCertificado(body: CreateCertificadoBody): Promise<Certificado> {
  const { rows } = await pool.query<Certificado>(
    `INSERT INTO certificados
       (lote_id, aprobado_por_id, numero_certificado, tipo, ipfs_uri, fecha_emision, fecha_vencimiento, revocado)
     VALUES ($1,$2,$3,$4,$5,$6,$7,false)
     RETURNING ${CERTIFICADO_COLUMNS_RETURNING}`,
    [
      body.loteId,
      body.aprobadoPorId,
      body.numeroCertificado,
      body.tipo,
      body.ipfsUri,
      body.fechaEmision,
      body.fechaVencimiento,
    ]
  );
  return rows[0];
}

export async function updateCertificadoNft(
  id: string,
  fields: { nftTokenId: string; txEmision: string }
): Promise<Certificado> {
  const { rows } = await pool.query<Certificado>(
    `UPDATE certificados SET nft_token_id = $1, tx_emision = $2 WHERE id = $3
     RETURNING ${CERTIFICADO_COLUMNS_RETURNING}`,
    [fields.nftTokenId, fields.txEmision, id]
  );
  return rows[0];
}

// Campanas CERRADAS con campanaHash de un lote, mas datos del agricultor —
// usado al validar elegibilidad para emitir certificado.
export async function getLoteParaCertificacion(loteId: string): Promise<
  | (Lote & {
      agricultor: Usuario | null;
      campanas: Array<{ id: string; campanaHash: string | null; nombre: string }>;
    })
  | null
> {
  const lote = await getLoteById(loteId);
  if (!lote) return null;

  const [agricultor, campanas] = await Promise.all([
    getUsuarioById(lote.agricultorId),
    pool
      .query<{ id: string; campanaHash: string | null; nombre: string }>(
        `SELECT id, campana_hash AS "campanaHash", nombre FROM campanas WHERE lote_id = $1 AND estado = 'CERRADA'`,
        [loteId]
      )
      .then((r) => r.rows),
  ]);

  return { ...lote, agricultor, campanas };
}

// Verificacion publica por codigo de lote — replica el `include` completo que
// usaba Prisma en verificacion.ts (predio, agricultor, eventos verificados,
// campanas cerradas, ultima inspeccion completada, certificado con aprobador).
export async function getLoteParaVerificacionPublica(codigoLote: string): Promise<
  | (Lote & {
      predio: Pick<Predio, "nombrePredio" | "departamento" | "municipio" | "latitud" | "longitud">;
      agricultor: Pick<Usuario, "nombres" | "apellidos">;
      eventos: Array<{ tipoEvento: string; descripcion: string; fechaEvento: Date; hashVerificado: boolean }>;
      campanas: Array<{ id: string; nombre: string; campanaHash: string | null; txHash: string | null; fechaCierre: Date | null }>;
      inspeccion: {
        resultado: string;
        puntaje: number | null;
        hallazgosCriticos: number;
        hallazgosMayores: number;
        hallazgosMenores: number;
        observaciones: string | null;
        reporteHash: string | null;
        txHash: string | null;
        fechaRealizada: Date | null;
        inspectorNombres: string;
        inspectorApellidos: string;
      } | null;
      certificado: (Certificado & { aprobadoPorNombres: string | null; aprobadoPorApellidos: string | null }) | null;
    })
  | null
> {
  const lote = await getLoteByCodigo(codigoLote);
  if (!lote) return null;

  const [predio, agricultor, eventos, campanas, inspeccion, certificado] = await Promise.all([
    pool
      .query(
        `SELECT nombre_predio AS "nombrePredio", departamento, municipio, latitud, longitud
         FROM predios WHERE id = $1`,
        [lote.predioId]
      )
      .then((r) => r.rows[0]),
    pool
      .query(`SELECT nombres, apellidos FROM usuarios WHERE id = $1`, [lote.agricultorId])
      .then((r) => r.rows[0]),
    pool
      .query(
        `SELECT tipo_evento AS "tipoEvento", descripcion, fecha_evento AS "fechaEvento", hash_verificado AS "hashVerificado"
         FROM eventos_produccion WHERE lote_id = $1 AND hash_verificado = true ORDER BY fecha_evento ASC`,
        [lote.id]
      )
      .then((r) => r.rows),
    pool
      .query(
        `SELECT id, nombre, campana_hash AS "campanaHash", tx_hash AS "txHash", fecha_cierre AS "fechaCierre"
         FROM campanas WHERE lote_id = $1 AND estado = 'CERRADA' ORDER BY fecha_cierre DESC`,
        [lote.id]
      )
      .then((r) => r.rows),
    pool
      .query(
        `SELECT
           i.resultado, i.puntaje, i.hallazgos_criticos AS "hallazgosCriticos",
           i.hallazgos_mayores AS "hallazgosMayores", i.hallazgos_menores AS "hallazgosMenores",
           i.observaciones, i.reporte_hash AS "reporteHash", i.tx_hash AS "txHash",
           i.fecha_realizada AS "fechaRealizada",
           u.nombres AS "inspectorNombres", u.apellidos AS "inspectorApellidos"
         FROM inspecciones i
         JOIN usuarios u ON u.id = i.inspector_id
         WHERE i.lote_id = $1 AND i.estado = 'COMPLETADA'
         ORDER BY i.fecha_realizada DESC LIMIT 1`,
        [lote.id]
      )
      .then((r) => r.rows[0] ?? null),
    pool
      .query(
        `SELECT ${CERTIFICADO_COLUMNS}, u.nombres AS "aprobadoPorNombres", u.apellidos AS "aprobadoPorApellidos"
         FROM certificados c
         LEFT JOIN usuarios u ON u.id = c.aprobado_por_id
         WHERE c.lote_id = $1`,
        [lote.id]
      )
      .then((r) => r.rows[0] ?? null),
  ]);

  return { ...lote, predio, agricultor, eventos, campanas, inspeccion, certificado };
}

// ── Sync desde app movil ─────────────────────────────────────────────────────

export async function getEventoByContentHash(contentHash: string): Promise<{ id: string } | null> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM eventos_produccion WHERE content_hash = $1`,
    [contentHash]
  );
  return rows[0] ?? null;
}

export async function getEventoDelDiaPorPlanta(
  plantaId: string,
  tipoEvento: string,
  fechaHoy: string
): Promise<{ id: string; fechaEvento: Date } | null> {
  const { rows } = await pool.query<{ id: string; fechaEvento: Date }>(
    `SELECT id, fecha_evento AS "fechaEvento"
     FROM eventos_produccion
     WHERE planta_id = $1 AND tipo_evento = $2
       AND fecha_evento >= $3::timestamptz AND fecha_evento <= $4::timestamptz
     LIMIT 1`,
    [plantaId, tipoEvento, `${fechaHoy}T00:00:00Z`, `${fechaHoy}T23:59:59Z`]
  );
  return rows[0] ?? null;
}

export interface CreateEventoProduccionBody {
  loteId: string;
  plantaId: string | null;
  creadoPor: string;
  tipoEvento: string;
  descripcion: string;
  fechaEvento: Date;
  latitud: number | null;
  longitud: number | null;
  contentHash: string;
  hashVerificado: boolean;
  syncEstado: string;
}

export async function createEventoProduccion(body: CreateEventoProduccionBody): Promise<EventoProduccion> {
  const { rows } = await pool.query<EventoProduccion>(
    `INSERT INTO eventos_produccion
       (lote_id, planta_id, creado_por, tipo_evento, descripcion, fecha_evento,
        latitud, longitud, content_hash, hash_verificado, sync_estado)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING
       id,
       lote_id            AS "loteId",
       planta_id          AS "plantaId",
       creado_por         AS "creadoPor",
       tipo_evento        AS "tipoEvento",
       descripcion, fecha_evento AS "fechaEvento",
       latitud, longitud,
       altitud_msnm       AS "altitudMsnm",
       content_hash       AS "contentHash",
       hash_verificado    AS "hashVerificado",
       rechaz_motivo      AS "rechazMotivo",
       sync_estado        AS "syncEstado",
       ipfs_cid           AS "ipfsCid",
       evidencia_hash     AS "evidenciaHash",
       tx_hash            AS "txHash",
       created_at         AS "createdAt"`,
    [
      body.loteId,
      body.plantaId,
      body.creadoPor,
      body.tipoEvento,
      body.descripcion,
      body.fechaEvento,
      body.latitud,
      body.longitud,
      body.contentHash,
      body.hashVerificado,
      body.syncEstado,
    ]
  );
  return rows[0];
}

// ── Metricas del dashboard ───────────────────────────────────────────────────

export async function getMetricasDashboard(): Promise<{
  totalLotes: number;
  lotesRegistrado: number;
  lotesEnProduccion: number;
  lotesCertificado: number;
  lotesEnInspeccion: number;
  totalCampanas: number;
  campanasAbiertas: number;
  campanasCerradas: number;
  adulteradosSinResolver: number;
  totalPlantas: number;
  registrosCompletos: number;
  ultimasCampanas: unknown[];
  ultimosEventos: unknown[];
}> {
  const count = async (sql: string, params: unknown[] = []): Promise<number> => {
    const { rows } = await pool.query<{ count: string }>(sql, params);
    return Number(rows[0].count);
  };

  const [
    totalLotes,
    lotesRegistrado,
    lotesEnProduccion,
    lotesCertificado,
    lotesEnInspeccion,
    totalCampanas,
    campanasAbiertas,
    campanasCerradas,
    adulteradosSinResolver,
    ultimasCampanas,
    ultimosEventos,
    totalPlantas,
    registrosCompletos,
  ] = await Promise.all([
    count(`SELECT count(*) FROM lotes`),
    count(`SELECT count(*) FROM lotes WHERE estado = 'REGISTRADO'`),
    count(`SELECT count(*) FROM lotes WHERE estado = 'EN_PRODUCCION'`),
    count(`SELECT count(*) FROM lotes WHERE estado = 'CERTIFICADO'`),
    count(`SELECT count(*) FROM lotes WHERE estado IN ('INSPECCION_SOLICITADA', 'EN_INSPECCION')`),
    count(`SELECT count(*) FROM campanas`),
    count(`SELECT count(*) FROM campanas WHERE estado = 'ABIERTA'`),
    count(`SELECT count(*) FROM campanas WHERE estado = 'CERRADA'`),
    count(`SELECT count(*) FROM registros_planta WHERE estado = 'ADULTERADO'`),
    pool
      .query(
        `SELECT
           c.id, c.nombre, c.estado, c.created_at AS "createdAt",
           l.codigo_lote AS "loteCodigoLote", l.especie AS "loteEspecie",
           u.nombres AS "creadorNombres", u.apellidos AS "creadorApellidos",
           (SELECT count(*)::int FROM registros_planta rp WHERE rp.campana_id = c.id) AS "totalRegistros"
         FROM campanas c
         JOIN lotes l ON l.id = c.lote_id
         JOIN usuarios u ON u.id = c.creada_por
         ORDER BY c.created_at DESC
         LIMIT 5`
      )
      .then((r) => r.rows),
    pool
      .query(
        `SELECT
           e.id, e.tipo_evento AS "tipoEvento", e.fecha_evento AS "fechaEvento", e.hash_verificado AS "hashVerificado",
           l.codigo_lote AS "loteCodigoLote", l.especie AS "loteEspecie",
           u.nombres AS "tecnicoNombres", u.apellidos AS "tecnicoApellidos"
         FROM eventos_produccion e
         JOIN lotes l ON l.id = e.lote_id
         JOIN usuarios u ON u.id = e.creado_por
         ORDER BY e.created_at DESC
         LIMIT 5`
      )
      .then((r) => r.rows),
    count(`SELECT count(*) FROM plantas`),
    count(`SELECT count(*) FROM registros_planta WHERE estado = 'COMPLETO'`),
  ]);

  return {
    totalLotes,
    lotesRegistrado,
    lotesEnProduccion,
    lotesCertificado,
    lotesEnInspeccion,
    totalCampanas,
    campanasAbiertas,
    campanasCerradas,
    adulteradosSinResolver,
    totalPlantas,
    registrosCompletos,
    ultimasCampanas,
    ultimosEventos,
  };
}

// ── Informe de trazabilidad (PDF) ────────────────────────────────────────────
// Replica el `include` de 4 niveles de Prisma (lote -> campanas -> registros ->
// aportes -> tecnico) mediante queries separadas ensambladas en memoria.

export async function getLoteParaInforme(loteId: string): Promise<unknown | null> {
  const lote = await getLoteById(loteId);
  if (!lote) return null;

  const [predio, departamento, municipio, agricultor, certificado, totalPlantas, totalEventos, campanas] =
    await Promise.all([
      getPredioById(lote.predioId),
      pool
        .query(`SELECT nombre FROM departamentos WHERE codigo = (SELECT departamento FROM predios WHERE id = $1)`, [lote.predioId])
        .then((r) => r.rows[0]?.nombre ?? null),
      pool
        .query(`SELECT nombre FROM municipios WHERE codigo = (SELECT municipio FROM predios WHERE id = $1)`, [lote.predioId])
        .then((r) => r.rows[0]?.nombre ?? null),
      pool
        .query(
          `SELECT nombres, apellidos, numero_documento AS "numeroDocumento", tipo_documento AS "tipoDocumento"
           FROM usuarios WHERE id = $1`,
          [lote.agricultorId]
        )
        .then((r) => r.rows[0] ?? null),
      pool.query(`SELECT ${CERTIFICADO_COLUMNS} FROM certificados c WHERE c.lote_id = $1`, [loteId]).then((r) => r.rows[0] ?? null),
      pool.query(`SELECT count(*)::int AS n FROM lote_plantas WHERE lote_id = $1`, [loteId]).then((r) => r.rows[0].n),
      pool.query(`SELECT count(*)::int AS n FROM eventos_produccion WHERE lote_id = $1`, [loteId]).then((r) => r.rows[0].n),
      pool
        .query(
          `SELECT
             c.id, c.nombre, c.codigo, c.descripcion, c.estado,
             c.campos_requeridos AS "camposRequeridos",
             c.campana_hash AS "campanaHash", c.tx_hash AS "txHash",
             c.fecha_apertura AS "fechaApertura", c.fecha_cierre AS "fechaCierre",
             c.created_at AS "createdAt",
             uc.nombres AS "creadorNombres", uc.apellidos AS "creadorApellidos", uc.rol AS "creadorRol",
             ux.nombres AS "cerradorNombres", ux.apellidos AS "cerradorApellidos"
           FROM campanas c
           JOIN usuarios uc ON uc.id = c.creada_por
           LEFT JOIN usuarios ux ON ux.id = c.cerrada_por
           WHERE c.lote_id = $1
           ORDER BY c.created_at ASC`,
          [loteId]
        )
        .then((r) => r.rows),
    ]);

  const campanaIds = campanas.map((c: any) => c.id);
  let registrosPorCampana = new Map<string, any[]>();

  if (campanaIds.length > 0) {
    const { rows: registros } = await pool.query(
      `SELECT
         rp.id, rp.campana_id AS "campanaId", rp.estado, rp.consecutivo,
         rp.content_hash AS "contentHash", rp.created_at AS "createdAt",
         pl.codigo_planta AS "plantaCodigoPlanta", pl.numero_planta AS "plantaNumeroPlanta"
       FROM registros_planta rp
       JOIN plantas pl ON pl.id = rp.planta_id
       WHERE rp.campana_id = ANY($1)
       ORDER BY rp.created_at ASC`,
      [campanaIds]
    );

    const registroIds = registros.map((r: any) => r.id);
    let aportesPorRegistro = new Map<string, any[]>();

    if (registroIds.length > 0) {
      const { rows: aportes } = await pool.query(
        `SELECT
           a.id, a.registro_planta_id AS "registroPlantaId", a.posicion, a.campos,
           a.foto_hash AS "fotoHash", a.audio_hash AS "audioHash",
           a.content_hash AS "contentHash", a.fecha_aporte AS "fechaAporte",
           u.nombres AS "tecnicoNombres", u.apellidos AS "tecnicoApellidos", u.rol AS "tecnicoRol"
         FROM aportes_tecnicos a
         JOIN usuarios u ON u.id = a.tecnico_id
         WHERE a.registro_planta_id = ANY($1)
         ORDER BY a.fecha_aporte ASC`,
        [registroIds]
      );
      for (const a of aportes) {
        const arr = aportesPorRegistro.get(a.registroPlantaId) ?? [];
        arr.push({
          ...a,
          tecnico: { nombres: a.tecnicoNombres, apellidos: a.tecnicoApellidos, rol: a.tecnicoRol },
        });
        aportesPorRegistro.set(a.registroPlantaId, arr);
      }
    }

    for (const r of registros) {
      const arr = registrosPorCampana.get(r.campanaId) ?? [];
      arr.push({
        ...r,
        planta: { codigoPlanta: r.plantaCodigoPlanta, numeroPlanta: r.plantaNumeroPlanta },
        aportes: aportesPorRegistro.get(r.id) ?? [],
      });
      registrosPorCampana.set(r.campanaId, arr);
    }
  }

  const campanasConDatos = campanas.map((c: any) => ({
    ...c,
    creador: { nombres: c.creadorNombres, apellidos: c.creadorApellidos, rol: c.creadorRol },
    cerrador: c.cerradorNombres ? { nombres: c.cerradorNombres, apellidos: c.cerradorApellidos } : null,
    registros: registrosPorCampana.get(c.id) ?? [],
  }));

  return {
    lote: {
      id: lote.id,
      codigoLote: lote.codigoLote,
      especie: lote.especie,
      variedad: lote.variedad,
      areaHa: lote.areaHa,
      estado: lote.estado,
      fechaSiembra: lote.fechaSiembra,
      fechaCosechaEst: lote.fechaCosechaEst,
      dataHash: lote.dataHash,
      txRegistro: lote.txRegistro,
      createdAt: lote.createdAt,
      predio: predio
        ? {
            nombrePredio: predio.nombrePredio,
            departamento,
            municipio,
            vereda: predio.vereda,
            altitudMsnm: predio.altitudMsnm,
            latitud: predio.latitud,
            longitud: predio.longitud,
          }
        : null,
      agricultor,
      certificado,
      totalPlantas,
      totalEventos,
    },
    campanas: campanasConDatos,
  };
}

// ── Evidencia binaria (S3) ───────────────────────────────────────────────────

export interface CreateEvidenciaBinariaBody {
  tipo: string; // 'aporte' | 'evento' | 'documento' | 'eudr_satelital'
  entidadId: string;
  storageKey: string;
  originalName: string;
  mimetype: string;
  sizeBytes: number;
  sha256: string;
  subidoPor: string;
}

export async function createEvidenciaBinaria(body: CreateEvidenciaBinariaBody): Promise<EvidenciaBinaria> {
  const { rows } = await pool.query<EvidenciaBinaria>(
    `INSERT INTO evidencia_binaria (tipo, entidad_id, storage_key, original_name, mimetype, size_bytes, sha256, subido_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, tipo, entidad_id AS "entidadId", storage_key AS "storageKey",
               original_name AS "originalName", mimetype, size_bytes AS "sizeBytes",
               sha256, subido_por AS "subidoPor", created_at AS "createdAt"`,
    [body.tipo, body.entidadId, body.storageKey, body.originalName, body.mimetype, body.sizeBytes, body.sha256, body.subidoPor]
  );
  return rows[0];
}

export async function listEvidenciaBinaria(tipo: string, entidadId: string): Promise<EvidenciaBinaria[]> {
  const { rows } = await pool.query<EvidenciaBinaria>(
    `SELECT id, tipo, entidad_id AS "entidadId", storage_key AS "storageKey",
            original_name AS "originalName", mimetype, size_bytes AS "sizeBytes",
            sha256, subido_por AS "subidoPor", created_at AS "createdAt"
     FROM evidencia_binaria WHERE tipo = $1 AND entidad_id = $2
     ORDER BY created_at ASC`,
    [tipo, entidadId]
  );
  return rows;
}

export async function getEvidenciaBinariaById(id: string): Promise<EvidenciaBinaria | null> {
  const { rows } = await pool.query<EvidenciaBinaria>(
    `SELECT id, tipo, entidad_id AS "entidadId", storage_key AS "storageKey",
            original_name AS "originalName", mimetype, size_bytes AS "sizeBytes",
            sha256, subido_por AS "subidoPor", created_at AS "createdAt"
     FROM evidencia_binaria WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function deleteEvidenciaBinaria(id: string): Promise<void> {
  await pool.query(`DELETE FROM evidencia_binaria WHERE id = $1`, [id]);
}

// Verifica si la entidad padre de una evidencia ya es inmutable, para
// replicar la regla de SSE (isStepConfirmed): no se puede subir/borrar
// evidencia sobre un aporte/registro/declaracion ya sellado.
//
// Nota de diseño: el content_hash del aporte (nivel 1) es inmutable desde su
// creacion, pero eso protege los CAMPOS DECLARADOS, no bloquea adjuntar el
// binario correspondiente — el flujo real es crear el aporte (con su hash
// ya calculado sobre fotoHash/audioHash) y subir el archivo justo despues.
// Lo que realmente se bloquea es subir evidencia una vez el REGISTRO de la
// planta (nivel 2, que agrupa los 4 aportes) ya quedo COMPLETO — a partir
// de ahi el registro entero se considera sellado.
export async function esEntidadEvidenciaInmutable(tipo: string, entidadId: string): Promise<boolean> {
  switch (tipo) {
    case "aporte": {
      const { rows } = await pool.query<{ estado: string }>(
        `SELECT rp.estado FROM aportes_tecnicos a
         JOIN registros_planta rp ON rp.id = a.registro_planta_id
         WHERE a.id = $1`,
        [entidadId]
      );
      return rows[0]?.estado === "COMPLETO";
    }
    case "evento": {
      // un evento_produccion es inmutable desde su creacion (ver 01_immutability.sql)
      const { rows } = await pool.query(`SELECT 1 FROM eventos_produccion WHERE id = $1`, [entidadId]);
      return rows.length > 0;
    }
    case "eudr_satelital": {
      const { rows } = await pool.query(
        `SELECT 1 FROM eudr_declaraciones WHERE id = $1 AND estado IN ('FIRMADA','ANCLADA_BLOCKCHAIN')`,
        [entidadId]
      );
      return rows.length > 0;
    }
    default:
      return false;
  }
}
