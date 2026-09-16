/**
 * Cierre automatico de campana — compartido entre la ruta HTTP
 * (routes/campanas.ts, se dispara justo despues del ultimo aporte que
 * completa la campana) y el checker periodico (services/autoSealCampanaChecker.ts,
 * respaldo si el cierre inline no llegó a correr, ej. el proceso se reinicio).
 */
import {
  generarHashCampana,
  getCampanaParaCierreAutomatico,
  cerrarCampana,
  updateCampanaTxHash,
} from "@agrochain/database";
import { enqueue } from "../blockchain/writer.js";
import { isConfigured } from "../services/blockchain.js";

export async function intentarCierreAutomatico(campanaId: string): Promise<boolean> {
  const campana = await getCampanaParaCierreAutomatico(campanaId);
  if (!campana || campana.estado !== "ABIERTA") return false;

  const totalPlantas = campana.totalPlantasLote;
  if (totalPlantas === 0) return false;

  // Registros activos (no INVALIDADOS) — getCampanaParaCierreAutomatico ya excluye INVALIDADO
  const activos = campana.registros;
  const completos = activos.filter((r) => r.estado === "COMPLETO");

  // Cierre automático solo si TODAS las plantas tienen registro COMPLETO
  if (completos.length !== totalPlantas) return false;
  if (activos.some((r) => r.estado !== "COMPLETO")) return false;

  // Generar hash final de la campaña
  const campanaHash = generarHashCampana({
    campanaId,
    registros: completos.map((r) => ({
      plantaId:    r.plantaId,
      contentHash: r.contentHash!,
    })),
  });

  await cerrarCampana(campanaId, { campanaHash, cierreConAdvertencia: false });

  // Encolar el anclaje on-chain (no bloquea el cierre en DB, que ya ocurrió)
  if (isConfigured() && campana.loteId) {
    enqueue({
      kind: "registrarEvento",
      payload: { loteId: campana.loteId, tipoEvento: `CAMPANA_CERRADA:${campanaId}`, contentHash: campanaHash },
      onSuccess: async (result) => {
        await updateCampanaTxHash(campanaId, result.txHash);
      },
      onError: async (err) => {
        console.error(`[cierreAutomatico] Error anclando campaña ${campanaId} en blockchain:`, err);
      },
    });
  }

  return true;
}
