import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ethers } from "ethers";
import { db } from "@agrochain/database";
import { finalizarInspeccionOnChain, isConfigured } from "../services/blockchain";

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

      const lote = await db.lote.findUnique({ where: { id: d.loteId } });
      if (!lote) return reply.status(404).send({ message: "Lote no encontrado" });

      const inspeccion = await db.inspeccion.create({
        data: {
          loteId:          d.loteId,
          inspectorId:     d.inspectorId,
          organizacionId:  d.organizacionId,
          tipoInspeccion:  d.tipoInspeccion,
          fechaSolicitud:  new Date(d.fechaSolicitud),
          fechaProgramada: d.fechaProgramada ? new Date(d.fechaProgramada) : undefined,
          estado:          "PROGRAMADA",
          resultado:       "PENDIENTE",
        },
      });

      await db.lote.update({
        where: { id: d.loteId },
        data:  { estado: "INSPECCION_SOLICITADA" },
      });

      return reply.status(201).send({ success: true, data: inspeccion });
    }
  );

  // PATCH /api/inspecciones/:id/iniciar — pasar a EN_CURSO
  app.patch<{ Params: { id: string } }>(
    "/:id/iniciar",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const { id } = request.params;

      const inspeccion = await db.inspeccion.findUnique({ where: { id } });
      if (!inspeccion) return reply.status(404).send({ message: "Inspección no encontrada" });
      if (inspeccion.estado !== "PROGRAMADA") {
        return reply.status(400).send({ message: "La inspección ya fue iniciada o completada" });
      }

      const actualizada = await db.inspeccion.update({
        where: { id },
        data:  { estado: "EN_CURSO" },
      });

      await db.lote.update({
        where: { id: inspeccion.loteId },
        data:  { estado: "EN_INSPECCION" },
      });

      return { success: true, data: actualizada };
    }
  );

  // PATCH /api/inspecciones/:id/completar — registrar resultado + anclar en Polygon
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

      // Calcular reporteHash: keccak256 de los datos relevantes del resultado
      const reportePayload = JSON.stringify({
        inspeccionId:      id,
        loteId:            inspeccion.loteId,
        resultado:         d.resultado,
        puntaje:           d.puntaje ?? null,
        hallazgosCriticos: d.hallazgosCriticos,
        hallazgosMayores:  d.hallazgosMayores,
        hallazgosMenores:  d.hallazgosMenores,
      });
      const reporteHash = ethers.keccak256(ethers.toUtf8Bytes(reportePayload));
      const reporteHashHex = reporteHash.slice(2); // sin 0x para registrarEventoOnChain

      // Guardar resultado en DB
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
          reporteHash,
        },
      });

      // Actualizar estado del lote
      const nuevoEstadoLote =
        d.resultado === "APROBADO" || d.resultado === "APROBADO_CON_OBSERVACIONES"
          ? "COSECHADO"
          : "RECHAZADO";

      await db.lote.update({
        where: { id: inspeccion.loteId },
        data:  { estado: nuevoEstadoLote },
      });

      // Ejecutar flujo on-chain completo: solicitar→iniciar→finalizar inspección en Polygon
      let txHash: string | null = null;
      let blockNumber: number | null = null;
      if (isConfigured()) {
        try {
          const aprobado = d.resultado === "APROBADO" || d.resultado === "APROBADO_CON_OBSERVACIONES";
          const txResult = await finalizarInspeccionOnChain(
            inspeccion.loteId,
            aprobado,
            reporteHashHex,
          );
          txHash      = txResult.txHash;
          blockNumber = txResult.blockNumber;
          await db.inspeccion.update({
            where: { id },
            data:  { txHash },
          });
        } catch (e) {
          console.error("[blockchain] Error finalizando inspección on-chain:", e);
        }
      }

      return {
        success: true,
        data: { ...actualizada, txHash },
        blockchain: txHash
          ? { txHash, blockNumber }
          : null,
      };
    }
  );

  // POST /api/inspecciones/:id/anclar — reintentar ancla on-chain
  app.post<{ Params: { id: string } }>(
    "/:id/anclar",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const inspeccion = await db.inspeccion.findUnique({ where: { id: request.params.id } });
      if (!inspeccion) return reply.status(404).send({ message: "Inspección no encontrada" });
      if (inspeccion.estado !== "COMPLETADA") {
        return reply.status(400).send({ message: "Solo se pueden anclar inspecciones completadas" });
      }
      if (inspeccion.txHash) {
        return reply.status(400).send({ message: "La inspección ya está anclada en blockchain", txHash: inspeccion.txHash });
      }
      if (!inspeccion.reporteHash) {
        return reply.status(400).send({ message: "La inspección no tiene reporteHash generado" });
      }
      if (!isConfigured()) {
        return reply.status(503).send({ message: "Blockchain no configurado" });
      }

      try {
        const aprobado = inspeccion.resultado === "APROBADO" || inspeccion.resultado === "APROBADO_CON_OBSERVACIONES";
        const reporteHashHex = inspeccion.reporteHash.startsWith("0x")
          ? inspeccion.reporteHash.slice(2)
          : inspeccion.reporteHash;

        const txResult = await finalizarInspeccionOnChain(inspeccion.loteId, aprobado, reporteHashHex);

        await db.inspeccion.update({
          where: { id: request.params.id },
          data:  { txHash: txResult.txHash },
        });

        return { success: true, txHash: txResult.txHash, blockNumber: txResult.blockNumber };
      } catch (e) {
        return reply.status(500).send({ message: `Error blockchain: ${String(e)}` });
      }
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
