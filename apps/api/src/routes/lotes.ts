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
  getPoligonoVigentePorParcela,
} from "@agrochain/database";
import { registrarLoteOnChain, isConfigured } from "../services/blockchain.js";
import {
  buscarEscenas,
  previsualizarEscena,
  coordenadasParcelaDesdeGeoJson,
  isTerrasachaConfigured,
  TerrasachaNoConfiguradoError,
  TerrasachaApiError,
} from "../services/terrasacha.js";
import { alcanceDeLotes } from "../middleware/alcance.js";
import type { JwtPayload } from "../middleware/auth.js";
import type { Lote } from "@agrochain/database";

// Un lote ajeno se responde 404, no 403: un 403 confirmaria que el id existe.
// Para un agricultor no hay diferencia entre "no existe" y "no es suyo".
async function loteDeAlcance(
  id: string,
  payload: JwtPayload
): Promise<{ ok: true; lote: Lote } | { ok: false; status: 403 | 404 }> {
  const alcance = alcanceDeLotes(payload);
  if (!alcance.permitido) return { ok: false, status: 403 };

  const lote = await getLoteById(id, alcance.agricultorId);
  if (!lote) return { ok: false, status: 404 };
  return { ok: true, lote };
}

// Resuelve el AOI (área de interés) para el historial satelital: el anillo de
// coordenadas del polígono VIGENTE de la parcela del lote. Devuelve un motivo
// legible para que la ruta lo convierta en el status HTTP correspondiente.
async function poligonoParcelaDeLote(
  parcelaId: string
): Promise<{ ok: true; coordenadas: number[][] } | { ok: false; motivo: string; status: 400 | 404 }> {
  const poligono = await getPoligonoVigentePorParcela(parcelaId);
  if (!poligono) {
    return { ok: false, motivo: "La parcela del lote no tiene polígono vigente registrado (dibujelo en el mapa de la parcela)", status: 400 };
  }

  const coordenadas = coordenadasParcelaDesdeGeoJson(poligono.geojson);
  if (!coordenadas) {
    return { ok: false, motivo: "El polígono de la parcela no tiene anillo de coordenadas utilizable", status: 400 };
  }

  return { ok: true, coordenadas };
}

// Errores de la API Terrasacha → HTTP con significado (503 config, 504 timeout,
// 502 aguas arriba, 400 satélite inválido) sin filtrar el cuerpo.
function responderErrorTerrasacha(reply: any, err: unknown) {
  if (err instanceof TerrasachaNoConfiguradoError) {
    return reply.status(503).send({ message: err.message });
  }
  if (err instanceof TerrasachaApiError) {
    if (err.status === 400) {
      return reply.status(400).send({ message: "Parámetros inválidos para Terrasacha", detalle: err.body });
    }
    if (err.status === 401 || err.status === 403) {
      return reply.status(502).send({ message: "Terrasacha rechazó las credenciales del servidor" });
    }
    return reply.status(502).send({ message: `Terrasacha respondió ${err.status}` });
  }
  return reply.status(504).send({ message: "Terrasacha no respondió a tiempo" });
}

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

const SatelitalQuerySchema = z.object({
  satellite: z.enum(["S2", "LC08", "LC09", "S1", "ALOS", "MOD13A1", "MOD11A1", "MOD14A1"]).optional(),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  nubosidad: z.coerce.number().int().min(0).max(100).optional(),
});

const PreviewQuerySchema = z.object({
  imageId: z.string().min(1),
  satellite: z.string().min(1),
  bandas: z.string().optional(),
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
  app.get<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
    const payload = (request as any).user as JwtPayload;
    const alcance = alcanceDeLotes(payload);
    if (!alcance.permitido) {
      return reply.status(403).send({ message: "No autorizado para esta operación" });
    }

    const lote = await getLoteDetalle(request.params.id, alcance.agricultorId);
    if (!lote) return reply.status(404).send({ success: false, error: "Lote no encontrado" });
    return { success: true, data: lote };
    }
  );

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
    const payload = (request as any).user as JwtPayload;
    const alcance = alcanceDeLotes(payload);
    if (!alcance.permitido) {
      return reply.status(403).send({ message: "No autorizado para esta operación" });
    }

    const plantas = await listPlantasByLote(request.params.id, alcance.agricultorId);
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
    const payload = (request as any).user as JwtPayload;
    const {
      codigoPlanta, numeroPlanta, latitud, longitud, altitudMsnm,
      especie, variedad, origenMaterial, procedenciaVivero,
      fechaSiembra, alturaCmInicial, diametroTalloCmInicial,
      numHojasInicial, estadoFenologicoInicial,
    } = request.body;

    if (!codigoPlanta || !numeroPlanta || latitud == null || longitud == null) {
      return reply.status(400).send({ success: false, error: "Faltan campos requeridos" });
    }

    const visible = await loteDeAlcance(request.params.id, payload);
    if (!visible.ok) {
      return reply.status(visible.status).send({ success: false, error: "Lote no encontrado" });
    }
    const lote = visible.lote;

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
      const payload = (request as any).user as JwtPayload;
      const { plantaIds } = request.body;
      if (!Array.isArray(plantaIds) || plantaIds.length === 0) {
        return reply.status(400).send({ success: false, error: "plantaIds debe ser un arreglo no vacío" });
      }

      const visible = await loteDeAlcance(request.params.id, payload);
      if (!visible.ok) {
        return reply.status(visible.status).send({ success: false, error: "Lote no encontrado" });
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
      const payload = (request as any).user as JwtPayload;
      if (!["ADMIN", "AGRICULTOR"].includes(payload.rol)) {
        return reply.status(403).send({ message: "Sin permisos para registrar en blockchain" });
      }

      const visible = await loteDeAlcance(request.params.id, payload);
      if (!visible.ok) {
        return reply.status(visible.status).send({ message: "Lote no encontrado" });
      }
      const lote = visible.lote;
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
  app.get<{ Params: { codigo: string } }>(
    "/codigo/:codigo",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
    const payload = (request as any).user as JwtPayload;
    const alcance = alcanceDeLotes(payload);
    if (!alcance.permitido) {
      return reply.status(403).send({ message: "No autorizado para esta operación" });
    }

    const lote = await getLoteConDetalleByCodigo(request.params.codigo, alcance.agricultorId);
    if (!lote) return reply.status(404).send({ success: false, error: "Lote no encontrado" });
    return { success: true, data: lote };
    }
  );

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

      const payload = (request as any).user as JwtPayload;
      const visible = await loteDeAlcance(request.params.id, payload);
      if (!visible.ok) {
        return reply.status(visible.status).send({ message: "Lote no encontrado" });
      }
      const existente = visible.lote;

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

  // GET /api/lotes/:id/satelital — escenas satelitales disponibles sobre la
  // parcela del lote (historial, consulta SOLO en vivo contra Terrasacha, sin
  // persistencia propia). AOI = polígono vigente de la parcela.
  // Query: satellite (default S2), desde/hasta (YYYY-MM-DD, default últimos 12
  // meses), nubosidad (0-100, default 20).
  app.get<{ Params: { id: string }; Querystring: unknown }>(
    "/:id/satelital",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      if (!isTerrasachaConfigured()) {
        return reply.status(503).send({ message: "Integración Terrasacha no configurada en el servidor" });
      }

      const payload = (request as any).user as JwtPayload;
      const visible = await loteDeAlcance(request.params.id, payload);
      if (!visible.ok) {
        return reply.status(visible.status).send({ message: "Lote no encontrado" });
      }

      const parsed = SatelitalQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ message: "Query inválida", errors: parsed.error.flatten().fieldErrors });
      }
      const q = parsed.data;

      const poligono = await poligonoParcelaDeLote(visible.lote.parcelaId);
      if (!poligono.ok) {
        return reply.status(poligono.status).send({ message: poligono.motivo });
      }

      const fin = q.hasta ? new Date(`${q.hasta}T23:59:59`) : new Date();
      const inicio = q.desde
        ? new Date(`${q.desde}T00:00:00`)
        : new Date(fin.getFullYear() - 1, fin.getMonth(), fin.getDate());

      const desde = inicio.toISOString().slice(0, 10);
      const hasta = fin.toISOString().slice(0, 10);

      try {
        const escenas = await buscarEscenas({
          satellite: q.satellite ?? "S2",
          coordenadas: poligono.coordenadas,
          fechaDesde: desde,
          fechaHasta: hasta,
          nubosidad: q.nubosidad ?? 20,
        });
        return {
          success: true,
          satelite: q.satellite ?? "S2",
          desde,
          hasta,
          ...escenas,
        };
      } catch (err) {
        return responderErrorTerrasacha(reply, err);
      }
    }
  );

  // GET /api/lotes/:id/satelital/preview — plantilla XYZ de una escena para el
  // mapa del historial satelital. Query: imageId, satellite, bandas (opcional,
  // CSV separado por coma; default true color B4,B3,B2).
  app.get<{ Params: { id: string }; Querystring: unknown }>(
    "/:id/satelital/preview",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      if (!isTerrasachaConfigured()) {
        return reply.status(503).send({ message: "Integración Terrasacha no configurada en el servidor" });
      }

      const payload = (request as any).user as JwtPayload;
      const visible = await loteDeAlcance(request.params.id, payload);
      if (!visible.ok) {
        return reply.status(visible.status).send({ message: "Lote no encontrado" });
      }

      const parsed = PreviewQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ message: "Query inválida", errors: parsed.error.flatten().fieldErrors });
      }
      const q = parsed.data;

      const poligono = await poligonoParcelaDeLote(visible.lote.parcelaId);
      if (!poligono.ok) {
        return reply.status(poligono.status).send({ message: poligono.motivo });
      }

      const bandas = q.bandas ? q.bandas.split(",").map((b) => b.trim()).filter(Boolean) : ["B4", "B3", "B2"];

      try {
        const preview = await previsualizarEscena({
          imageId: q.imageId,
          satellite: q.satellite,
          bandas,
          coordenadas: poligono.coordenadas,
        });
        return { success: true, ...preview };
      } catch (err) {
        return responderErrorTerrasacha(reply, err);
      }
    }
  );
}
