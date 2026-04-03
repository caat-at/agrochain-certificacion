import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, generarHashLote, generarCodigoLote } from "@agrochain/database";
import { registrarLoteOnChain, isConfigured } from "../services/blockchain.js";

const CrearLoteSchema = z.object({
  predioId: z.string(),
  agricultorId: z.string(),
  especie: z.string().min(1),
  variedad: z.string().min(1),
  areaHa: z.number().positive(),
  fechaSiembra: z.string().datetime().optional(),
  fechaCosechaEst: z.string().datetime().optional(),
  destinoProduccion: z.enum(["CONSUMO_INTERNO", "EXPORTACION", "AGROINDUSTRIA", "MIXTO"]).optional(),
  codigoDepartamento: z.string().length(2),
});

export async function lotesRoutes(app: FastifyInstance) {
  // GET /api/lotes — listar lotes del agricultor autenticado
  app.get("/", { preHandler: [(app as any).authenticate] }, async (request, reply) => {
    const payload = (request as any).user as { sub: string; rol: string };

    // Agricultores solo ven sus propios lotes; admin/inspector ven todos
    const where = payload.rol === "AGRICULTOR" ? { agricultorId: payload.sub } : {};

    const lotes = await db.lote.findMany({
      where,
      include: {
        predio: { select: { id: true, nombrePredio: true } },
        inspecciones: payload.rol === "CERTIFICADORA" ? {
          where:   { estado: "COMPLETADA" },
          orderBy: { fechaRealizada: "desc" },
          take:    1,
          include: { inspector: { select: { nombres: true, apellidos: true } } },
        } : false,
        campanas: payload.rol === "CERTIFICADORA" ? {
          where:   { estado: "CERRADA" },
          select:  { id: true, nombre: true, campanaHash: true, txHash: true, fechaCierre: true },
        } : false,
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      lotes: lotes.map((l: any) => ({
        id:               l.id,
        codigoLote:       l.codigoLote,
        predioId:         l.predio?.id ?? null,
        predioNombre:     l.predio?.nombrePredio ?? "",
        especie:          l.especie,
        variedad:         l.variedad,
        areaHa:           l.areaHa,
        fechaSiembra:     l.fechaSiembra?.toISOString() ?? null,
        destinoProduccion:l.destinoProduccion,
        sistemaRiego:     l.sistemaRiego,
        estadoLote:       l.estado,
        dataHash:         l.dataHash,
        txRegistro:          l.txRegistro ?? null,
        inspeccion:          l.inspecciones?.[0] ?? null,
        campanasVerificadas: l.campanas?.filter((c: any) => !!c.campanaHash).length ?? 0,
        campanas:            l.campanas?.filter((c: any) => !!c.campanaHash).map((c: any) => ({
          id:          c.id,
          nombre:      c.nombre,
          campanaHash: c.campanaHash,
          txHash:      c.txHash ?? null,
          fechaCierre: c.fechaCierre?.toISOString() ?? null,
        })) ?? [],
      })),
    };
  });

  // GET /api/lotes/:id
  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const lote = await db.lote.findUnique({
      where: { id: request.params.id },
      include: {
        predio: true,
        agricultor: { select: { nombres: true, apellidos: true, numeroDocumento: true } },
        plantas: { where: { activo: true } },
        eventos: { orderBy: { fechaEvento: "desc" }, take: 20 },
        certificado: true,
        campanas: {
          where:   { estado: "CERRADA" },
          select:  { id: true, nombre: true, campanaHash: true, txHash: true, fechaCierre: true },
          orderBy: { fechaCierre: "desc" },
        },
      },
    });

    if (!lote) return reply.status(404).send({ success: false, error: "Lote no encontrado" });
    return { success: true, data: lote };
  });

  // POST /api/lotes
  app.post<{ Body: z.infer<typeof CrearLoteSchema> }>("/", async (request, reply) => {
    const parsed = CrearLoteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.flatten() });
    }

    const data = parsed.data;

    // Generar secuencia del codigo de lote
    const anio = new Date().getFullYear();
    const count = await db.lote.count();
    const codigoLote = generarCodigoLote(data.codigoDepartamento, anio, count + 1);

    const dataHash = generarHashLote({
      codigoLote,
      predioId: data.predioId,
      agricultorId: data.agricultorId,
      especie: data.especie,
      variedad: data.variedad,
      areaHa: data.areaHa,
      fechaCreacion: new Date().toISOString(),
    });

    const lote = await db.lote.create({
      data: {
        predioId: data.predioId,
        agricultorId: data.agricultorId,
        codigoLote,
        especie: data.especie,
        variedad: data.variedad,
        areaHa: data.areaHa,
        fechaSiembra: data.fechaSiembra ? new Date(data.fechaSiembra) : undefined,
        fechaCosechaEst: data.fechaCosechaEst ? new Date(data.fechaCosechaEst) : undefined,
        destinoProduccion: data.destinoProduccion,
        dataHash,
        syncEstado: "VERIFICADO",
      },
    });

    return reply.status(201).send({ success: true, data: lote });
  });

  // GET /api/lotes/:loteId/plantas — listar plantas del lote
  app.get<{ Params: { id: string } }>("/:id/plantas", { preHandler: [(app as any).authenticate] }, async (request, reply) => {
    const plantas = await db.planta.findMany({
      where: { loteId: request.params.id, activo: true },
      select: {
        id:                      true,
        codigoPlanta:            true,
        numeroPlanta:            true,
        especie:                 true,
        variedad:                true,
        origenMaterial:          true,
        procedenciaVivero:       true,
        fechaSiembra:            true,
        alturaCmInicial:         true,
        diametroTalloCmInicial:  true,
        numHojasInicial:         true,
        estadoFenologicoInicial: true,
        latitud:                 true,
        longitud:                true,
        altitudMsnm:             true,
      },
      orderBy: { numeroPlanta: "asc" },
    });
    return {
      plantas: plantas.map((p) => ({
        ...p,
        fechaSiembra: p.fechaSiembra?.toISOString() ?? null,
      })),
    };
  });

  // POST /api/lotes/:loteId/plantas — registrar planta desde móvil (NTC 5400 / ICA)
  app.post<{ Params: { id: string }; Body: {
    codigoPlanta: string;
    numeroPlanta: string;
    latitud: number;
    longitud: number;
    altitudMsnm?: number;
    especie?: string;
    variedad?: string;
    origenMaterial?: string;
    procedenciaVivero?: string;
    fechaSiembra?: string;
    alturaCmInicial?: number;
    diametroTalloCmInicial?: number;
    numHojasInicial?: number;
    estadoFenologicoInicial?: string;
  } }>("/:id/plantas", { preHandler: [(app as any).authenticate] }, async (request, reply) => {
    const payload = (request as any).user as { sub: string };
    const {
      codigoPlanta, numeroPlanta, latitud, longitud, altitudMsnm,
      especie, variedad, origenMaterial, procedenciaVivero,
      fechaSiembra, alturaCmInicial, diametroTalloCmInicial,
      numHojasInicial, estadoFenologicoInicial,
    } = request.body;

    if (!codigoPlanta || !numeroPlanta || latitud == null || longitud == null) {
      return reply.status(400).send({ success: false, error: "Faltan campos requeridos" });
    }

    try {
      const planta = await db.planta.create({
        data: {
          loteId:                  request.params.id,
          codigoPlanta,
          numeroPlanta,
          latitud,
          longitud,
          altitudMsnm:             altitudMsnm ?? null,
          especie:                 especie ?? null,
          variedad:                variedad ?? null,
          origenMaterial:          (origenMaterial as any) ?? null,
          procedenciaVivero:       procedenciaVivero ?? null,
          fechaSiembra:            fechaSiembra ? new Date(fechaSiembra) : null,
          alturaCmInicial:         alturaCmInicial ?? null,
          diametroTalloCmInicial:  diametroTalloCmInicial ?? null,
          numHojasInicial:         numHojasInicial ?? null,
          estadoFenologicoInicial: estadoFenologicoInicial ?? null,
          registradoPor:           payload.sub,
        },
        select: {
          id: true, codigoPlanta: true, numeroPlanta: true,
          especie: true, latitud: true, longitud: true,
        },
      });
      return reply.status(201).send({ success: true, planta });
    } catch (err: any) {
      if (err?.code === "P2002") {
        return reply.status(409).send({ success: false, error: "Ya existe una planta con ese código en este lote" });
      }
      return reply.status(500).send({ success: false, error: "Error al registrar planta" });
    }
  });

  // POST /api/lotes/:id/registrar-blockchain — registrar lote en Polygon
  app.post<{ Params: { id: string } }>(
    "/:id/registrar-blockchain",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { sub: string; rol: string };
      if (!["ADMIN", "AGRICULTOR"].includes(payload.rol)) {
        return reply.status(403).send({ message: "Sin permisos para registrar en blockchain" });
      }

      const lote = await db.lote.findUnique({ where: { id: request.params.id } });
      if (!lote) return reply.status(404).send({ message: "Lote no encontrado" });
      if (lote.txRegistro) {
        return reply.status(400).send({ message: "El lote ya está registrado en blockchain", txHash: lote.txRegistro });
      }
      if (!lote.dataHash) {
        return reply.status(400).send({ message: "El lote no tiene dataHash generado" });
      }
      if (!isConfigured()) {
        return reply.status(503).send({ message: "Integración blockchain no configurada en el servidor" });
      }

      try {
        const result = await registrarLoteOnChain(lote.id, lote.dataHash);

        await db.lote.update({
          where: { id: lote.id },
          data: {
            txRegistro:  result.txHash,
            syncEstado:  "EN_CADENA",
          },
        });

        return reply.status(200).send({
          message: "Lote registrado en Polygon",
          txHash:      result.txHash,
          blockNumber: result.blockNumber,
          gasUsed:     result.gasUsed,
        });
      } catch (err) {
        return reply.status(500).send({ message: `Error blockchain: ${String(err)}` });
      }
    }
  );

  // GET /api/lotes/codigo/:codigo - buscar por codigo de lote
  app.get<{ Params: { codigo: string } }>("/codigo/:codigo", async (request, reply) => {
    const lote = await db.lote.findUnique({
      where: { codigoLote: request.params.codigo },
      include: {
        predio: { select: { nombrePredio: true, departamento: true, municipio: true } },
        agricultor: { select: { nombres: true, apellidos: true } },
        eventos: { orderBy: { fechaEvento: "asc" } },
        certificado: true,
      },
    });

    if (!lote) return reply.status(404).send({ success: false, error: "Lote no encontrado" });
    return { success: true, data: lote };
  });
}
