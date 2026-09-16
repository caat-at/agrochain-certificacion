/**
 * Rutas de predios — ICA Resolución 3168/2015
 * GET /api/predios — listar predios del agricultor autenticado
 * GET /api/predios/:id — detalle de un predio
 */
import type { FastifyInstance } from "fastify";
import { listPredios, getPredioConLotes } from "@agrochain/database";

export async function prediosRoutes(app: FastifyInstance) {
  // GET /api/predios — listar predios
  app.get("/", { preHandler: [(app as any).authenticate] }, async (request, reply) => {
    const payload = (request as any).user as { sub: string; rol: string };

    const predios = await listPredios({
      agricultorId: payload.rol === "AGRICULTOR" ? payload.sub : undefined,
      soloActivos: true,
    });

    return { predios };
  });

  // GET /api/predios/:id — detalle con lotes
  app.get<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { sub: string; rol: string };

      const predio = await getPredioConLotes(request.params.id, {
        agricultorId: payload.rol === "AGRICULTOR" ? payload.sub : undefined,
      });

      if (!predio) {
        return reply.status(404).send({ success: false, error: "Predio no encontrado" });
      }

      return { success: true, data: predio };
    }
  );
}
