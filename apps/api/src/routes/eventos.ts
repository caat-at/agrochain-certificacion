import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "@agrochain/database";

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

    const eventos = await db.eventoProduccion.findMany({
      where: {
        ...(query.data.loteId && { loteId: query.data.loteId }),
        ...(query.data.plantaId && { plantaId: query.data.plantaId }),
        ...(query.data.tipo && { tipoEvento: query.data.tipo as any }),
        hashVerificado: true,  // Solo eventos con integridad verificada
      },
      orderBy: { fechaEvento: "desc" },
      include: {
        planta: { select: { codigoPlanta: true, numeroPlanta: true } },
        creador: { select: { nombres: true, apellidos: true } },
        aplicacionAgroquimico: true,
        registroRiego: true,
      },
    });

    return { success: true, data: eventos };
  });

  // GET /api/eventos/:id
  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const evento = await db.eventoProduccion.findUnique({
      where: { id: request.params.id },
      include: {
        lote: { select: { codigoLote: true, especie: true } },
        planta: true,
        creador: { select: { nombres: true, apellidos: true, rol: true } },
        aplicacionAgroquimico: true,
        registroRiego: true,
        documentos: true,
      },
    });

    if (!evento) return reply.status(404).send({ success: false, error: "Evento no encontrado" });
    return { success: true, data: evento };
  });
}
