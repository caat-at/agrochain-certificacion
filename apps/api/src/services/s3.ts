/**
 * Cliente S3 minimo — patron replicado de SSE (backend/src/services/s3.ts).
 * El upload real (PutObjectCommand) vive en routes/evidencia.ts, que
 * reutiliza `s3`/`S3_BUCKET` de aqui. Este archivo solo expone el cliente y
 * el firmador de lectura.
 */
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const S3_BUCKET = process.env.S3_BUCKET;
export const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-2" });

export function signEvidenciaUrl(storageKey: string): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: S3_BUCKET, Key: storageKey }), { expiresIn: 3600 });
}
