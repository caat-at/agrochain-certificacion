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
  getParcelaConLotes,
  countParcelas,
  createParcela,
  updateParcela,
  getPredioById,
  generarCodigoParcela,
  listPlantasDisponiblesParaLote,
  getPoligonoVigentePorParcela,
  listPoligonosPorParcela,
  crearPoligonoVigenteParcela,
  desactivarPoligonoVigenteParcela,
} from "@agrochain/database";

const PoligonoSchema = z.object({
  geojson: z.record(z.unknown()),
  areaHaCalculada: z.number().positive().optional(),
  fuente: z.enum(["DIBUJADO_MANUAL", "GPS_CAMPO", "KML_IMPORTADO"]).optional(),
});

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

  // GET /api/parcelas/:id — detalle (incluye nombre del predio padre y sus lotes)
  app.get<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const parcela = await getParcelaConLotes(request.params.id);
      if (!parcela) {
        return reply.status(404).send({ message: "Parcela no encontrada" });
      }
      return { success: true, data: parcela };
    }
  );

  // GET /api/parcelas/:id/plantas-disponibles?especie= — plantas activas de
  // la parcela, de esa especie, que no estan en ningun lote actualmente
  // abierto — candidatas a reusar en un lote/cosecha nuevo (cultivos perennes).
  app.get<{ Params: { id: string } }>(
    "/:id/plantas-disponibles",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const { especie } = request.query as { especie?: string };
      if (!especie) {
        return reply.status(400).send({ message: "El parámetro especie es requerido" });
      }
      const plantas = await listPlantasDisponiblesParaLote(request.params.id, especie);
      return { plantas };
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

  // GET /api/parcelas/:id/poligono — vigente + historial de versiones
  app.get<{ Params: { id: string } }>(
    "/:id/poligono",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const parcela = await getParcelaById(request.params.id);
      if (!parcela) return reply.status(404).send({ message: "Parcela no encontrada" });

      const [vigente, historial] = await Promise.all([
        getPoligonoVigentePorParcela(request.params.id),
        listPoligonosPorParcela(request.params.id),
      ]);
      if (!vigente) return reply.status(404).send({ message: "La parcela no tiene polígono registrado" });
      return { poligono: vigente, historial };
    }
  );

  // POST /api/parcelas/:id/poligono — registra una nueva version vigente
  app.post<{ Params: { id: string } }>(
    "/:id/poligono",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { sub: string; rol: string };
      if (!["ADMIN", "AGRICULTOR"].includes(payload.rol)) {
        return reply.status(403).send({ message: "Sin permisos para registrar el polígono de la parcela" });
      }

      const parcela = await getParcelaById(request.params.id);
      if (!parcela) return reply.status(404).send({ message: "Parcela no encontrada" });

      if (payload.rol === "AGRICULTOR") {
        const predio = await getPredioById(parcela.predioId);
        if (!predio || predio.agricultorId !== payload.sub) {
          return reply.status(403).send({ message: "Un agricultor solo puede registrar el polígono de parcelas en predios propios" });
        }
      }

      const parsed = PoligonoSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.flatten() });
      }

      const poligono = await crearPoligonoVigenteParcela({
        parcelaId: request.params.id,
        geojson: parsed.data.geojson,
        areaHaCalculada: parsed.data.areaHaCalculada ?? null,
        fuente: parsed.data.fuente,
        creadoPor: payload.sub,
      });

      return reply.status(201).send({ success: true, poligono });
    }
  );

  // DELETE /api/parcelas/:id/poligono — desactiva la version vigente (no borra
  // el historial, mismo principio de versionado que el resto del modulo)
  app.delete<{ Params: { id: string } }>(
    "/:id/poligono",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { sub: string; rol: string };
      if (!["ADMIN", "AGRICULTOR"].includes(payload.rol)) {
        return reply.status(403).send({ message: "Sin permisos para eliminar el polígono de la parcela" });
      }

      const parcela = await getParcelaById(request.params.id);
      if (!parcela) return reply.status(404).send({ message: "Parcela no encontrada" });

      if (payload.rol === "AGRICULTOR") {
        const predio = await getPredioById(parcela.predioId);
        if (!predio || predio.agricultorId !== payload.sub) {
          return reply.status(403).send({ message: "Un agricultor solo puede eliminar el polígono de parcelas en predios propios" });
        }
      }

      const eliminado = await desactivarPoligonoVigenteParcela(request.params.id);
      if (!eliminado) {
        return reply.status(404).send({ message: "La parcela no tiene polígono registrado" });
      }

      return { success: true };
    }
  );
}
