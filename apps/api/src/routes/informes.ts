import type { FastifyInstance } from "fastify";
import { db } from "@agrochain/database";

export async function informesRoutes(app: FastifyInstance) {

  // GET /api/informes/lote/:loteId — datos completos para generar PDF
  app.get("/lote/:loteId", { preHandler: [(app as any).authenticate] }, async (request, reply) => {
    const { loteId } = request.params as { loteId: string };

    const lote = await db.lote.findUnique({
      where: { id: loteId },
      include: {
        predio: true,
        agricultor: {
          select: { nombres: true, apellidos: true, numeroDocumento: true, tipoDocumento: true },
        },
        certificado: true,
        campanas: {
          orderBy: { createdAt: "asc" },
          include: {
            creador:  { select: { nombres: true, apellidos: true, rol: true } },
            cerrador: { select: { nombres: true, apellidos: true } },
            registros: {
              include: {
                planta:  { select: { codigoPlanta: true, numeroPlanta: true } },
                aportes: {
                  include: {
                    tecnico: { select: { nombres: true, apellidos: true, rol: true } },
                  },
                  orderBy: { fechaAporte: "asc" },
                },
              },
              orderBy: { createdAt: "asc" },
            },
          },
        },
        _count: { select: { plantas: true, eventos: true } },
      },
    });

    if (!lote) return reply.status(404).send({ message: "Lote no encontrado" });

    // Parsear campos JSON de aportes y camposRequeridos
    const campanasConDatos = lote.campanas.map((c) => ({
      ...c,
      camposRequeridos: (() => { try { return JSON.parse(c.camposRequeridos as string); } catch { return []; } })(),
      registros: c.registros.map((r) => ({
        ...r,
        aportes: r.aportes.map((a) => ({
          ...a,
          campos: (() => { try { return JSON.parse(a.campos as string); } catch { return {}; } })(),
        })),
      })),
    }));

    // Estadísticas de integridad
    const todosRegistros = campanasConDatos.flatMap((c) => c.registros);
    const estadisticas = {
      totalRegistros:    todosRegistros.length,
      completos:         todosRegistros.filter((r) => r.estado === "COMPLETO").length,
      parciales:         todosRegistros.filter((r) => r.estado === "PARCIAL").length,
      adulterados:       todosRegistros.filter((r) => r.estado === "ADULTERADO" || r.estado === "ADULTERADO_EVIDENCIA").length,
      campanasAbiertas:  campanasConDatos.filter((c) => c.estado === "ABIERTA").length,
      campanasCerradas:  campanasConDatos.filter((c) => c.estado === "CERRADA").length,
    };

    return {
      generadoEn: new Date().toISOString(),
      lote: {
        id:               lote.id,
        codigoLote:       lote.codigoLote,
        especie:          lote.especie,
        variedad:         lote.variedad,
        areaHa:           lote.areaHa,
        estado:           lote.estado,
        fechaSiembra:     lote.fechaSiembra,
        fechaCosechaEst:  lote.fechaCosechaEst,
        dataHash:         lote.dataHash,
        txRegistro:       lote.txRegistro,
        createdAt:        lote.createdAt,
        predio: {
          nombrePredio:  lote.predio.nombrePredio,
          departamento:  lote.predio.departamento.nombre,
          municipio:     lote.predio.municipio.nombre,
          vereda:        lote.predio.vereda,
          altitudMsnm:   lote.predio.altitudMsnm,
          latitud:       lote.predio.latitud,
          longitud:      lote.predio.longitud,
        },
        agricultor:  lote.agricultor,
        certificado: lote.certificado,
        totalPlantas: lote._count.plantas,
        totalEventos: lote._count.eventos,
      },
      campanas: campanasConDatos,
      estadisticas,
    };
  });
}
