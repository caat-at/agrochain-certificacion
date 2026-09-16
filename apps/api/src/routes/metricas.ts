import type { FastifyInstance } from "fastify";
import { getMetricasDashboard } from "@agrochain/database";

export async function metricasRoutes(app: FastifyInstance) {

  // GET /api/metricas/dashboard
  app.get("/dashboard", { preHandler: [(app as any).authenticate] }, async () => {
    const m = await getMetricasDashboard();

    return {
      resumen: {
        totalLotes: m.totalLotes,
        lotesActivos:          m.lotesRegistrado + m.lotesEnProduccion,
        lotesCertificados:     m.lotesCertificado,
        lotesEnInspeccion:     m.lotesEnInspeccion,
        totalCampanas:         m.totalCampanas,
        campanasAbiertas:      m.campanasAbiertas,
        campanasCerradas:      m.campanasCerradas,
        adulteradosSinResolver: m.adulteradosSinResolver,
        totalPlantas:          m.totalPlantas,
        registrosCompletos:    m.registrosCompletos,
      },
      lotesPorEstado: {
        REGISTRADO:           m.lotesRegistrado,
        EN_PRODUCCION:        m.lotesEnProduccion,
        CERTIFICADO:          m.lotesCertificado,
        EN_INSPECCION:        m.lotesEnInspeccion,
      },
      ultimasCampanas: (m.ultimasCampanas as any[]).map((c) => ({
        id:             c.id,
        nombre:         c.nombre,
        estado:         c.estado,
        lote:           { codigoLote: c.loteCodigoLote, especie: c.loteEspecie },
        creador:        { nombres: c.creadorNombres, apellidos: c.creadorApellidos },
        totalRegistros: c.totalRegistros,
        createdAt:      c.createdAt,
      })),
      ultimosEventos: (m.ultimosEventos as any[]).map((e) => ({
        id:             e.id,
        tipoEvento:     e.tipoEvento,
        fechaEvento:    e.fechaEvento,
        lote:           { codigoLote: e.loteCodigoLote, especie: e.loteEspecie },
        tecnico:        { nombres: e.tecnicoNombres, apellidos: e.tecnicoApellidos },
        hashVerificado: e.hashVerificado,
      })),
    };
  });
}
