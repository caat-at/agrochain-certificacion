import type { FastifyInstance } from "fastify";
import { getLoteParaVerificacionPublica } from "@agrochain/database";
import { REDES_POLYGON } from "@agrochain/shared";

export async function verificacionRoutes(app: FastifyInstance) {
  /**
   * GET /api/verificar/:codigoLote
   * Ruta publica — sin autenticacion.
   * Consumidor escanea QR y obtiene trazabilidad completa.
   */
  app.get<{ Params: { codigoLote: string } }>("/:codigoLote", async (request, reply) => {
    const lote = await getLoteParaVerificacionPublica(request.params.codigoLote);

    if (!lote) {
      return reply.status(404).send({
        message: "Lote no encontrado. Verifique el codigo.",
      });
    }

    const red = REDES_POLYGON.AMOY;
    const cert = lote.certificado;
    const insp = lote.inspeccion;

    return {
      codigoLote: lote.codigoLote,
      especie:    lote.especie,
      variedad:   lote.variedad,
      estado:     lote.estado,
      dataHash:   lote.dataHash,
      predio: {
        nombre:       lote.predio.nombrePredio,
        departamento: lote.predio.departamento,
        municipio:    lote.predio.municipio,
        latitud:      lote.predio.latitud,
        longitud:     lote.predio.longitud,
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
      campanas: lote.campanas.map((c) => ({
        nombre:      c.nombre,
        campanaHash: c.campanaHash,
        txHash:      c.txHash,
        fechaCierre: c.fechaCierre,
      })),
      inspeccion: insp
        ? {
            resultado:         insp.resultado,
            puntajeBpa:        insp.puntaje,
            hallazgosCriticos: insp.hallazgosCriticos,
            hallazgosMayores:  insp.hallazgosMayores,
            hallazgosMenores:  insp.hallazgosMenores,
            observaciones:     insp.observaciones,
            reporteHash:       insp.reporteHash,
            txHash:            insp.txHash,
            fechaRealizada:    insp.fechaRealizada,
            inspector:         `${insp.inspectorNombres} ${insp.inspectorApellidos}`,
          }
        : null,
      blockchain: {
        registrado:  !!lote.dataHash,
        loteIdHash:  lote.dataHash,
        txRegistro:  lote.txRegistro ?? null,
        explorerUrl: lote.txRegistro
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
            txEmision:         cert.txEmision ?? null,
            ipfsUri:           cert.ipfsUri ?? null,
            aprobadoPor:       cert.aprobadoPorNombres
              ? `${cert.aprobadoPorNombres} ${cert.aprobadoPorApellidos}`
              : null,
          }
        : null,
    };
  });
}
