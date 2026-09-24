/**
 * Rutas de predios — ICA Resolución 3168/2015
 * GET /api/predios — listar predios del agricultor autenticado
 * GET /api/predios/:id — detalle de un predio
 * POST /api/predios — crear predio nuevo (ADMIN, o AGRICULTOR para si mismo)
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { listPredios, getPredioConLotes, createPredio, getUsuarioById } from "@agrochain/database";

const CrearPredioSchema = z.object({
  agricultorId: z.string().uuid(),
  nombrePredio: z.string().min(1).max(200),
  codigoIca: z.string().max(50).optional(),
  matriculaInmobiliaria: z.string().max(100).optional(),
  departamento: z.string().min(1).max(100),
  municipio: z.string().min(1).max(100),
  vereda: z.string().max(150).optional(),
  direccion: z.string().max(255).optional(),
  latitud: z.number().min(-90).max(90),
  longitud: z.number().min(-180).max(180),
  altitudMsnm: z.number().optional(),
  areaTotalHa: z.number().positive(),
  areaProductivaHa: z.number().positive().optional(),
  areaBosqueHa: z.number().positive().optional(),
  areaViverosHa: z.number().positive().optional(),
  fuenteAgua: z.enum(["ACUEDUCTO", "RIO", "POZO", "LLUVIA", "MIXTA"]).optional(),
  tipoSuelo: z.string().max(50).optional(),
  pendientePct: z.number().min(0).max(100).optional(),
  usoPrevio: z.string().max(150).optional(),
  certifUsoSuelo: z.string().max(100).optional(),
  tieneBodegaAgroquimicos: z.boolean().optional(),
  tieneAguaPotable: z.boolean().optional(),
  tieneSSSBasicas: z.boolean().optional(),
  tieneZonaAcopio: z.boolean().optional(),
});

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

  // POST /api/predios — crear predio (ADMIN cualquiera, AGRICULTOR solo el suyo)
  app.post("/", { preHandler: [(app as any).authenticate] }, async (request, reply) => {
    const payload = (request as any).user as { sub: string; rol: string };
    if (!["ADMIN", "AGRICULTOR"].includes(payload.rol)) {
      return reply.status(403).send({ message: "Sin permisos para crear predios" });
    }

    const parsed = CrearPredioSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.flatten().fieldErrors });
    }

    if (payload.rol === "AGRICULTOR" && parsed.data.agricultorId !== payload.sub) {
      return reply.status(403).send({ message: "Un agricultor solo puede crear predios a su propio nombre" });
    }

    const agricultor = await getUsuarioById(parsed.data.agricultorId);
    if (!agricultor || agricultor.rol !== "AGRICULTOR") {
      return reply.status(400).send({ message: "agricultorId debe corresponder a un usuario con rol AGRICULTOR" });
    }

    const predio = await createPredio(parsed.data);
    return reply.status(201).send({ success: true, data: predio });
  });
}
