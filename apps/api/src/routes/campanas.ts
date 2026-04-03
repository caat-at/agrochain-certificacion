import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  db,
  generarContentHashAporte,
  generarContentHashRegistro,
  generarHashCampana,
  verificarCamposCompletos,
} from "@agrochain/database";
import { registrarEventoOnChain, isConfigured } from "../services/blockchain.js";

// ─── Schemas de validación ────────────────────────────────────────────────────

const CrearCampanaSchema = z.object({
  loteId:           z.string(),
  nombre:           z.string().min(1),
  codigo:           z.string().min(2).max(20).regex(/^[A-Z0-9\-_]+$/, "Solo mayúsculas, números, guiones").optional(),
  descripcion:      z.string().optional(),
  camposRequeridos: z.array(z.string()).min(1),
});

const CambiarEstadoSchema = z.object({
  estado:       z.enum(["ACTIVA", "ABIERTA", "CERRADA"]),
  motivoCierre: z.string().optional(), // requerido si estado=CERRADA con advertencia
  forzar:       z.boolean().optional().default(false), // cierre manual aunque haya incompletos
});

const AsignarTecnicoSchema = z.object({
  posicion:       z.number().int().min(1).max(4),
  tecnicoId:      z.string(),
  camposAsignados: z.array(z.string()).min(1),
});

const AporteTecnicoSchema = z.object({
  campos:           z.record(z.unknown()),
  fotoHash:         z.string().optional(),
  audioHash:        z.string().optional(),
  latitud:          z.number().optional(),
  longitud:         z.number().optional(),
  contentHash:      z.string(), // generado en la app móvil
  fechaAporte:      z.string().optional(), // ISO timestamp del momento de captura en la app
  // Solo para ADMIN — permite registrar en nombre de un técnico específico
  tecnicoIdOverride: z.string().optional(),
  posicionOverride:  z.number().int().min(1).max(4).optional(),
});

// ─── Helper: verificar cierre automático de campaña ──────────────────────────

async function intentarCierreAutomatico(campanaId: string): Promise<boolean> {
  const campana = await db.campana.findUnique({
    where: { id: campanaId },
    include: {
      registros: true,
      lote: { select: { plantas: { select: { id: true } } } },
    },
  });
  if (!campana || campana.estado !== "ABIERTA") return false;

  const totalPlantas = campana.lote.plantas.length;
  if (totalPlantas === 0) return false;

  // Registros activos (no INVALIDADOS)
  const activos = campana.registros.filter((r) => r.estado !== "INVALIDADO");
  const completos = activos.filter((r) => r.estado === "COMPLETO");

  // Cierre automático solo si TODAS las plantas tienen registro COMPLETO
  if (completos.length !== totalPlantas) return false;
  if (activos.some((r) => r.estado !== "COMPLETO")) return false;

  // Generar hash final de la campaña
  const campanaHash = generarHashCampana({
    campanaId,
    registros: completos.map((r) => ({
      plantaId:    r.plantaId,
      contentHash: r.contentHash!,
    })),
  });

  await db.campana.update({
    where: { id: campanaId },
    data: {
      estado:      "CERRADA",
      campanaHash,
      fechaCierre: new Date(),
    },
  });

  // Intentar registrar on-chain (no bloquea)
  if (isConfigured() && campana.loteId) {
    try {
      const result = await registrarEventoOnChain(campana.loteId, `CAMPANA_CERRADA:${campanaId}`, campanaHash);
      await db.campana.update({ where: { id: campanaId }, data: { txHash: result.txHash } });
    } catch { /* off-chain si blockchain no disponible */ }
  }

  return true;
}

// ─── Rutas ────────────────────────────────────────────────────────────────────

export async function campanasRoutes(app: FastifyInstance) {

  // ── GET /api/campanas?loteId=xxx ─────────────────────────────────────────
  app.get("/", { preHandler: [(app as any).authenticate] }, async (request) => {
    const { loteId } = request.query as { loteId?: string };
    const where = loteId ? { loteId } : {};
    const campanas = await db.campana.findMany({
      where,
      include: {
        lote:     { select: { codigoLote: true, especie: true, variedad: true } },
        creador:  { select: { nombres: true, apellidos: true } },
        cerrador: { select: { nombres: true, apellidos: true } },
        tecnicos: {
          include: { tecnico: { select: { id: true, nombres: true, apellidos: true } } },
          orderBy: { posicion: "asc" },
        },
        _count:   { select: { registros: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return { campanas };
  });

  // ── POST /api/campanas ───────────────────────────────────────────────────
  app.post("/", { preHandler: [(app as any).authenticate] }, async (request, reply) => {
    const payload = (request as any).user as { sub: string; rol: string };

    if (!["ADMIN"].includes(payload.rol)) {
      return reply.status(403).send({ message: "Solo el ADMIN puede crear campañas" });
    }

    const body = CrearCampanaSchema.parse(request.body);

    const lote = await db.lote.findUnique({ where: { id: body.loteId } });
    if (!lote) return reply.status(404).send({ message: "Lote no encontrado" });

    // No puede haber una campaña ACTIVA o ABIERTA para el mismo lote
    const activa = await db.campana.findFirst({
      where: { loteId: body.loteId, estado: { in: ["ACTIVA", "ABIERTA"] } },
    });
    if (activa) {
      return reply.status(409).send({
        message: `Ya existe una campaña ${activa.estado} para este lote.`,
        campanaId: activa.id,
      });
    }

    // Verificar unicidad del código si se provee
    if (body.codigo) {
      const codigoExiste = await db.campana.findFirst({ where: { codigo: body.codigo } });
      if (codigoExiste) {
        return reply.status(409).send({ message: `El código "${body.codigo}" ya está en uso por otra campaña.` });
      }
    }

    const campana = await db.campana.create({
      data: {
        loteId:           body.loteId,
        nombre:           body.nombre,
        codigo:           body.codigo ?? null,
        descripcion:      body.descripcion,
        camposRequeridos: JSON.stringify(body.camposRequeridos),
        estado:           "ACTIVA",
        creadaPor:        payload.sub,
      },
    });

    return reply.status(201).send({ success: true, campana });
  });

  // ── GET /api/campanas/:id ────────────────────────────────────────────────
  app.get("/:id", { preHandler: [(app as any).authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campana = await db.campana.findUnique({
      where: { id },
      include: {
        lote:     { select: { codigoLote: true, especie: true, variedad: true, txRegistro: true } },
        creador:  { select: { nombres: true, apellidos: true } },
        cerrador: { select: { nombres: true, apellidos: true } },
        tecnicos: {
          include: { tecnico: { select: { id: true, nombres: true, apellidos: true } } },
          orderBy: { posicion: "asc" },
        },
        registros: {
          include: {
            planta:  { select: { codigoPlanta: true, numeroPlanta: true, latitud: true, longitud: true } },
            aportes: {
              include: { tecnico: { select: { nombres: true, apellidos: true, rol: true } } },
              orderBy: { posicion: "asc" },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!campana) return reply.status(404).send({ message: "Campaña no encontrada" });

    const camposRequeridos: string[] = JSON.parse(campana.camposRequeridos);
    const registros   = campana.registros;
    // Excluir INVALIDADO del conteo de progreso (son registros anulados)
    const activos     = registros.filter((r) => r.estado !== "INVALIDADO");
    const total       = activos.length;
    const completos   = activos.filter((r) => r.estado === "COMPLETO").length;
    const adulterados = activos.filter((r) => r.estado === "ADULTERADO").length;
    const pendientes  = activos.filter((r) => ["PENDIENTE", "PARCIAL"].includes(r.estado)).length;

    return {
      campana: {
        ...campana,
        camposRequeridos,
        progreso: { total, completos, adulterados, pendientes },
      },
    };
  });

  // ── PUT /api/campanas/:id/estado ─────────────────────────────────────────
  // ADMIN cambia estado: ACTIVA → ABIERTA o cierre manual ABIERTA → CERRADA
  app.put("/:id/estado", { preHandler: [(app as any).authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const payload = (request as any).user as { sub: string; rol: string };

    if (payload.rol !== "ADMIN") {
      return reply.status(403).send({ message: "Solo el ADMIN puede cambiar el estado de la campaña" });
    }

    const body = CambiarEstadoSchema.parse(request.body);

    const campana = await db.campana.findUnique({
      where: { id },
      include: {
        registros: { where: { estado: { not: "INVALIDADO" } } },
        lote: { select: { plantas: { select: { id: true } } } },
      },
    });
    if (!campana) return reply.status(404).send({ message: "Campaña no encontrada" });

    // Validar transiciones permitidas
    const transicionesValidas: Record<string, string[]> = {
      ACTIVA:  ["ABIERTA"],
      ABIERTA: ["CERRADA"],
      CERRADA: [],
    };
    if (!transicionesValidas[campana.estado]?.includes(body.estado)) {
      return reply.status(409).send({
        message: `No se puede cambiar de ${campana.estado} a ${body.estado}`,
      });
    }

    // Si abre la campaña: verificar que tenga los 4 técnicos asignados
    if (body.estado === "ABIERTA") {
      const tecnicos = await db.campanaTecnico.count({ where: { campanaId: id } });
      if (tecnicos < 4) {
        return reply.status(409).send({
          message: `Debe asignar los 4 técnicos antes de abrir la campaña. Actualmente: ${tecnicos}/4`,
        });
      }
      await db.campana.update({ where: { id }, data: { estado: "ABIERTA" } });
      return { success: true, estado: "ABIERTA" };
    }

    // Cierre manual: calcular resumen
    const totalPlantas = campana.lote.plantas.length;
    const activos = campana.registros.filter((r) => r.estado !== "INVALIDADO");
    const completos = activos.filter((r) => r.estado === "COMPLETO");
    const parciales = activos.filter((r) => r.estado === "PARCIAL");
    const sinRegistro = totalPlantas - activos.length;
    const adulterados = activos.filter((r) => r.estado === "ADULTERADO");

    const hayIncompletos = completos.length < totalPlantas || adulterados.length > 0;

    // Si hay incompletos y no se fuerza → retornar resumen para confirmación
    if (hayIncompletos && !body.forzar) {
      return reply.status(200).send({
        requiereConfirmacion: true,
        resumen: {
          totalPlantas,
          completos:    completos.length,
          parciales:    parciales.length,
          sinRegistro,
          adulterados:  adulterados.length,
        },
        mensaje: "Hay registros incompletos. Envía forzar=true y motivoCierre para confirmar.",
      });
    }

    // Cierre manual forzado o sin incompletos
    const campanaHash = generarHashCampana({
      campanaId: id,
      registros: completos.map((r) => ({ plantaId: r.plantaId, contentHash: r.contentHash! })),
    });

    const campanaCerrada = await db.campana.update({
      where: { id },
      data: {
        estado:              "CERRADA",
        campanaHash,
        cerradaPor:          payload.sub,
        fechaCierre:         new Date(),
        cierreConAdvertencia: hayIncompletos,
        motivoCierre:        body.motivoCierre,
      },
    });

    // Intentar on-chain
    let txCampana: string | undefined;
    if (isConfigured() && campana.loteId) {
      try {
        const result = await registrarEventoOnChain(campana.loteId, `CAMPANA_CERRADA:${id}`, campanaHash);
        txCampana = result.txHash;
        await db.campana.update({ where: { id }, data: { txHash: txCampana } });
      } catch { /* off-chain */ }
    }

    return {
      success: true,
      campanaHash,
      txCampana,
      cierreConAdvertencia: hayIncompletos,
      resumen: {
        totalPlantas,
        completos:   completos.length,
        parciales:   parciales.length,
        sinRegistro,
        adulterados: adulterados.length,
      },
      campana: campanaCerrada,
    };
  });

  // ── POST /api/campanas/:id/tecnicos ──────────────────────────────────────
  // ADMIN asigna o reasigna un técnico a una posición
  app.post("/:id/tecnicos", { preHandler: [(app as any).authenticate] }, async (request, reply) => {
    const { id: campanaId } = request.params as { id: string };
    const payload = (request as any).user as { sub: string; rol: string };

    if (payload.rol !== "ADMIN") {
      return reply.status(403).send({ message: "Solo el ADMIN puede asignar técnicos" });
    }

    const body = AsignarTecnicoSchema.parse(request.body);

    const campana = await db.campana.findUnique({ where: { id: campanaId } });
    if (!campana) return reply.status(404).send({ message: "Campaña no encontrada" });
    if (campana.estado === "CERRADA") {
      return reply.status(409).send({ message: "No se pueden asignar técnicos a una campaña CERRADA" });
    }

    const tecnico = await db.usuario.findUnique({ where: { id: body.tecnicoId } });
    if (!tecnico) return reply.status(404).send({ message: "Técnico no encontrado" });
    if (tecnico.rol !== "TECNICO") {
      return reply.status(400).send({ message: "El usuario debe tener rol TECNICO" });
    }

    const asignacion = await db.campanaTecnico.upsert({
      where: { campanaId_posicion: { campanaId, posicion: body.posicion } },
      update: {
        tecnicoId:      body.tecnicoId,
        camposAsignados: JSON.stringify(body.camposAsignados),
      },
      create: {
        campanaId,
        posicion:       body.posicion,
        tecnicoId:      body.tecnicoId,
        camposAsignados: JSON.stringify(body.camposAsignados),
      },
      include: { tecnico: { select: { nombres: true, apellidos: true } } },
    });

    return reply.status(201).send({ success: true, asignacion });
  });

  // ── GET /api/campanas/:id/tecnicos ───────────────────────────────────────
  app.get("/:id/tecnicos", { preHandler: [(app as any).authenticate] }, async (request, reply) => {
    const { id: campanaId } = request.params as { id: string };
    const tecnicos = await db.campanaTecnico.findMany({
      where: { campanaId },
      include: { tecnico: { select: { id: true, nombres: true, apellidos: true, email: true } } },
      orderBy: { posicion: "asc" },
    });
    return { tecnicos: tecnicos.map((t) => ({
      ...t,
      camposAsignados: JSON.parse(t.camposAsignados),
    })) };
  });

  // ── POST /api/campanas/:id/registros/:plantaId/aportes ───────────────────
  // Técnico envía su aporte — solo los campos de su posición asignada
  app.post(
    "/:id/registros/:plantaId/aportes",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const { id: campanaId, plantaId } = request.params as { id: string; plantaId: string };
      const payload = (request as any).user as { sub: string; rol: string };

      if (!request.body || typeof request.body !== "object") {
        request.log.warn({ body: request.body, headers: request.headers }, "POST aporte — body vacío o no-objeto");
        return reply.status(400).send({ message: "Body vacío o inválido. Asegúrate de enviar Content-Type: application/json" });
      }

      const parseResult = AporteTecnicoSchema.safeParse(request.body);
      if (!parseResult.success) {
        const errMsg = parseResult.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
        return reply.status(400).send({ message: `Datos inválidos: ${errMsg}` });
      }
      const body = parseResult.data;

      // 1. Verificar campaña ABIERTA
      const campana = await db.campana.findUnique({
        where: { id: campanaId },
        include: { tecnicos: true },
      });
      if (!campana) return reply.status(404).send({ message: "Campaña no encontrada" });
      if (campana.estado !== "ABIERTA") {
        return reply.status(409).send({ message: `La campaña está ${campana.estado}. No se pueden agregar aportes.` });
      }

      // 2. Verificar que el técnico tiene posición asignada en esta campaña
      // ADMIN puede especificar tecnicoIdOverride + posicionOverride para registrar en nombre de un técnico
      const tecnicoEfectivo = (payload.rol === "ADMIN" && body.tecnicoIdOverride)
        ? body.tecnicoIdOverride
        : payload.sub;
      const asignacion = campana.tecnicos.find((t) => t.tecnicoId === tecnicoEfectivo);
      if (!asignacion && payload.rol !== "ADMIN") {
        return reply.status(403).send({ message: "No tienes posición asignada en esta campaña" });
      }
      if (!asignacion && payload.rol === "ADMIN" && !body.posicionOverride) {
        return reply.status(400).send({ message: "El técnico no tiene posición asignada. Especifica posicionOverride." });
      }
      const posicion = (payload.rol === "ADMIN" && body.posicionOverride)
        ? body.posicionOverride
        : (asignacion?.posicion ?? 0);

      // 3. Verificar planta pertenece al lote
      const planta = await db.planta.findFirst({
        where: { id: plantaId, loteId: campana.loteId },
      });
      if (!planta) return reply.status(404).send({ message: "Planta no encontrada en este lote" });

      // 4. Obtener o crear RegistroPlanta (solo registros activos, no INVALIDADOS)
      let registro = await db.registroPlanta.findFirst({
        where: { campanaId, plantaId, estado: { not: "INVALIDADO" } },
        include: { aportes: true },
      });

      const esElPrimero = !registro;

      if (!registro) {
        // Calcular consecutivo: MAX(consecutivo) + 1 para evitar colisiones si se borran registros
        const maxConsec = await db.registroPlanta.aggregate({
          _max: { consecutivo: true },
          where: { campanaId },
        });
        const consecutivo = (maxConsec._max.consecutivo ?? 0) + 1;

        registro = await db.registroPlanta.create({
          data: {
            campanaId,
            plantaId,
            consecutivo,
            fechaEvento: new Date(), // capturado automáticamente al primer aporte
          },
          include: { aportes: true },
        });
      }

      // 5. Verificar estado del registro
      if (registro.estado === "COMPLETO") {
        return reply.status(409).send({ message: "Este registro ya está COMPLETO." });
      }
      if (registro.estado === "ADULTERADO") {
        return reply.status(409).send({ message: "Registro ADULTERADO. El ADMIN debe crear un nuevo registro." });
      }

      // 6. Verificar que este técnico no ya haya aportado en este registro
      const aporteExistente = registro.aportes.find((a) => a.tecnicoId === tecnicoEfectivo);
      if (aporteExistente) {
        return reply.status(409).send({ message: "Ya registraste tu aporte para esta planta en esta campaña." });
      }

      // 7. Verificar contentHash del aporte (recalcular en servidor)
      // Usar la fechaAporte enviada por la app (la misma que se usó al calcular el hash)
      const fechaAporte = body.fechaAporte ?? new Date().toISOString();
      const contentHashEsperado = generarContentHashAporte({
        plantaId,
        campanaId,
        tecnicoId:   tecnicoEfectivo,
        posicion,
        campos:      body.campos as Record<string, unknown>,
        fotoHash:    body.fotoHash ?? null,
        audioHash:   body.audioHash ?? null,
        latitud:     body.latitud ?? null,
        longitud:    body.longitud ?? null,
        fechaAporte,
      });

      const contentHashFinal = body.contentHash;
      const hashVerificado = contentHashEsperado === contentHashFinal;

      // 8. Guardar aporte
      await db.aporteTecnico.create({
        data: {
          registroPlantaId: registro.id,
          campanaId,
          tecnicoId:   tecnicoEfectivo,
          posicion,
          campos:      JSON.stringify(body.campos),
          fotoHash:    body.fotoHash ?? null,
          audioHash:   body.audioHash ?? null,
          contentHash: contentHashFinal,
          hashVerificado,
          hashRechazMotivo: hashVerificado ? null : "contentHash no coincide al recibir",
          latitud:     body.latitud ?? null,
          longitud:    body.longitud ?? null,
          fechaAporte: new Date(fechaAporte),
          syncEstado:  "SINCRONIZADO",
        },
      });

      // 9. Verificar si el registro está ahora COMPLETO
      const todosLosAportes = await db.aporteTecnico.findMany({
        where: { registroPlantaId: registro.id },
      });

      const camposRequeridos: string[] = JSON.parse(campana.camposRequeridos);
      const aportesConCampos = todosLosAportes.map((a) => ({
        campos:    JSON.parse(a.campos as string) as Record<string, unknown>,
        fotoHash:  a.fotoHash,
        audioHash: a.audioHash,
      }));
      const { completo, faltantes } = verificarCamposCompletos(camposRequeridos, aportesConCampos);

      let nuevoEstado: "PARCIAL" | "COMPLETO" = "PARCIAL";
      let contentHashRegistro: string | undefined;

      if (completo) {
        // Hash final del registro = SHA256 de todos los contentHash ordenados por posición
        const aportesPorPosicion = [...todosLosAportes].sort((a, b) => a.posicion - b.posicion);
        const firmasPorCampo = aportesPorPosicion.map((a) => ({
          campo: `posicion_${a.posicion}`,
          firma: a.contentHash,
        }));
        contentHashRegistro = generarContentHashRegistro({
          firmasAportes: firmasPorCampo,
          plantaId,
          campanaId,
        });
        nuevoEstado = "COMPLETO";
      }

      await db.registroPlanta.update({
        where: { id: registro.id },
        data: {
          estado:      nuevoEstado,
          contentHash: contentHashRegistro ?? undefined,
        },
      });

      // 10. Si el registro quedó COMPLETO → intentar cierre automático de campaña
      let campanaAutoCerrada = false;
      if (completo) {
        campanaAutoCerrada = await intentarCierreAutomatico(campanaId);
      }

      return reply.status(201).send({
        success: true,
        estado:       nuevoEstado,
        consecutivo:  registro.consecutivo,
        codigoCampana: campana.codigo ?? null,
        faltantes:    faltantes.length > 0 ? faltantes : undefined,
        contentHash:  contentHashRegistro,
        campanaAutoCerrada,
        mensaje: completo
          ? campanaAutoCerrada
            ? "Registro COMPLETO. Campaña cerrada automáticamente."
            : "Registro COMPLETO."
          : `Aporte guardado. Campos faltantes: ${faltantes.join(", ")}`,
      });
    }
  );

  // ── POST /api/campanas/:id/registros/:plantaId/reregistrar ────────────────
  // ADMIN crea nuevo registro para una planta con registro ADULTERADO
  app.post(
    "/:id/registros/:plantaId/reregistrar",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const { id: campanaId, plantaId } = request.params as { id: string; plantaId: string };
      const payload = (request as any).user as { sub: string; rol: string };

      if (payload.rol !== "ADMIN") {
        return reply.status(403).send({ message: "Solo el ADMIN puede crear un reregistro" });
      }

      const registroAdulterado = await db.registroPlanta.findFirst({
        where: { campanaId, plantaId, estado: "ADULTERADO" },
      });
      if (!registroAdulterado) {
        return reply.status(404).send({ message: "No hay registro ADULTERADO para esta planta en esta campaña" });
      }

      // Marcar el adulterado como INVALIDADO (queda en auditoría)
      await db.registroPlanta.update({
        where: { id: registroAdulterado.id },
        data: {
          estado:                "INVALIDADO",
          adulteradoDetectadoEn: registroAdulterado.adulteradoDetectadoEn ?? new Date(),
        },
      });

      // Crear nuevo registro vacío — los 4 técnicos deben volver a registrar
      const nuevoRegistro = await db.registroPlanta.create({
        data: {
          campanaId,
          plantaId,
          fechaEvento: new Date(),
        },
      });

      // Enlazar el registro invalidado con el nuevo
      await db.registroPlanta.update({
        where: { id: registroAdulterado.id },
        data: { registroReemplazanteId: nuevoRegistro.id },
      });

      return reply.status(201).send({
        success: true,
        mensaje: "Registro adulterado invalidado. Nuevo registro creado. Los 4 técnicos deben volver a registrar.",
        registroInvalidadoId: registroAdulterado.id,
        nuevoRegistroId:      nuevoRegistro.id,
      });
    }
  );

  // ── GET /api/campanas/movil/lote/:loteId ─────────────────────────────────
  // App móvil: devuelve campaña ABIERTA del lote + campos asignados al técnico autenticado
  app.get(
    "/movil/lote/:loteId",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const { loteId } = request.params as { loteId: string };
      const payload = (request as any).user as { sub: string; rol: string };

      const campana = await db.campana.findFirst({
        where: { loteId, estado: { in: ["ACTIVA", "ABIERTA"] } },
        include: {
          lote:    { select: { codigoLote: true, especie: true, variedad: true } },
          creador: { select: { nombres: true, apellidos: true } },
          tecnicos: true,
          registros: {
            where: { estado: { not: "INVALIDADO" } },
            include: {
              planta: {
                select: {
                  id: true, codigoPlanta: true, numeroPlanta: true,
                  latitud: true, longitud: true, especie: true, variedad: true,
                },
              },
              aportes: {
                select: {
                  id: true, tecnicoId: true, posicion: true, campos: true,
                  fotoHash: true, audioHash: true,
                  fechaAporte: true, latitud: true, longitud: true, contentHash: true,
                },
              },
            },
          },
        },
      });

      if (!campana) {
        return reply.status(404).send({ message: "No hay campaña activa para este lote" });
      }

      // Si la campaña está ACTIVA (no ABIERTA), retornar info básica sin plantas
      if (campana.estado === "ACTIVA") {
        return reply.status(200).send({
          campana: {
            id:              campana.id,
            nombre:          campana.nombre,
            codigo:          campana.codigo ?? null,
            descripcion:     campana.descripcion,
            loteId,
            lote:            campana.lote,
            camposRequeridos: JSON.parse(campana.camposRequeridos),
            creador:         campana.creador,
            fechaApertura:   campana.fechaApertura,
            estado:          "ACTIVA",
          },
          estado:      "ACTIVA",
          miPosicion:  null,
          misCampos:   [],
          plantas:     [],
          progreso:    { total: 0, completos: 0, pendientes: 0 },
        });
      }

      // Buscar posición asignada al técnico autenticado
      const asignacion = campana.tecnicos.find((t) => t.tecnicoId === payload.sub);
      const camposAsignados: string[] = asignacion
        ? JSON.parse(asignacion.camposAsignados)
        : [];
      const posicionTecnico = asignacion?.posicion ?? null;

      // Obtener todas las plantas del lote
      const todasLasPlantas = await db.planta.findMany({
        where: { loteId, activo: true },
        select: {
          id: true, codigoPlanta: true, numeroPlanta: true,
          latitud: true, longitud: true, especie: true, variedad: true,
        },
        orderBy: { numeroPlanta: "asc" },
      });

      const camposRequeridos: string[] = JSON.parse(campana.camposRequeridos);

      // Construir respuesta con estado por planta
      const plantas = todasLasPlantas.map((planta) => {
        const registro = campana.registros.find((r) => r.plantaId === planta.id);
        const camposIngresados: string[] = [];

        if (registro) {
          for (const aporte of registro.aportes) {
            const camposAporte = Object.keys(JSON.parse(aporte.campos as string));
            camposIngresados.push(...camposAporte);
            // foto y audio se guardan en columnas separadas
            if (aporte.fotoHash)  camposIngresados.push("foto");
            if (aporte.audioHash) camposIngresados.push("audio");
          }
        }

        const faltantes = camposRequeridos.filter((c) => !camposIngresados.includes(c));

        // ¿Ya aportó este técnico en esta planta?
        const yaAporte = registro?.aportes.some((a) => a.tecnicoId === payload.sub) ?? false;

        // Campos faltantes específicos del técnico autenticado (excluyendo foto/audio)
        const camposDatosTecnico = camposAsignados.filter((c) => c !== "foto" && c !== "audio");
        const misCamposFaltantes = camposDatosTecnico.filter((c) => !camposIngresados.includes(c));

        return {
          ...planta,
          registroId:      registro?.id ?? null,
          consecutivo:     registro?.consecutivo ?? null,
          estadoRegistro:  registro?.estado ?? "SIN_REGISTRO",
          camposIngresados,
          camposFaltantes: misCamposFaltantes, // Solo los campos del técnico autenticado
          completo:        faltantes.length === 0,
          yaTecnicoAporto: yaAporte,
        };
      });

      return {
        campana: {
          id:              campana.id,
          nombre:          campana.nombre,
          codigo:          campana.codigo ?? null,
          descripcion:     campana.descripcion,
          loteId,
          lote:            campana.lote,
          camposRequeridos,
          creador:         campana.creador,
          fechaApertura:   campana.fechaApertura,
        },
        // Información de la posición del técnico autenticado
        miPosicion:      posicionTecnico,
        misCampos:       camposAsignados,
        plantas,
        progreso: {
          total:      plantas.length,
          completos:  plantas.filter((p) => p.completo).length,
          pendientes: plantas.filter((p) => !p.completo).length,
        },
      };
    }
  );

  // ── GET /api/campanas/movil/planta/:plantaId/aportes ─────────────────────
  // App móvil: historial de aportes de campaña para una planta
  app.get(
    "/movil/planta/:plantaId/aportes",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const { plantaId } = request.params as { plantaId: string };

      const registros = await db.registroPlanta.findMany({
        where: { plantaId, estado: { not: "INVALIDADO" } },
        include: {
          campana: { select: { id: true, nombre: true, codigo: true } },
          aportes: {
            select: {
              id: true,
              tecnicoId: true,
              posicion: true,
              campos: true,
              fotoHash: true,
              audioHash: true,
              fechaAporte: true,
              latitud: true,
              longitud: true,
              contentHash: true,
              hashVerificado: true,
            },
            orderBy: { posicion: "asc" },
          },
        },
        orderBy: { fechaEvento: "desc" },
      });

      return reply.send({
        registros: registros.map((r) => ({
          id:            r.id,
          consecutivo:   r.consecutivo,
          estado:        r.estado,
          fechaEvento:   r.fechaEvento.toISOString(),
          campana:       r.campana,
          aportes: r.aportes.map((a) => ({
            id:             a.id,
            tecnicoId:      a.tecnicoId,
            posicion:       a.posicion,
            campos:         JSON.parse(a.campos as string),
            fotoHash:       a.fotoHash ?? null,
            audioHash:      a.audioHash ?? null,
            fechaAporte:    a.fechaAporte.toISOString(),
            latitud:        a.latitud ?? null,
            longitud:       a.longitud ?? null,
            contentHash:    a.contentHash,
            hashVerificado: a.hashVerificado,
          })),
        })),
      });
    }
  );

  // ── POST /api/campanas/:id/verificar-integridad ──────────────────────────
  // Reverifica todos los contentHash — detecta adulteraciones
  app.post(
    "/:id/verificar-integridad",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const { id: campanaId } = request.params as { id: string };
      const payload = request.user as { sub: string };

      const campana = await db.campana.findUnique({
        where: { id: campanaId },
        include: {
          registros: {
            where: { estado: { notIn: ["INVALIDADO"] } },
            include: { aportes: true },
          },
        },
      });
      if (!campana) return reply.status(404).send({ message: "Campaña no encontrada" });

      const detallesRegistro: Array<{
        registroId:    string;
        plantaId:      string;
        hashGuardado:  string;
        hashCalculado: string;
        resultado:     string;
      }> = [];

      const adulteracionesDetectadas: Array<{
        registroId: string;
        plantaId:   string;
        motivo:     string;
      }> = [];

      for (const registro of campana.registros) {
        // Solo verificar registros COMPLETOS — los demás no tienen contentHash de registro
        if (registro.estado !== "COMPLETO" && registro.estado !== "ADULTERADO") continue;
        if (!registro.contentHash) continue;

        // Recalcular el hash del registro con los aportes actuales
        const aportesPorPosicion = [...registro.aportes].sort((a, b) => a.posicion - b.posicion);
        const firmasPorCampo = aportesPorPosicion.map((a) => ({
          campo: `posicion_${a.posicion}`,
          firma: a.contentHash,
        }));
        const hashRecalculado = generarContentHashRegistro({
          firmasAportes: firmasPorCampo,
          plantaId:      registro.plantaId,
          campanaId,
        });

        const ok = hashRecalculado === registro.contentHash;

        detallesRegistro.push({
          registroId:    registro.id,
          plantaId:      registro.plantaId,
          hashGuardado:  registro.contentHash,
          hashCalculado: hashRecalculado,
          resultado:     ok ? "OK" : "FALLA",
        });

        if (!ok) {
          adulteracionesDetectadas.push({
            registroId: registro.id,
            plantaId:   registro.plantaId,
            motivo:     `Hash guardado: ${registro.contentHash} | Recalculado: ${hashRecalculado}`,
          });
          await db.registroPlanta.update({
            where: { id: registro.id },
            data: {
              estado:                 "ADULTERADO",
              adulteradoDetectadoEn:  new Date(),
              adulteradoDetectadoPor: "sistema",
            },
          });
        }
      }

      // Guardar historial de verificación
      const verificacion = await db.verificacionIntegridad.create({
        data: {
          campanaId,
          ejecutadoPorId: payload.sub,
          totalRegistros: detallesRegistro.length,
          aprobados:      detallesRegistro.filter((d) => d.resultado === "OK").length,
          adulterados:    detallesRegistro.filter((d) => d.resultado === "FALLA").length,
          ok:             adulteracionesDetectadas.length === 0,
          detalles: {
            create: detallesRegistro,
          },
        },
        include: { detalles: true },
      });

      return {
        ok:                      verificacion.ok,
        adulteracionesDetectadas,
        mensaje: verificacion.ok
          ? "Integridad verificada. Todos los registros son válidos."
          : `Se detectaron ${adulteracionesDetectadas.length} adulteración(es).`,
        verificacionId:    verificacion.id,
        fechaVerificacion: verificacion.fechaVerificacion,
      };
    }
  );

  // ── GET /api/campanas/:id/verificaciones ──────────────────────────────────
  // Historial de verificaciones de integridad de una campaña
  app.get(
    "/:id/verificaciones",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const { id: campanaId } = request.params as { id: string };

      const verificaciones = await db.verificacionIntegridad.findMany({
        where: { campanaId },
        orderBy: { fechaVerificacion: "desc" },
        include: {
          ejecutadoPor: { select: { nombres: true, apellidos: true } },
          detalles: { orderBy: { plantaId: "asc" } },
        },
      });

      // Enriquecer detalles con el consecutivo del registro
      const registros = await db.registroPlanta.findMany({
        where: { campanaId },
        select: { id: true, consecutivo: true, campana: { select: { codigo: true } } },
      });
      const regMap = new Map(registros.map((r) => [r.id, r]));

      const resultado = verificaciones.map((v) => ({
        ...v,
        detalles: v.detalles.map((d) => {
          const reg = regMap.get(d.registroId);
          const codigo = reg?.campana?.codigo;
          const consec = reg?.consecutivo;
          const etiqueta = consec != null
            ? (codigo ? `${codigo}-${String(consec).padStart(3, "0")}` : `REG-${String(consec).padStart(3, "0")}`)
            : null;
          return { ...d, etiquetaRegistro: etiqueta };
        }),
      }));

      return { verificaciones: resultado };
    }
  );

  // ── POST /api/campanas/:id/verificar-hash-campana ─────────────────────────
  // Recalcula el campanaHash a partir de los registros COMPLETO actuales
  // y lo compara contra el hash sellado al momento del cierre.
  app.post(
    "/:id/verificar-hash-campana",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const { id: campanaId } = request.params as { id: string };
      const payload = request.user as { sub: string };

      const campana = await db.campana.findUnique({
        where: { id: campanaId },
        select: {
          campanaHash: true,
          estado:      true,
          registros: {
            where:   { estado: "COMPLETO" },
            select:  { plantaId: true, contentHash: true },
            orderBy: { plantaId: "asc" },
          },
        },
      });

      if (!campana) return reply.status(404).send({ message: "Campaña no encontrada" });
      if (!campana.campanaHash) {
        return reply.status(400).send({
          message: "La campaña no tiene campanaHash — debe estar CERRADA con registros completos.",
        });
      }

      const registrosCompletos = campana.registros.filter((r) => r.contentHash);
      const hashRecalculado = generarHashCampana({
        campanaId,
        registros: registrosCompletos.map((r) => ({
          plantaId:    r.plantaId,
          contentHash: r.contentHash!,
        })),
      });

      const ok = hashRecalculado === campana.campanaHash;

      // Guardar en historial
      const verificacion = await db.verificacionHashCampana.create({
        data: {
          campanaId,
          ejecutadoPorId: payload.sub,
          ok,
          hashGuardado:   campana.campanaHash,
          hashRecalculado,
          totalRegistros: registrosCompletos.length,
        },
      });

      return {
        ok,
        hashGuardado:      campana.campanaHash,
        hashRecalculado,
        totalRegistros:    registrosCompletos.length,
        fechaVerificacion: verificacion.fechaVerificacion,
        mensaje: ok
          ? `Hash de campaña válido — ${registrosCompletos.length} registro(s) incluidos en el sello.`
          : "El hash de campaña NO coincide — los registros pueden haber sido modificados después del cierre.",
      };
    }
  );

  // ── GET /api/campanas/:id/historial-hash-campana ──────────────────────────
  app.get(
    "/:id/historial-hash-campana",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const { id: campanaId } = request.params as { id: string };

      const historial = await db.verificacionHashCampana.findMany({
        where:   { campanaId },
        orderBy: { fechaVerificacion: "desc" },
        include: { ejecutadoPor: { select: { nombres: true, apellidos: true } } },
      });

      return { historial };
    }
  );

  // ── POST /api/campanas/:id/anclar-blockchain ──────────────────────────────
  // Ancla (o re-ancla) el campanaHash en Polygon via LoteRegistry.registrarEvento.
  // Útil cuando el cierre ocurrió sin conexión y txHash quedó vacío.
  app.post(
    "/:id/anclar-blockchain",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const { id: campanaId } = request.params as { id: string };
      const payload = request.user as { sub: string; rol: string };

      if (payload.rol !== "ADMIN") {
        return reply.status(403).send({ message: "Solo el ADMIN puede anclar en blockchain." });
      }

      const campana = await db.campana.findUnique({
        where:  { id: campanaId },
        select: { campanaHash: true, estado: true, loteId: true, txHash: true },
      });

      if (!campana) return reply.status(404).send({ message: "Campaña no encontrada" });
      if (campana.estado !== "CERRADA") {
        return reply.status(400).send({ message: "La campaña debe estar CERRADA para anclar en blockchain." });
      }
      if (!campana.campanaHash) {
        return reply.status(400).send({ message: "La campaña no tiene campanaHash generado." });
      }
      if (!isConfigured()) {
        return reply.status(503).send({ message: "Blockchain no configurado en el servidor." });
      }

      try {
        const result = await registrarEventoOnChain(
          campana.loteId,
          `CAMPANA_CERRADA:${campanaId}`,
          campana.campanaHash,
        );

        await db.campana.update({
          where: { id: campanaId },
          data:  { txHash: result.txHash },
        });

        return {
          ok:          true,
          txHash:      result.txHash,
          blockNumber: result.blockNumber,
          gasUsed:     result.gasUsed,
          mensaje:     `Hash de campaña anclado en Polygon — bloque ${result.blockNumber}.`,
        };
      } catch (err) {
        return reply.status(502).send({
          message: `Error al anclar en blockchain: ${String(err)}`,
        });
      }
    }
  );
}
