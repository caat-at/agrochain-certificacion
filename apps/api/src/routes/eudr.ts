/**
 * Modulo EUDR (Reglamento UE 2023/1115, deforestacion-cero) — requisito para
 * la certificacion STBN (PNSS 0000404, PlanetAI Nature Space). Vinculado a
 * nivel de LOTE: el documento STBN exige georreferenciar "production areas"
 * especificas, no el predio completo.
 *
 * Solo modelo de datos + flujo manual: sin integracion a APIs satelitales.
 * La evidencia satelital se carga como documento (foto/PDF/reporte) con su
 * hash, igual que cualquier otra evidencia — ver routes/evidencia.ts.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID, createHash } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import {
  getLoteById,
  generarContentHashDeclaracionEudr,
  getPoligonoVigentePorLote,
  listPoligonosPorLote,
  crearPoligonoVigente,
  getPoligonoById,
  getDeclaracionVigentePorLote,
  getDeclaracionById,
  createDeclaracionEudr,
  firmarDeclaracionEudr,
  updateDeclaracionTxHash,
  createEvidenciaSatelital,
  listEvidenciasSatelitales,
  getEudrEstadoLote,
  createEvidenciaBinaria,
} from "@agrochain/database";
import { s3, S3_BUCKET, signEvidenciaUrl } from "../services/s3.js";
import { enqueue } from "../blockchain/writer.js";
import { isConfigured } from "../services/blockchain.js";

const PoligonoSchema = z.object({
  geojson: z.record(z.unknown()),
  areaHaCalculada: z.number().positive().optional(),
  fuente: z.enum(["DIBUJADO_MANUAL", "GPS_CAMPO", "KML_IMPORTADO"]).optional(),
});

const DeclaracionSchema = z.object({
  libreDeforestacion: z.boolean(),
  fechaCorte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  observaciones: z.string().optional(),
});

const TIPOS_EVIDENCIA = ["IMAGEN_SATELITAL", "REPORTE_NDVI", "CERTIFICADO_TERCERO", "OTRO"] as const;
const MIMETYPES_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export async function eudrRoutes(app: FastifyInstance) {
  // ── POST /api/eudr/lotes/:loteId/poligono ──────────────────────────────
  app.post<{ Params: { loteId: string } }>(
    "/lotes/:loteId/poligono",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { sub: string; rol: string };
      const { loteId } = request.params;

      if (!["ADMIN", "TECNICO", "AGRICULTOR"].includes(payload.rol)) {
        return reply.status(403).send({ message: "Sin permisos para registrar el polígono del lote" });
      }

      const lote = await getLoteById(loteId);
      if (!lote) return reply.status(404).send({ message: "Lote no encontrado" });

      const parsed = PoligonoSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.flatten() });
      }

      const poligono = await crearPoligonoVigente({
        loteId,
        geojson: parsed.data.geojson,
        areaHaCalculada: parsed.data.areaHaCalculada ?? null,
        fuente: parsed.data.fuente,
        creadoPor: payload.sub,
      });

      return reply.status(201).send({ success: true, poligono });
    }
  );

  // ── GET /api/eudr/lotes/:loteId/poligono ───────────────────────────────
  app.get<{ Params: { loteId: string } }>(
    "/lotes/:loteId/poligono",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const { loteId } = request.params;
      const [vigente, historial] = await Promise.all([
        getPoligonoVigentePorLote(loteId),
        listPoligonosPorLote(loteId),
      ]);
      if (!vigente) return reply.status(404).send({ message: "El lote no tiene polígono registrado" });
      return { poligono: vigente, historial };
    }
  );

  // ── POST /api/eudr/lotes/:loteId/declaracion ───────────────────────────
  app.post<{ Params: { loteId: string } }>(
    "/lotes/:loteId/declaracion",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { sub: string; rol: string };
      const { loteId } = request.params;

      if (!["ADMIN", "AGRICULTOR", "CERTIFICADORA"].includes(payload.rol)) {
        return reply.status(403).send({ message: "Sin permisos para declarar cumplimiento EUDR" });
      }

      const lote = await getLoteById(loteId);
      if (!lote) return reply.status(404).send({ message: "Lote no encontrado" });

      const poligono = await getPoligonoVigentePorLote(loteId);
      if (!poligono) {
        return reply.status(400).send({ message: "El lote debe tener un polígono registrado antes de declarar EUDR" });
      }

      const parsed = DeclaracionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.flatten() });
      }

      const fechaCorte = parsed.data.fechaCorte ?? "2020-12-31";
      const timestamp = new Date().toISOString();
      const contentHash = generarContentHashDeclaracionEudr({
        loteId,
        poligonoId: poligono.id,
        fechaCorte,
        libreDeforestacion: parsed.data.libreDeforestacion,
        declaradoPor: payload.sub,
        timestamp,
      });

      const declaracion = await createDeclaracionEudr({
        loteId,
        poligonoId: poligono.id,
        fechaCorte,
        libreDeforestacion: parsed.data.libreDeforestacion,
        declaradoPor: payload.sub,
        contentHash,
        observaciones: parsed.data.observaciones,
      });

      return reply.status(201).send({ success: true, declaracion });
    }
  );

  // ── POST /api/eudr/declaraciones/:id/firmar ────────────────────────────
  app.post<{ Params: { id: string } }>(
    "/declaraciones/:id/firmar",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { sub: string; rol: string };
      if (!["ADMIN", "AGRICULTOR", "CERTIFICADORA"].includes(payload.rol)) {
        return reply.status(403).send({ message: "Sin permisos para firmar la declaración" });
      }

      const declaracion = await getDeclaracionById(request.params.id);
      if (!declaracion) return reply.status(404).send({ message: "Declaración no encontrada" });
      if (declaracion.estado !== "BORRADOR") {
        return reply.status(400).send({ message: `La declaración ya está ${declaracion.estado}, no se puede firmar de nuevo` });
      }

      const firmada = await firmarDeclaracionEudr(declaracion.id);
      return { success: true, declaracion: firmada };
    }
  );

  // ── POST /api/eudr/declaraciones/:id/anclar-blockchain ─────────────────
  app.post<{ Params: { id: string } }>(
    "/declaraciones/:id/anclar-blockchain",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { sub: string; rol: string };
      if (payload.rol !== "ADMIN") {
        return reply.status(403).send({ message: "Solo el ADMIN puede anclar la declaración en blockchain" });
      }

      const declaracion = await getDeclaracionById(request.params.id);
      if (!declaracion) return reply.status(404).send({ message: "Declaración no encontrada" });
      if (declaracion.estado !== "FIRMADA") {
        return reply.status(400).send({ message: "La declaración debe estar FIRMADA para anclar en blockchain" });
      }
      if (!isConfigured()) {
        return reply.status(503).send({ message: "Blockchain no configurado en el servidor" });
      }

      enqueue({
        kind: "registrarEvento",
        payload: {
          loteId: declaracion.loteId,
          tipoEvento: `EUDR_DECLARACION:${declaracion.id}`,
          contentHash: declaracion.contentHash,
        },
        onSuccess: async (result) => {
          await updateDeclaracionTxHash(declaracion.id, result.txHash);
        },
        onError: async (err) => {
          console.error(`[eudr] Error anclando declaración ${declaracion.id} en blockchain:`, err);
        },
      });

      return { success: true, ancladoEnCola: true, mensaje: "Anclaje encolado — consulta GET /lotes/:loteId/estado para ver el txHash una vez confirmado." };
    }
  );

  // ── POST /api/eudr/declaraciones/:id/evidencias ────────────────────────
  app.post<{ Params: { id: string } }>(
    "/declaraciones/:id/evidencias",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { sub: string };
      const declaracion = await getDeclaracionById(request.params.id);
      if (!declaracion) return reply.status(404).send({ message: "Declaración no encontrada" });
      if (!S3_BUCKET) {
        return reply.status(503).send({ message: "S3 no está configurado en el servidor (falta S3_BUCKET)" });
      }

      const file = await request.file({ limits: { fileSize: MAX_SIZE_BYTES } });
      if (!file) return reply.status(400).send({ message: "No se recibió ningún archivo" });
      if (!MIMETYPES_PERMITIDOS.has(file.mimetype)) {
        return reply.status(400).send({ message: `Tipo de archivo no permitido: ${file.mimetype}` });
      }

      const fields = file.fields as Record<string, { value?: string } | undefined>;
      const tipoEvidencia = fields.tipoEvidencia?.value ?? "OTRO";
      if (!TIPOS_EVIDENCIA.includes(tipoEvidencia as (typeof TIPOS_EVIDENCIA)[number])) {
        return reply.status(400).send({ message: `tipoEvidencia inválido: ${tipoEvidencia}` });
      }
      const descripcion = fields.descripcion?.value ?? null;
      const fechaCaptura = fields.fechaCaptura?.value ?? null;
      const fuenteDeclarada = fields.fuenteDeclarada?.value ?? null;

      const buffer = await file.toBuffer();
      if (buffer.byteLength > MAX_SIZE_BYTES) {
        return reply.status(413).send({ message: "Archivo demasiado grande (máximo 10MB)" });
      }
      const sha256 = createHash("sha256").update(buffer).digest("hex");
      const storageKey = `eudr_satelital/${declaracion.id}/${randomUUID()}${extOf(file.filename)}`;

      await s3.send(
        new PutObjectCommand({ Bucket: S3_BUCKET, Key: storageKey, Body: buffer, ContentType: file.mimetype })
      );

      const evidenciaBinaria = await createEvidenciaBinaria({
        tipo: "eudr_satelital",
        entidadId: declaracion.id,
        storageKey,
        originalName: file.filename,
        mimetype: file.mimetype,
        sizeBytes: buffer.byteLength,
        sha256,
        subidoPor: payload.sub,
      });

      const evidencia = await createEvidenciaSatelital({
        declaracionId: declaracion.id,
        tipoEvidencia,
        descripcion,
        fechaCaptura,
        fuenteDeclarada,
        evidenciaBinariaId: evidenciaBinaria.id,
        cargadoPor: payload.sub,
      });

      return reply.status(201).send({ success: true, evidencia });
    }
  );

  // ── GET /api/eudr/declaraciones/:id/evidencias ─────────────────────────
  app.get<{ Params: { id: string } }>(
    "/declaraciones/:id/evidencias",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const items = await listEvidenciasSatelitales(request.params.id) as Array<{ storageKey: string }>;
      const conUrl = await Promise.all(items.map(async (e) => ({ ...e, url: await signEvidenciaUrl(e.storageKey) })));
      return { evidencias: conUrl };
    }
  );

  // ── GET /api/eudr/lotes/:loteId/estado ─────────────────────────────────
  // Resumen para el checklist de certificacion STBN — usado tambien por la
  // ruta de emision de certificados para validar elegibilidad.
  app.get<{ Params: { loteId: string } }>(
    "/lotes/:loteId/estado",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const lote = await getLoteById(request.params.loteId);
      if (!lote) return reply.status(404).send({ message: "Lote no encontrado" });

      const estado = await getEudrEstadoLote(request.params.loteId);
      return { estado };
    }
  );
}
