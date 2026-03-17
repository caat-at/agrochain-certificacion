/**
 * Módulo de integridad de datos — versión mobile.
 * Replica exactamente la lógica de packages/database/src/lib/hash.ts
 * usando expo-crypto en lugar de Node.js crypto.
 *
 * CRÍTICO: el orden de campos y la lógica de sortObject deben
 * ser idénticos al servidor para que los hashes coincidan.
 */
import * as Crypto from "expo-crypto";

export interface EventoCampoData {
  plantaId: string | null;
  loteId: string;
  tipoEvento: string;
  fechaEvento: string; // ISO 8601
  latitud: number | null;
  longitud: number | null;
  tecnicoId: string;
  descripcion: string;
  datosExtra: Record<string, unknown>;
  fotoHash?: string;
  audioHash?: string;
}

/**
 * Genera SHA256 del evento con campos en orden fijo.
 * Se llama al guardar localmente — antes de sincronizar.
 */
export async function generarHashEvento(data: EventoCampoData): Promise<string> {
  const payload = JSON.stringify({
    plantaId: data.plantaId ?? "",
    loteId: data.loteId,
    tipoEvento: data.tipoEvento,
    fechaEvento: data.fechaEvento,
    latitud: data.latitud ?? "",
    longitud: data.longitud ?? "",
    tecnicoId: data.tecnicoId,
    descripcion: data.descripcion,
    datosExtra: sortObject(data.datosExtra),
    fotoHash: data.fotoHash ?? "",
    audioHash: data.audioHash ?? "",
  });

  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, payload);
}

/**
 * Genera SHA256 de los bytes de una foto (buffer base64).
 * Se usa para el campo fotoHash del evento.
 */
export async function generarHashFoto(base64: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64);
}

/**
 * Genera SHA256 de los bytes de un audio (buffer base64).
 * Se usa para el campo audioHash del evento.
 */
export async function generarHashAudio(base64: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64);
}

/**
 * contentHash del aporte de un técnico — NIVEL 1b (nueva arquitectura).
 * SHA256(plantaId + campanaId + tecnicoId + posicion + campos + fotoHash + audioHash + latitud + longitud + fechaAporte)
 * CRÍTICO: debe ser idéntico al servidor para que la verificación funcione.
 */
export async function generarContentHashAporte(data: {
  plantaId:    string;
  campanaId:   string;
  tecnicoId:   string;
  posicion:    number;
  campos:      Record<string, unknown>;
  fotoHash:    string | null;
  audioHash:   string | null;
  latitud:     number | null;
  longitud:    number | null;
  fechaAporte: string; // ISO 8601 exacto
}): Promise<string> {
  const payload = JSON.stringify({
    plantaId:    data.plantaId,
    campanaId:   data.campanaId,
    tecnicoId:   data.tecnicoId,
    posicion:    data.posicion,
    campos:      sortObject(data.campos),
    fotoHash:    data.fotoHash ?? "",
    audioHash:   data.audioHash ?? "",
    latitud:     data.latitud ?? "",
    longitud:    data.longitud ?? "",
    fechaAporte: data.fechaAporte,
  });
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, payload);
}

// Ordena objeto recursivamente — igual que en el servidor
function sortObject(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.keys(obj)
    .sort()
    .reduce(
      (result, key) => {
        const val = obj[key];
        result[key] =
          val && typeof val === "object" && !Array.isArray(val)
            ? sortObject(val as Record<string, unknown>)
            : val;
        return result;
      },
      {} as Record<string, unknown>
    );
}
