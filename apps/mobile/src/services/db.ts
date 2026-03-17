/**
 * Servicio de base de datos local SQLite (expo-sqlite).
 * Estructura: Predio → Lote → Planta → Evento
 * Normas: NTC 5400 BPA, ICA Res. 3168/2015, INVIMA — Colombia
 */
import * as SQLite from "expo-sqlite";

let _db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync("agrochain_v3.db");
  }
  return _db;
}

// ── INICIALIZACIÓN ─────────────────────────────────────────────────────────────

export async function inicializarDB(): Promise<void> {
  const db = getDb();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    -- Sesión del usuario autenticado
    CREATE TABLE IF NOT EXISTS sesion (
      id            INTEGER PRIMARY KEY CHECK (id = 1),
      userId        TEXT NOT NULL,
      nombre        TEXT NOT NULL,
      email         TEXT NOT NULL,
      rol           TEXT NOT NULL,
      token         TEXT NOT NULL,
      apiUrl        TEXT NOT NULL,
      posicion      INTEGER,         -- posición del técnico en la campaña activa (1-4)
      camposAsignados TEXT           -- JSON array de campos asignados a su posición
    );

    -- Predios — ICA Res. 3168/2015
    CREATE TABLE IF NOT EXISTS predios (
      id                      TEXT PRIMARY KEY,
      nombrePredio            TEXT NOT NULL,
      codigoIca               TEXT,
      matriculaInmobiliaria   TEXT,
      departamento            TEXT NOT NULL,
      municipio               TEXT NOT NULL,
      vereda                  TEXT,
      direccion               TEXT,
      latitud                 REAL,
      longitud                REAL,
      altitudMsnm             REAL,
      areaTotalHa             REAL,
      areaProductivaHa        REAL,
      fuenteAgua              TEXT,
      tipoSuelo               TEXT,
      pendientePct            REAL,
      tieneBodegaAgroquimicos INTEGER DEFAULT 0,
      tieneAguaPotable        INTEGER DEFAULT 0,
      tieneSSSBasicas         INTEGER DEFAULT 0,
      tieneZonaAcopio         INTEGER DEFAULT 0,
      syncEstado              TEXT NOT NULL DEFAULT 'PENDIENTE',
      creadoEn                TEXT NOT NULL
    );

    -- Lotes — NTC 5400 §3, unidad de trazabilidad
    CREATE TABLE IF NOT EXISTS lotes (
      id                TEXT PRIMARY KEY,
      predioId          TEXT REFERENCES predios(id),
      predioNombre      TEXT NOT NULL,
      codigoLote        TEXT NOT NULL UNIQUE,
      especie           TEXT NOT NULL,
      variedad          TEXT,
      areaHa            REAL,
      fechaSiembra      TEXT,
      destinoProduccion TEXT,
      sistemaRiego      TEXT,
      distanciaSiembraM REAL,
      densidadPlantas   INTEGER,
      cultivoAnterior   TEXT,
      estadoLote        TEXT NOT NULL DEFAULT 'REGISTRADO',
      dataHash          TEXT,
      syncEstado        TEXT NOT NULL DEFAULT 'PENDIENTE',
      creadoEn          TEXT NOT NULL
    );

    -- Plantas — NTC 5400 §4.3, ICA Res. 3168/2015 art. 7
    CREATE TABLE IF NOT EXISTS plantas (
      id                        TEXT PRIMARY KEY,
      loteId                    TEXT NOT NULL REFERENCES lotes(id),
      codigoPlanta              TEXT NOT NULL,
      numeroPlanta              TEXT NOT NULL,
      especie                   TEXT,
      variedad                  TEXT,
      origenMaterial            TEXT,
      procedenciaVivero         TEXT,
      fechaSiembra              TEXT,
      alturaCmInicial           REAL,
      diametroTalloCmInicial    REAL,
      numHojasInicial           INTEGER,
      estadoFenologicoInicial   TEXT,
      latitud                   REAL,
      longitud                  REAL,
      altitudMsnm               REAL,
      syncEstado                TEXT NOT NULL DEFAULT 'PENDIENTE',
      creadoEn                  TEXT NOT NULL,
      UNIQUE(loteId, codigoPlanta),
      UNIQUE(loteId, numeroPlanta)
    );

    -- Eventos de seguimiento — NTC 5400 §4.3 a §4.9
    CREATE TABLE IF NOT EXISTS eventos (
      id              TEXT PRIMARY KEY,
      loteId          TEXT NOT NULL REFERENCES lotes(id),
      plantaId        TEXT REFERENCES plantas(id),
      tipoEvento      TEXT NOT NULL,
      fechaEvento     TEXT NOT NULL,
      latitud         REAL,
      longitud        REAL,
      tecnicoId       TEXT NOT NULL,
      descripcion     TEXT NOT NULL DEFAULT '',
      datosExtra      TEXT NOT NULL DEFAULT '{}',
      fotoHash        TEXT,
      fotoUri         TEXT,
      audioHash       TEXT,
      audioUri        TEXT,
      contentHash     TEXT UNIQUE,
      syncEstado      TEXT NOT NULL DEFAULT 'PENDIENTE',
      creadoEn        TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_plantas_lote      ON plantas(loteId);
    CREATE INDEX IF NOT EXISTS idx_eventos_lote      ON eventos(loteId);
    CREATE INDEX IF NOT EXISTS idx_eventos_planta    ON eventos(plantaId);
    CREATE INDEX IF NOT EXISTS idx_eventos_sync      ON eventos(syncEstado);
    CREATE INDEX IF NOT EXISTS idx_eventos_hash      ON eventos(contentHash);

    -- Campañas de recolección — sincronizadas desde el servidor
    CREATE TABLE IF NOT EXISTS campanas (
      id               TEXT PRIMARY KEY,
      loteId           TEXT NOT NULL REFERENCES lotes(id),
      nombre           TEXT NOT NULL,
      descripcion      TEXT,
      camposRequeridos TEXT NOT NULL DEFAULT '[]',
      creadorNombre    TEXT,
      fechaApertura    TEXT NOT NULL,
      actualizadoEn    TEXT NOT NULL
    );

    -- Aportes técnicos pendientes de enviar al servidor (nueva arquitectura multi-técnico)
    CREATE TABLE IF NOT EXISTS aportes_pendientes (
      id               TEXT PRIMARY KEY,
      campanaId        TEXT NOT NULL,
      plantaId         TEXT NOT NULL,
      posicion         INTEGER NOT NULL DEFAULT 0,  -- posición del técnico (1-4)
      campos           TEXT NOT NULL DEFAULT '{}',
      fotoHash         TEXT,          -- SHA256 de su foto
      fotoUri          TEXT,          -- ruta local de la foto
      audioHash        TEXT,          -- SHA256 de su audio
      audioUri         TEXT,          -- ruta local del audio
      contentHash      TEXT NOT NULL DEFAULT '', -- hash de integridad inmutable
      latitud          REAL,
      longitud         REAL,
      fechaAporte      TEXT NOT NULL,  -- capturado automáticamente al guardar
      syncEstado       TEXT NOT NULL DEFAULT 'PENDIENTE',
      creadoEn         TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_campanas_lote     ON campanas(loteId);
    CREATE INDEX IF NOT EXISTS idx_aportes_campana   ON aportes_pendientes(campanaId);
    CREATE INDEX IF NOT EXISTS idx_aportes_sync      ON aportes_pendientes(syncEstado);
  `);

  // Migraciones — agregar columnas nuevas a tablas existentes (ALTER TABLE ignora si ya existe)
  const migraciones = [
    // lotes: nuevos campos
    "ALTER TABLE lotes ADD COLUMN predioId TEXT",
    "ALTER TABLE lotes ADD COLUMN areaHa REAL",
    "ALTER TABLE lotes ADD COLUMN fechaSiembra TEXT",
    "ALTER TABLE lotes ADD COLUMN destinoProduccion TEXT",
    "ALTER TABLE lotes ADD COLUMN sistemaRiego TEXT",
    "ALTER TABLE lotes ADD COLUMN distanciaSiembraM REAL",
    "ALTER TABLE lotes ADD COLUMN densidadPlantas INTEGER",
    "ALTER TABLE lotes ADD COLUMN cultivoAnterior TEXT",
    // plantas: nuevos campos NTC 5400
    "ALTER TABLE plantas ADD COLUMN numeroPlanta TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE plantas ADD COLUMN variedad TEXT",
    "ALTER TABLE plantas ADD COLUMN origenMaterial TEXT",
    "ALTER TABLE plantas ADD COLUMN procedenciaVivero TEXT",
    "ALTER TABLE plantas ADD COLUMN fechaSiembra TEXT",
    "ALTER TABLE plantas ADD COLUMN alturaCmInicial REAL",
    "ALTER TABLE plantas ADD COLUMN diametroTalloCmInicial REAL",
    "ALTER TABLE plantas ADD COLUMN numHojasInicial INTEGER",
    "ALTER TABLE plantas ADD COLUMN estadoFenologicoInicial TEXT",
    "ALTER TABLE plantas ADD COLUMN latitud REAL",
    "ALTER TABLE plantas ADD COLUMN longitud REAL",
    "ALTER TABLE plantas ADD COLUMN altitudMsnm REAL",
    "ALTER TABLE plantas ADD COLUMN creadoEn TEXT NOT NULL DEFAULT ''",
    // eventos: columnas de audio si no existen
    "ALTER TABLE eventos ADD COLUMN audioHash TEXT",
    "ALTER TABLE eventos ADD COLUMN audioUri TEXT",
  ];

  for (const sql of migraciones) {
    try { await db.runAsync(sql); } catch { /* columna ya existe */ }
  }

  // Índice sobre predioId (solo después de que la columna exista)
  try { await db.runAsync("CREATE INDEX IF NOT EXISTS idx_lotes_predio ON lotes(predioId)"); } catch {}

  // Migraciones campañas/aportes (por si la tabla ya existía sin estas columnas)
  const migCampanas = [
    "ALTER TABLE campanas ADD COLUMN descripcion TEXT",
    "ALTER TABLE campanas ADD COLUMN creadorNombre TEXT",
    // Sesión: posición y campos asignados del técnico
    "ALTER TABLE sesion ADD COLUMN posicion INTEGER",
    "ALTER TABLE sesion ADD COLUMN camposAsignados TEXT",
    // Aportes: nuevos campos nueva arquitectura
    "ALTER TABLE aportes_pendientes ADD COLUMN posicion INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE aportes_pendientes ADD COLUMN fotoHash TEXT",
    "ALTER TABLE aportes_pendientes ADD COLUMN fotoUri TEXT",
    "ALTER TABLE aportes_pendientes ADD COLUMN audioHash TEXT",
    "ALTER TABLE aportes_pendientes ADD COLUMN audioUri TEXT",
    "ALTER TABLE aportes_pendientes ADD COLUMN contentHash TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE aportes_pendientes ADD COLUMN fechaAporte TEXT NOT NULL DEFAULT ''",
  ];
  for (const sql of migCampanas) {
    try { await db.runAsync(sql); } catch {}
  }
}

// ── SESIÓN ─────────────────────────────────────────────────────────────────────

export interface Sesion {
  userId: string;
  nombre: string;
  email: string;
  rol: string;
  token: string;
  apiUrl: string;
  posicion: number | null;        // posición del técnico en la campaña (1-4)
  camposAsignados: string | null; // JSON array de campos de su posición
}

export async function guardarSesion(sesion: Sesion): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO sesion (id, userId, nombre, email, rol, token, apiUrl, posicion, camposAsignados)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [sesion.userId, sesion.nombre, sesion.email, sesion.rol, sesion.token, sesion.apiUrl,
     sesion.posicion ?? null, sesion.camposAsignados ?? null]
  );
}

export async function obtenerSesion(): Promise<Sesion | null> {
  const db = getDb();
  return db.getFirstAsync<Sesion>(
    "SELECT userId, nombre, email, rol, token, apiUrl, posicion, camposAsignados FROM sesion WHERE id = 1"
  );
}

export async function actualizarPosicionSesion(posicion: number | null, camposAsignados: string | null): Promise<void> {
  const db = getDb();
  await db.runAsync(
    "UPDATE sesion SET posicion = ?, camposAsignados = ? WHERE id = 1",
    [posicion, camposAsignados]
  );
}

export async function cerrarSesion(): Promise<void> {
  const db = getDb();
  await db.runAsync("DELETE FROM sesion WHERE id = 1");
}

// ── PREDIOS ────────────────────────────────────────────────────────────────────

export interface PredioLocal {
  id: string;
  nombrePredio: string;
  codigoIca: string | null;
  departamento: string;
  municipio: string;
  vereda: string | null;
  areaTotalHa: number | null;
  areaProductivaHa: number | null;
  fuenteAgua: string | null;
  tipoSuelo: string | null;
  latitud: number | null;
  longitud: number | null;
  altitudMsnm: number | null;
  syncEstado: string;
  creadoEn: string;
}

export async function upsertPredio(predio: PredioLocal): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO predios
      (id, nombrePredio, codigoIca, departamento, municipio, vereda,
       areaTotalHa, areaProductivaHa, fuenteAgua, tipoSuelo,
       latitud, longitud, altitudMsnm, syncEstado, creadoEn)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      predio.id, predio.nombrePredio, predio.codigoIca ?? null,
      predio.departamento, predio.municipio, predio.vereda ?? null,
      predio.areaTotalHa ?? null, predio.areaProductivaHa ?? null,
      predio.fuenteAgua ?? null, predio.tipoSuelo ?? null,
      predio.latitud ?? null, predio.longitud ?? null, predio.altitudMsnm ?? null,
      predio.syncEstado, predio.creadoEn,
    ]
  );
}

export async function listarPredios(): Promise<PredioLocal[]> {
  const db = getDb();
  return db.getAllAsync<PredioLocal>("SELECT * FROM predios ORDER BY creadoEn DESC");
}

export async function obtenerPredio(id: string): Promise<PredioLocal | null> {
  const db = getDb();
  return db.getFirstAsync<PredioLocal>("SELECT * FROM predios WHERE id = ?", [id]);
}

// ── LOTES ──────────────────────────────────────────────────────────────────────

export interface LoteLocal {
  id: string;
  predioId: string | null;
  predioNombre: string;
  codigoLote: string;
  especie: string;
  variedad: string | null;
  areaHa: number | null;
  fechaSiembra: string | null;
  destinoProduccion: string | null;
  sistemaRiego: string | null;
  estadoLote: string;
  dataHash: string | null;
  syncEstado: string;
  creadoEn: string;
}

export async function upsertLote(lote: LoteLocal): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO lotes
      (id, predioId, predioNombre, codigoLote, especie, variedad, areaHa,
       fechaSiembra, destinoProduccion, sistemaRiego, estadoLote, dataHash, syncEstado, creadoEn)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      lote.id, lote.predioId ?? null, lote.predioNombre, lote.codigoLote,
      lote.especie, lote.variedad ?? null, lote.areaHa ?? null,
      lote.fechaSiembra ?? null, lote.destinoProduccion ?? null,
      lote.sistemaRiego ?? null, lote.estadoLote,
      lote.dataHash ?? null, lote.syncEstado, lote.creadoEn,
    ]
  );
}

export async function listarLotes(predioId?: string): Promise<LoteLocal[]> {
  const db = getDb();
  if (predioId) {
    return db.getAllAsync<LoteLocal>(
      "SELECT * FROM lotes WHERE predioId = ? ORDER BY creadoEn DESC",
      [predioId]
    );
  }
  return db.getAllAsync<LoteLocal>("SELECT * FROM lotes ORDER BY creadoEn DESC");
}

export async function obtenerLote(id: string): Promise<LoteLocal | null> {
  const db = getDb();
  return db.getFirstAsync<LoteLocal>("SELECT * FROM lotes WHERE id = ?", [id]);
}

// ── PLANTAS ────────────────────────────────────────────────────────────────────

export interface PlantaLocal {
  id: string;
  loteId: string;
  codigoPlanta: string;
  numeroPlanta: string;
  especie: string | null;
  variedad: string | null;
  origenMaterial: string | null;
  procedenciaVivero: string | null;
  fechaSiembra: string | null;
  alturaCmInicial: number | null;
  diametroTalloCmInicial: number | null;
  numHojasInicial: number | null;
  estadoFenologicoInicial: string | null;
  latitud: number | null;
  longitud: number | null;
  altitudMsnm: number | null;
  syncEstado: string;
  creadoEn: string;
}

export async function upsertPlanta(planta: PlantaLocal): Promise<void> {
  const db = getDb();
  await db.runAsync("PRAGMA foreign_keys = OFF");
  await db.runAsync(
    `INSERT OR REPLACE INTO plantas
      (id, loteId, codigoPlanta, numeroPlanta, especie, variedad,
       origenMaterial, procedenciaVivero, fechaSiembra,
       alturaCmInicial, diametroTalloCmInicial, numHojasInicial, estadoFenologicoInicial,
       latitud, longitud, altitudMsnm, syncEstado, creadoEn)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      planta.id, planta.loteId, planta.codigoPlanta, planta.numeroPlanta,
      planta.especie ?? null, planta.variedad ?? null,
      planta.origenMaterial ?? null, planta.procedenciaVivero ?? null,
      planta.fechaSiembra ?? null,
      planta.alturaCmInicial ?? null, planta.diametroTalloCmInicial ?? null,
      planta.numHojasInicial ?? null, planta.estadoFenologicoInicial ?? null,
      planta.latitud ?? null, planta.longitud ?? null, planta.altitudMsnm ?? null,
      planta.syncEstado, planta.creadoEn,
    ]
  );
  await db.runAsync("PRAGMA foreign_keys = ON");
}

export async function listarPlantas(loteId: string): Promise<PlantaLocal[]> {
  const db = getDb();
  return db.getAllAsync<PlantaLocal>(
    "SELECT * FROM plantas WHERE loteId = ? ORDER BY CAST(numeroPlanta AS INTEGER)",
    [loteId]
  );
}

export async function obtenerPlanta(id: string): Promise<PlantaLocal | null> {
  const db = getDb();
  return db.getFirstAsync<PlantaLocal>("SELECT * FROM plantas WHERE id = ?", [id]);
}

// ── EVENTOS ────────────────────────────────────────────────────────────────────

export interface EventoLocal {
  id: string;
  loteId: string;
  plantaId: string | null;
  tipoEvento: string;
  fechaEvento: string;
  latitud: number | null;
  longitud: number | null;
  tecnicoId: string;
  descripcion: string;
  datosExtra: string; // JSON string
  fotoHash: string | null;
  fotoUri: string | null;
  audioHash: string | null;
  audioUri: string | null;
  contentHash: string | null;
  syncEstado: string;
  creadoEn: string;
}

export async function guardarEvento(evento: EventoLocal): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO eventos
      (id, loteId, plantaId, tipoEvento, fechaEvento, latitud, longitud,
       tecnicoId, descripcion, datosExtra, fotoHash, fotoUri, audioHash, audioUri,
       contentHash, syncEstado, creadoEn)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      evento.id, evento.loteId, evento.plantaId ?? null,
      evento.tipoEvento, evento.fechaEvento,
      evento.latitud ?? null, evento.longitud ?? null,
      evento.tecnicoId, evento.descripcion, evento.datosExtra,
      evento.fotoHash ?? null, evento.fotoUri ?? null,
      evento.audioHash ?? null, evento.audioUri ?? null,
      evento.contentHash ?? null, evento.syncEstado, evento.creadoEn,
    ]
  );
}

export async function listarEventosPorPlanta(plantaId: string): Promise<EventoLocal[]> {
  const db = getDb();
  return db.getAllAsync<EventoLocal>(
    "SELECT * FROM eventos WHERE plantaId = ? ORDER BY fechaEvento DESC",
    [plantaId]
  );
}

export async function listarEventosPorLote(loteId: string): Promise<EventoLocal[]> {
  const db = getDb();
  return db.getAllAsync<EventoLocal>(
    "SELECT * FROM eventos WHERE loteId = ? ORDER BY fechaEvento DESC",
    [loteId]
  );
}

export async function listarEventosPendientes(): Promise<EventoLocal[]> {
  const db = getDb();
  return db.getAllAsync<EventoLocal>(
    "SELECT * FROM eventos WHERE syncEstado = 'PENDIENTE' ORDER BY creadoEn ASC"
  );
}

export async function verificarDuplicadoLocal(
  loteId: string,
  plantaId: string | null,
  tipoEvento: string,
  fechaEvento: string
): Promise<boolean> {
  const db = getDb();
  const fechaDia = fechaEvento.substring(0, 10);
  const row = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM eventos
     WHERE loteId = ?
       AND (plantaId = ? OR (plantaId IS NULL AND ? IS NULL))
       AND tipoEvento = ?
       AND substr(fechaEvento, 1, 10) = ?
       AND syncEstado != 'RECHAZADO'`,
    [loteId, plantaId ?? null, plantaId ?? null, tipoEvento, fechaDia]
  );
  return (row?.cnt ?? 0) > 0;
}

export async function marcarEventoSincronizado(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync("UPDATE eventos SET syncEstado = 'SINCRONIZADO' WHERE id = ?", [id]);
}

export async function marcarEventoRechazado(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync("UPDATE eventos SET syncEstado = 'RECHAZADO' WHERE id = ?", [id]);
}

export async function purgarFotoEvento(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync("UPDATE eventos SET fotoUri = NULL WHERE id = ?", [id]);
}

export async function limpiarEventosRechazados(): Promise<number> {
  const db = getDb();
  const result = await db.runAsync("DELETE FROM eventos WHERE syncEstado = 'RECHAZADO'");
  return result.changes;
}

export async function contarEventosPendientes(): Promise<number> {
  const db = getDb();
  const row = await db.getFirstAsync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM eventos WHERE syncEstado = 'PENDIENTE'"
  );
  return row?.cnt ?? 0;
}

// ── CAMPAÑAS ───────────────────────────────────────────────────────────────────

export interface CampanaLocal {
  id: string;
  loteId: string;
  nombre: string;
  descripcion: string | null;
  camposRequeridos: string; // JSON array string
  creadorNombre: string | null;
  fechaApertura: string;
  actualizadoEn: string;
}

export async function upsertCampana(campana: CampanaLocal): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO campanas
      (id, loteId, nombre, descripcion, camposRequeridos, creadorNombre, fechaApertura, actualizadoEn)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      campana.id, campana.loteId, campana.nombre,
      campana.descripcion ?? null, campana.camposRequeridos,
      campana.creadorNombre ?? null, campana.fechaApertura, campana.actualizadoEn,
    ]
  );
}

export async function listarCampanas(): Promise<CampanaLocal[]> {
  const db = getDb();
  return db.getAllAsync<CampanaLocal>(
    "SELECT * FROM campanas ORDER BY fechaApertura DESC"
  );
}

export async function obtenerCampana(id: string): Promise<CampanaLocal | null> {
  const db = getDb();
  return db.getFirstAsync<CampanaLocal>("SELECT * FROM campanas WHERE id = ?", [id]);
}

export async function obtenerCampanaPorLote(loteId: string): Promise<CampanaLocal | null> {
  const db = getDb();
  return db.getFirstAsync<CampanaLocal>(
    "SELECT * FROM campanas WHERE loteId = ? ORDER BY fechaApertura DESC LIMIT 1",
    [loteId]
  );
}

export async function eliminarCampana(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync("DELETE FROM campanas WHERE id = ?", [id]);
}

// ── APORTES PENDIENTES ─────────────────────────────────────────────────────────

export interface AportePendiente {
  id: string;
  campanaId: string;
  plantaId: string;
  posicion: number;
  campos: string;       // JSON object string
  fotoHash: string | null;
  fotoUri: string | null;
  audioHash: string | null;
  audioUri: string | null;
  contentHash: string;  // hash de integridad inmutable
  latitud: number | null;
  longitud: number | null;
  fechaAporte: string;  // ISO 8601 — capturado automáticamente
  syncEstado: string;
  creadoEn: string;
}

export async function guardarAporte(aporte: AportePendiente): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO aportes_pendientes
      (id, campanaId, plantaId, posicion, campos, fotoHash, fotoUri, audioHash, audioUri,
       contentHash, latitud, longitud, fechaAporte, syncEstado, creadoEn)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      aporte.id, aporte.campanaId, aporte.plantaId, aporte.posicion,
      aporte.campos,
      aporte.fotoHash ?? null, aporte.fotoUri ?? null,
      aporte.audioHash ?? null, aporte.audioUri ?? null,
      aporte.contentHash,
      aporte.latitud ?? null, aporte.longitud ?? null,
      aporte.fechaAporte, aporte.syncEstado, aporte.creadoEn,
    ]
  );
}

export async function listarAportesPendientes(): Promise<AportePendiente[]> {
  const db = getDb();
  return db.getAllAsync<AportePendiente>(
    "SELECT * FROM aportes_pendientes WHERE syncEstado = 'PENDIENTE' ORDER BY creadoEn ASC"
  );
}

export async function marcarAporteSincronizado(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync(
    "UPDATE aportes_pendientes SET syncEstado = 'SINCRONIZADO' WHERE id = ?",
    [id]
  );
}

export async function marcarAporteRechazado(id: string, motivo?: string): Promise<void> {
  const db = getDb();
  await db.runAsync(
    "UPDATE aportes_pendientes SET syncEstado = 'RECHAZADO' WHERE id = ?",
    [id]
  );
}

export async function contarAportesPendientes(): Promise<number> {
  const db = getDb();
  const row = await db.getFirstAsync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM aportes_pendientes WHERE syncEstado = 'PENDIENTE'"
  );
  return row?.cnt ?? 0;
}

export async function listarAportesDeCampanaPlanta(
  campanaId: string,
  plantaId: string
): Promise<AportePendiente[]> {
  const db = getDb();
  return db.getAllAsync<AportePendiente>(
    "SELECT * FROM aportes_pendientes WHERE campanaId = ? AND plantaId = ? ORDER BY creadoEn ASC",
    [campanaId, plantaId]
  );
}
