import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { listEventosProduccion, getEventoProduccionDetalle } from "@agrochain/database";
import { alcanceDeLotes } from "../middleware/alcance.js";
import type { JwtPayload } from "../middleware/auth.js";

const EventoQuerySchema = z.object({
  loteId: z.string().optional(),
  plantaId: z.string().optional(),
  tipo: z.string().optional(),
});

export async function eventosRoutes(app: FastifyInstance) {
  // GET /api/eventos?loteId=&plantaId=&tipo=
  app.get<{ Querystring: z.infer<typeof EventoQuerySchema> }>(
    "/",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
    const payload = (request as any).user as JwtPayload;
    const alcance = alcanceDeLotes(payload);

    if (!alcance.permitido) {
      return reply.status(403).send({ message: "No autorizado para esta operación" });
    }

    const query = EventoQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({ success: false, error: query.error.flatten() });
    }

    const eventos = await listEventosProduccion({
      loteId: query.data.loteId,
      plantaId: query.data.plantaId,
      tipoEvento: query.data.tipo,
      soloVerificados: true, // Solo eventos con integridad verificada
      agricultorId: alcance.agricultorId,
    });

    return { success: true, data: eventos };
    }
  );

  // GET /api/eventos/:id
  app.get<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
    const payload = (request as any).user as JwtPayload;
    const alcance = alcanceDeLotes(payload);

    if (!alcance.permitido) {
      return reply.status(403).send({ message: "No autorizado para esta operación" });
    }

    const evento = await getEventoProduccionDetalle(request.params.id, alcance.agricultorId);
    if (!evento) return reply.status(404).send({ success: false, error: "Evento no encontrado" });
    return { success: true, data: evento };
    }
  );
}