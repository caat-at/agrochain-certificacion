/**
 * Subida real de evidencia (fotos/audio/documentos) a S3 — funcionalidad
 * nueva, no migracion. Hoy el binario capturado en la app movil nunca sale
 * del dispositivo (solo se sincroniza su hash SHA256, ver apps/mobile).
 *
 * Patron replicado de SSE (routes/uploads.ts): @fastify/multipart en vez de
 * multer, mismo storage key jerarquico, misma regla de bloqueo sobre
 * entidades ya inmutables, mismas URLs firmadas de 1h nunca expuestas
 * directamente.
 *
 * Diferencia de integridad especifica de AgroChain: el servidor recalcula el
 * SHA256 del buffer recibido y lo compara contra el hash que el cliente ya
 * declaro (foto_hash/audio_hash del aporte, o hash_sha256 del documento) —
 * si no coincide, 409 y no se sube. Esto extiende el mismo principio de
 * "verificar integridad server-side" que ya usa packages/database/src/lib/hash.ts,
 * ahora tambien al binario, no solo a los metadatos.
 */
import type { FastifyInstance } from "fastify";
import { randomUUID, createHash } from "crypto";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import {
  createEvidenciaBinaria,
  listEvidenciaBinaria,
  getEvidenciaBinariaById,
  deleteEvidenciaBinaria,
  esEntidadEvidenciaInmutable,
} from "@agrochain/database";
import { s3, S3_BUCKET, signEvidenciaUrl } from "../services/s3.js";

const TIPOS_VALIDOS = new Set(["aporte", "evento", "documento", "eudr_satelital"]);
const MIMETYPES_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf", "audio/mp4", "audio/mpeg", "audio/wav", "audio/aac"]);
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB, igual que SSE

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export async function evidenciaRoutes(app: FastifyInstance) {
  // POST /api/evidencia/:tipo/:entidadId — sube un archivo a S3
  app.post<{ Params: { tipo: string; entidadId: string } }>(
    "/:tipo/:entidadId",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const { tipo, entidadId } = request.params;
      const payload = (request as any).user as { sub: string };

      if (!TIPOS_VALIDOS.has(tipo)) {
        return reply.status(400).send({ message: `Tipo de evidencia inválido: ${tipo}` });
      }
      if (!S3_BUCKET) {
        return reply.status(503).send({ message: "S3 no está configurado en el servidor (falta S3_BUCKET)" });
      }

      if (await esEntidadEvidenciaInmutable(tipo, entidadId)) {
        return reply.status(403).send({ message: "Esta entidad ya es inmutable — no se puede agregar evidencia nueva" });
      }

      const file = await request.file({ limits: { fileSize: MAX_SIZE_BYTES } });
      if (!file) {
        return reply.status(400).send({ message: "No se recibió ningún archivo" });
      }
      if (!MIMETYPES_PERMITIDOS.has(file.mimetype)) {
        return reply.status(400).send({ message: `Tipo de archivo no permitido: ${file.mimetype}` });
      }

      const buffer = await file.toBuffer();
      if (buffer.byteLength > MAX_SIZE_BYTES) {
        return reply.status(413).send({ message: "Archivo demasiado grande (máximo 10MB)" });
      }

      // El cliente declara el hash esperado (fotoHash/audioHash ya sincronizado,
      // o hashSha256 de un documento) como campo del multipart form-data.
      const hashEsperadoField = (file.fields as any)?.hashEsperado;
      const hashEsperado: string | undefined = Array.isArray(hashEsperadoField)
        ? hashEsperadoField[0]?.value
        : hashEsperadoField?.value;

      const sha256Servidor = createHash("sha256").update(buffer).digest("hex");
      if (hashEsperado && hashEsperado !== sha256Servidor) {
        return reply.status(409).send({
          message: "El hash recalculado en el servidor no coincide con el declarado por el cliente — posible corrupción o adulteración en tránsito",
          hashEsperado,
          hashServidor: sha256Servidor,
        });
      }

      const storageKey = `${tipo}/${entidadId}/${randomUUID()}${extOf(file.filename)}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: storageKey,
          Body: buffer,
          ContentType: file.mimetype,
        })
      );

      const evidencia = await createEvidenciaBinaria({
        tipo,
        entidadId,
        storageKey,
        originalName: file.filename,
        mimetype: file.mimetype,
        sizeBytes: buffer.byteLength,
        sha256: sha256Servidor,
        subidoPor: payload.sub,
      });

      return reply.status(201).send({ success: true, evidencia });
    }
  );

  // GET /api/evidencia/:tipo/:entidadId — lista evidencia con URLs firmadas
  app.get<{ Params: { tipo: string; entidadId: string } }>(
    "/:tipo/:entidadId",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const { tipo, entidadId } = request.params;
      if (!TIPOS_VALIDOS.has(tipo)) {
        return reply.status(400).send({ message: `Tipo de evidencia inválido: ${tipo}` });
      }

      const items = await listEvidenciaBinaria(tipo, entidadId);
      const conUrl = await Promise.all(
        items.map(async (e) => ({ ...e, url: await signEvidenciaUrl(e.storageKey) }))
      );

      return { evidencia: conUrl };
    }
  );

  // DELETE /api/evidencia/:id — borra un archivo huérfano (no vinculado a
  // una entidad ya inmutable). Regla igual que SSE: nunca se borra evidencia
  // ya sellada, ni siquiera admin.
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { sub: string; rol: string };
      const evidencia = await getEvidenciaBinariaById(request.params.id);
      if (!evidencia) return reply.status(404).send({ message: "Evidencia no encontrada" });

      if (evidencia.subidoPor !== payload.sub && payload.rol !== "ADMIN") {
        return reply.status(403).send({ message: "No tienes permiso para eliminar este archivo" });
      }

      if (await esEntidadEvidenciaInmutable(evidencia.tipo, evidencia.entidadId)) {
        return reply.status(403).send({ message: "Esta evidencia ya está vinculada a una entidad inmutable — no se puede eliminar" });
      }

      if (S3_BUCKET) {
        await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: evidencia.storageKey }));
      }
      await deleteEvidenciaBinaria(evidencia.id);

      return { success: true };
    }
  );
}
