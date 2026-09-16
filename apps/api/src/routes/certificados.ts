import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  listCertificadosConLote,
  getCertificadoByNumero,
  createCertificado,
  updateCertificadoNft,
  getLoteParaCertificacion,
  updateLoteEstado,
  getDeclaracionVigentePorLote,
  crearCertificadoEudrRequisito,
  calcularPuntajeStbnLote,
} from "@agrochain/database";
import { emitirCertificadoOnChain, isConfigured } from "../services/blockchain.js";

const EmitirSchema = z.object({
  loteId:            z.string(),
  numeroCertificado: z.string().min(1),
  tipo:              z.enum(["BPA_ICA", "ORGANICO", "GLOBAL_GAP", "RAINFOREST", "INVIMA_INOCUIDAD", "STBN"]),
  diasVigencia:      z.number().int().min(1).max(1825),
  ipfsUri:           z.string().min(1),
});

export async function certificadosRoutes(app: FastifyInstance) {
  // GET /api/certificados — listar todos los certificados
  app.get("/", { preHandler: [(app as any).authenticate] }, async (_request, reply) => {
    const certificados = await listCertificadosConLote();
    return { certificados };
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
      const lote = await getLoteParaCertificacion(loteId);

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
      const existing = await getCertificadoByNumero(numeroCertificado);
      if (existing) {
        return reply.status(400).send({ message: "El número de certificado ya existe" });
      }

      // Requisito adicional para STBN (PNSS 0000404 — PlanetAI Nature Space):
      // el lote debe tener una declaracion EUDR firmada/anclada declarando
      // libre_deforestacion=true. Sin esto, es imposible superar el pilar de
      // 40/100 puntos del estandar (trazabilidad EUDR).
      let declaracionEudr: Awaited<ReturnType<typeof getDeclaracionVigentePorLote>> = null;
      if (tipo === "STBN") {
        declaracionEudr = await getDeclaracionVigentePorLote(loteId);
        const cumpleEudr =
          !!declaracionEudr &&
          (declaracionEudr.estado === "FIRMADA" || declaracionEudr.estado === "ANCLADA_BLOCKCHAIN") &&
          declaracionEudr.libreDeforestacion === true;

        if (!cumpleEudr) {
          return reply.status(400).send({
            message:
              "No se puede emitir certificado STBN sin una declaración EUDR firmada que confirme libre_deforestacion=true. " +
              "Completa el flujo en /api/eudr/lotes/:loteId antes de emitir.",
            declaracionEudr,
          });
        }

        // Requisito de puntaje total (PNSS 0000404): EUDR (40pts) + los 5
        // pilares evaluables manualmente a nivel de Predio (60pts) deben
        // sumar >= 80/100. Ver /api/stbn/lotes/:loteId/puntaje.
        const puntajeStbn = await calcularPuntajeStbnLote(loteId);
        if (puntajeStbn.puntajeTotal < 80) {
          return reply.status(400).send({
            message:
              `No se puede emitir certificado STBN: puntaje total ${puntajeStbn.puntajeTotal}/100 ` +
              `(mínimo requerido: 80). Completa y finaliza la evaluación de pilares en ` +
              `/api/stbn/predios/:predioId/evaluaciones antes de emitir.`,
            puntajeStbn,
          });
        }
      }

      const fechaEmision     = new Date();
      const fechaVencimiento = new Date(Date.now() + diasVigencia * 24 * 3600 * 1000);

      const certificado = await createCertificado({
        loteId,
        aprobadoPorId: payload.sub,
        numeroCertificado,
        tipo,
        ipfsUri,
        fechaEmision,
        fechaVencimiento,
      });

      if (declaracionEudr) {
        await crearCertificadoEudrRequisito({
          certificadoId: certificado.id,
          declaracionId: declaracionEudr.id,
          cumpleUmbral: true,
        });
      }

      // Actualizar estado del lote a CERTIFICADO
      await updateLoteEstado(loteId, "CERTIFICADO");

      // Intentar mintear NFT on-chain (no bloquea si falla)
      if (isConfigured() && lote.agricultor) {
        try {
          const nft = await emitirCertificadoOnChain({
            loteId,
            agricultorAddress: lote.agricultor.walletAddress ?? "",
            numeroCertificado,
            tipo,
            diasVigencia,
            ipfsUri,
          });
          await updateCertificadoNft(certificado.id, {
            nftTokenId: String(nft.tokenId),
            txEmision:  nft.txHash,
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
