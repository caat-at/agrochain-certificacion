import type { FastifyInstance } from "fastify";
import { getLoteParaInforme } from "@agrochain/database";

export async function informesRoutes(app: FastifyInstance) {

  // GET /api/informes/lote/:loteId — datos completos para generar PDF
  app.get("/lote/:loteId", { preHandler: [(app as any).authenticate] }, async (request, reply) => {
    const { loteId } = request.params as { loteId: string };

    const informe = await getLoteParaInforme(loteId) as any;
    if (!informe) return reply.status(404).send({ message: "Lote no encontrado" });

    // camposRequeridos/campos ya vienen como jsonb nativo (no hace falta JSON.parse,
    // a diferencia del String serializado manual que usaba Prisma/SQLite)
    const campanasConDatos = informe.campanas;

    // Estadísticas de integridad
    const todosRegistros = campanasConDatos.flatMap((c: any) => c.registros);
    const estadisticas = {
      totalRegistros:    todosRegistros.length,
      completos:         todosRegistros.filter((r: any) => r.estado === "COMPLETO").length,
      parciales:         todosRegistros.filter((r: any) => r.estado === "PARCIAL").length,
      adulterados:       todosRegistros.filter((r: any) => r.estado === "ADULTERADO" || r.estado === "INVALIDADO").length,
      campanasAbiertas:  campanasConDatos.filter((c: any) => c.estado === "ABIERTA").length,
      campanasCerradas:  campanasConDatos.filter((c: any) => c.estado === "CERRADA").length,
    };

    return {
      generadoEn: new Date().toISOString(),
      lote: informe.lote,
      campanas: campanasConDatos,
      estadisticas,
    };
  });
}
