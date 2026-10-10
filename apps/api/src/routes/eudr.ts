/**
 * Modulo EUDR (Reglamento UE 2023/1115, deforestacion-cero) — requisito para
 * la certificacion STBN (PNSS 0000404, PlanetAI Nature Space). Vinculado a
 * nivel de PARCELA: el documento STBN exige georreferenciar "production
 * areas" fisicas — el area de terreno, no el ciclo de cosecha (lote). Una
 * misma parcela produce muchos lotes a lo largo del tiempo, y todos comparten
 * el mismo poligono y la misma declaracion de libre-deforestacion.
 *
 * EUDR no tiene su propio poligono: usa el poligono GENERAL de la parcela
 * (modulo de trazabilidad en routes/parcelas.ts, mismo que se dibuja con el
 * mapa interactivo en el detalle de parcela) — ver
 * sql/16_eudr_usa_poligono_parcela.sql. Evita pedir el mismo dato geografico
 * dos veces en formularios distintos.
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
  getParcelaById,
  getPredioById,
  generarContentHashDeclaracionEudr,
  getPoligonoVigentePorParcela,
  getDeclaracionVigentePorParcela,
  getDeclaracionById,
  createDeclaracionEudr,
  firmarDeclaracionEudr,
  createEvidenciaSatelital,
  listEvidenciasSatelitales,
  getEudrEstadoParcela,
  createEvidenciaBinaria,
  listPaisesRiesgo,
  getEvaluacionRiesgoVigentePredio,
  crearEvaluacionRiesgoPredio,
  getEvaluacionRiesgoVigenteParcela,
  crearEvaluacionRiesgoParcela,
  crearMedidaMitigacion,
  listMedidasMitigacionPredio,
  listMedidasMitigacionParcela,
  getEudrEstadoRiesgo,
} from "@agrochain/database";
import { s3, S3_BUCKET, signEvidenciaUrl } from "../services/s3.js";

const DeclaracionSchema = z.object({
  libreDeforestacion: z.boolean(),
  fechaCorte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  observaciones: z.string().optional(),
});

const NIVEL_RIESGO = ["NULO", "BAJO", "MEDIO", "ALTO"] as const;

const EvaluacionRiesgoPredioSchema = z.object({
  paisCodigo: z.string().length(2).optional(),
  historialIncumplimiento: z.boolean(),
  historialIncumplimientoDetalle: z.string().optional(),
  tenenciaLegalVerificada: z.boolean(),
  tenenciaLegalObservaciones: z.string().optional(),
  nivelRiesgoGlobal: z.enum(NIVEL_RIESGO),
});

const EvaluacionRiesgoParcelaSchema = z.object({
  fiabilidadPoligono: z.enum(["ALTA", "MEDIA", "BAJA"]),
  complejidadCadena: z.enum(["BAJA", "MEDIA", "ALTA"]),
  complejidadCadenaDetalle: z.string().optional(),
  riesgoMezclaOrigen: z.enum(NIVEL_RIESGO),
  informacionNoConformidad: z.string().optional(),
  nivelRiesgoGlobal: z.enum(NIVEL_RIESGO),
});

const MedidaMitigacionSchema = z.object({
  descripcion: z.string().min(1),
  responsable: z.string().max(200).optional(),
  fechaImplementacion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const TIPOS_EVIDENCIA = ["IMAGEN_SATELITAL", "REPORTE_NDVI", "CERTIFICADO_TERCERO", "OTRO"] as const;
const MIMETYPES_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export async function eudrRoutes(app: FastifyInstance) {
  // ── POST /api/eudr/parcelas/:parcelaId/declaracion ─────────────────────
  // Requiere que la parcela ya tenga un poligono GENERAL vigente (se dibuja
  // en el detalle de parcela, POST /api/parcelas/:id/poligono) — EUDR lo usa
  // directamente, no pide uno propio.
  app.post<{ Params: { parcelaId: string } }>(
    "/parcelas/:parcelaId/declaracion",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { sub: string; rol: string };
      const { parcelaId } = request.params;

      if (!["ADMIN", "AGRICULTOR", "CERTIFICADORA"].includes(payload.rol)) {
        return reply.status(403).send({ message: "Sin permisos para declarar cumplimiento EUDR" });
      }

      const parcela = await getParcelaById(parcelaId);
      if (!parcela) return reply.status(404).send({ message: "Parcela no encontrada" });

      const poligono = await getPoligonoVigentePorParcela(parcelaId);
      if (!poligono) {
        return reply.status(400).send({
          message: "La parcela debe tener un polígono registrado antes de declarar EUDR — dibújalo en el detalle de la parcela",
        });
      }

      // Art. 10(1): no se puede declarar cumplimiento salvo que el riesgo sea
      // nulo o insignificante (evaluacion de predio + parcela aceptable, o
      // con mitigacion documentada si es MEDIO/ALTO).
      const estadoRiesgo = await getEudrEstadoRiesgo(parcela.predioId, parcelaId);
      if (!estadoRiesgo.esAceptable) {
        return reply.status(400).send({
          message:
            "Debes completar la evaluación de riesgo EUDR (predio y parcela) con un resultado aceptable " +
            "(nulo/bajo, o medio/alto con medida de mitigación documentada) antes de declarar cumplimiento.",
          estadoRiesgo,
        });
      }

      const parsed = DeclaracionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.flatten() });
      }

      const fechaCorte = parsed.data.fechaCorte ?? "2020-12-31";
      const timestamp = new Date().toISOString();
      const contentHash = generarContentHashDeclaracionEudr({
        parcelaId,
        poligonoId: poligono.id,
        fechaCorte,
        libreDeforestacion: parsed.data.libreDeforestacion,
        declaradoPor: payload.sub,
        timestamp,
      });

      const declaracion = await createDeclaracionEudr({
        parcelaId,
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

      // El anclaje on-chain de declaraciones EUDR (a nivel de PARCELA) requiere
      // un contrato propio — LoteRegistry.registrarEvento() exige un loteId ya
      // existente on-chain (modifier loteExiste), y una parcela no es un lote.
      // Pendiente: desplegar un contrato EudrRegistry/ParcelaRegistry dedicado.
      return reply.status(501).send({
        message:
          "El anclaje en blockchain de declaraciones EUDR aún no está disponible — requiere un contrato " +
          "dedicado para parcelas (en desarrollo). La declaración queda FIRMADA y es válida para certificación.",
      });
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

  // ── GET /api/eudr/parcelas/:parcelaId/estado ───────────────────────────
  // Resumen para el checklist de certificacion STBN — usado tambien por la
  // ruta de emision de certificados para validar elegibilidad.
  app.get<{ Params: { parcelaId: string } }>(
    "/parcelas/:parcelaId/estado",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const parcela = await getParcelaById(request.params.parcelaId);
      if (!parcela) return reply.status(404).send({ message: "Parcela no encontrada" });

      const estado = await getEudrEstadoParcela(request.params.parcelaId);
      return { estado };
    }
  );

  // ══════════════════════════════════════════════════════════════════════
  // Evaluacion de riesgo (Art. 9-11) — vive 100% en Certificacion -> EUDR.
  // Los datos generales (matricula, codigo ICA, territorio indigena) se leen
  // del predio via GET /api/predios/:id, no se duplican aqui.
  // ══════════════════════════════════════════════════════════════════════

  // ── GET /api/eudr/paises-riesgo — catalogo (Art. 10(2)(a), Art. 29) ────
  app.get("/paises-riesgo", { preHandler: [(app as any).authenticate] }, async () => {
    const paises = await listPaisesRiesgo();
    return { paises };
  });

  // ── GET /api/eudr/predios/:predioId/evaluacion-riesgo ──────────────────
  app.get<{ Params: { predioId: string } }>(
    "/predios/:predioId/evaluacion-riesgo",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const predio = await getPredioById(request.params.predioId);
      if (!predio) return reply.status(404).send({ message: "Predio no encontrado" });

      const evaluacion = await getEvaluacionRiesgoVigentePredio(request.params.predioId);
      const medidas = evaluacion ? await listMedidasMitigacionPredio(evaluacion.id) : [];
      return { evaluacion, medidas };
    }
  );

  // ── POST /api/eudr/predios/:predioId/evaluacion-riesgo ──────────────────
  app.post<{ Params: { predioId: string } }>(
    "/predios/:predioId/evaluacion-riesgo",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { sub: string; rol: string };
      if (!["ADMIN", "AGRICULTOR", "CERTIFICADORA"].includes(payload.rol)) {
        return reply.status(403).send({ message: "Sin permisos para evaluar riesgo EUDR" });
      }

      const predio = await getPredioById(request.params.predioId);
      if (!predio) return reply.status(404).send({ message: "Predio no encontrado" });

      const parsed = EvaluacionRiesgoPredioSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.flatten() });
      }

      const evaluacion = await crearEvaluacionRiesgoPredio({
        predioId: request.params.predioId,
        ...parsed.data,
        evaluadoPor: payload.sub,
      });

      return reply.status(201).send({ success: true, evaluacion });
    }
  );

  // ── GET /api/eudr/parcelas/:parcelaId/evaluacion-riesgo ─────────────────
  app.get<{ Params: { parcelaId: string } }>(
    "/parcelas/:parcelaId/evaluacion-riesgo",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const parcela = await getParcelaById(request.params.parcelaId);
      if (!parcela) return reply.status(404).send({ message: "Parcela no encontrada" });

      const evaluacion = await getEvaluacionRiesgoVigenteParcela(request.params.parcelaId);
      const medidas = evaluacion ? await listMedidasMitigacionParcela(evaluacion.id) : [];
      return { evaluacion, medidas };
    }
  );

  // ── POST /api/eudr/parcelas/:parcelaId/evaluacion-riesgo ────────────────
  app.post<{ Params: { parcelaId: string } }>(
    "/parcelas/:parcelaId/evaluacion-riesgo",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { sub: string; rol: string };
      if (!["ADMIN", "AGRICULTOR", "CERTIFICADORA"].includes(payload.rol)) {
        return reply.status(403).send({ message: "Sin permisos para evaluar riesgo EUDR" });
      }

      const parcela = await getParcelaById(request.params.parcelaId);
      if (!parcela) return reply.status(404).send({ message: "Parcela no encontrada" });

      const parsed = EvaluacionRiesgoParcelaSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.flatten() });
      }

      const evaluacion = await crearEvaluacionRiesgoParcela({
        parcelaId: request.params.parcelaId,
        ...parsed.data,
        evaluadoPor: payload.sub,
      });

      return reply.status(201).send({ success: true, evaluacion });
    }
  );

  // ── POST /api/eudr/evaluaciones-riesgo/predio/:evaluacionId/mitigacion ──
  app.post<{ Params: { evaluacionId: string } }>(
    "/evaluaciones-riesgo/predio/:evaluacionId/mitigacion",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { sub: string; rol: string };
      if (!["ADMIN", "AGRICULTOR", "CERTIFICADORA"].includes(payload.rol)) {
        return reply.status(403).send({ message: "Sin permisos para registrar medidas de mitigación" });
      }
      const parsed = MedidaMitigacionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.flatten() });
      }
      const medida = await crearMedidaMitigacion({
        evaluacionPredioId: request.params.evaluacionId,
        ...parsed.data,
        registradoPor: payload.sub,
      });
      return reply.status(201).send({ success: true, medida });
    }
  );

  // ── POST /api/eudr/evaluaciones-riesgo/parcela/:evaluacionId/mitigacion ─
  app.post<{ Params: { evaluacionId: string } }>(
    "/evaluaciones-riesgo/parcela/:evaluacionId/mitigacion",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { sub: string; rol: string };
      if (!["ADMIN", "AGRICULTOR", "CERTIFICADORA"].includes(payload.rol)) {
        return reply.status(403).send({ message: "Sin permisos para registrar medidas de mitigación" });
      }
      const parsed = MedidaMitigacionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.flatten() });
      }
      const medida = await crearMedidaMitigacion({
        evaluacionParcelaId: request.params.evaluacionId,
        ...parsed.data,
        registradoPor: payload.sub,
      });
      return reply.status(201).send({ success: true, medida });
    }
  );

  // ── GET /api/eudr/parcelas/:parcelaId/estado-riesgo ──────────────────────
  // Combinado predio+parcela — usado para habilitar/bloquear "Crear declaración".
  app.get<{ Params: { parcelaId: string } }>(
    "/parcelas/:parcelaId/estado-riesgo",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const parcela = await getParcelaById(request.params.parcelaId);
      if (!parcela) return reply.status(404).send({ message: "Parcela no encontrada" });

      const estadoRiesgo = await getEudrEstadoRiesgo(parcela.predioId, parcela.id);
      return { estadoRiesgo };
    }
  );
}
