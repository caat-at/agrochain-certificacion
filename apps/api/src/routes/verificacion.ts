import type { FastifyInstance } from "fastify";
import { db } from "@agrochain/database";
import { REDES_POLYGON } from "@agrochain/shared";

export async function verificacionRoutes(app: FastifyInstance) {
  /**
   * GET /api/verificar/:codigoLote
   * Ruta publica — sin autenticacion.
   * Consumidor escanea QR y obtiene trazabilidad completa.
   */
  app.get<{ Params: { codigoLote: string } }>("/:codigoLote", async (request, reply) => {
    const lote = await db.lote.findUnique({
      where: { codigoLote: request.params.codigoLote },
      include: {
        predio: {
          select: {
            nombrePredio: true,
            departamento: true,
            municipio: true,
            vereda: true,
            latitud: true,
            longitud: true,
            altitudMsnm: true,
          },
        },
        agricultor: {
          select: { nombres: true, apellidos: true },
        },
        eventos: {
          where: { hashVerificado: true },
          orderBy: { fechaEvento: "asc" },
          select: {
            tipoEvento: true,
            descripcion: true,
            fechaEvento: true,
            contentHash: true,
            hashVerificado: true,
            latitud: true,
            longitud: true,
          },
        },
        certificado: true,
      },
    });

    if (!lote) {
      return reply.status(404).send({
        message: "Lote no encontrado. Verifique el codigo.",
      });
    }

    const red = REDES_POLYGON.AMOY;
    const cert = lote.certificado;

    return {
      codigoLote: lote.codigoLote,
      especie:    lote.especie,
      variedad:   lote.variedad,
      estado:     lote.estado,
      predio: {
        nombre:      lote.predio.nombrePredio,
        departamento: lote.predio.departamento,
        municipio:   lote.predio.municipio,
        latitud:     lote.predio.latitud,
        longitud:    lote.predio.longitud,
      },
      agricultor: {
        nombre: `${lote.agricultor.nombres} ${lote.agricultor.apellidos}`,
      },
      totalEventos: lote.eventos.length,
      eventos: lote.eventos.map((e) => ({
        tipoEvento:     e.tipoEvento,
        descripcion:    e.descripcion,
        fechaEvento:    e.fechaEvento,
        hashVerificado: e.hashVerificado,
      })),
      blockchain: {
        registrado:    !!lote.dataHash,
        loteIdHash:    lote.dataHash,
        txHash:        lote.txRegistro ?? null,
        explorerUrl:   lote.txRegistro
          ? `${red.explorerUrl}/tx/${lote.txRegistro}`
          : null,
      },
      certificado: cert
        ? {
            numeroCertificado: cert.numeroCertificado,
            tipo:              cert.tipo,
            fechaEmision:      cert.fechaEmision,
            fechaVencimiento:  cert.fechaVencimiento,
            valido:            !cert.revocado && new Date(cert.fechaVencimiento) > new Date(),
            tokenId:           cert.nftTokenId ? Number(cert.nftTokenId) : null,
          }
        : null,
    };
  });
}
