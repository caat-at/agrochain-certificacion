import type { JwtPayload } from "./auth.js";

// =============================================================================
// AGROCHAIN - Alcance sobre lotes y eventos
//
// `authenticate` responde "quien sos". Esto responde "que podes ver". Son dos
// preguntas distintas: sin el segundo filtro, cualquier usuario autenticado
// puede leer y editar lotes ajenos, porque las rutas nunca comparan el recurso
// contra `lotes.agricultor_id`. El listado de lotes ya lo hacia (`lotes.ts` GET /),
// los detalles no: un agricultor que adivinara un UUID ve la produccion de otro.
//
// Regla:
//   CONSUMIDOR -> sin acceso interno. El portal publico usa /api/verificar/:codigo
//   AGRICULTOR -> solo los lotes con lotes.agricultor_id = payload.sub
//   resto      -> todos (ADMIN, inspectores, certificadora, INVIMA, TECNICO)
//
// El tipo es discriminante a proposito: `permitido: false` no se confunde con
// `permitido: true` sin filtro, que significaria "ver todo". Un consumidor que se
// colara por un handler sin chequear `permitido` pasaria a ver todo el dataset.
// =============================================================================

export type Alcance =
  | { permitido: false }
  | { permitido: true; agricultorId: string | undefined };

export function alcanceDeLotes(payload: JwtPayload): Alcance {
  if (payload.rol === "CONSUMIDOR") return { permitido: false };
  if (payload.rol === "AGRICULTOR") return { permitido: true, agricultorId: payload.sub };
  return { permitido: true, agricultorId: undefined };
}

// Para lecturas por codigo, que no aceptan filtro en SQL pero si comparar en JS.
export function loteEsVisible(alcance: Alcance, loteAgricultorId: string): boolean {
  if (!alcance.permitido) return false;
  if (alcance.agricultorId === undefined) return true;
  return loteAgricultorId === alcance.agricultorId;
}