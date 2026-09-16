/**
 * Modulo STBN — pilares evaluables manualmente (PNSS 0000404, PlanetAI Nature
 * Space): Conservacion, Comunidad, Justicia Social, Tecnologia, Derechos
 * Humanos (60 de los 100 puntos; los otros 40 son EUDR, ver routes/eudr.ts).
 *
 * Vinculado a nivel de PREDIO. Solo modelo de datos + flujo manual: un
 * evaluador humano (ADMIN/CERTIFICADORA) califica cada uno de los 10
 * subcriterios entre 2 niveles fijos (ALTO/BAJO) definidos en el documento;
 * el sistema suma automaticamente. El puntaje /100 se consulta en contexto
 * de Lote porque el certificado es por lote (dos lotes del mismo predio
 * pueden tener distinto estado EUDR).
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID, createHash } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import {
  getLoteById,
  generarContentHashEvaluacionStbn,
  listSubcriteriosStbn,
  createEvidenciaPilar,
  listEvidenciasPorPredioPilar,
  getEvidenciaPilarById,
  vincularEvidenciaBinariaAPilar,
  listAdjuntosPorEvidenciaPilar,
  getEvaluacionVigentePorPredio,
  getEvaluacionById,
  crearEvaluacionStbn,
  calificarSubcriterio,
  listCalificacionesPorEvaluacion,
  finalizarEvaluacionStbn,
  updateEvaluacionTxHash,
  calcularPuntajeStbnLote,
  createEvidenciaBinaria,
} from "@agrochain/database";
import { s3, S3_BUCKET } from "../services/s3.js";
import { enqueue } from "../blockchain/writer.js";
import { isConfigured } from "../services/blockchain.js";

const PILARES = ["CONSERVACION", "COMUNIDAD", "JUSTICIA_SOCIAL", "TECNOLOGIA", "DERECHOS_HUMANOS"] as const;

const EvidenciaPilarSchema = z.object({
  pilar: z.enum(PILARES),
  titulo: z.string().min(1).max(200),
  narrativa: z.string().min(1),
  periodoDesde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  periodoHasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const CalificacionSchema = z.object({
  nivel: z.enum(["ALTO", "BAJO"]),
  justificacion: z.string().optional(),
});

const AnclarSchema = z.object({
  // El contrato LoteRegistry.registrarEvento exige un loteId ya registrado
  // on-chain (modifier loteExiste) — como la evaluacion STBN es por Predio,
  // se ancla contra un lote de referencia de ese mismo predio.
  loteId: z.string().uuid(),
});

const MIMETYPES_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export async function stbnRoutes(app: FastifyInstance) {
  // ── GET /api/stbn/subcriterios ──────────────────────────────────────────
  app.get("/subcriterios", { preHandler: [(app as any).authenticate] }, async () => {
    const subcriterios = await listSubcriteriosStbn();
    return { subcriterios };
  });

  // ── POST /api/stbn/predios/:predioId/evidencias ─────────────────────────
  app.post<{ Params: { predioId: string } }>(
    "/predios/:predioId/evidencias",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { sub: string; rol: string };
      if (!["ADMIN", "AGRICULTOR", "TECNICO", "CERTIFICADORA"].includes(payload.rol)) {
        return reply.status(403).send({ message: "Sin permisos para registrar evidencia STBN" });
      }

      const parsed = EvidenciaPilarSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.flatten() });
      }

      const evidencia = await createEvidenciaPilar({
        predioId: request.params.predioId,
        pilar: parsed.data.pilar,
        titulo: parsed.data.titulo,
        narrativa: parsed.data.narrativa,
        periodoDesde: parsed.data.periodoDesde,
        periodoHasta: parsed.data.periodoHasta,
        registradoPor: payload.sub,
      });

      return reply.status(201).send({ success: true, evidencia });
    }
  );

  // ── GET /api/stbn/predios/:predioId/evidencias?pilar= ───────────────────
  app.get<{ Params: { predioId: string }; Querystring: { pilar?: string } }>(
    "/predios/:predioId/evidencias",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const pilar = request.query.pilar;
      if (pilar && !PILARES.includes(pilar as (typeof PILARES)[number])) {
        return reply.status(400).send({ message: `pilar inválido: ${pilar}` });
      }
      const evidencias = await listEvidenciasPorPredioPilar(
        request.params.predioId,
        pilar as (typeof PILARES)[number] | undefined
      );
      const conAdjuntos = await Promise.all(
        evidencias.map(async (e) => ({ ...e, adjuntos: await listAdjuntosPorEvidenciaPilar(e.id) }))
      );
      return { evidencias: conAdjuntos };
    }
  );

  // ── POST /api/stbn/evidencias/:evidenciaPilarId/binarios ────────────────
  app.post<{ Params: { evidenciaPilarId: string } }>(
    "/evidencias/:evidenciaPilarId/binarios",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { sub: string };
      const evidenciaPilar = await getEvidenciaPilarById(request.params.evidenciaPilarId);
      if (!evidenciaPilar) return reply.status(404).send({ message: "Evidencia de pilar no encontrada" });
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
      const sha256 = createHash("sha256").update(buffer).digest("hex");
      const storageKey = `stbn_pilar/${evidenciaPilar.id}/${randomUUID()}${extOf(file.filename)}`;

      await s3.send(
        new PutObjectCommand({ Bucket: S3_BUCKET, Key: storageKey, Body: buffer, ContentType: file.mimetype })
      );

      const evidenciaBinaria = await createEvidenciaBinaria({
        tipo: "stbn_pilar",
        entidadId: evidenciaPilar.id,
        storageKey,
        originalName: file.filename,
        mimetype: file.mimetype,
        sizeBytes: buffer.byteLength,
        sha256,
        subidoPor: payload.sub,
      });

      await vincularEvidenciaBinariaAPilar(evidenciaPilar.id, evidenciaBinaria.id);

      return reply.status(201).send({ success: true, evidenciaBinaria });
    }
  );

  // ── POST /api/stbn/predios/:predioId/evaluaciones ───────────────────────
  app.post<{ Params: { predioId: string } }>(
    "/predios/:predioId/evaluaciones",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { sub: string; rol: string };
      if (!["ADMIN", "CERTIFICADORA"].includes(payload.rol)) {
        return reply.status(403).send({ message: "Sin permisos para iniciar una evaluación STBN" });
      }

      const evaluacion = await crearEvaluacionStbn({
        predioId: request.params.predioId,
        iniciadaPor: payload.sub,
      });

      return reply.status(201).send({ success: true, evaluacion });
    }
  );

  // ── POST /api/stbn/evaluaciones/:evaluacionId/subcriterios/:codigo ──────
  app.post<{ Params: { evaluacionId: string; codigo: string } }>(
    "/evaluaciones/:evaluacionId/subcriterios/:codigo",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { sub: string; rol: string };
      if (!["ADMIN", "CERTIFICADORA"].includes(payload.rol)) {
        return reply.status(403).send({ message: "Sin permisos para calificar subcriterios STBN" });
      }

      const evaluacion = await getEvaluacionById(request.params.evaluacionId);
      if (!evaluacion) return reply.status(404).send({ message: "Evaluación no encontrada" });
      if (evaluacion.estado !== "EN_PROGRESO") {
        return reply.status(400).send({ message: "La evaluación ya está finalizada, no admite nuevas calificaciones" });
      }

      const parsed = CalificacionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.flatten() });
      }

      let calificacion;
      try {
        calificacion = await calificarSubcriterio({
          evaluacionId: evaluacion.id,
          subcriterioCodigo: request.params.codigo,
          nivel: parsed.data.nivel,
          justificacion: parsed.data.justificacion,
          evaluadoPor: payload.sub,
        });
      } catch (e) {
        return reply.status(400).send({ message: (e as Error).message });
      }

      return { success: true, calificacion };
    }
  );

  // ── POST /api/stbn/evaluaciones/:evaluacionId/finalizar ─────────────────
  app.post<{ Params: { evaluacionId: string } }>(
    "/evaluaciones/:evaluacionId/finalizar",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { sub: string; rol: string };
      if (payload.rol !== "ADMIN") {
        return reply.status(403).send({ message: "Solo el ADMIN puede finalizar una evaluación STBN" });
      }

      const evaluacion = await getEvaluacionById(request.params.evaluacionId);
      if (!evaluacion) return reply.status(404).send({ message: "Evaluación no encontrada" });

      const calificaciones = await listCalificacionesPorEvaluacion(evaluacion.id);
      const resultadoHash = generarContentHashEvaluacionStbn({
        predioId: evaluacion.predioId,
        calificaciones: calificaciones.map((c) => ({
          subcriterioCodigo: c.subcriterioCodigo,
          nivel: c.nivel,
          puntajeAsignado: c.puntajeAsignado,
        })),
        evaluadoPor: payload.sub,
        timestamp: new Date().toISOString(),
      });

      let finalizada;
      try {
        finalizada = await finalizarEvaluacionStbn(evaluacion.id, payload.sub, resultadoHash);
      } catch (e) {
        return reply.status(400).send({ message: (e as Error).message });
      }

      return { success: true, evaluacion: finalizada };
    }
  );

  // ── POST /api/stbn/evaluaciones/:evaluacionId/anclar-blockchain ─────────
  app.post<{ Params: { evaluacionId: string } }>(
    "/evaluaciones/:evaluacionId/anclar-blockchain",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { sub: string; rol: string };
      if (payload.rol !== "ADMIN") {
        return reply.status(403).send({ message: "Solo el ADMIN puede anclar la evaluación en blockchain" });
      }

      const evaluacion = await getEvaluacionById(request.params.evaluacionId);
      if (!evaluacion) return reply.status(404).send({ message: "Evaluación no encontrada" });
      if (evaluacion.estado !== "FINALIZADA" || !evaluacion.resultadoHash) {
        return reply.status(400).send({ message: "La evaluación debe estar FINALIZADA para anclar en blockchain" });
      }
      if (!isConfigured()) {
        return reply.status(503).send({ message: "Blockchain no configurado en el servidor" });
      }

      const parsed = AnclarSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.flatten() });
      }
      const lote = await getLoteById(parsed.data.loteId);
      if (!lote) return reply.status(404).send({ message: "Lote de referencia no encontrado" });
      if (lote.predioId !== evaluacion.predioId) {
        return reply.status(400).send({ message: "El lote de referencia debe pertenecer al mismo predio de la evaluación" });
      }

      enqueue({
        kind: "registrarEvento",
        payload: {
          loteId: lote.id,
          tipoEvento: `STBN_EVALUACION:${evaluacion.id}`,
          contentHash: evaluacion.resultadoHash,
        },
        onSuccess: async (result) => {
          await updateEvaluacionTxHash(evaluacion.id, result.txHash);
        },
        onError: async (err) => {
          console.error(`[stbn] Error anclando evaluación ${evaluacion.id} en blockchain:`, err);
        },
      });

      return {
        success: true,
        ancladoEnCola: true,
        mensaje: "Anclaje encolado — consulta la evaluación para ver el txHash una vez confirmado.",
      };
    }
  );

  // ── GET /api/stbn/lotes/:loteId/puntaje ──────────────────────────────────
  app.get<{ Params: { loteId: string } }>(
    "/lotes/:loteId/puntaje",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const lote = await getLoteById(request.params.loteId);
      if (!lote) return reply.status(404).send({ message: "Lote no encontrado" });

      const puntaje = await calcularPuntajeStbnLote(request.params.loteId);
      return { puntaje };
    }
  );
}
