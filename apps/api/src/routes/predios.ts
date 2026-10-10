/**
 * Rutas de predios — ICA Resolución 3168/2015
 * GET /api/predios — listar predios del agricultor autenticado
 * GET /api/predios/:id — detalle de un predio
 * POST /api/predios — crear predio nuevo (ADMIN, o AGRICULTOR para si mismo)
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID, createHash } from "crypto";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
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
  createEvidenciaBinaria,
  listEvidenciaBinaria,
  deleteEvidenciaBinaria,
} from "@agrochain/database";
import { s3, S3_BUCKET, signEvidenciaUrl } from "../services/s3.js";

const MIMETYPES_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

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

  // ── Documento de tenencia legal (Art. 9(1)(h) EUDR, dato general del predio) ──
  // Un solo documento vigente por predio (matricula inmobiliaria, certificado
  // de uso de suelo, contrato de uso del area) — al subir uno nuevo se
  // reemplaza el anterior (no se versiona, a diferencia del poligono/declaracion).

  // GET /api/predios/:id/tenencia-legal-documento
  app.get<{ Params: { id: string } }>(
    "/:id/tenencia-legal-documento",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const predio = await getPredioById(request.params.id);
      if (!predio) return reply.status(404).send({ message: "Predio no encontrado" });

      const documentos = await listEvidenciaBinaria("predio_tenencia_legal", request.params.id);
      const vigente = documentos[documentos.length - 1] ?? null;
      if (!vigente) return { documento: null };
      const url = await signEvidenciaUrl(vigente.storageKey);
      return { documento: { ...vigente, url } };
    }
  );

  // POST /api/predios/:id/tenencia-legal-documento
  app.post<{ Params: { id: string } }>(
    "/:id/tenencia-legal-documento",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { sub: string; rol: string };
      if (!["ADMIN", "AGRICULTOR"].includes(payload.rol)) {
        return reply.status(403).send({ message: "Sin permisos para adjuntar el documento de tenencia legal" });
      }

      const predio = await getPredioById(request.params.id);
      if (!predio) return reply.status(404).send({ message: "Predio no encontrado" });
      if (payload.rol === "AGRICULTOR" && predio.agricultorId !== payload.sub) {
        return reply.status(403).send({ message: "Un agricultor solo puede adjuntar documentos de predios propios" });
      }
      if (!S3_BUCKET) {
        return reply.status(503).send({ message: "S3 no está configurado en el servidor (falta S3_BUCKET)" });
      }

      const file = await request.file({ limits: { fileSize: MAX_SIZE_BYTES } });
      if (!file) return reply.status(400).send({ message: "No se recibió ningún archivo" });
      if (!MIMETYPES_PERMITIDOS.has(file.mimetype)) {
        return reply.status(400).send({ message: `Tipo de archivo no permitido: ${file.mimetype}` });
      }

      const buffer = await file.toBuffer();
      if (buffer.byteLength > MAX_SIZE_BYTES) {
        return reply.status(413).send({ message: "Archivo demasiado grande (máximo 10MB)" });
      }

      // Reemplazo: borra el documento anterior (S3 + registro) antes de subir el nuevo.
      const anteriores = await listEvidenciaBinaria("predio_tenencia_legal", request.params.id);
      for (const anterior of anteriores) {
        await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: anterior.storageKey })).catch(() => {});
        await deleteEvidenciaBinaria(anterior.id);
      }

      const sha256 = createHash("sha256").update(buffer).digest("hex");
      const storageKey = `predio_tenencia_legal/${request.params.id}/${randomUUID()}${extOf(file.filename)}`;

      await s3.send(
        new PutObjectCommand({ Bucket: S3_BUCKET, Key: storageKey, Body: buffer, ContentType: file.mimetype })
      );

      const documento = await createEvidenciaBinaria({
        tipo: "predio_tenencia_legal",
        entidadId: request.params.id,
        storageKey,
        originalName: file.filename,
        mimetype: file.mimetype,
        sizeBytes: buffer.byteLength,
        sha256,
        subidoPor: payload.sub,
      });

      return reply.status(201).send({ success: true, documento });
    }
  );
}
