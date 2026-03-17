import type { FastifyInstance } from "fastify";
import { db } from "@agrochain/database";

export async function metricasRoutes(app: FastifyInstance) {

  // GET /api/metricas/dashboard
  app.get("/dashboard", { preHandler: [(app as any).authenticate] }, async () => {

    const [
      totalLotes,
      lotesRegistrado,
      lotesEnProduccion,
      lotesCertificado,
      lotesEnInspeccion,
      totalCampanas,
      campanasAbiertas,
      campanasCerradas,
      adulteradosSinResolver,
      ultimasCampanas,
      ultimosEventos,
      totalPlantas,
      registrosCompletos,
    ] = await Promise.all([
      db.lote.count(),
      db.lote.count({ where: { estado: "REGISTRADO" } }),
      db.lote.count({ where: { estado: "EN_PRODUCCION" } }),
      db.lote.count({ where: { estado: "CERTIFICADO" } }),
      db.lote.count({ where: { estado: { in: ["INSPECCION_SOLICITADA", "EN_INSPECCION"] } } }),
      db.campana.count(),
      db.campana.count({ where: { estado: "ABIERTA" } }),
      db.campana.count({ where: { estado: "CERRADA" } }),
      db.registroPlanta.count({ where: { estado: "ADULTERADO" } }),

      db.campana.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          lote:    { select: { codigoLote: true, especie: true } },
          creador: { select: { nombres: true, apellidos: true } },
          _count:  { select: { registros: true } },
        },
      }),

      db.eventoProduccion.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          lote:    { select: { codigoLote: true, especie: true } },
          creador: { select: { nombres: true, apellidos: true } },
        },
      }),

      db.planta.count(),
      db.registroPlanta.count({ where: { estado: "COMPLETO" } }),
    ]);

    return {
      resumen: {
        totalLotes,
        lotesActivos:          lotesRegistrado + lotesEnProduccion,
        lotesCertificados:     lotesCertificado,
        lotesEnInspeccion,
        totalCampanas,
        campanasAbiertas,
        campanasCerradas,
        adulteradosSinResolver,
        totalPlantas,
        registrosCompletos,
      },
      lotesPorEstado: {
        REGISTRADO:           lotesRegistrado,
        EN_PRODUCCION:        lotesEnProduccion,
        CERTIFICADO:          lotesCertificado,
        EN_INSPECCION:        lotesEnInspeccion,
      },
      ultimasCampanas: ultimasCampanas.map((c) => ({
        id:             c.id,
        nombre:         c.nombre,
        estado:         c.estado,
        lote:           c.lote,
        creador:        c.creador,
        totalRegistros: c._count.registros,
        createdAt:      c.createdAt,
      })),
      ultimosEventos: ultimosEventos.map((e) => ({
        id:             e.id,
        tipoEvento:     e.tipoEvento,
        fechaEvento:    e.fechaEvento,
        lote:           e.lote,
        tecnico:        e.creador,
        hashVerificado: e.hashVerificado,
      })),
    };
  });
}
