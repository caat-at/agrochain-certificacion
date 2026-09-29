// Replica exacta de packages/database/src/lib/hash.ts::generarContentHashAporte
// y sortObject, usando Web Crypto API (crypto.subtle) en vez de node:crypto.
// CRITICO: el orden de campos y la logica de sortObject deben ser identicos
// al servidor para que hashVerificado sea true.
"use client";

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

async function sha256Hex(input: string | ArrayBuffer): Promise<string> {
  const buffer = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function generarContentHashAporte(data: {
  plantaId: string;
  campanaId: string;
  tecnicoId: string;
  posicion: number;
  campos: Record<string, unknown>;
  fotoHash: string | null;
  audioHash: string | null;
  latitud: number | null;
  longitud: number | null;
  fechaAporte: string;
}): Promise<string> {
  const payload = JSON.stringify({
    plantaId: data.plantaId,
    campanaId: data.campanaId,
    tecnicoId: data.tecnicoId,
    posicion: data.posicion,
    campos: sortObject(data.campos),
    fotoHash: data.fotoHash ?? "",
    audioHash: data.audioHash ?? "",
    latitud: data.latitud ?? "",
    longitud: data.longitud ?? "",
    fechaAporte: data.fechaAporte,
  });
  return sha256Hex(payload);
}

// Replica exacta de packages/database/src/lib/hash.ts::generarHashEvento —
// usada por eventos_produccion (sync.ts recalcula y RECHAZA el evento si no
// coincide, sin margen de tolerancia como en aportes de campaña).
export async function generarHashEvento(data: {
  plantaId: string | null;
  loteId: string;
  tipoEvento: string;
  fechaEvento: string;
  latitud: number | null;
  longitud: number | null;
  tecnicoId: string;
  descripcion: string;
  datosExtra: Record<string, unknown>;
  fotoHash?: string;
  audioHash?: string;
}): Promise<string> {
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
  return sha256Hex(payload);
}

// Hashea el string base64 del archivo (no los bytes crudos) — mismo criterio
// que generarHashFoto/generarHashAudio en apps/mobile/src/lib/hash.ts, para
// que el mismo archivo produzca el mismo hash sea cual sea el canal usado.
export async function generarHashArchivo(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return sha256Hex(base64);
}
