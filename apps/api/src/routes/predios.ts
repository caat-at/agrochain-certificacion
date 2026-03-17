/**
 * Rutas de predios — ICA Resolución 3168/2015
 * GET /api/predios — listar predios del agricultor autenticado
 * GET /api/predios/:id — detalle de un predio
 */
import type { FastifyInstance } from "fastify";
import { db } from "@agrochain/database";

export async function prediosRoutes(app: FastifyInstance) {
  // GET /api/predios — listar predios
  app.get("/", { preHandler: [(app as any).authenticate] }, async (request, reply) => {
    const payload = (request as any).user as { sub: string; rol: string };

    const where =
      payload.rol === "AGRICULTOR"
        ? { agricultorId: payload.sub, activo: true }
        : { activo: true };

    const predios = await db.predio.findMany({
      where,
      select: {
        id:                      true,
        nombrePredio:             true,
        codigoIca:               true,
        matriculaInmobiliaria:   true,
        departamento:            true,
        municipio:               true,
        vereda:                  true,
        direccion:               true,
        latitud:                 true,
        longitud:                true,
        altitudMsnm:             true,
        areaTotalHa:             true,
        areaProductivaHa:        true,
        areaBosqueHa:            true,
        fuenteAgua:              true,
        tipoSuelo:               true,
        pendientePct:            true,
        tieneBodegaAgroquimicos: true,
        tieneAguaPotable:        true,
        tieneSSSBasicas:         true,
        tieneZonaAcopio:         true,
        activo:                  true,
        createdAt:               true,
        _count: {
          select: { lotes: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      predios: predios.map((p) => ({
        ...p,
        totalLotes: p._count.lotes,
        _count: undefined,
      })),
    };
  });

  // GET /api/predios/:id — detalle con lotes
  app.get<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { sub: string; rol: string };

      const predio = await db.predio.findFirst({
        where: {
          id: request.params.id,
          ...(payload.rol === "AGRICULTOR" ? { agricultorId: payload.sub } : {}),
        },
        include: {
          lotes: {
            where: { activo: true },
            select: {
              id:               true,
              codigoLote:       true,
              especie:          true,
              variedad:         true,
              areaHa:           true,
              fechaSiembra:     true,
              destinoProduccion:true,
              sistemaRiego:     true,
              estado:           true,
              dataHash:         true,
              createdAt:        true,
              _count: { select: { plantas: true } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!predio) {
        return reply.status(404).send({ success: false, error: "Predio no encontrado" });
      }

      return { success: true, data: predio };
    }
  );
}
