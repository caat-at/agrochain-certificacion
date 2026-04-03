import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "@agrochain/database";
import { emitirCertificadoOnChain, isConfigured } from "../services/blockchain.js";

const EmitirSchema = z.object({
  loteId:            z.string(),
  numeroCertificado: z.string().min(1),
  tipo:              z.enum(["BPA_ICA", "ORGANICO", "GLOBAL_GAP", "RAINFOREST", "INVIMA_INOCUIDAD"]),
  diasVigencia:      z.number().int().min(1).max(1825),
  ipfsUri:           z.string().min(1),
});

export async function certificadosRoutes(app: FastifyInstance) {
  // GET /api/certificados — listar todos los certificados
  app.get("/", { preHandler: [(app as any).authenticate] }, async (_request, reply) => {
    const certs = await db.certificado.findMany({
      include: {
        lote: {
          select: {
            codigoLote: true, especie: true, variedad: true, dataHash: true, txRegistro: true,
            predio: { select: { nombrePredio: true } },
            inspecciones: {
              where: { estado: "COMPLETADA" },
              orderBy: { fechaRealizada: "desc" },
              take: 1,
              include: { inspector: { select: { nombres: true, apellidos: true } } },
            },
            campanas: {
              where:   { estado: "CERRADA" },
              select:  { nombre: true, campanaHash: true, txHash: true },
              orderBy: { fechaCierre: "desc" },
            },
          },
        },
        aprobadoPor: { select: { nombres: true, apellidos: true } },
      },
      orderBy: { fechaEmision: "desc" },
    });
    return { certificados: certs };
  });

  // POST /api/certificados/emitir — emitir certificado (solo CERTIFICADORA o ADMIN)
  app.post<{ Body: z.infer<typeof EmitirSchema> }>(
    "/emitir",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { sub: string; rol: string };
      if (payload.rol !== "CERTIFICADORA") {
        return reply.status(403).send({ message: "Solo certificador(a) pueden emitir certificados" });
      }

      const parsed = EmitirSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ message: "Datos inválidos", error: parsed.error.flatten() });
      }

      const { loteId, numeroCertificado, tipo, diasVigencia, ipfsUri } = parsed.data;

      // Verificar que el lote existe y está en estado COSECHADO
      const lote = await db.lote.findUnique({
        where: { id: loteId },
        include: {
          agricultor: true,
          campanas: {
            where: { estado: "CERRADA" },
            select: { id: true, campanaHash: true, nombre: true },
          },
        },
      });

      if (!lote) {
        return reply.status(404).send({ message: "Lote no encontrado" });
      }
      if (lote.estado !== "COSECHADO") {
        return reply.status(400).send({
          message: `El lote debe estar en estado COSECHADO. Estado actual: ${lote.estado}`,
        });
      }

      // Verificar que existe al menos una campaña CERRADA con campanaHash
      const campanasConHash = lote.campanas.filter((c) => !!c.campanaHash);
      if (campanasConHash.length === 0) {
        return reply.status(400).send({
          message:
            "No se puede certificar. El lote no tiene campañas cerradas con integridad verificada (campanaHash). " +
            "Cierra al menos una campaña de campo antes de emitir el certificado.",
          campanasTotal:   lote.campanas.length,
          campanasConHash: 0,
        });
      }

      // Verificar unicidad del número de certificado
      const existing = await db.certificado.findUnique({ where: { numeroCertificado } });
      if (existing) {
        return reply.status(400).send({ message: "El número de certificado ya existe" });
      }

      const fechaEmision     = new Date();
      const fechaVencimiento = new Date(Date.now() + diasVigencia * 24 * 3600 * 1000);

      const certificado = await db.certificado.create({
        data: {
          loteId,
          aprobadoPorId: payload.sub,
          numeroCertificado,
          tipo,
          ipfsUri,
          fechaEmision,
          fechaVencimiento,
          revocado: false,
        },
      });

      // Actualizar estado del lote a CERTIFICADO
      await db.lote.update({
        where: { id: loteId },
        data: { estado: "CERTIFICADO" },
      });

      // Intentar mintear NFT on-chain (no bloquea si falla)
      if (isConfigured() && lote.agricultor) {
        try {
          const nft = await emitirCertificadoOnChain({
            loteId,
            agricultorAddress: (lote.agricultor as any).walletAddress ?? "",
            numeroCertificado,
            tipo,
            diasVigencia,
            ipfsUri,
          });
          await db.certificado.update({
            where: { id: certificado.id },
            data: {
              nftTokenId: String(nft.tokenId),
              txEmision:  nft.txHash,
            },
          });
          return reply.status(201).send({
            certificado: { ...certificado, nftTokenId: String(nft.tokenId), txEmision: nft.txHash },
            blockchain: { tokenId: nft.tokenId, txHash: nft.txHash },
          });
        } catch (nftErr) {
          // NFT falló pero el certificado DB ya existe — retornar con advertencia
          return reply.status(201).send({
            certificado,
            warning: `Certificado creado en DB pero NFT falló: ${String(nftErr)}`,
          });
        }
      }

      return reply.status(201).send({ certificado });
    }
  );
}
