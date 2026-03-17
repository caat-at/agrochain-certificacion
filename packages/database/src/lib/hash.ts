import { createHash } from "crypto";

// =============================================================================
// MODULO DE INTEGRIDAD DE DATOS
// Genera y verifica hashes SHA256 para garantizar que los datos
// capturados en campo no fueron alterados al sincronizar a la nube
// =============================================================================

export interface EventoCampoData {
  plantaId: string | null;
  loteId: string;
  tipoEvento: string;
  fechaEvento: string;        // ISO 8601
  latitud: number | null;
  longitud: number | null;
  tecnicoId: string;
  descripcion: string;
  datosExtra: Record<string, unknown>; // Datos especificos del tipo de evento
  fotoHash?: string;          // SHA256 de los bytes de la foto (si aplica)
  audioHash?: string;         // SHA256 de los bytes del audio (si aplica)
}

/**
 * Genera el hash SHA256 de un evento capturado en campo.
 * Este mismo calculo se hace en la app movil al momento de guardar.
 * El backend lo recalcula para verificar integridad.
 */
export function generarHashEvento(data: EventoCampoData): string {
  // Ordenamos los campos para que el hash sea determinista
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

  return createHash("sha256").update(payload, "utf8").digest("hex");
}

/**
 * Verifica que el hash recibido del movil coincide con el recalculado en servidor.
 * Retorna true si la integridad es correcta.
 */
export function verificarHashEvento(
  data: EventoCampoData,
  hashRecibido: string
): { valido: boolean; hashServidor: string; payloadServidor?: string; motivo?: string } {
  const payloadObj = {
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
  };
  const payloadServidor = JSON.stringify(payloadObj);
  const hashServidor = createHash("sha256").update(payloadServidor, "utf8").digest("hex");

  if (hashServidor === hashRecibido) {
    return { valido: true, hashServidor };
  }

  return {
    valido: false,
    hashServidor,
    payloadServidor,
    motivo: `Hash no coincide. Movil: ${hashRecibido} | Servidor: ${hashServidor}`,
  };
}

/**
 * Genera hash SHA256 de un archivo (documento, foto, PDF).
 * Se usa para verificar que el archivo no fue alterado.
 */
export function generarHashArchivo(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Genera el hash keccak256-like del lote para registrar on-chain.
 * En la practica se usa ethers.js en el backend para keccak256 real.
 * Aqui usamos SHA256 como proxy para la capa de DB.
 */
export function generarHashLote(data: {
  codigoLote: string;
  predioId: string;
  agricultorId: string;
  especie: string;
  variedad: string;
  areaHa: number;
  fechaCreacion: string;
}): string {
  const payload = JSON.stringify(sortObject(data));
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

/**
 * Genera codigo unico de lote segun formato colombiano:
 * COL-{DEP_COD}-{YYYY}-{SEQ_5}
 * Ej: COL-05-2024-00001
 */
export function generarCodigoLote(
  codigoDepartamento: string,
  anio: number,
  secuencia: number
): string {
  const seq = String(secuencia).padStart(5, "0");
  return `COL-${codigoDepartamento}-${anio}-${seq}`;
}

// =============================================================================
// INTEGRIDAD DE CAMPAÑAS — Nivel 1: firma de aporte, Nivel 2: registro planta,
// Nivel 3: hash de campaña
// =============================================================================

/**
 * NIVEL 1b — contentHash del aporte de un técnico (nueva arquitectura multi-técnico).
 * SHA256(plantaId + campanaId + tecnicoId + posicion + campos + fotoHash + audioHash + latitud + longitud + fechaAporte)
 * Se genera en la app móvil al guardar y el servidor lo recalcula al sincronizar.
 */
export function generarContentHashAporte(data: {
  plantaId:   string;
  campanaId:  string;
  tecnicoId:  string;
  posicion:   number;
  campos:     Record<string, unknown>;
  fotoHash:   string | null;
  audioHash:  string | null;
  latitud:    number | null;
  longitud:   number | null;
  fechaAporte: string; // ISO 8601 exacto
}): string {
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
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

/**
 * NIVEL 1 — Firma inmediata del aporte de un técnico.
 * Se genera al momento de guardar y nunca debe cambiar.
 * SHA256(campos_json + tecnicoId + plantaId + campanaId + timestamp)
 */
export function generarFirmaAporte(data: {
  campos: Record<string, unknown>;
  tecnicoId: string;
  plantaId: string;
  campanaId: string;
  timestamp: string; // ISO 8601 exacto
}): string {
  const payload = JSON.stringify({
    campos: sortObject(data.campos),
    tecnicoId: data.tecnicoId,
    plantaId: data.plantaId,
    campanaId: data.campanaId,
    timestamp: data.timestamp,
  });
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

/**
 * Verifica que la firma guardada de un aporte sigue siendo válida.
 * Si no coincide → el aporte fue adulterado.
 */
export function verificarFirmaAporte(
  data: {
    campos: Record<string, unknown>;
    tecnicoId: string;
    plantaId: string;
    campanaId: string;
    timestamp: string;
  },
  firmaGuardada: string
): { valido: boolean; firmaEsperada: string; motivo?: string } {
  const firmaEsperada = generarFirmaAporte(data);
  if (firmaEsperada === firmaGuardada) {
    return { valido: true, firmaEsperada };
  }
  return {
    valido: false,
    firmaEsperada,
    motivo: `Firma adulterada. Guardada: ${firmaGuardada} | Esperada: ${firmaEsperada}`,
  };
}

/**
 * NIVEL 2 — Hash final del registro completo de una planta.
 * Solo se genera cuando todos los campos requeridos están presentes.
 * SHA256(firma_aporte_1 + firma_aporte_2 + ... ordenadas por campo + plantaId + campanaId)
 */
export function generarContentHashRegistro(data: {
  firmasAportes: Array<{ campo: string; firma: string }>; // ordenadas por campo
  plantaId: string;
  campanaId: string;
}): string {
  const firmasOrdenadas = [...data.firmasAportes].sort((a, b) =>
    a.campo.localeCompare(b.campo)
  );
  const payload = JSON.stringify({
    firmas: firmasOrdenadas,
    plantaId: data.plantaId,
    campanaId: data.campanaId,
  });
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

/**
 * NIVEL 3 — Hash de la campaña completa al cierre.
 * SHA256 de todos los contentHash de registros COMPLETOS, ordenados por plantaId.
 */
export function generarHashCampana(data: {
  campanaId: string;
  registros: Array<{ plantaId: string; contentHash: string }>; // solo COMPLETOS
}): string {
  const registrosOrdenados = [...data.registros].sort((a, b) =>
    a.plantaId.localeCompare(b.plantaId)
  );
  const payload = JSON.stringify({
    campanaId: data.campanaId,
    registros: registrosOrdenados,
  });
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

/**
 * Verifica si todos los campos requeridos están cubiertos por los aportes existentes.
 * Retorna los campos faltantes.
 */
export function verificarCamposCompletos(
  camposRequeridos: string[],
  aportesExistentes: Array<{ campos: Record<string, unknown>; fotoHash?: string | null; audioHash?: string | null }>
): { completo: boolean; faltantes: string[]; cubiertos: string[] } {
  const cubiertos = new Set<string>();
  for (const aporte of aportesExistentes) {
    for (const campo of Object.keys(aporte.campos)) {
      if (aporte.campos[campo] !== null && aporte.campos[campo] !== undefined && aporte.campos[campo] !== "") {
        cubiertos.add(campo);
      }
    }
    // foto y audio se guardan en columnas separadas, no en el JSON de campos
    if (aporte.fotoHash)  cubiertos.add("foto");
    if (aporte.audioHash) cubiertos.add("audio");
  }
  const faltantes = camposRequeridos.filter((c) => !cubiertos.has(c));
  return {
    completo: faltantes.length === 0,
    faltantes,
    cubiertos: [...cubiertos],
  };
}

// Ordena objeto recursivamente para hash determinista
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
