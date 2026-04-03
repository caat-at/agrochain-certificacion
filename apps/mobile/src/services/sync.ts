/**
 * Servicio de sincronización con el API de AgroChain.
 *
 * Flujo de integridad:
 *   1. Al guardar un evento en campo → se genera SHA256 (contentHash)
 *   2. Al sincronizar → se envía el evento + contentHash al servidor
 *   3. El servidor recalcula el hash y verifica que coincida
 *   4. Si el servidor responde { purgar: true } → se elimina la foto local
 */
import * as FileSystem from "expo-file-system/legacy";
import {
  obtenerSesion,
  listarEventosPendientes,
  marcarEventoSincronizado,
  marcarEventoRechazado,
  purgarFotoEvento,
  EventoLocal,
} from "./db";

export interface SyncResultado {
  total: number;
  aceptados: number;
  rechazados: number;
  errores: string[];
}

interface ApiEventoPayload {
  eventoId: string;
  loteId: string;
  plantaId: string | null;
  tipoEvento: string;
  fechaEvento: string;
  latitud: number | null;
  longitud: number | null;
  altitudMsnm: number | null;
  tecnicoId: string;
  descripcion: string;
  datosExtra: Record<string, unknown>;
  fotoHash: string | null;
  audioHash: string | null;
  contentHash: string;
}

interface ApiSyncResponse {
  resultados: Array<{
    eventoId: string;
    aceptado: boolean;
    purgar: boolean;
    motivo?: string;
  }>;
}

/**
 * Sincroniza todos los eventos pendientes con el servidor.
 * Envía en lotes de 20 para no saturar la conexión.
 */
export async function sincronizarEventos(): Promise<SyncResultado> {
  const sesion = await obtenerSesion();
  if (!sesion) throw new Error("No hay sesión activa");

  const pendientes = await listarEventosPendientes();
  const resultado: SyncResultado = {
    total: pendientes.length,
    aceptados: 0,
    rechazados: 0,
    errores: [],
  };

  if (pendientes.length === 0) return resultado;

  const BATCH_SIZE = 20;
  for (let i = 0; i < pendientes.length; i += BATCH_SIZE) {
    const lote = pendientes.slice(i, i + BATCH_SIZE);
    await procesarLote(lote, sesion.token, sesion.apiUrl, resultado);
  }

  return resultado;
}

async function procesarLote(
  eventos: EventoLocal[],
  token: string,
  apiUrl: string,
  resultado: SyncResultado
): Promise<void> {
  const payloads: ApiEventoPayload[] = eventos
    .filter((e) => e.contentHash !== null)
    .map((e) => ({
      eventoId: e.id,
      loteId: e.loteId,
      plantaId: e.plantaId,
      tipoEvento: e.tipoEvento,
      fechaEvento: e.fechaEvento,
      latitud: e.latitud,
      longitud: e.longitud,
      altitudMsnm: e.altitudMsnm,
      tecnicoId: e.tecnicoId,
      descripcion: e.descripcion,
      datosExtra: JSON.parse(e.datosExtra) as Record<string, unknown>,
      fotoHash: e.fotoHash,
      audioHash: e.audioHash,
      contentHash: e.contentHash!,
    }));

  if (payloads.length === 0) return;

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/sync/eventos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ eventos: payloads }),
    });
  } catch (err) {
    resultado.errores.push(`Red: ${String(err)}`);
    return;
  }

  if (!response.ok) {
    resultado.errores.push(`HTTP ${response.status}: ${await response.text()}`);
    return;
  }

  const data = (await response.json()) as ApiSyncResponse;

  for (const item of data.resultados) {
    const evento = eventos.find((e) => e.id === item.eventoId);
    if (!evento) continue;

    if (item.aceptado) {
      await marcarEventoSincronizado(evento.id);
      resultado.aceptados++;

      // Purgar archivo de foto local si el servidor lo indica
      if (item.purgar && evento.fotoUri) {
        try {
          await FileSystem.deleteAsync(evento.fotoUri, { idempotent: true });
        } catch {
          // No crítico si falla la purga
        }
        await purgarFotoEvento(evento.id);
      }
    } else {
      await marcarEventoRechazado(evento.id);
      resultado.rechazados++;
      if (item.motivo) {
        resultado.errores.push(`[${evento.id}] ${item.motivo}`);
      }
    }
  }
}

// ── PLANTAS ───────────────────────────────────────────────────────────────────

export interface PlantaApi {
  id: string;
  codigoPlanta: string;
  numeroPlanta: string;
  especie: string | null;
  variedad: string | null;
  latitud: number;
  longitud: number;
}

export async function cargarPlantasDesdeServidor(loteId: string): Promise<PlantaApi[]> {
  const sesion = await obtenerSesion();
  if (!sesion) throw new Error("No hay sesión activa");

  const response = await fetch(`${sesion.apiUrl}/api/lotes/${loteId}/plantas`, {
    headers: { Authorization: `Bearer ${sesion.token}` },
  });

  if (!response.ok) throw new Error(`Error cargando plantas: ${response.status}`);
  const data = await response.json() as { plantas: PlantaApi[] };
  return data.plantas;
}

export async function registrarPlantaEnServidor(loteId: string, datos: {
  codigoPlanta: string;
  numeroPlanta: string;
  latitud: number;
  longitud: number;
  altitudMsnm?: number;
  especie?: string;
  variedad?: string;
  origenMaterial?: string;
  procedenciaVivero?: string;
  fechaSiembra?: string;
  alturaCmInicial?: number;
  diametroTalloCmInicial?: number;
  numHojasInicial?: number;
  estadoFenologicoInicial?: string;
}): Promise<PlantaApi> {
  const sesion = await obtenerSesion();
  if (!sesion) throw new Error("No hay sesión activa");

  const response = await fetch(`${sesion.apiUrl}/api/lotes/${loteId}/plantas`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sesion.token}`,
    },
    body: JSON.stringify(datos),
  });

  if (!response.ok) {
    const err = await response.json() as { error?: string };
    throw new Error(err.error ?? `Error ${response.status}`);
  }

  const data = await response.json() as { planta: PlantaApi };
  return data.planta;
}

// ── PREDIOS ───────────────────────────────────────────────────────────────────

export interface PredioApi {
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
}

export async function cargarPrediosDesdeServidor(): Promise<PredioApi[]> {
  const sesion = await obtenerSesion();
  if (!sesion) throw new Error("No hay sesión activa");

  const response = await fetch(`${sesion.apiUrl}/api/predios`, {
    headers: { Authorization: `Bearer ${sesion.token}` },
  });

  if (!response.ok) throw new Error(`Error cargando predios: ${response.status}`);
  const data = await response.json() as { predios: PredioApi[] };
  return data.predios;
}

// ── APORTES DE CAMPAÑA DESDE SERVIDOR ────────────────────────────────────────

export interface AporteCampanaApi {
  id:             string;
  tecnicoId:      string;
  posicion:       number;
  campos:         Record<string, unknown>;
  fotoHash:       string | null;
  audioHash:      string | null;
  fechaAporte:    string;
  latitud:        number | null;
  longitud:       number | null;
  contentHash:    string;
  hashVerificado: boolean | null;
}

export interface RegistroCampanaApi {
  id:          string;
  consecutivo: number;
  estado:      string;
  fechaEvento: string;
  campana: {
    id:     string;
    nombre: string;
    codigo: string | null;
  };
  aportes: AporteCampanaApi[];
}

export async function cargarAportesCampanaDesdeServidor(plantaId: string): Promise<RegistroCampanaApi[]> {
  const sesion = await obtenerSesion();
  if (!sesion) throw new Error("No hay sesión activa");

  const response = await fetch(
    `${sesion.apiUrl}/api/campanas/movil/planta/${plantaId}/aportes`,
    { headers: { Authorization: `Bearer ${sesion.token}` } }
  );

  if (!response.ok) throw new Error(`Error cargando aportes campaña: ${response.status}`);
  const data = await response.json() as { registros: RegistroCampanaApi[] };
  return data.registros ?? [];
}

// ── EVENTOS DESDE SERVIDOR ────────────────────────────────────────────────────

export interface EventoApi {
  id: string;
  loteId: string;
  plantaId: string | null;
  tipoEvento: string;
  fechaEvento: string;
  descripcion: string;
  latitud: number | null;
  longitud: number | null;
  contentHash: string;
  syncEstado: string;
}

export async function cargarEventosDesdeServidor(plantaId: string): Promise<EventoApi[]> {
  const sesion = await obtenerSesion();
  if (!sesion) throw new Error("No hay sesión activa");

  const response = await fetch(
    `${sesion.apiUrl}/api/eventos?plantaId=${plantaId}`,
    { headers: { Authorization: `Bearer ${sesion.token}` } }
  );

  if (!response.ok) throw new Error(`Error cargando eventos: ${response.status}`);
  const data = await response.json() as { data: any[] };

  return (data.data ?? []).map((e) => ({
    id:          e.id,
    loteId:      e.loteId,
    plantaId:    e.plantaId ?? null,
    tipoEvento:  e.tipoEvento,
    fechaEvento: typeof e.fechaEvento === "string" ? e.fechaEvento : new Date(e.fechaEvento).toISOString(),
    descripcion: e.descripcion ?? "",
    latitud:     e.latitud ?? null,
    longitud:    e.longitud ?? null,
    contentHash: e.contentHash,
    syncEstado:  "SINCRONIZADO",
  }));
}

// ── CARGA DE LOTES DESDE SERVIDOR ────────────────────────────────────────────

export interface LoteApi {
  id: string;
  codigoLote: string;
  predioNombre: string;
  especie: string;
  variedad: string | null;
  estadoLote: string;
  dataHash: string | null;
}

export async function cargarLotesDesdeServidor(): Promise<LoteApi[]> {
  const sesion = await obtenerSesion();
  if (!sesion) throw new Error("No hay sesión activa");

  const response = await fetch(`${sesion.apiUrl}/api/lotes`, {
    headers: { Authorization: `Bearer ${sesion.token}` },
  });

  if (!response.ok) throw new Error(`Error cargando lotes: ${response.status}`);
  const data = await response.json() as { lotes: LoteApi[] };
  return data.lotes;
}

// ── AUTENTICACIÓN ─────────────────────────────────────────────────────────────

export interface LoginResponse {
  token: string;
  usuario: {
    id: string;
    nombre: string;
    email: string;
    rol: string;
  };
}

export async function login(
  email: string,
  password: string,
  apiUrl: string
): Promise<LoginResponse> {
  const response = await fetch(`${apiUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const err = await response.json() as { message?: string };
    throw new Error(err.message ?? "Credenciales inválidas");
  }

  return response.json() as Promise<LoginResponse>;
}
