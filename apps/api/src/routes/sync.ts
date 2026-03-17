import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, verificarHashEvento } from "@agrochain/database";
import type { SyncPayload, SyncResultado } from "@agrochain/shared";

const SyncPayloadSchema = z.object({
  eventoId: z.string(),
  contentHash: z.string().length(64, "Hash SHA256 debe tener 64 caracteres"),
  loteId: z.string(),
  plantaId: z.string().nullable(),
  tipoEvento: z.string(),
  descripcion: z.string().min(1),
  fechaEvento: z.string().datetime(),
  latitud: z.number().nullable(),
  longitud: z.number().nullable(),
  altitudMsnm: z.number().nullable().optional(),
  tecnicoId: z.string(),
  datosExtra: z.record(z.unknown()),
  fotoHash: z.string().nullable().optional(),
  audioHash: z.string().nullable().optional(),
});

const SyncBatchSchema = z.object({
  eventos: z.array(SyncPayloadSchema).max(50, "Maximo 50 eventos por batch"),
});

export async function syncRoutes(app: FastifyInstance) {
  /**
   * POST /api/sync/eventos
   * Recibe batch de eventos desde la app movil.
   * Verifica integridad de hash y detecta duplicados.
   */
  app.post<{ Body: { eventos: SyncPayload[] } }>("/eventos", async (request, reply) => {
    const parsed = SyncBatchSchema.safeParse(request.body);

    if (!parsed.success) {
      request.log.warn({ body: request.body, errors: parsed.error.issues }, "sync payload invalido");
      return reply.status(400).send({
        success: false,
        error: "Payload invalido",
        detalles: parsed.error.flatten(),
        issues: parsed.error.issues,
      });
    }

    const resultados: SyncResultado[] = [];

    for (const payload of parsed.data.eventos) {
      // ── 1. VERIFICAR INTEGRIDAD DEL HASH ──────────────────────────────────
      const verificacion = verificarHashEvento(
        {
          plantaId: payload.plantaId,
          loteId: payload.loteId,
          tipoEvento: payload.tipoEvento,
          fechaEvento: payload.fechaEvento,
          latitud: payload.latitud,
          longitud: payload.longitud,
          tecnicoId: payload.tecnicoId,
          descripcion: payload.descripcion,
          datosExtra: payload.datosExtra,
          fotoHash: payload.fotoHash ?? undefined,
          audioHash: payload.audioHash ?? undefined,
        },
        payload.contentHash
      );

      request.log.info({
        eventoId: payload.eventoId,
        coincide: verificacion.valido,
      }, "verificacion hash");

      if (!verificacion.valido) {
        resultados.push({
          eventoId: payload.eventoId,
          aceptado: false,
          motivo: `Integridad comprometida: ${verificacion.motivo}`,
          purgar: false,
        });
        continue;
      }

      // ── 2. VERIFICAR DUPLICADO (hash unico) ───────────────────────────────
      const existente = await db.eventoProduccion.findUnique({
        where: { contentHash: payload.contentHash },
        select: { id: true },
      });

      if (existente) {
        // Ya existe — sync duplicado (reconexion), aceptar silencioso
        resultados.push({
          eventoId: payload.eventoId,
          aceptado: true,
          motivo: "Ya sincronizado previamente",
          idServidor: existente.id,
          purgar: true, // App puede liberar archivos
        });
        continue;
      }

      // ── 3. VERIFICAR QUE LA PLANTA NO TIENE EVENTO DEL MISMO TIPO HOY ────
      if (payload.plantaId) {
        const fechaHoy = payload.fechaEvento.split("T")[0];
        const eventoHoy = await db.eventoProduccion.findFirst({
          where: {
            plantaId: payload.plantaId,
            tipoEvento: payload.tipoEvento as any,
            fechaEvento: {
              gte: new Date(`${fechaHoy}T00:00:00Z`),
              lte: new Date(`${fechaHoy}T23:59:59Z`),
            },
          },
          select: { id: true, fechaEvento: true },
        });

        if (eventoHoy) {
          resultados.push({
            eventoId: payload.eventoId,
            aceptado: false,
            motivo: `Planta ya tiene evento '${payload.tipoEvento}' registrado el ${fechaHoy}`,
            purgar: false,
          });
          continue;
        }
      }

      // ── 4. GUARDAR EN TURSO ───────────────────────────────────────────────
      try {
        const nuevo = await db.eventoProduccion.create({
          data: {
            loteId: payload.loteId,
            plantaId: payload.plantaId,
            creadoPor: payload.tecnicoId,
            tipoEvento: payload.tipoEvento as any,
            descripcion: payload.descripcion,
            fechaEvento: new Date(payload.fechaEvento),
            latitud: payload.latitud,
            longitud: payload.longitud,
            contentHash: payload.contentHash,
            hashVerificado: true,
            syncEstado: "VERIFICADO",
          },
        });

        resultados.push({
          eventoId: payload.eventoId,
          aceptado: true,
          idServidor: nuevo.id,
          purgar: true, // App puede borrar fotos originales, quedan en IPFS
        });
      } catch (err) {
        resultados.push({
          eventoId: payload.eventoId,
          aceptado: false,
          motivo: "Error interno al guardar",
          purgar: false,
        });
      }
    }

    const aceptados = resultados.filter((r) => r.aceptado).length;
    const rechazados = resultados.filter((r) => !r.aceptado).length;

    return reply.send({
      success: true,
      resumen: { total: resultados.length, aceptados, rechazados },
      resultados,
    });
  });
}
