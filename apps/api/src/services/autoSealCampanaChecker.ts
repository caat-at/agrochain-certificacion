/**
 * Checker periodico de auto-sellado — patron replicado de SSE
 * (backend/src/services/autoSealChecker.ts): setInterval nativo, sin
 * dependencia de node-cron. Respaldo de intentarCierreAutomatico (que se
 * dispara inline justo despues del ultimo aporte que completa una campana):
 * si ese cierre inline no llegó a correr (ej. el proceso se reinició en ese
 * instante), la campaña queda "completa pero abierta" para siempre sin este
 * checker.
 */
import { listCampanasListasParaSellar } from "@agrochain/database";
import { intentarCierreAutomatico } from "./cierreAutomatico.js";

const INTERVAL_MS = 10 * 60 * 1000; // cada 10 minutos, igual que SSE

export function startAutoSealCampanaChecker(): void {
  void check(); // corre una vez inmediatamente al arrancar
  setInterval(check, INTERVAL_MS);
}

async function check(): Promise<void> {
  try {
    const campanaIds = await listCampanasListasParaSellar();
    for (const id of campanaIds) {
      console.log(`[autoSealCampanaChecker] Campaña ${id} completa sin sellar — reintentando…`);
      await intentarCierreAutomatico(id);
    }
  } catch (err) {
    console.error("[autoSealCampanaChecker] Error:", err);
  }
}
