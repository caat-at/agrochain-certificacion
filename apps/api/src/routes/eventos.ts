import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { listEventosProduccion, getEventoProduccionDetalle } from "@agrochain/database";

const EventoQuerySchema = z.object({
  loteId: z.string().optional(),
  plantaId: z.string().optional(),
  tipo: z.string().optional(),
});

export async function eventosRoutes(app: FastifyInstance) {
  // GET /api/eventos?loteId=&plantaId=&tipo=
  app.get<{ Querystring: z.infer<typeof EventoQuerySchema> }>("/", async (request, reply) => {
    const query = EventoQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({ success: false, error: query.error.flatten() });
    }

    const eventos = await listEventosProduccion({
      loteId: query.data.loteId,
      plantaId: query.data.plantaId,
      tipoEvento: query.data.tipo,
      soloVerificados: true, // Solo eventos con integridad verificada
    });

    return { success: true, data: eventos };
  });

  // GET /api/eventos/:id
  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const evento = await getEventoProduccionDetalle(request.params.id);
    if (!evento) return reply.status(404).send({ success: false, error: "Evento no encontrado" });
    return { success: true, data: evento };
  });
}
