import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  generarContentHashAporte,
  generarContentHashRegistro,
  generarHashCampana,
  verificarCamposCompletos,
  getLoteById,
  getUsuarioById,
  listPlantasByLote,
  listCampanas,
  getCampanaById,
  getCampanaParaCierreAutomatico,
  createCampana,
  getCampanaActivaOAbiertaPorLote,
  getCampanaPorCodigo,
  getCampanaDetalle,
  cerrarCampana,
  abrirCampana,
  updateCampanaTxHash,
  countTecnicosByCampana,
  upsertCampanaTecnico,
  listCampanaTecnicos,
  listCampanaTecnicosRaw,
  getRegistroActivoPorPlanta,
  getMaxConsecutivoCampana,
  createRegistroPlanta,
  updateRegistroPlantaEstado,
  getRegistroAdulterado,
  invalidarRegistro,
  linkRegistroReemplazante,
  marcarRegistroAdulterado,
  createAporteTecnico,
  listAportesByRegistro,
  getCampanaMovilPorLote,
  listRegistrosConAportesPorPlanta,
  crearVerificacionIntegridad,
  listVerificacionesIntegridad,
  listRegistrosConCampanaCodigo,
  getCampanaParaVerificarHash,
  crearVerificacionHashCampana,
  listHistorialHashCampana,
} from "@agrochain/database";
import { registrarEventoOnChain, isConfigured } from "../services/blockchain.js";
import { enqueue } from "../blockchain/writer.js";
import { verificarCampanaSeal } from "../blockchain/verifier.js";
import { intentarCierreAutomatico } from "../services/cierreAutomatico.js";

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

// ─── Rutas ────────────────────────────────────────────────────────────────────

export async function campanasRoutes(app: FastifyInstance) {

  // ── GET /api/campanas?loteId=xxx ─────────────────────────────────────────
  app.get("/", { preHandler: [(app as any).authenticate] }, async (request) => {
    const { loteId } = request.query as { loteId?: string };
    const campanas = await listCampanas({ loteId });
    return { campanas };
  });

  // ── POST /api/campanas ───────────────────────────────────────────────────
  app.post("/", { preHandler: [(app as any).authenticate] }, async (request, reply) => {
    const payload = (request as any).user as { sub: string; rol: string };

    if (!["ADMIN"].includes(payload.rol)) {
      return reply.status(403).send({ message: "Solo el ADMIN puede crear campañas" });
    }

    const body = CrearCampanaSchema.parse(request.body);

    const lote = await getLoteById(body.loteId);
    if (!lote) return reply.status(404).send({ message: "Lote no encontrado" });

    // No puede haber una campaña ACTIVA o ABIERTA para el mismo lote
    const activa = await getCampanaActivaOAbiertaPorLote(body.loteId);
    if (activa) {
      return reply.status(409).send({
        message: `Ya existe una campaña ${activa.estado} para este lote.`,
        campanaId: activa.id,
      });
    }

    // Verificar unicidad del código si se provee
    if (body.codigo) {
      const codigoExiste = await getCampanaPorCodigo(body.codigo);
      if (codigoExiste) {
        return reply.status(409).send({ message: `El código "${body.codigo}" ya está en uso por otra campaña.` });
      }
    }

    const campana = await createCampana({
      loteId:           body.loteId,
      nombre:           body.nombre,
      codigo:           body.codigo ?? null,
      descripcion:      body.descripcion,
      camposRequeridos: body.camposRequeridos,
      creadaPor:        payload.sub,
    });

    return reply.status(201).send({ success: true, campana });
  });

  // ── GET /api/campanas/:id ────────────────────────────────────────────────
  app.get("/:id", { preHandler: [(app as any).authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campana = await getCampanaDetalle(id) as any;
    if (!campana) return reply.status(404).send({ message: "Campaña no encontrada" });

    const camposRequeridos: string[] = campana.camposRequeridos;
    const registros   = campana.registros;
    // Excluir INVALIDADO del conteo de progreso (son registros anulados)
    const activos     = registros.filter((r: any) => r.estado !== "INVALIDADO");
    const total       = activos.length;
    const completos   = activos.filter((r: any) => r.estado === "COMPLETO").length;
    const adulterados = activos.filter((r: any) => r.estado === "ADULTERADO").length;
    const pendientes  = activos.filter((r: any) => ["PENDIENTE", "PARCIAL"].includes(r.estado)).length;

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

    const campana = await getCampanaParaCierreAutomatico(id);
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
      const tecnicos = await countTecnicosByCampana(id);
      if (tecnicos < 4) {
        return reply.status(409).send({
          message: `Debe asignar los 4 técnicos antes de abrir la campaña. Actualmente: ${tecnicos}/4`,
        });
      }
      await abrirCampana(id);
      return { success: true, estado: "ABIERTA" };
    }

    // Cierre manual: calcular resumen
    const totalPlantas = campana.totalPlantasLote;
    const activos = campana.registros;
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

    const campanaCerrada = await cerrarCampana(id, {
      campanaHash,
      cerradaPor: payload.sub,
      cierreConAdvertencia: hayIncompletos,
      motivoCierre: body.motivoCierre,
    });

    // Encolar el anclaje on-chain — no bloquea la respuesta HTTP; el cierre en
    // DB ya es efectivo, txHash se completa async (ver GET /:id para consultarlo).
    let ancladoEnCola = false;
    if (isConfigured() && campana.loteId) {
      enqueue({
        kind: "registrarEvento",
        payload: { loteId: campana.loteId, tipoEvento: `CAMPANA_CERRADA:${id}`, contentHash: campanaHash },
        onSuccess: async (result) => {
          await updateCampanaTxHash(id, result.txHash);
        },
        onError: async (err) => {
          console.error(`[campanas] Error anclando cierre manual de ${id} en blockchain:`, err);
        },
      });
      ancladoEnCola = true;
    }

    return {
      success: true,
      campanaHash,
      ancladoEnCola,
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

    const campana = await getCampanaById(campanaId);
    if (!campana) return reply.status(404).send({ message: "Campaña no encontrada" });
    if (campana.estado === "CERRADA") {
      return reply.status(409).send({ message: "No se pueden asignar técnicos a una campaña CERRADA" });
    }

    const tecnico = await getUsuarioById(body.tecnicoId);
    if (!tecnico) return reply.status(404).send({ message: "Técnico no encontrado" });
    if (tecnico.rol !== "TECNICO") {
      return reply.status(400).send({ message: "El usuario debe tener rol TECNICO" });
    }

    const asignacion = await upsertCampanaTecnico({
      campanaId,
      posicion: body.posicion,
      tecnicoId: body.tecnicoId,
      camposAsignados: body.camposAsignados,
    });

    return reply.status(201).send({ success: true, asignacion });
  });

  // ── GET /api/campanas/:id/tecnicos ───────────────────────────────────────
  app.get("/:id/tecnicos", { preHandler: [(app as any).authenticate] }, async (request, reply) => {
    const { id: campanaId } = request.params as { id: string };
    const tecnicos = await listCampanaTecnicos(campanaId);
    return { tecnicos };
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
      const campana = await getCampanaById(campanaId);
      if (!campana) return reply.status(404).send({ message: "Campaña no encontrada" });
      if (campana.estado !== "ABIERTA") {
        return reply.status(409).send({ message: `La campaña está ${campana.estado}. No se pueden agregar aportes.` });
      }
      const tecnicosCampana = await listCampanaTecnicosRaw(campanaId);

      // 2. Verificar que el técnico tiene posición asignada en esta campaña
      // ADMIN puede especificar tecnicoIdOverride + posicionOverride para registrar en nombre de un técnico
      const tecnicoEfectivo = (payload.rol === "ADMIN" && body.tecnicoIdOverride)
        ? body.tecnicoIdOverride
        : payload.sub;
      const asignacion = tecnicosCampana.find((t) => t.tecnicoId === tecnicoEfectivo);
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
      const plantasDelLote = await listPlantasByLote(campana.loteId);
      const planta = plantasDelLote.find((p) => p.id === plantaId);
      if (!planta) return reply.status(404).send({ message: "Planta no encontrada en este lote" });

      // 4. Obtener o crear RegistroPlanta (solo registros activos, no INVALIDADOS)
      let registro = await getRegistroActivoPorPlanta(campanaId, plantaId);

      if (!registro) {
        // Calcular consecutivo: MAX(consecutivo) + 1 para evitar colisiones si se borran registros
        const maxConsec = await getMaxConsecutivoCampana(campanaId);
        const consecutivo = maxConsec + 1;

        registro = await createRegistroPlanta({ campanaId, plantaId, consecutivo });
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
        return reply.status(409).send({
          message: "Ya registraste tu aporte para esta planta en esta campaña.",
          aporteId: aporteExistente.id,
        });
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
      const aporteCreado = await createAporteTecnico({
        registroPlantaId: registro.id,
        campanaId,
        tecnicoId:   tecnicoEfectivo,
        posicion,
        campos:      body.campos as Record<string, unknown>,
        fotoHash:    body.fotoHash ?? null,
        audioHash:   body.audioHash ?? null,
        contentHash: contentHashFinal,
        hashVerificado,
        hashRechazMotivo: hashVerificado ? null : "contentHash no coincide al recibir",
        latitud:     body.latitud ?? null,
        longitud:    body.longitud ?? null,
        fechaAporte: new Date(fechaAporte),
      });

      // 9. Verificar si el registro está ahora COMPLETO
      const todosLosAportes = await listAportesByRegistro(registro.id);

      const camposRequeridos: string[] = campana.camposRequeridos;
      const aportesConCampos = todosLosAportes.map((a) => ({
        campos:    a.campos,
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

      await updateRegistroPlantaEstado(registro.id, {
        estado: nuevoEstado,
        contentHash: contentHashRegistro,
      });

      // 10. Si el registro quedó COMPLETO → intentar cierre automático de campaña
      let campanaAutoCerrada = false;
      if (completo) {
        campanaAutoCerrada = await intentarCierreAutomatico(campanaId);
      }

      return reply.status(201).send({
        success: true,
        aporteId:     aporteCreado.id,
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

      const registroAdulterado = await getRegistroAdulterado(campanaId, plantaId);
      if (!registroAdulterado) {
        return reply.status(404).send({ message: "No hay registro ADULTERADO para esta planta en esta campaña" });
      }

      // Marcar el adulterado como INVALIDADO (queda en auditoría)
      await invalidarRegistro(registroAdulterado.id, new Date());

      // Calcular consecutivo del nuevo registro (evita duplicar el mismo numero)
      const maxConsec = await getMaxConsecutivoCampana(campanaId);

      // Crear nuevo registro vacío — los 4 técnicos deben volver a registrar
      const nuevoRegistro = await createRegistroPlanta({
        campanaId,
        plantaId,
        consecutivo: maxConsec + 1,
      });

      // Enlazar el registro invalidado con el nuevo
      await linkRegistroReemplazante(registroAdulterado.id, nuevoRegistro.id);

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

      const data = await getCampanaMovilPorLote(loteId) as any;

      if (!data) {
        return reply.status(404).send({ message: "No hay campaña activa para este lote" });
      }

      const { campana, registros, tecnicos } = data;

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
            camposRequeridos: campana.camposRequeridos,
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
      const asignacion = tecnicos.find((t: any) => t.tecnicoId === payload.sub);
      const camposAsignados: string[] = asignacion ? asignacion.camposAsignados : [];
      const posicionTecnico = asignacion?.posicion ?? null;

      // Obtener todas las plantas del lote
      const todasLasPlantas = await listPlantasByLote(loteId);

      const camposRequeridos: string[] = campana.camposRequeridos;

      // Construir respuesta con estado por planta
      const plantas = todasLasPlantas.map((planta) => {
        const registro = registros.find((r: any) => r.plantaId === planta.id);
        const camposIngresados: string[] = [];

        if (registro) {
          for (const aporte of registro.aportes) {
            const camposAporte = Object.keys(aporte.campos);
            camposIngresados.push(...camposAporte);
            // foto y audio se guardan en columnas separadas
            if (aporte.fotoHash)  camposIngresados.push("foto");
            if (aporte.audioHash) camposIngresados.push("audio");
          }
        }

        const faltantes = camposRequeridos.filter((c) => !camposIngresados.includes(c));

        // ¿Ya aportó este técnico en esta planta?
        const yaAporte = registro?.aportes.some((a: any) => a.tecnicoId === payload.sub) ?? false;

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

      const registros = await listRegistrosConAportesPorPlanta(plantaId) as any[];

      return reply.send({
        registros: registros.map((r) => ({
          id:            r.id,
          consecutivo:   r.consecutivo,
          estado:        r.estado,
          fechaEvento:   new Date(r.fechaEvento).toISOString(),
          campana:       r.campana,
          aportes: r.aportes.map((a: any) => ({
            id:             a.id,
            tecnicoId:      a.tecnicoId,
            posicion:       a.posicion,
            campos:         a.campos,
            fotoHash:       a.fotoHash ?? null,
            audioHash:      a.audioHash ?? null,
            fechaAporte:    new Date(a.fechaAporte).toISOString(),
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

      const campana = await getCampanaDetalle(campanaId) as any;
      if (!campana) return reply.status(404).send({ message: "Campaña no encontrada" });

      const registrosActivos = campana.registros.filter((r: any) => r.estado !== "INVALIDADO");

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

      for (const registro of registrosActivos) {
        // Solo verificar registros COMPLETOS — los demás no tienen contentHash de registro
        if (registro.estado !== "COMPLETO" && registro.estado !== "ADULTERADO") continue;
        if (!registro.contentHash) continue;

        // NIVEL 1: Recalcular contentHash de cada aporte desde datos crudos
        const aportesPorPosicion = [...registro.aportes].sort((a: any, b: any) => a.posicion - b.posicion);
        const firmasPorCampo = aportesPorPosicion.map((a: any) => {
          const contentHashRecalculado = generarContentHashAporte({
            plantaId:    registro.plantaId,
            campanaId,
            tecnicoId:   a.tecnicoId,
            posicion:    a.posicion,
            campos:      a.campos as Record<string, unknown>,
            fotoHash:    a.fotoHash ?? null,
            audioHash:   a.audioHash ?? null,
            latitud:     a.latitud ?? null,
            longitud:    a.longitud ?? null,
            fechaAporte: new Date(a.fechaAporte).toISOString(),
          });
          return {
            campo:                `posicion_${a.posicion}`,
            firma:                contentHashRecalculado, // nivel 1 recalculado desde datos crudos
            contentHashGuardado:  a.contentHash,
            contentHashOk:        contentHashRecalculado === a.contentHash,
          };
        });

        // NIVEL 2: Recalcular contentHashRegistro desde los hashes de nivel 1 recalculados
        const hashRecalculado = generarContentHashRegistro({
          firmasAportes: firmasPorCampo.map((f: any) => ({ campo: f.campo, firma: f.firma })),
          plantaId:      registro.plantaId,
          campanaId,
        });

        const ok = hashRecalculado === registro.contentHash;

        // Detectar qué aportes tienen nivel 1 alterado
        const aportesAlterados = firmasPorCampo.filter((f: any) => !f.contentHashOk);

        detallesRegistro.push({
          registroId:    registro.id,
          plantaId:      registro.plantaId,
          hashGuardado:  registro.contentHash,
          hashCalculado: hashRecalculado,
          resultado:     ok ? "OK" : "FALLA",
        });

        if (!ok) {
          const motivoAportes = aportesAlterados.length > 0
            ? ` | Aportes con datos alterados: posiciones ${aportesAlterados.map((f: any) => f.campo).join(", ")}`
            : "";
          adulteracionesDetectadas.push({
            registroId: registro.id,
            plantaId:   registro.plantaId,
            motivo:     `Hash guardado: ${registro.contentHash} | Recalculado desde datos crudos: ${hashRecalculado}${motivoAportes}`,
          });
          await marcarRegistroAdulterado(registro.id);
        }
      }

      // Guardar historial de verificación
      const verificacion = await crearVerificacionIntegridad({
        campanaId,
        ejecutadoPorId: payload.sub,
        totalRegistros: detallesRegistro.length,
        aprobados:      detallesRegistro.filter((d) => d.resultado === "OK").length,
        adulterados:    detallesRegistro.filter((d) => d.resultado === "FALLA").length,
        ok:             adulteracionesDetectadas.length === 0,
        detalles: detallesRegistro,
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

      const verificaciones = await listVerificacionesIntegridad(campanaId) as any[];

      // Enriquecer detalles con el consecutivo del registro
      const registros = await listRegistrosConCampanaCodigo(campanaId);
      const regMap = new Map(registros.map((r) => [r.id, r]));

      const resultado = verificaciones.map((v) => ({
        ...v,
        detalles: v.detalles.map((d: any) => {
          const reg = regMap.get(d.registroId);
          const codigo = reg?.campanaCodigo;
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
  // Recalcula el campanaHash desde los registros COMPLETO actuales y lo compara
  // contra: (1) el hash sellado en DB al cierre, y (2) el hash en Polygon via txHash.
  app.post(
    "/:id/verificar-hash-campana",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const { id: campanaId } = request.params as { id: string };
      const payload = request.user as { sub: string };

      const campana = await getCampanaParaVerificarHash(campanaId);

      if (!campana) return reply.status(404).send({ message: "Campaña no encontrada" });
      if (!campana.campanaHash) {
        return reply.status(400).send({
          message: "La campaña no tiene campanaHash — debe estar CERRADA con registros completos.",
        });
      }

      // Recalcular hash desde los contentHash de registros en DB
      const registrosCompletos = campana.registros.filter((r) => r.contentHash);
      const hashRecalculado = generarHashCampana({
        campanaId,
        registros: registrosCompletos.map((r) => ({
          plantaId:    r.plantaId,
          contentHash: r.contentHash!,
        })),
      });

      // Verificacion de 3 niveles (DB + Polygon) via el modulo compartido
      const verif = await verificarCampanaSeal({
        hashRecalculado,
        hashGuardadoDB: campana.campanaHash,
        txHash: campana.txHash ?? null,
      });

      // Guardar en historial (incluyendo datos de Polygon)
      const verificacion = await crearVerificacionHashCampana({
        campanaId,
        ejecutadoPorId:   payload.sub,
        ok: verif.ok,
        hashGuardado:     campana.campanaHash,
        hashRecalculado,
        totalRegistros:   registrosCompletos.length,
        txHash:           campana.txHash ?? null,
        hashEnPolygon:    verif.hashEnPolygon,
        blockNumber:      verif.blockNumber,
        timestampPolygon: verif.timestampPolygon,
        okDB:             verif.okDB,
        okPolygon:        verif.okPolygon,
        polygonError:     verif.polygonError,
      });

      return {
        ok: verif.ok,
        // Comparación 1: DB
        hashGuardadoDB:    campana.campanaHash,
        hashRecalculado,
        okDB: verif.okDB,
        // Comparación 2: Polygon
        txHash:            campana.txHash ?? null,
        hashEnPolygon:     verif.hashEnPolygon,
        blockNumber:       verif.blockNumber,
        timestampPolygon:  verif.timestampPolygon,
        okPolygon:         verif.okPolygon,
        polygonError:      verif.polygonError,
        // Resumen
        totalRegistros:    registrosCompletos.length,
        fechaVerificacion: verificacion.fechaVerificacion,
        mensaje: verif.ok
          ? `Hash válido — DB ✓${verif.okPolygon !== null ? " · Polygon ✓" : " · Polygon no consultado (sin txHash)"}`
          : !verif.okDB
            ? "ALERTA: El hash de campaña en DB no coincide con el recalculado — registros modificados después del cierre."
            : "ALERTA: El hash recalculado no coincide con el registrado en Polygon — posible adulteración.",
      };
    }
  );

  // ── GET /api/campanas/:id/historial-hash-campana ──────────────────────────
  app.get(
    "/:id/historial-hash-campana",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const { id: campanaId } = request.params as { id: string };
      const historial = await listHistorialHashCampana(campanaId);
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

      const campana = await getCampanaById(campanaId);

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

        await updateCampanaTxHash(campanaId, result.txHash);

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
