/**
 * Verificador de solo lectura — patron replicado de SSE
 * (backend/src/blockchain/verifier.ts). No firma transacciones, solo
 * reconstruye eventos ya minados desde su receipt y compara hashes en
 * varios niveles (evento individual, registro de planta, sello de campana).
 *
 * Reutiliza leerHashDesdeTx (services/blockchain.ts) como base para el nivel
 * mas simple, y agrega verificarEventoOnChain/verificarCampanaSeal encima.
 */
import { leerHashDesdeTx } from "../services/blockchain.js";

export interface VerificacionEvento {
  hashCoincide: boolean;
  hashEnPolygon: string | null;
  blockNumber: number | null;
  timestamp: number | null;
  error: string | null;
}

/**
 * Compara el contentHash guardado en DB para un evento/registro contra el
 * hash realmente sellado en la transaccion de Polygon (leido desde el log
 * EventoRegistrado, no desde lo que la DB dice que se envio).
 */
export async function verificarEventoOnChain(txHash: string, hashEsperado: string): Promise<VerificacionEvento> {
  try {
    const txData = await leerHashDesdeTx(txHash);
    if (!txData) {
      return { hashCoincide: false, hashEnPolygon: null, blockNumber: null, timestamp: null, error: "No se encontró el evento EventoRegistrado en la transacción" };
    }
    return {
      hashCoincide: txData.evidenciaHash === hashEsperado,
      hashEnPolygon: txData.evidenciaHash,
      blockNumber: txData.blockNumber,
      timestamp: txData.timestamp,
      error: null,
    };
  } catch (err) {
    return { hashCoincide: false, hashEnPolygon: null, blockNumber: null, timestamp: null, error: String(err) };
  }
}

export interface VerificacionCampanaSeal {
  ok: boolean;
  hashRecalculado: string;
  hashGuardadoDB: string;
  hashEnPolygon: string | null;
  blockNumber: number | null;
  timestampPolygon: number | null;
  okDB: boolean;
  okPolygon: boolean | null;
  polygonError: string | null;
}

/**
 * Verificacion de 3 niveles del sello de campana (Nivel 3 del sistema de
 * hash de AgroChain): recalculado-vs-DB, y recalculado-vs-Polygon si hay
 * txHash. Usado por campanas.ts en /verificar-hash-campana.
 */
export async function verificarCampanaSeal(params: {
  hashRecalculado: string;
  hashGuardadoDB: string;
  txHash: string | null;
}): Promise<VerificacionCampanaSeal> {
  const okDB = params.hashRecalculado === params.hashGuardadoDB;

  let hashEnPolygon: string | null = null;
  let blockNumber: number | null = null;
  let timestampPolygon: number | null = null;
  let okPolygon: boolean | null = null;
  let polygonError: string | null = null;

  if (params.txHash) {
    const verificacion = await verificarEventoOnChain(params.txHash, params.hashRecalculado);
    hashEnPolygon = verificacion.hashEnPolygon;
    blockNumber = verificacion.blockNumber;
    timestampPolygon = verificacion.timestamp;
    polygonError = verificacion.error;
    okPolygon = verificacion.error ? null : verificacion.hashCoincide;
  }

  const ok = okDB && (okPolygon === null ? true : okPolygon);

  return {
    ok,
    hashRecalculado: params.hashRecalculado,
    hashGuardadoDB: params.hashGuardadoDB,
    hashEnPolygon,
    blockNumber,
    timestampPolygon,
    okDB,
    okPolygon,
    polygonError,
  };
}
