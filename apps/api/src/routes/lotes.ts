import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  generarHashLote,
  generarCodigoLote,
  getLoteById,
  getLoteByCodigo,
  getLoteDetalle,
  getLoteConDetalleByCodigo,
  listLotesConResumen,
  countLotes,
  createLote,
  updateLote,
  updateLoteBlockchainTx,
  listPlantasByLote,
  createPlanta,
  vincularPlantasALote,
  getParcelaById,
  getPredioById,
} from "@agrochain/database";
import { registrarLoteOnChain, isConfigured } from "../services/blockchain.js";

const CrearLoteSchema = z.object({
  parcelaId: z.string().uuid(),
  agricultorId: z.string(),
  especie: z.string().min(1),
  variedad: z.string().min(1),
  areaHa: z.number().positive(),
  fechaSiembra: z.string().datetime().optional(),
  fechaCosechaEst: z.string().datetime().optional(),
  destinoProduccion: z.enum(["CONSUMO_INTERNO", "EXPORTACION", "AGROINDUSTRIA", "MIXTO"]).optional(),
  codigoDepartamento: z.string().length(2),
});

const EditarLoteSchema = z.object({
  variedad: z.string().min(1).optional(),
  fechaCosechaEst: z.string().datetime().nullable().optional(),
  fechaCosechaReal: z.string().datetime().nullable().optional(),
  volumenCosechaKg: z.number().positive().nullable().optional(),
  destinoProduccion: z.enum(["CONSUMO_INTERNO", "EXPORTACION", "AGROINDUSTRIA", "MIXTO"]).nullable().optional(),
  sistemaRiego: z.string().max(50).nullable().optional(),
  distanciaSiembraM: z.number().positive().nullable().optional(),
  densidadPlantas: z.number().int().positive().nullable().optional(),
  cultivoAnterior: z.string().max(150).nullable().optional(),
});

export async function lotesRoutes(app: FastifyInstance) {
  // GET /api/lotes — listar lotes del agricultor autenticado
  app.get("/", { preHandler: [(app as any).authenticate] }, async (request, reply) => {
    const payload = (request as any).user as { sub: string; rol: string };

    const lotes = await listLotesConResumen({
      agricultorId: payload.rol === "AGRICULTOR" ? payload.sub : undefined,
      incluirInspeccionYCampanas: payload.rol === "CERTIFICADORA",
    });

    return {
      lotes: lotes.map((l) => ({
        id:               l.id,
        codigoLote:       l.codigoLote,
        predioId:         l.predioId,
        predioNombre:     l.predioNombre ?? "",
        parcelaId:        l.parcelaId,
        parcelaNombre:    l.parcelaNombre ?? null,
        parcelaCodigo:    l.parcelaCodigo ?? null,
        especie:          l.especie,
        variedad:         l.variedad,
        areaHa:           l.areaHa,
        fechaSiembra:     l.fechaSiembra ? new Date(l.fechaSiembra).toISOString() : null,
        fechaCosechaEst:  l.fechaCosechaEst ? new Date(l.fechaCosechaEst).toISOString() : null,
        fechaCosechaReal: l.fechaCosechaReal ? new Date(l.fechaCosechaReal).toISOString() : null,
        volumenCosechaKg: l.volumenCosechaKg,
        destinoProduccion:l.destinoProduccion,
        sistemaRiego:     l.sistemaRiego,
        estadoLote:       l.estado,
        dataHash:         l.dataHash,
        txRegistro:          l.txRegistro ?? null,
        inspeccion:          l.inspeccion,
        campanasVerificadas: l.campanas.length,
        campanas:            l.campanas.map((c) => ({
          id:          c.id,
          nombre:      c.nombre,
          campanaHash: c.campanaHash,
          txHash:      c.txHash ?? null,
          fechaCierre: c.fechaCierre ? new Date(c.fechaCierre).toISOString() : null,
        })),
      })),
    };
  });

  // GET /api/lotes/:id
  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const lote = await getLoteDetalle(request.params.id);
    if (!lote) return reply.status(404).send({ success: false, error: "Lote no encontrado" });
    return { success: true, data: lote };
  });

  // POST /api/lotes — crear (ADMIN cualquiera, AGRICULTOR solo en parcelas de predios propios)
  app.post<{ Body: z.infer<typeof CrearLoteSchema> }>(
    "/",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { sub: string; rol: string };
      if (!["ADMIN", "AGRICULTOR"].includes(payload.rol)) {
        return reply.status(403).send({ success: false, error: "Sin permisos para crear lotes" });
      }

      const parsed = CrearLoteSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: parsed.error.flatten() });
      }

      const data = parsed.data;

      const parcela = await getParcelaById(data.parcelaId);
      if (!parcela) {
        return reply.status(404).send({ success: false, error: "Parcela no encontrada" });
      }

      const predio = await getPredioById(parcela.predioId);
      if (!predio) {
        return reply.status(404).send({ success: false, error: "Predio de la parcela no encontrado" });
      }
      if (payload.rol === "AGRICULTOR" && predio.agricultorId !== payload.sub) {
        return reply.status(403).send({ success: false, error: "Un agricultor solo puede crear lotes en parcelas de predios propios" });
      }

      const anio = new Date().getFullYear();
      const count = await countLotes();
      const codigoLote = generarCodigoLote(data.codigoDepartamento, anio, count + 1);

      const dataHash = generarHashLote({
        codigoLote,
        predioId: parcela.predioId,
        agricultorId: data.agricultorId,
        especie: data.especie,
        variedad: data.variedad,
        areaHa: data.areaHa,
        fechaCreacion: new Date().toISOString(),
      });

      const lote = await createLote({
        parcelaId: data.parcelaId,
        agricultorId: data.agricultorId,
        codigoLote,
        especie: data.especie,
        variedad: data.variedad,
        areaHa: data.areaHa,
        fechaSiembra: data.fechaSiembra ? new Date(data.fechaSiembra) : null,
        fechaCosechaEst: data.fechaCosechaEst ? new Date(data.fechaCosechaEst) : null,
        destinoProduccion: data.destinoProduccion,
        dataHash,
        syncEstado: "VERIFICADO",
      });

      return reply.status(201).send({ success: true, data: lote });
    }
  );

  // GET /api/lotes/:loteId/plantas — listar plantas del lote
  app.get<{ Params: { id: string } }>("/:id/plantas", { preHandler: [(app as any).authenticate] }, async (request, reply) => {
    const plantas = await listPlantasByLote(request.params.id);
    return {
      plantas: plantas.map((p) => ({
        ...p,
        fechaSiembra: p.fechaSiembra ? new Date(p.fechaSiembra).toISOString() : null,
      })),
    };
  });

  // POST /api/lotes/:loteId/plantas — crea una planta NUEVA en la parcela de
  // este lote y la vincula al lote en el mismo paso (compatibilidad con el
  // flujo existente NTC 5400/ICA). Para reusar plantas ya existentes de la
  // parcela (cultivos perennes), usar POST /:id/plantas/vincular.
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

    const lote = await getLoteById(request.params.id);
    if (!lote) return reply.status(404).send({ success: false, error: "Lote no encontrado" });

    try {
      const planta = await createPlanta({
        parcelaId:               lote.parcelaId,
        codigoPlanta,
        numeroPlanta,
        latitud,
        longitud,
        altitudMsnm:             altitudMsnm ?? null,
        especie:                 especie ?? null,
        variedad:                variedad ?? null,
        origenMaterial:          origenMaterial ?? null,
        procedenciaVivero:       procedenciaVivero ?? null,
        fechaSiembra:            fechaSiembra ? new Date(fechaSiembra) : null,
        alturaCmInicial:         alturaCmInicial ?? null,
        diametroTalloCmInicial:  diametroTalloCmInicial ?? null,
        numHojasInicial:         numHojasInicial ?? null,
        estadoFenologicoInicial: estadoFenologicoInicial ?? null,
        registradoPor:           payload.sub,
      });
      await vincularPlantasALote({ loteId: request.params.id, plantaIds: [planta.id], vinculadoPor: payload.sub });
      return reply.status(201).send({ success: true, planta });
    } catch (err: any) {
      if (err?.code === "23505") {
        // unique_violation en Postgres (equivalente al P2002 de Prisma)
        return reply.status(409).send({ success: false, error: "Ya existe una planta con ese código en esta parcela" });
      }
      return reply.status(500).send({ success: false, error: "Error al registrar planta" });
    }
  });

  // POST /api/lotes/:id/plantas/vincular — vincula plantas EXISTENTES de la
  // parcela a este lote (reuso en cultivos perennes: la planta ya vive en la
  // parcela y participa en un nuevo ciclo de cosecha sin recrearse).
  app.post<{ Params: { id: string }; Body: { plantaIds: string[] } }>(
    "/:id/plantas/vincular",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { sub: string; rol: string };
      const { plantaIds } = request.body;
      if (!Array.isArray(plantaIds) || plantaIds.length === 0) {
        return reply.status(400).send({ success: false, error: "plantaIds debe ser un arreglo no vacío" });
      }

      const lote = await getLoteById(request.params.id);
      if (!lote) return reply.status(404).send({ success: false, error: "Lote no encontrado" });

      if (payload.rol === "AGRICULTOR") {
        const predio = await getPredioById((await getParcelaById(lote.parcelaId))?.predioId ?? "");
        if (!predio || predio.agricultorId !== payload.sub) {
          return reply.status(403).send({ success: false, error: "Un agricultor solo puede vincular plantas en lotes de predios propios" });
        }
      }

      const resultado = await vincularPlantasALote({ loteId: request.params.id, plantaIds, vinculadoPor: payload.sub });
      return reply.status(200).send({ success: true, ...resultado });
    }
  );

  // POST /api/lotes/:id/registrar-blockchain — registrar lote en Polygon
  app.post<{ Params: { id: string } }>(
    "/:id/registrar-blockchain",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { sub: string; rol: string };
      if (!["ADMIN", "AGRICULTOR"].includes(payload.rol)) {
        return reply.status(403).send({ message: "Sin permisos para registrar en blockchain" });
      }

      const lote = await getLoteById(request.params.id);
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

        await updateLoteBlockchainTx(lote.id, {
          txRegistro: result.txHash,
          syncEstado: "EN_CADENA",
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
    const lote = await getLoteConDetalleByCodigo(request.params.codigo);
    if (!lote) return reply.status(404).send({ success: false, error: "Lote no encontrado" });
    return { success: true, data: lote };
  });

  // PATCH /api/lotes/:id — editar (no permite cambiar estado ni codigoLote,
  // que tienen su propio flujo dedicado)
  app.patch<{ Params: { id: string }; Body: z.infer<typeof EditarLoteSchema> }>(
    "/:id",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const parsed = EditarLoteSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.flatten().fieldErrors });
      }

      const existente = await getLoteById(request.params.id);
      if (!existente) {
        return reply.status(404).send({ message: "Lote no encontrado" });
      }

      const data = parsed.data;
      const actualizado = await updateLote(request.params.id, {
        ...data,
        fechaCosechaEst: data.fechaCosechaEst !== undefined
          ? (data.fechaCosechaEst ? new Date(data.fechaCosechaEst) : null)
          : undefined,
        fechaCosechaReal: data.fechaCosechaReal !== undefined
          ? (data.fechaCosechaReal ? new Date(data.fechaCosechaReal) : null)
          : undefined,
      });
      if (actualizado === "no-changes") {
        return { success: true, data: existente };
      }
      return { success: true, data: actualizado };
    }
  );
}
