/**
 * Rutas de predios — ICA Resolución 3168/2015
 * GET /api/predios — listar predios del agricultor autenticado
 * GET /api/predios/:id — detalle de un predio
 * POST /api/predios — crear predio nuevo (ADMIN, o AGRICULTOR para si mismo)
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  listPredios,
  getPredioConLotes,
  getPredioById,
  createPredio,
  updatePredio,
  countPredios,
  generarCodigoPredio,
  getUsuarioById,
  getPropietarioById,
  getPoligonoVigentePorPredio,
  listPoligonosPorPredio,
  crearPoligonoVigentePredio,
  desactivarPoligonoVigentePredio,
} from "@agrochain/database";

const PoligonoSchema = z.object({
  geojson: z.record(z.unknown()),
  areaHaCalculada: z.number().positive().optional(),
  fuente: z.enum(["DIBUJADO_MANUAL", "GPS_CAMPO", "KML_IMPORTADO"]).optional(),
});

const CrearPredioSchema = z.object({
  propietarioId: z.string().uuid(),
  agricultorId: z.string().uuid().optional(),
  nombrePredio: z.string().min(1).max(200),
  codigoIca: z.string().max(50).optional(),
  matriculaInmobiliaria: z.string().max(100).optional(),
  departamentoCod: z.string().min(1).max(5),
  municipioCod: z.string().min(1).max(10),
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

const EditarPredioSchema = z.object({
  propietarioId: z.string().uuid().optional(),
  agricultorId: z.string().uuid().nullable().optional(),
  nombrePredio: z.string().min(1).max(200).optional(),
  codigoIca: z.string().max(50).nullable().optional(),
  matriculaInmobiliaria: z.string().max(100).nullable().optional(),
  departamentoCod: z.string().min(1).max(5).optional(),
  municipioCod: z.string().min(1).max(10).optional(),
  vereda: z.string().max(150).nullable().optional(),
  direccion: z.string().max(255).nullable().optional(),
  latitud: z.number().min(-90).max(90).optional(),
  longitud: z.number().min(-180).max(180).optional(),
  altitudMsnm: z.number().nullable().optional(),
  areaTotalHa: z.number().positive().optional(),
  areaProductivaHa: z.number().positive().nullable().optional(),
  areaBosqueHa: z.number().positive().nullable().optional(),
  areaViverosHa: z.number().positive().nullable().optional(),
  fuenteAgua: z.enum(["ACUEDUCTO", "RIO", "POZO", "LLUVIA", "MIXTA"]).nullable().optional(),
  tipoSuelo: z.string().max(50).nullable().optional(),
  pendientePct: z.number().min(0).max(100).nullable().optional(),
  usoPrevio: z.string().max(150).nullable().optional(),
  certifUsoSuelo: z.string().max(100).nullable().optional(),
  tieneBodegaAgroquimicos: z.boolean().optional(),
  tieneAguaPotable: z.boolean().optional(),
  tieneSSSBasicas: z.boolean().optional(),
  tieneZonaAcopio: z.boolean().optional(),
  activo: z.boolean().optional(),
});

export async function prediosRoutes(app: FastifyInstance) {
  // GET /api/predios?propietarioId= — listar predios
  app.get("/", { preHandler: [(app as any).authenticate] }, async (request, reply) => {
    const payload = (request as any).user as { sub: string; rol: string };
    const { propietarioId } = request.query as { propietarioId?: string };

    const predios = await listPredios({
      agricultorId: payload.rol === "AGRICULTOR" ? payload.sub : undefined,
      propietarioId,
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

    if (payload.rol === "AGRICULTOR" && parsed.data.agricultorId && parsed.data.agricultorId !== payload.sub) {
      return reply.status(403).send({ message: "Un agricultor solo puede crear predios a su propio nombre" });
    }

    const propietario = await getPropietarioById(parsed.data.propietarioId);
    if (!propietario) {
      return reply.status(400).send({ message: "propietarioId no corresponde a ningún propietario registrado" });
    }

    if (parsed.data.agricultorId) {
      const agricultor = await getUsuarioById(parsed.data.agricultorId);
      if (!agricultor || agricultor.rol !== "AGRICULTOR") {
        return reply.status(400).send({ message: "agricultorId debe corresponder a un usuario con rol AGRICULTOR" });
      }
    }

    // codigoPredio: identificador interno, SIEMPRE se autogenera al crear el
    // predio (PRD-{municipio}-{seq}, mismo estilo que codigo_lote/codigo_parcela),
    // sea que el usuario llene codigoIca o no — son dos campos independientes.
    // codigoIca es el numero oficial real del ICA, opcional, sin relacion con
    // el autogenerado.
    const count = await countPredios();
    const codigoPredio = generarCodigoPredio(parsed.data.municipioCod, count + 1);

    const predio = await createPredio({ ...parsed.data, codigoPredio });
    return reply.status(201).send({ success: true, data: predio });
  });

  // PATCH /api/predios/:id — editar (solo ADMIN)
  app.patch<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { rol: string };
      if (payload.rol !== "ADMIN") {
        return reply.status(403).send({ message: "Solo administradores" });
      }

      const parsed = EditarPredioSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.flatten().fieldErrors });
      }

      const existente = await getPredioById(request.params.id);
      if (!existente) {
        return reply.status(404).send({ message: "Predio no encontrado" });
      }

      if (parsed.data.propietarioId) {
        const propietario = await getPropietarioById(parsed.data.propietarioId);
        if (!propietario) {
          return reply.status(400).send({ message: "propietarioId no corresponde a ningún propietario registrado" });
        }
      }

      if (parsed.data.agricultorId) {
        const agricultor = await getUsuarioById(parsed.data.agricultorId);
        if (!agricultor || agricultor.rol !== "AGRICULTOR") {
          return reply.status(400).send({ message: "agricultorId debe corresponder a un usuario con rol AGRICULTOR" });
        }
      }

      const actualizado = await updatePredio(request.params.id, parsed.data);
      if (actualizado === "no-changes") {
        return { success: true, data: existente };
      }
      return { success: true, data: actualizado };
    }
  );

  // GET /api/predios/:id/poligono — vigente + historial de versiones
  app.get<{ Params: { id: string } }>(
    "/:id/poligono",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const predio = await getPredioById(request.params.id);
      if (!predio) return reply.status(404).send({ message: "Predio no encontrado" });

      const [vigente, historial] = await Promise.all([
        getPoligonoVigentePorPredio(request.params.id),
        listPoligonosPorPredio(request.params.id),
      ]);
      if (!vigente) return reply.status(404).send({ message: "El predio no tiene polígono registrado" });
      return { poligono: vigente, historial };
    }
  );

  // POST /api/predios/:id/poligono — registra una nueva version vigente
  app.post<{ Params: { id: string } }>(
    "/:id/poligono",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { sub: string; rol: string };
      if (!["ADMIN", "AGRICULTOR"].includes(payload.rol)) {
        return reply.status(403).send({ message: "Sin permisos para registrar el polígono del predio" });
      }

      const predio = await getPredioById(request.params.id);
      if (!predio) return reply.status(404).send({ message: "Predio no encontrado" });

      if (payload.rol === "AGRICULTOR" && predio.agricultorId !== payload.sub) {
        return reply.status(403).send({ message: "Un agricultor solo puede registrar el polígono de predios propios" });
      }

      const parsed = PoligonoSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.flatten() });
      }

      const poligono = await crearPoligonoVigentePredio({
        predioId: request.params.id,
        geojson: parsed.data.geojson,
        areaHaCalculada: parsed.data.areaHaCalculada ?? null,
        fuente: parsed.data.fuente,
        creadoPor: payload.sub,
      });

      return reply.status(201).send({ success: true, poligono });
    }
  );

  // DELETE /api/predios/:id/poligono — desactiva la version vigente (no borra
  // el historial, mismo principio de versionado que el resto del modulo)
  app.delete<{ Params: { id: string } }>(
    "/:id/poligono",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { sub: string; rol: string };
      if (!["ADMIN", "AGRICULTOR"].includes(payload.rol)) {
        return reply.status(403).send({ message: "Sin permisos para eliminar el polígono del predio" });
      }

      const predio = await getPredioById(request.params.id);
      if (!predio) return reply.status(404).send({ message: "Predio no encontrado" });

      if (payload.rol === "AGRICULTOR" && predio.agricultorId !== payload.sub) {
        return reply.status(403).send({ message: "Un agricultor solo puede eliminar el polígono de predios propios" });
      }

      const eliminado = await desactivarPoligonoVigentePredio(request.params.id);
      if (!eliminado) {
        return reply.status(404).send({ message: "El predio no tiene polígono registrado" });
      }

      return { success: true };
    }
  );
}
