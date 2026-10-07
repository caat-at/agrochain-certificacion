import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  listCertificadosConLote,
  getCertificadoByNumero,
  createCertificado,
  updateCertificadoNft,
  getLoteParaCertificacion,
  updateLoteEstado,
  getDeclaracionVigentePorParcela,
  crearCertificadoEudrRequisito,
  calcularPuntajeStbnLote,
  getInspeccionVigentePorLoteYTipo,
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
      // la PARCELA del lote (area fisica de produccion) debe tener una
      // declaracion EUDR firmada/anclada declarando libre_deforestacion=true.
      // Sin esto, es imposible superar el pilar de 40/100 puntos del estandar
      // (trazabilidad EUDR) — ver 15_eudr_via_parcela.sql.
      let declaracionEudr: Awaited<ReturnType<typeof getDeclaracionVigentePorParcela>> = null;
      if (tipo === "STBN") {
        declaracionEudr = await getDeclaracionVigentePorParcela(lote.parcelaId);
        const cumpleEudr =
          !!declaracionEudr &&
          (declaracionEudr.estado === "FIRMADA" || declaracionEudr.estado === "ANCLADA_BLOCKCHAIN") &&
          declaracionEudr.libreDeforestacion === true;

        if (!cumpleEudr) {
          return reply.status(400).send({
            message:
              "No se puede emitir certificado STBN sin una declaración EUDR firmada que confirme libre_deforestacion=true. " +
              "Completa el flujo en /api/eudr/parcelas/:parcelaId antes de emitir.",
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

      // Requisito para INVIMA_INOCUIDAD: exige una inspeccion tipo_inspeccion
      // 'INVIMA' aprobada (o con observaciones) para este lote — mismo nivel
      // de rigor que el bloqueo EUDR/STBN de arriba, antes este tipo de
      // certificado no exigia ninguna inspeccion previa.
      if (tipo === "INVIMA_INOCUIDAD") {
        const inspeccionInvima = await getInspeccionVigentePorLoteYTipo(loteId, "INVIMA");
        const aprobada =
          !!inspeccionInvima &&
          (inspeccionInvima.resultado === "APROBADO" || inspeccionInvima.resultado === "APROBADO_CON_OBSERVACIONES");

        if (!aprobada) {
          return reply.status(400).send({
            message:
              "No se puede emitir certificado INVIMA_INOCUIDAD sin una inspección tipo INVIMA aprobada para este lote. " +
              "Completa el flujo en /api/inspecciones antes de emitir.",
            inspeccionInvima,
          });
        }
      }

      // Requisito para BPA_ICA: exige una inspeccion BPA_CERTIFICACION (o
      // BPA_RENOVACION) aprobada. El contrato ya lo exige on-chain — sin
      // inspeccion no se llega a estado COSECHADO — pero la API validaba el
      // estado en su propia BD, que es manipulable.
      if (tipo === "BPA_ICA") {
        const inspeccionBpa =
          (await getInspeccionVigentePorLoteYTipo(loteId, "BPA_CERTIFICACION")) ??
          (await getInspeccionVigentePorLoteYTipo(loteId, "BPA_RENOVACION"));
        const aprobadaBpa =
          !!inspeccionBpa &&
          (inspeccionBpa.resultado === "APROBADO" || inspeccionBpa.resultado === "APROBADO_CON_OBSERVACIONES");

        if (!aprobadaBpa) {
          return reply.status(400).send({
            message:
              "No se puede emitir certificado BPA_ICA sin una inspeccion BPA aprobada para este lote. " +
              "Completa el flujo en /api/inspecciones antes de emitir.",
            inspeccionBpa,
          });
        }
      }

      const fechaEmision     = new Date();
      const fechaVencimiento = new Date(Date.now() + diasVigencia * 24 * 3600 * 1000);

      // El mint va ANTES de persistir. Si el NFT falla no se escribe nada y el
      // lote sigue en COSECHADO, asi el reintento es posible; con el orden
      // anterior el lote pasaba a CERTIFICADO antes del mint y quedaba un
      // estado intermedio del que no se podia salir sin tocar la BD a mano.
      let nft: { tokenId: number; txHash: string } | null = null;

      if (isConfigured() && lote.agricultor) {
        try {
          nft = await emitirCertificadoOnChain({
            loteId,
            agricultorAddress: lote.agricultor.walletAddress ?? "",
            numeroCertificado,
            tipo,
            diasVigencia,
            ipfsUri,
          });
        } catch (nftErr) {
          const motivo = nftErr instanceof Error ? nftErr.message : String(nftErr);
          return reply.status(500).send({
            message: `No se pudo emitir el NFT en Polygon: ${motivo}`,
            detalle: "No se creo ningun certificado ni cambio el estado del lote; puedes reintentar.",
          });
        }
      }

      const certificado = await createCertificado({
        loteId,
        aprobadoPorId: payload.sub,
        numeroCertificado,
        tipo,
        ipfsUri,
        fechaEmision,
        fechaVencimiento,
      });

      if (nft) {
        await updateCertificadoNft(certificado.id, {
          nftTokenId: String(nft.tokenId),
          txEmision:  nft.txHash,
        });
      }

      if (declaracionEudr) {
        await crearCertificadoEudrRequisito({
          certificadoId: certificado.id,
          declaracionId: declaracionEudr.id,
          cumpleUmbral: true,
        });
      }

      await updateLoteEstado(loteId, "CERTIFICADO");

      if (nft) {
        return reply.status(201).send({
          certificado: { ...certificado, nftTokenId: String(nft.tokenId), txEmision: nft.txHash },
          blockchain: { tokenId: nft.tokenId, txHash: nft.txHash },
        });
      }

      return reply.status(201).send({ certificado });
    }
  );
}
