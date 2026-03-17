/**
 * Pantalla: Mis Campañas
 * Lista las campañas abiertas de cada lote del técnico.
 * Permite descargar/actualizar la campaña del servidor y ver el progreso.
 */
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { listarLotes, LoteLocal, contarAportesPendientes, obtenerCampanaPorLote } from "../../src/services/db";
import {
  cargarCampanaDesdeServidor,
  sincronizarAportes,
  CampanaDetalle,
  SyncAportesResultado,
} from "../../src/services/campanas";

const VERDE = "#1a7f4b";

export default function MisCampanasScreen() {
  const router = useRouter();
  const [lotes, setLotes]               = useState<LoteLocal[]>([]);
  const [cargando, setCargando]         = useState(true);
  const [actualizando, setActualizando]   = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [pendientes, setPendientes]       = useState(0);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);
  // Mapa: loteId → detalle de campaña (null = sin campaña abierta)
  const [campanas, setCampanas]           = useState<Record<string, CampanaDetalle | null>>({});

  useEffect(() => {
    // Mantener cargando=true hasta que termine la consulta al servidor
    // para no mostrar caché desactualizada
    listarLotes()
      .then((lista) => {
        setLotes(lista);
        return Promise.all([
          contarAportesPendientes().then(setPendientes),
          actualizarCampanas(lista),
        ]);
      })
      .finally(() => setCargando(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Actualizar desde servidor (solo cuando el usuario lo pide o al pull-to-refresh)
  const actualizarCampanas = useCallback(async (lotesParam?: LoteLocal[]) => {
    const lista = lotesParam ?? lotes;
    if (lista.length === 0) return;
    setActualizando(true);
    try {
      const nuevoMapa: Record<string, CampanaDetalle | null> = {};
      for (const lote of lista) {
        try {
          const det = await cargarCampanaDesdeServidor(lote.id);
          nuevoMapa[lote.id] = det;
        } catch {
          // Si falla el servidor, conservar caché local
          const local = await obtenerCampanaPorLote(lote.id);
          if (local) {
            nuevoMapa[lote.id] = {
              estado: "ABIERTA", // caché local = asumimos que era ABIERTA cuando se descargó
              campana: {
                id:               local.id,
                nombre:           local.nombre,
                descripcion:      local.descripcion ?? null,
                loteId:           local.loteId,
                lote:             { codigoLote: lote.codigoLote, especie: lote.especie, variedad: lote.variedad ?? null },
                camposRequeridos: JSON.parse(local.camposRequeridos),
                creador:          { nombres: local.creadorNombre, apellidos: "" },
                fechaApertura:    local.fechaApertura,
                estado:           "ABIERTA",
              },
              plantas:   [],
              progreso:  { total: 0, completos: 0, pendientes: 0 },
              miPosicion: null,
              misCampos:  [],
            };
          } else {
            nuevoMapa[lote.id] = null;
          }
        }
      }
      setCampanas(nuevoMapa);
      setUltimaActualizacion(new Date());
    } finally {
      setActualizando(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lotes]);

  async function handleSincronizar() {
    setSincronizando(true);
    try {
      const res: SyncAportesResultado = await sincronizarAportes();
      setPendientes(await contarAportesPendientes());
      Alert.alert(
        "Sincronización completada",
        `Enviados: ${res.enviados}  |  Rechazados: ${res.rechazados}` +
          (res.errores.length > 0 ? `\n\nErrores:\n${res.errores.slice(0, 3).join("\n")}` : ""),
        [{ text: "OK" }]
      );
      // Refrescar progreso de campañas
      await actualizarCampanas();
    } catch (err) {
      Alert.alert("Error", String(err));
    } finally {
      setSincronizando(false);
    }
  }

  function abrirCampana(loteId: string, campanaId: string) {
    router.push(`/campana-detalle?campanaId=${campanaId}&loteId=${loteId}`);
  }

  if (cargando) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={VERDE} />
      </View>
    );
  }

  const lotesConCampana  = lotes.filter((l) => campanas[l.id] != null);
  const lotesAbiertas    = lotes.filter((l) => (campanas[l.id]?.estado ?? campanas[l.id]?.campana?.estado) === "ABIERTA");
  const lotesActivas     = lotes.filter((l) => (campanas[l.id]?.estado ?? campanas[l.id]?.campana?.estado) === "ACTIVA");
  const lotesSinCampana  = lotes.filter((l) => campanas[l.id] === null || campanas[l.id] === undefined);

  // El botón actualizar solo es útil si:
  // - Nunca se ha actualizado manualmente (primera vez)
  // - Hay campañas en estado ACTIVA (aún no abiertas, puede que el admin las abra pronto)
  const hayQueActualizar = !ultimaActualizacion || lotesActivas.length > 0;

  return (
    <View style={s.container}>
      {/* Header info */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Campaña</Text>
          <Text style={s.headerSub}>
            {lotesAbiertas.length > 0
              ? `${lotesAbiertas.length} campaña(s) disponible(s)`
              : lotesConCampana.length > 0
                ? "Sin campañas pendientes por sincronizar"
                : "Sin campañas"}
          </Text>
        </View>
        {pendientes > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{pendientes} pendiente(s)</Text>
          </View>
        )}
      </View>

      {/* Botones de acción */}
      <View style={s.acciones}>
        {/* Botón actualizar — siempre visible, deshabilitado cuando está al día */}
        <View style={s.btnAccionWrap}>
          <TouchableOpacity
            style={[s.btnAccion, (!hayQueActualizar || actualizando) && s.btnAccionDesactivado]}
            onPress={() => actualizarCampanas(lotes)}
            disabled={!hayQueActualizar || actualizando}
            activeOpacity={0.75}
          >
            <Ionicons
              name={actualizando ? "hourglass-outline" : hayQueActualizar ? "cloud-download-outline" : "checkmark-circle-outline"}
              size={18}
              color="#fff"
            />
            <Text style={s.btnAccionText}>
              {actualizando
                ? "Actualizando..."
                : hayQueActualizar
                  ? "Actualizar campaña"
                  : "Campaña al día"}
            </Text>
          </TouchableOpacity>
          {ultimaActualizacion && (
            <Text style={s.ultimaActText}>
              {hayQueActualizar ? "" : `Actualizado ${ultimaActualizacion.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`}
            </Text>
          )}
        </View>

        {pendientes > 0 && (
          <TouchableOpacity
            style={[s.btnSync, sincronizando && s.btnDisabled]}
            onPress={handleSincronizar}
            disabled={sincronizando}
          >
            <Ionicons name="cloud-upload-outline" size={16} color={VERDE} />
            <Text style={s.btnSyncText}>
              {sincronizando ? "Enviando..." : `Enviar ${pendientes}`}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {lotes.length === 0 ? (
        <View style={s.vacio}>
          <Ionicons name="leaf-outline" size={48} color="#d1d5db" />
          <Text style={s.vacioText}>No hay lotes registrados</Text>
          <Text style={s.vacioSub}>Actualiza tus lotes en la pestaña "Mis Lotes"</Text>
        </View>
      ) : Object.keys(campanas).length === 0 ? (
        <View style={s.vacio}>
          <Ionicons name="clipboard-outline" size={48} color="#d1d5db" />
          <Text style={s.vacioText}>Sin campañas cargadas</Text>
          <Text style={s.vacioSub}>Toca "Actualizar campañas" para descargar las activas</Text>
        </View>
      ) : (
        <FlatList
          data={lotesConCampana}
          keyExtractor={(l) => l.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={actualizando}
              onRefresh={() => actualizarCampanas(lotes)}
              tintColor={VERDE}
            />
          }
          renderItem={({ item: lote }) => {
            const det = campanas[lote.id];
            if (det === undefined) return null; // No descargado aún
            if (det === null) {
              // Sin campaña abierta
              return (
                <View style={s.card}>
                  <View style={s.cardRow}>
                    <Text style={s.loteCode}>{lote.codigoLote}</Text>
                    <View style={[s.estadoBadge, { backgroundColor: "#f3f4f6" }]}>
                      <Text style={[s.estadoText, { color: "#9ca3af" }]}>Sin campaña</Text>
                    </View>
                  </View>
                  <Text style={s.loteEspecie}>{lote.especie}{lote.variedad ? ` · ${lote.variedad}` : ""}</Text>
                  <Text style={s.sinCampanaNote}>No hay campaña ABIERTA para este lote</Text>
                </View>
              );
            }

            const { campana, plantas, progreso } = det;
            const estadoCampana = det.estado ?? det.campana.estado ?? "ABIERTA";
            const esActiva = estadoCampana === "ACTIVA";
            const pct = progreso.total > 0
              ? Math.round((progreso.completos / progreso.total) * 100)
              : 0;

            return (
              <TouchableOpacity
                style={[s.card, esActiva && s.cardActiva]}
                onPress={() => esActiva ? null : abrirCampana(lote.id, campana.id)}
                activeOpacity={esActiva ? 1 : 0.7}
              >
                <View style={s.cardRow}>
                  <Text style={s.loteCode}>{lote.codigoLote}</Text>
                  {esActiva ? (
                    <View style={[s.estadoBadge, { backgroundColor: "#dbeafe" }]}>
                      <Text style={[s.estadoText, { color: "#1d4ed8" }]}>PREPARANDO</Text>
                    </View>
                  ) : (
                    <View style={[s.estadoBadge, { backgroundColor: "#dcfce7" }]}>
                      <Text style={[s.estadoText, { color: VERDE }]}>ABIERTA</Text>
                    </View>
                  )}
                </View>

                <Text style={s.campanaNombre}>{campana.nombre}</Text>
                <Text style={s.loteEspecie}>
                  {campana.lote.especie}{campana.lote.variedad ? ` · ${campana.lote.variedad}` : ""}
                </Text>

                {esActiva ? (
                  // Campaña en preparación — aún no disponible para técnicos
                  <View style={s.activaBanner}>
                    <Ionicons name="time-outline" size={13} color="#1d4ed8" />
                    <Text style={s.activaBannerText}>
                      En preparación — el administrador aún no ha abierto esta campaña
                    </Text>
                  </View>
                ) : (
                  <>
                    {/* Barra de progreso */}
                    <View style={s.progresoContainer}>
                      <View style={s.progresoBar}>
                        <View style={[s.progresoFill, { width: `${pct}%` as any }]} />
                      </View>
                      <Text style={s.progresoText}>
                        {progreso.completos}/{progreso.total} plantas · {pct}%
                      </Text>
                    </View>

                    {/* Posición del técnico (si tiene) */}
                    {det.miPosicion !== null ? (
                      <View style={s.posicionRow}>
                        <View style={s.posicionBadge}>
                          <Text style={s.posicionBadgeText}>P{det.miPosicion}</Text>
                        </View>
                        <View style={s.camposRow}>
                          {det.misCampos.slice(0, 3).map((c) => (
                            <View key={c} style={s.miCampoBadge}>
                              <Text style={s.miCampoText}>{c.replace(/_/g, " ")}</Text>
                            </View>
                          ))}
                          {det.misCampos.length > 3 && (
                            <Text style={s.masText}>+{det.misCampos.length - 3}</Text>
                          )}
                        </View>
                      </View>
                    ) : (
                      <View style={s.sinPosicionRow}>
                        <Ionicons name="alert-circle-outline" size={12} color="#d97706" />
                        <Text style={s.sinPosicionText}>Sin posición asignada</Text>
                      </View>
                    )}
                  </>
                )}

                <View style={s.cardFooter}>
                  <Text style={s.creadorText}>
                    Creada por {campana.creador.nombres} {campana.creador.apellidos}
                  </Text>
                  {!esActiva && <Ionicons name="chevron-forward" size={16} color="#9ca3af" />}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#f9fafb" },
  center:      { flex: 1, alignItems: "center", justifyContent: "center" },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                  backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 14,
                  borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#111827" },
  headerSub:   { fontSize: 12, color: "#6b7280", marginTop: 2 },
  badge:       { backgroundColor: "#fef3c7", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText:   { fontSize: 12, color: "#d97706", fontWeight: "600" },
  acciones:    { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 10,
                  backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6",
                  alignItems: "center" },
  btnAccion:   { flexDirection: "row", alignItems: "center", justifyContent: "center",
                  gap: 8, backgroundColor: VERDE, borderRadius: 10,
                  paddingVertical: 12, paddingHorizontal: 16 },
  btnAccionDesactivado: { backgroundColor: "#9ca3af" },
  btnAccionText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  btnSync:     { flexDirection: "row", alignItems: "center", gap: 6,
                  backgroundColor: "#dcfce7", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
                  borderWidth: 1, borderColor: "#bbf7d0" },
  btnSyncText: { color: VERDE, fontSize: 13, fontWeight: "600" },
  btnDisabled: { opacity: 0.5 },
  vacio:       { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 32 },
  vacioText:   { fontSize: 16, fontWeight: "600", color: "#6b7280" },
  vacioSub:    { fontSize: 13, color: "#9ca3af", textAlign: "center" },
  card:        { backgroundColor: "#fff", borderRadius: 14, padding: 14,
                  shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4,
                  elevation: 2, gap: 6 },
  cardRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  loteCode:    { fontFamily: "monospace", fontSize: 13, fontWeight: "700", color: "#111827" },
  estadoBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  estadoText:  { fontSize: 11, fontWeight: "700" },
  campanaNombre: { fontSize: 15, fontWeight: "600", color: "#111827" },
  loteEspecie: { fontSize: 12, color: "#6b7280" },
  sinCampanaNote: { fontSize: 12, color: "#9ca3af", fontStyle: "italic" },
  progresoContainer: { gap: 4 },
  progresoBar: { height: 6, backgroundColor: "#f3f4f6", borderRadius: 3, overflow: "hidden" },
  progresoFill:{ height: "100%", backgroundColor: VERDE, borderRadius: 3 },
  progresoText:{ fontSize: 11, color: "#6b7280" },
  camposRow:   { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  campoBadge:  { backgroundColor: "#f0fdf4", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
                  borderWidth: 1, borderColor: "#bbf7d0" },
  campoText:   { fontSize: 10, color: VERDE, fontWeight: "500" },
  masText:        { fontSize: 10, color: "#9ca3af", alignSelf: "center" },
  posicionRow:    { flexDirection: "row", alignItems: "center", gap: 6 },
  posicionBadge:  { backgroundColor: VERDE, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  posicionBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  miCampoBadge:   { backgroundColor: "#eff6ff", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
                     borderWidth: 1, borderColor: "#bfdbfe" },
  miCampoText:    { fontSize: 10, color: "#1d4ed8", fontWeight: "500" },
  sinPosicionRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  sinPosicionText:{ fontSize: 11, color: "#d97706", fontStyle: "italic" },
  cardFooter:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                  marginTop: 2, paddingTop: 6, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  creadorText: { fontSize: 11, color: "#9ca3af" },
  btnAccionWrap: { flex: 1, gap: 3 },
  ultimaActText: { fontSize: 10, color: "#6b7280", textAlign: "center" },
  cardActiva:  { borderWidth: 1, borderColor: "#bfdbfe", borderStyle: "dashed" },
  activaBanner: { flexDirection: "row", alignItems: "center", gap: 6,
                   backgroundColor: "#eff6ff", borderRadius: 8,
                   paddingHorizontal: 10, paddingVertical: 7 },
  activaBannerText: { fontSize: 11, color: "#1d4ed8", flex: 1 },
});
