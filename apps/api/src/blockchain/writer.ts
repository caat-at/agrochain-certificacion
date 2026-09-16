/**
 * Cola serial de escritura a Polygon — patron replicado de SSE
 * (backend/src/blockchain/writer.ts): la wallet unica del backend
 * (BACKEND_WALLET_PRIVATE_KEY) firma todas las transacciones, y dos llamadas
 * concurrentes pueden chocar de nonce si se envian en paralelo. La cola
 * serializa: encola, procesa una a la vez, la siguiente solo arranca cuando
 * la anterior confirmo (o fallo).
 *
 * No reemplaza las funciones de services/blockchain.ts — las envuelve. Las
 * rutas dejan de esperar el `tx.wait()` sincronamente en el handler HTTP y en
 * su lugar encolan el job, respondiendo de inmediato; el resultado se aplica
 * a la DB de forma asincrona via los callbacks onSuccess/onError.
 */
import {
  registrarLoteOnChain,
  registrarEventoOnChain,
  finalizarInspeccionOnChain,
  emitirCertificadoOnChain,
  revocarCertificadoOnChain,
  type TxResult,
} from "../services/blockchain.js";

export type WriteJobKind =
  | "registrarLote"
  | "registrarEvento"
  | "finalizarInspeccion"
  | "emitirCertificado"
  | "revocarCertificado";

export interface WriteJob {
  kind: WriteJobKind;
  payload: Record<string, unknown>;
  onSuccess: (result: TxResult & { tokenId?: number }) => Promise<void>;
  onError: (err: unknown) => Promise<void>;
}

const queue: WriteJob[] = [];
let processing = false;

export function enqueue(job: WriteJob): void {
  queue.push(job);
  void processNext();
}

export function queueLength(): number {
  return queue.length;
}

async function processNext(): Promise<void> {
  if (processing || queue.length === 0) return;
  processing = true;
  const job = queue.shift()!;

  try {
    let result: TxResult & { tokenId?: number };

    switch (job.kind) {
      case "registrarLote":
        result = await registrarLoteOnChain(job.payload.loteId as string, job.payload.dataHash as string);
        break;
      case "registrarEvento":
        result = await registrarEventoOnChain(
          job.payload.loteId as string,
          job.payload.tipoEvento as string,
          job.payload.contentHash as string
        );
        break;
      case "finalizarInspeccion":
        result = await finalizarInspeccionOnChain(
          job.payload.loteId as string,
          job.payload.aprobado as boolean,
          job.payload.reporteHash as string
        );
        break;
      case "emitirCertificado":
        result = await emitirCertificadoOnChain(
          job.payload as unknown as Parameters<typeof emitirCertificadoOnChain>[0]
        );
        break;
      case "revocarCertificado":
        result = await revocarCertificadoOnChain(job.payload.tokenId as number, job.payload.motivo as string);
        break;
    }

    await job.onSuccess(result);
  } catch (err) {
    try {
      await job.onError(err);
    } catch (callbackErr) {
      console.error("[blockchain/writer] Error en onError callback:", callbackErr);
    }
  } finally {
    processing = false;
    void processNext();
  }
}
