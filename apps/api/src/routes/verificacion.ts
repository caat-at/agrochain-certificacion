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
            latitud: true,
            longitud: true,
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
            hashVerificado: true,
          },
        },
        campanas: {
          where: { estado: "CERRADA" },
          select: { id: true, nombre: true, campanaHash: true, txHash: true, fechaCierre: true },
          orderBy: { fechaCierre: "desc" },
        },
        inspecciones: {
          where: { estado: "COMPLETADA" },
          orderBy: { fechaRealizada: "desc" },
          take: 1,
          select: {
            resultado: true,
            puntaje: true,
            hallazgosCriticos: true,
            hallazgosMayores: true,
            hallazgosMenores: true,
            observaciones: true,
            reporteHash: true,
            txHash: true,
            fechaRealizada: true,
            inspector: { select: { nombres: true, apellidos: true } },
          },
        },
        certificado: {
          select: {
            numeroCertificado: true,
            tipo: true,
            fechaEmision: true,
            fechaVencimiento: true,
            revocado: true,
            nftTokenId: true,
            txEmision: true,
            ipfsUri: true,
            aprobadoPor: { select: { nombres: true, apellidos: true } },
          },
        },
      },
    });

    if (!lote) {
      return reply.status(404).send({
        message: "Lote no encontrado. Verifique el codigo.",
      });
    }

    const red = REDES_POLYGON.AMOY;
    const cert = lote.certificado;
    const insp = lote.inspecciones[0] ?? null;

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
            inspector:         insp.inspector
              ? `${insp.inspector.nombres} ${insp.inspector.apellidos}`
              : null,
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
            aprobadoPor:       cert.aprobadoPor
              ? `${cert.aprobadoPor.nombres} ${cert.aprobadoPor.apellidos}`
              : null,
          }
        : null,
    };
  });
}
