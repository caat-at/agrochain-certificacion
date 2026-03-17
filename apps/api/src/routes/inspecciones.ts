import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "@agrochain/database";

const RegistrarInspeccionSchema = z.object({
  loteId:            z.string(),
  inspectorId:       z.string(),
  organizacionId:    z.string(),
  tipoInspeccion:    z.enum(["ICA_INICIAL", "ICA_SEGUIMIENTO", "BPA_CERTIFICACION", "BPA_RENOVACION", "INVIMA"]),
  fechaSolicitud:    z.string().datetime(),
  fechaProgramada:   z.string().datetime().optional(),
});

const CompletarInspeccionSchema = z.object({
  resultado:           z.enum(["APROBADO", "APROBADO_CON_OBSERVACIONES", "RECHAZADO"]),
  puntaje:             z.number().min(0).max(100).optional(),
  hallazgosCriticos:   z.number().int().min(0).default(0),
  hallazgosMayores:    z.number().int().min(0).default(0),
  hallazgosMenores:    z.number().int().min(0).default(0),
  observaciones:       z.string().optional(),
  planMejora:          z.string().optional(),
  fechaRealizada:      z.string().datetime().optional(),
});

export async function inspeccionesRoutes(app: FastifyInstance) {

  // GET /api/inspecciones — listar inspecciones
  app.get("/", { preHandler: [(app as any).authenticate] }, async (request) => {
    const payload = (request as any).user as { sub: string; rol: string };

    const where: any = {};
    if (payload.rol === "INSPECTOR_ICA" || payload.rol === "INSPECTOR_BPA") {
      where.inspectorId = payload.sub;
    }

    const inspecciones = await db.inspeccion.findMany({
      where,
      include: {
        lote: {
          select: {
            codigoLote: true,
            especie:    true,
            estado:     true,
            predio:     { select: { nombrePredio: true } },
          },
        },
        inspector: { select: { nombres: true, apellidos: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return { inspecciones };
  });

  // POST /api/inspecciones — registrar solicitud de inspección
  app.post<{ Body: z.infer<typeof RegistrarInspeccionSchema> }>(
    "/",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const parsed = RegistrarInspeccionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.flatten() });
      }

      const d = parsed.data;

      // Verificar que el lote existe y está en estado válido
      const lote = await db.lote.findUnique({ where: { id: d.loteId } });
      if (!lote) return reply.status(404).send({ message: "Lote no encontrado" });

      const inspeccion = await db.inspeccion.create({
        data: {
          loteId:         d.loteId,
          inspectorId:    d.inspectorId,
          organizacionId: d.organizacionId,
          tipoInspeccion: d.tipoInspeccion,
          fechaSolicitud: new Date(d.fechaSolicitud),
          fechaProgramada: d.fechaProgramada ? new Date(d.fechaProgramada) : undefined,
          estado:         "PROGRAMADA",
          resultado:      "PENDIENTE",
        },
      });

      // Actualizar estado del lote
      await db.lote.update({
        where: { id: d.loteId },
        data:  { estado: "INSPECCION_SOLICITADA" },
      });

      return reply.status(201).send({ success: true, data: inspeccion });
    }
  );

  // PATCH /api/inspecciones/:id/completar — registrar resultado
  app.patch<{
    Params: { id: string };
    Body: z.infer<typeof CompletarInspeccionSchema>;
  }>(
    "/:id/completar",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const parsed = CompletarInspeccionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.flatten() });
      }

      const { id } = request.params;
      const d = parsed.data;

      const inspeccion = await db.inspeccion.findUnique({ where: { id } });
      if (!inspeccion) return reply.status(404).send({ message: "Inspección no encontrada" });

      const actualizada = await db.inspeccion.update({
        where: { id },
        data: {
          resultado:         d.resultado,
          puntaje:           d.puntaje,
          hallazgosCriticos: d.hallazgosCriticos,
          hallazgosMayores:  d.hallazgosMayores,
          hallazgosMenores:  d.hallazgosMenores,
          observaciones:     d.observaciones,
          planMejora:        d.planMejora,
          fechaRealizada:    d.fechaRealizada ? new Date(d.fechaRealizada) : new Date(),
          estado:            "COMPLETADA",
        },
      });

      // Actualizar estado del lote según resultado
      const nuevoEstadoLote =
        d.resultado === "APROBADO" || d.resultado === "APROBADO_CON_OBSERVACIONES"
          ? "COSECHADO"    // listo para certificar
          : "RECHAZADO";

      await db.lote.update({
        where: { id: inspeccion.loteId },
        data:  { estado: nuevoEstadoLote },
      });

      return { success: true, data: actualizada };
    }
  );

  // GET /api/inspecciones/:id — detalle
  app.get<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const inspeccion = await db.inspeccion.findUnique({
        where:   { id: request.params.id },
        include: {
          lote:      { include: { predio: true, agricultor: true } },
          inspector: true,
        },
      });
      if (!inspeccion) return reply.status(404).send({ message: "No encontrada" });
      return { success: true, data: inspeccion };
    }
  );
}
