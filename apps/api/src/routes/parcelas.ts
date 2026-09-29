/**
 * Rutas de parcelas — subdivision fisica permanente de un predio
 * (ej. finca de 100 ha dividida en 10 parcelas de 10 ha con cultivos distintos).
 * GET /api/parcelas?predioId= — listar
 * GET /api/parcelas/:id — detalle
 * POST /api/parcelas — crear (ADMIN, o AGRICULTOR dueño del predio)
 * PATCH /api/parcelas/:id — editar
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  listParcelas,
  getParcelaById,
  countParcelas,
  createParcela,
  updateParcela,
  getPredioById,
  generarCodigoParcela,
} from "@agrochain/database";

const CrearParcelaSchema = z.object({
  predioId: z.string().uuid(),
  nombre: z.string().max(150).optional(),
  areaHa: z.number().positive(),
  latitud: z.number().min(-90).max(90).optional(),
  longitud: z.number().min(-180).max(180).optional(),
  usoActual: z.string().max(150).optional(),
});

const EditarParcelaSchema = z.object({
  predioId: z.string().uuid().optional(),
  nombre: z.string().max(150).nullable().optional(),
  areaHa: z.number().positive().optional(),
  latitud: z.number().min(-90).max(90).nullable().optional(),
  longitud: z.number().min(-180).max(180).nullable().optional(),
  usoActual: z.string().max(150).nullable().optional(),
  activo: z.boolean().optional(),
});

export async function parcelasRoutes(app: FastifyInstance) {
  // GET /api/parcelas?predioId= — listar
  app.get("/", { preHandler: [(app as any).authenticate] }, async (request) => {
    const { predioId } = request.query as { predioId?: string };
    const parcelas = await listParcelas(predioId);
    return { parcelas };
  });

  // GET /api/parcelas/:id — detalle
  app.get<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const parcela = await getParcelaById(request.params.id);
      if (!parcela) {
        return reply.status(404).send({ message: "Parcela no encontrada" });
      }
      return { success: true, data: parcela };
    }
  );

  // POST /api/parcelas — crear (ADMIN cualquiera, AGRICULTOR solo si el predio es propio)
  app.post("/", { preHandler: [(app as any).authenticate] }, async (request, reply) => {
    const payload = (request as any).user as { sub: string; rol: string };
    if (!["ADMIN", "AGRICULTOR"].includes(payload.rol)) {
      return reply.status(403).send({ message: "Sin permisos para crear parcelas" });
    }

    const parsed = CrearParcelaSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.flatten().fieldErrors });
    }

    const predio = await getPredioById(parsed.data.predioId);
    if (!predio) {
      return reply.status(404).send({ message: "Predio no encontrado" });
    }

    if (payload.rol === "AGRICULTOR" && predio.agricultorId !== payload.sub) {
      return reply.status(403).send({ message: "Un agricultor solo puede crear parcelas en predios propios" });
    }

    // codigo_parcela: PAR-{municipio_cod}-{secuencia}, mismo estilo que codigo_lote.
    const count = await countParcelas();
    const municipioCod = predio.municipioCod ?? "00000";
    const codigoParcela = generarCodigoParcela(municipioCod, count + 1);

    const parcela = await createParcela({ ...parsed.data, codigoParcela });
    return reply.status(201).send({ success: true, data: parcela });
  });

  // PATCH /api/parcelas/:id — editar
  app.patch<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { sub: string; rol: string };

      const parsed = EditarParcelaSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.flatten().fieldErrors });
      }

      const existente = await getParcelaById(request.params.id);
      if (!existente) {
        return reply.status(404).send({ message: "Parcela no encontrada" });
      }

      if (payload.rol === "AGRICULTOR") {
        const predio = await getPredioById(existente.predioId);
        if (!predio || predio.agricultorId !== payload.sub) {
          return reply.status(403).send({ message: "Un agricultor solo puede editar parcelas en predios propios" });
        }
      } else if (payload.rol !== "ADMIN") {
        return reply.status(403).send({ message: "Sin permisos para editar parcelas" });
      }

      if (parsed.data.predioId) {
        const predioDestino = await getPredioById(parsed.data.predioId);
        if (!predioDestino) {
          return reply.status(400).send({ message: "predioId no corresponde a ningún predio registrado" });
        }
        if (payload.rol === "AGRICULTOR" && predioDestino.agricultorId !== payload.sub) {
          return reply.status(403).send({ message: "Un agricultor solo puede mover parcelas a predios propios" });
        }
      }

      const actualizada = await updateParcela(request.params.id, parsed.data);
      if (actualizada === "no-changes") {
        return { success: true, data: existente };
      }
      return { success: true, data: actualizada };
    }
  );
}
