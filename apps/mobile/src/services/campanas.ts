/**
 * Servicio de campañas de recolección — AgroChain.
 * Nueva arquitectura multi-técnico con posiciones y contentHash por aporte.
 *
 * Flujo:
 *  1. Técnico descarga la campaña → recibe sus campos asignados según posición
 *  2. App guarda localmente con contentHash (offline-first)
 *  3. Al sincronizar, el servidor verifica el contentHash
 *  4. Cuando los 4 técnicos aportan → registro COMPLETO → posible cierre automático de campaña
 */
import {
  obtenerSesion,
  actualizarPosicionSesion,
  upsertCampana,
  listarCampanas,
  obtenerCampanaPorLote,
  eliminarCampana,
  guardarAporte,
  listarAportesPendientes,
  marcarAporteSincronizado,
  marcarAporteRechazado,
  AportePendiente,
  CampanaLocal,
} from "./db";
import { generarContentHashAporte } from "../lib/hash";

// ── Tipos de respuesta del servidor ──────────────────────────────────────────

export interface PlantaCampana {
  id: string;
  codigoPlanta: string;
  numeroPlanta: string;
  especie: string | null;
  variedad: string | null;
  latitud: number | null;
  longitud: number | null;
  registroId: string | null;
  consecutivo: number | null; // consecutivo del registro en la campaña
  estadoRegistro: string; // PENDIENTE | PARCIAL | COMPLETO | SIN_REGISTRO | ADULTERADO
  camposIngresados: string[];
  camposFaltantes: string[];
  completo: boolean;
  yaTecnicoAporto: boolean; // si el técnico autenticado ya aportó en esta planta
}

export interface CampanaDetalle {
  campana: {
    id: string;
    nombre: string;
    codigo: string | null; // código legible de la campaña: "MANGO26"
    descripcion: string | null;
    loteId: string;
    lote: { codigoLote: string; especie: string; variedad: string | null };
    camposRequeridos: string[];
    creador: { nombres: string; apellidos: string };
    fechaApertura: string;
    estado?: string;
  };
  estado?: string; // "ACTIVA" | "ABIERTA"
  plantas: PlantaCampana[];
  progreso: { total: number; completos: number; pendientes: number };
  // Información de la posición del técnico autenticado
  miPosicion: number | null;
  misCampos: string[];
}

export interface SyncAportesResultado {
  total: number;
  enviados: number;
  rechazados: number;
  errores: string[];
}

// ── Cargar campaña abierta desde el servidor ──────────────────────────────────

export async function cargarCampanaDesdeServidor(
  loteId: string
): Promise<CampanaDetalle | null> {
  const sesion = await obtenerSesion();
  if (!sesion) throw new Error("No hay sesión activa");

  const res = await fetch(
    `${sesion.apiUrl}/api/campanas/movil/lote/${loteId}`,
    {
      headers: {
        Authorization: `Bearer ${sesion.token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (res.status === 404) {
    // No hay campaña ABIERTA — limpiar caché local
    const local = await obtenerCampanaPorLote(loteId);
    if (local) await eliminarCampana(local.id);
    await actualizarPosicionSesion(null, null);
    return null;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `Error ${res.status}`);
  }

  const data = await res.json() as CampanaDetalle;

  // Si la campaña está ACTIVA (en preparación), solo guardar info básica en caché
  // y limpiar posición (no hay posición asignada aún)
  if (data.estado === "ACTIVA") {
    await upsertCampana({
      id:              data.campana.id,
      loteId,
      nombre:          data.campana.nombre,
      descripcion:     data.campana.descripcion ?? null,
      camposRequeridos: JSON.stringify(data.campana.camposRequeridos),
      creadorNombre:   `${data.campana.creador.nombres} ${data.campana.creador.apellidos}`,
      fechaApertura:   data.campana.fechaApertura ?? new Date().toISOString(),
      actualizadoEn:   new Date().toISOString(),
    });
    await actualizarPosicionSesion(null, null);
    return data;
  }

  // Guardar campaña ABIERTA localmente para acceso offline
  await upsertCampana({
    id:              data.campana.id,
    loteId,
    nombre:          data.campana.nombre,
    descripcion:     data.campana.descripcion ?? null,
    camposRequeridos: JSON.stringify(data.campana.camposRequeridos),
    creadorNombre:   `${data.campana.creador.nombres} ${data.campana.creador.apellidos}`,
    fechaApertura:   data.campana.fechaApertura,
    actualizadoEn:   new Date().toISOString(),
  });

  // Guardar posición y campos asignados del técnico en sesión local
  if (data.miPosicion !== null) {
    await actualizarPosicionSesion(
      data.miPosicion,
      JSON.stringify(data.misCampos)
    );
  }

  return data;
}

// ── Listar campañas guardadas localmente ──────────────────────────────────────

export async function listarCampanasLocales(): Promise<CampanaLocal[]> {
  return listarCampanas();
}

export async function obtenerCampanaLocal(loteId: string): Promise<CampanaLocal | null> {
  return obtenerCampanaPorLote(loteId);
}

// ── Guardar aporte localmente (offline-first) ─────────────────────────────────

export async function guardarAporteLocal(params: {
  campanaId:   string;
  plantaId:    string;
  posicion:    number;
  campos:      Record<string, unknown>;
  fotoHash?:   string;
  fotoUri?:    string;
  audioHash?:  string;
  audioUri?:   string;
  latitud?:    number;
  longitud?:   number;
}): Promise<string> {
  const sesion = await obtenerSesion();
  if (!sesion) throw new Error("No hay sesión activa");

  const fechaAporte = new Date().toISOString();
  const id = `aporte_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Generar contentHash inmutable — mismo algoritmo que el servidor
  const contentHash = await generarContentHashAporte({
    plantaId:    params.plantaId,
    campanaId:   params.campanaId,
    tecnicoId:   sesion.userId,
    posicion:    params.posicion,
    campos:      params.campos,
    fotoHash:    params.fotoHash ?? null,
    audioHash:   params.audioHash ?? null,
    latitud:     params.latitud ?? null,
    longitud:    params.longitud ?? null,
    fechaAporte,
  });

  await guardarAporte({
    id,
    campanaId:   params.campanaId,
    plantaId:    params.plantaId,
    tecnicoId:   sesion.userId,
    posicion:    params.posicion,
    campos:      JSON.stringify(params.campos),
    fotoHash:    params.fotoHash ?? null,
    fotoUri:     params.fotoUri ?? null,
    audioHash:   params.audioHash ?? null,
    audioUri:    params.audioUri ?? null,
    contentHash,
    latitud:     params.latitud ?? null,
    longitud:    params.longitud ?? null,
    fechaAporte,
    syncEstado:  "PENDIENTE",
    creadoEn:    fechaAporte,
  });

  return id;
}

// ── Sincronizar aportes pendientes con el servidor ────────────────────────────

export async function sincronizarAportes(): Promise<SyncAportesResultado> {
  const sesion = await obtenerSesion();
  if (!sesion) throw new Error("No hay sesión activa");

  const pendientes = await listarAportesPendientes();
  const resultado: SyncAportesResultado = {
    total:      pendientes.length,
    enviados:   0,
    rechazados: 0,
    errores:    [],
  };

  for (const aporte of pendientes) {
    try {
      let campos: Record<string, unknown>;
      try {
        campos = JSON.parse(aporte.campos) as Record<string, unknown>;
      } catch {
        resultado.errores.push(`P${aporte.posicion}: campos JSON inválido — "${aporte.campos}"`);
        resultado.rechazados++;
        await marcarAporteRechazado(aporte.id);
        continue;
      }

      const res = await fetch(
        `${sesion.apiUrl}/api/campanas/${aporte.campanaId}/registros/${aporte.plantaId}/aportes`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sesion.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            campos,
            fotoHash:    aporte.fotoHash ?? undefined,
            audioHash:   aporte.audioHash ?? undefined,
            latitud:     aporte.latitud ?? undefined,
            longitud:    aporte.longitud ?? undefined,
            contentHash: aporte.contentHash,
            fechaAporte: aporte.fechaAporte,
          }),
        }
      );

      if (res.ok) {
        await marcarAporteSincronizado(aporte.id);
        resultado.enviados++;
      } else {
        const rawText = await res.text().catch(() => "");
        console.log(`[sync] aporte P${aporte.posicion} → HTTP ${res.status} — ${rawText}`);
        let motivo = `HTTP ${res.status}`;
        try {
          const parsed = JSON.parse(rawText) as { message?: string; error?: string };
          motivo = parsed.message ?? parsed.error ?? rawText.substring(0, 120) ?? motivo;
        } catch {
          motivo = rawText.substring(0, 120) || motivo;
        }
        if (res.status === 409) {
          // Ya existe en el servidor — marcar como sincronizado para no reintentar
          await marcarAporteSincronizado(aporte.id);
          resultado.enviados++;
        } else if (res.status === 401) {
          // Token expirado — dejar pendiente, el usuario debe volver a iniciar sesión
          resultado.errores.push(`P${aporte.posicion}: Sesión expirada — cierra sesión y vuelve a entrar`);
        } else if (res.status === 400 || res.status === 403 || res.status === 404) {
          // Error definitivo del servidor (datos inválidos, sin permisos, planta no encontrada)
          // Marcar rechazado para que no se reintente indefinidamente
          await marcarAporteRechazado(aporte.id);
          resultado.rechazados++;
          resultado.errores.push(`P${aporte.posicion}: ${motivo}`);
        } else {
          // Error temporal (500, red, etc.) — dejar en PENDIENTE para reintentar
          resultado.errores.push(`P${aporte.posicion}: ${motivo} (se reintentará)`);
        }
      }
    } catch (err) {
      // Error de red — dejar en PENDIENTE para reintentar
      resultado.errores.push(`P${aporte.posicion}: sin conexión (se reintentará)`);
    }
  }

  return resultado;
}
