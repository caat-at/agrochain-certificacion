/**
 * Rutas de plantas — la planta vive en la parcela (permanente), no en el
 * lote (cada ciclo de cosecha). Ver lote_plantas para la relacion N:M.
 * GET /api/plantas?parcelaId= — listar
 * GET /api/plantas/:id — detalle + historial de lotes vinculados
 * POST /api/plantas — crear (ADMIN, o AGRICULTOR dueño del predio de la parcela)
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  listPlantasByParcela,
  getPlantaById,
  createPlanta,
  updatePlanta,
  getParcelaById,
  getPredioById,
} from "@agrochain/database";

const CrearPlantaSchema = z.object({
  parcelaId: z.string().uuid(),
  codigoPlanta: z.string().min(1),
  numeroPlanta: z.string().min(1),
  latitud: z.number().min(-90).max(90),
  longitud: z.number().min(-180).max(180),
  altitudMsnm: z.number().optional(),
  especie: z.string().min(1).optional(),
  variedad: z.string().optional(),
  origenMaterial: z.string().optional(),
  procedenciaVivero: z.string().optional(),
  fechaSiembra: z.string().datetime().optional(),
  alturaCmInicial: z.number().optional(),
  diametroTalloCmInicial: z.number().optional(),
  numHojasInicial: z.number().int().optional(),
  estadoFenologicoInicial: z.string().optional(),
});

const EditarPlantaSchema = z.object({
  especie: z.string().min(1).nullable().optional(),
  variedad: z.string().nullable().optional(),
  origenMaterial: z.string().nullable().optional(),
  procedenciaVivero: z.string().nullable().optional(),
  fechaSiembra: z.string().datetime().nullable().optional(),
  alturaCmInicial: z.number().nullable().optional(),
  diametroTalloCmInicial: z.number().nullable().optional(),
  numHojasInicial: z.number().int().nullable().optional(),
  estadoFenologicoInicial: z.string().nullable().optional(),
  activo: z.boolean().optional(),
});

export async function plantasRoutes(app: FastifyInstance) {
  // GET /api/plantas?parcelaId= — listar
  app.get("/", { preHandler: [(app as any).authenticate] }, async (request) => {
    const { parcelaId } = request.query as { parcelaId?: string };
    if (!parcelaId) return { plantas: [] };
    const plantas = await listPlantasByParcela(parcelaId);
    return { plantas };
  });

  // GET /api/plantas/:id — detalle + historial de lotes vinculados
  app.get<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const planta = await getPlantaById(request.params.id);
      if (!planta) return reply.status(404).send({ message: "Planta no encontrada" });
      return { success: true, data: planta };
    }
  );

  // POST /api/plantas — crear (ADMIN cualquiera, AGRICULTOR solo en parcelas de predios propios)
  app.post("/", { preHandler: [(app as any).authenticate] }, async (request, reply) => {
    const payload = (request as any).user as { sub: string; rol: string };
    if (!["ADMIN", "AGRICULTOR"].includes(payload.rol)) {
      return reply.status(403).send({ message: "Sin permisos para crear plantas" });
    }

    const parsed = CrearPlantaSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.flatten().fieldErrors });
    }

    const parcela = await getParcelaById(parsed.data.parcelaId);
    if (!parcela) {
      return reply.status(404).send({ message: "Parcela no encontrada" });
    }

    if (payload.rol === "AGRICULTOR") {
      const predio = await getPredioById(parcela.predioId);
      if (!predio || predio.agricultorId !== payload.sub) {
        return reply.status(403).send({ message: "Un agricultor solo puede crear plantas en parcelas de predios propios" });
      }
    }

    try {
      const planta = await createPlanta({
        ...parsed.data,
        fechaSiembra: parsed.data.fechaSiembra ? new Date(parsed.data.fechaSiembra) : null,
        registradoPor: payload.sub,
      });
      return reply.status(201).send({ success: true, data: planta });
    } catch (err: any) {
      if (err?.code === "23505") {
        return reply.status(409).send({ message: "Ya existe una planta con ese código en esta parcela" });
      }
      return reply.status(500).send({ message: "Error al registrar planta" });
    }
  });

  // PATCH /api/plantas/:id — editar (ADMIN cualquiera, AGRICULTOR solo en parcelas de predios propios)
  app.patch<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { sub: string; rol: string };

      const parsed = EditarPlantaSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.flatten().fieldErrors });
      }

      const existente = await getPlantaById(request.params.id);
      if (!existente) {
        return reply.status(404).send({ message: "Planta no encontrada" });
      }

      if (payload.rol === "AGRICULTOR") {
        const parcela = await getParcelaById(existente.parcelaId);
        const predio = parcela ? await getPredioById(parcela.predioId) : null;
        if (!predio || predio.agricultorId !== payload.sub) {
          return reply.status(403).send({ message: "Un agricultor solo puede editar plantas en parcelas de predios propios" });
        }
      } else if (payload.rol !== "ADMIN") {
        return reply.status(403).send({ message: "Sin permisos para editar plantas" });
      }

      const data = parsed.data;
      const actualizada = await updatePlanta(request.params.id, {
        ...data,
        fechaSiembra: data.fechaSiembra !== undefined
          ? (data.fechaSiembra ? new Date(data.fechaSiembra) : null)
          : undefined,
      });
      if (actualizada === "no-changes") {
        return { success: true, data: existente };
      }
      return { success: true, data: actualizada };
    }
  );
}
