/**
 * Pantalla: Detalle de Campaña
 * Muestra la lista de plantas con su estado de registro.
 * Permite navegar a registrar aportes por planta.
 */
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { useEffect, useState, useCallback } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  cargarCampanaDesdeServidor,
  CampanaDetalle,
  PlantaCampana,
} from "../src/services/campanas";

const VERDE = "#1a7f4b";

const ESTADO_ICONO: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  COMPLETO:     { icon: "checkmark-circle",  color: VERDE,    label: "Completo"  },
  PARCIAL:      { icon: "time-outline",      color: "#f59e0b", label: "Parcial"  },
  PENDIENTE:    { icon: "ellipse-outline",   color: "#9ca3af", label: "Pendiente" },
  SIN_REGISTRO: { icon: "ellipse-outline",   color: "#9ca3af", label: "Sin datos" },
  ADULTERADO:   { icon: "warning-outline",   color: "#ef4444", label: "Adulterado"},
  INVALIDADO:   { icon: "ban-outline",       color: "#7c3aed", label: "Invalidado"},
};

export default function CampanaDetalleScreen() {
  const router = useRouter();
  const { campanaId, loteId } = useLocalSearchParams<{ campanaId: string; loteId: string }>();

  const [detalle, setDetalle]     = useState<CampanaDetalle | null>(null);
  const [cargando, setCargando]   = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [filtro, setFiltro]       = useState<"TODAS" | "PENDIENTES" | "COMPLETAS">("PENDIENTES");

  const cargar = useCallback(async () => {
    if (!loteId) return;
    try {
      const det = await cargarCampanaDesdeServidor(loteId);
      setDetalle(det);
    } catch (err) {
      Alert.alert("Error", String(err));
    }
  }, [loteId]);

  useEffect(() => {
    cargar().finally(() => setCargando(false));
  }, [cargar]);

  async function handleRefresh() {
    setActualizando(true);
    await cargar().finally(() => setActualizando(false));
  }

  function abrirAporte(planta: PlantaCampana) {
    if (!detalle) return;

    if (planta.estadoRegistro === "COMPLETO") {
      Alert.alert("Planta completa", "Esta planta ya tiene todos los campos registrados.");
      return;
    }

    if (planta.yaTecnicoAporto) {
      Alert.alert("Ya registraste", "Ya enviaste tu aporte para esta planta en esta campaña.");
      return;
    }

    if (detalle.miPosicion === null || detalle.misCampos.length === 0) {
      Alert.alert("Sin posición asignada", "No tienes una posición asignada en esta campaña. Contacta al administrador.");
      return;
    }

    router.push(
      `/registrar-aporte?campanaId=${campanaId}&plantaId=${planta.id}&codigoPlanta=${planta.codigoPlanta}&posicion=${detalle.miPosicion}&campos=${encodeURIComponent(JSON.stringify(detalle.misCampos))}`
    );
  }

  if (cargando) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={VERDE} />
      </View>
    );
  }

  if (!detalle) {
    return (
      <View style={s.center}>
        <Ionicons name="close-circle-outline" size={48} color="#ef4444" />
        <Text style={s.errorText}>No se pudo cargar la campaña</Text>
        <TouchableOpacity onPress={cargar} style={s.btnRecargar}>
          <Text style={s.btnRecargarText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { campana, plantas, progreso } = detalle;
  const pct = progreso.total > 0
    ? Math.round((progreso.completos / progreso.total) * 100)
    : 0;

  const plantasFiltradas = plantas.filter((p) => {
    if (filtro === "PENDIENTES") return !p.completo;
    if (filtro === "COMPLETAS")  return p.completo;
    return true;
  });

  return (
    <View style={s.container}>
      {/* Encabezado de campaña */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.btnBack}>
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <View style={s.headerInfo}>
          <View style={s.headerTitleRow}>
            <Text style={s.headerTitle} numberOfLines={1}>{campana.nombre}</Text>
            {campana.codigo && (
              <View style={s.codigoBadge}>
                <Text style={s.codigoText}>{campana.codigo}</Text>
              </View>
            )}
          </View>
          <Text style={s.headerLote}>{campana.lote.codigoLote} · {campana.lote.especie}</Text>
        </View>
      </View>

      {/* Barra de progreso */}
      <View style={s.progreso}>
        <View style={s.progresoHeader}>
          <Text style={s.progresoLabel}>Progreso de recolección</Text>
          <Text style={s.progresoPct}>{pct}%</Text>
        </View>
        <View style={s.progresoBar}>
          <View style={[s.progresoFill, { width: `${pct}%` as any }]} />
        </View>
        <View style={s.progresoRow}>
          <Text style={s.progresoSub}>
            <Text style={{ color: VERDE, fontWeight: "700" }}>{progreso.completos}</Text>
            /{progreso.total} plantas completas
          </Text>
          <Text style={s.progresoSub}>
            <Text style={{ color: "#f59e0b", fontWeight: "700" }}>{progreso.pendientes}</Text> pendientes
          </Text>
        </View>
      </View>

      {/* Mi posición en la campaña */}
      {detalle.miPosicion !== null ? (
        <View style={s.posicionSection}>
          <View style={s.posicionRow}>
            <View style={s.posicionBadge}>
              <Text style={s.posicionBadgeText}>P{detalle.miPosicion}</Text>
            </View>
            <Text style={s.posicionLabel}>Tu posición en esta campaña</Text>
          </View>
          <View style={s.camposRow}>
            {detalle.misCampos.map((c) => (
              <View key={c} style={s.miCampoBadge}>
                <Text style={s.miCampoText}>{c.replace(/_/g, " ")}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={s.sinPosicionBanner}>
          <Ionicons name="alert-circle-outline" size={14} color="#d97706" />
          <Text style={s.sinPosicionText}>No tienes posición asignada en esta campaña</Text>
        </View>
      )}

      {/* Filtros */}
      <View style={s.filtros}>
        {(["PENDIENTES", "COMPLETAS", "TODAS"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[s.filtroBtn, filtro === f && s.filtroBtnActive]}
            onPress={() => setFiltro(f)}
          >
            <Text style={[s.filtroText, filtro === f && s.filtroTextActive]}>
              {f === "PENDIENTES" ? `Pendientes (${progreso.pendientes})`
                : f === "COMPLETAS" ? `Completas (${progreso.completos})`
                : `Todas (${progreso.total})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista de plantas */}
      <FlatList
        data={plantasFiltradas}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        refreshControl={
          <RefreshControl refreshing={actualizando} onRefresh={handleRefresh} tintColor={VERDE} />
        }
        renderItem={({ item: planta }) => {
          const est = ESTADO_ICONO[planta.estadoRegistro] ?? ESTADO_ICONO["SIN_REGISTRO"];
          const bloqueada = planta.completo || planta.yaTecnicoAporto;
          return (
            <TouchableOpacity
              style={[s.plantaCard, bloqueada && s.plantaCardCompleta]}
              onPress={() => abrirAporte(planta)}
              activeOpacity={0.7}
            >
              <View style={s.plantaRow}>
                <Ionicons name={est.icon} size={22} color={est.color} />
                <View style={s.plantaInfo}>
                  <View style={s.plantaCodigoRow}>
                    <Text style={s.plantaCodigo}>
                      Planta #{planta.numeroPlanta}
                      <Text style={s.plantaCodigoSub}> · {planta.codigoPlanta}</Text>
                    </Text>
                    {planta.consecutivo != null && (
                      <View style={s.consecutivoBadge}>
                        <Text style={s.consecutivoText}>
                          {campana.codigo
                            ? `${campana.codigo}-${String(planta.consecutivo).padStart(3, "0")}`
                            : `REG-${String(planta.consecutivo).padStart(3, "0")}`}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={[s.plantaEstado, { color: est.color }]}>{est.label}</Text>
                </View>
                {planta.yaTecnicoAporto && !planta.completo && (
                  <View style={s.yaAporteBadge}>
                    <Ionicons name="checkmark" size={11} color="#fff" />
                    <Text style={s.yaAporteText}>Enviado</Text>
                  </View>
                )}
                {!bloqueada && (
                  <View style={s.faltantesInfo}>
                    <Text style={s.faltantesLabel}>
                      {planta.camposFaltantes.length} campo(s) faltante(s)
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                  </View>
                )}
                {planta.completo && (
                  <Ionicons name="checkmark-circle" size={20} color={VERDE} />
                )}
              </View>

              {/* Campos faltantes resumidos */}
              {!bloqueada && planta.camposFaltantes.length > 0 && (
                <View style={s.faltantesRow}>
                  {planta.camposFaltantes.slice(0, 3).map((c) => (
                    <View key={c} style={s.faltanteBadge}>
                      <Text style={s.faltanteText}>{c.replace(/_/g, " ")}</Text>
                    </View>
                  ))}
                  {planta.camposFaltantes.length > 3 && (
                    <Text style={s.masText}>+{planta.camposFaltantes.length - 3}</Text>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={s.vacio}>
            <Ionicons name="checkmark-done-circle-outline" size={48} color="#d1d5db" />
            <Text style={s.vacioText}>
              {filtro === "PENDIENTES"
                ? "¡Todas las plantas están completas!"
                : "Sin plantas en este filtro"}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: "#f9fafb" },
  center:        { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  errorText:     { fontSize: 15, color: "#ef4444", fontWeight: "600" },
  btnRecargar:   { backgroundColor: VERDE, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  btnRecargarText: { color: "#fff", fontWeight: "600" },
  header:        { flexDirection: "row", alignItems: "center", gap: 10,
                    backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 12,
                    borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  btnBack:       { padding: 4 },
  headerInfo:    { flex: 1 },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  headerTitle:   { fontSize: 16, fontWeight: "700", color: "#111827", flexShrink: 1 },
  headerLote:    { fontSize: 12, color: "#6b7280", marginTop: 1 },
  codigoBadge:   { backgroundColor: "#374151", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  codigoText:    { color: "#fff", fontSize: 10, fontWeight: "700", fontFamily: "monospace", letterSpacing: 0.5 },
  progreso:      { backgroundColor: "#fff", padding: 14,
                    borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  progresoHeader:{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  progresoLabel: { fontSize: 12, color: "#6b7280", fontWeight: "600" },
  progresoPct:   { fontSize: 12, fontWeight: "700", color: VERDE },
  progresoBar:   { height: 8, backgroundColor: "#f3f4f6", borderRadius: 4, overflow: "hidden" },
  progresoFill:  { height: "100%", backgroundColor: VERDE, borderRadius: 4 },
  progresoRow:   { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  progresoSub:   { fontSize: 11, color: "#6b7280" },
  camposSection: { backgroundColor: "#fff", paddingHorizontal: 14, paddingBottom: 10,
                    borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  camposLabel:   { fontSize: 11, color: "#9ca3af", marginBottom: 4, marginTop: 8 },
  camposRow:     { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  campoBadge:    { backgroundColor: "#f0fdf4", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
                    borderWidth: 1, borderColor: "#bbf7d0" },
  campoText:     { fontSize: 10, color: VERDE, fontWeight: "500" },
  filtros:       { flexDirection: "row", backgroundColor: "#fff",
                    borderBottomWidth: 1, borderBottomColor: "#f3f4f6", paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  filtroBtn:     { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
                    borderWidth: 1, borderColor: "#e5e7eb" },
  filtroBtnActive: { backgroundColor: VERDE, borderColor: VERDE },
  filtroText:    { fontSize: 11, color: "#6b7280" },
  filtroTextActive: { color: "#fff", fontWeight: "600" },
  plantaCard:    { backgroundColor: "#fff", borderRadius: 12, padding: 12,
                    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 3, elevation: 1, gap: 6 },
  plantaCardCompleta: { opacity: 0.7 },
  plantaRow:     { flexDirection: "row", alignItems: "center", gap: 10 },
  plantaInfo:    { flex: 1 },
  plantaCodigoRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  plantaCodigo:  { fontSize: 14, fontWeight: "700", color: "#111827" },
  plantaCodigoSub: { fontWeight: "400", color: "#6b7280" },
  consecutivoBadge: { backgroundColor: "#6b7280", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  consecutivoText: { color: "#fff", fontSize: 9, fontWeight: "700", fontFamily: "monospace", letterSpacing: 0.3 },
  plantaEstado:  { fontSize: 11, marginTop: 1 },
  faltantesInfo: { flexDirection: "row", alignItems: "center", gap: 2 },
  faltantesLabel: { fontSize: 11, color: "#9ca3af" },
  faltantesRow:  { flexDirection: "row", flexWrap: "wrap", gap: 4, paddingLeft: 32 },
  faltanteBadge: { backgroundColor: "#fef3c7", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
                    borderWidth: 1, borderColor: "#fde68a" },
  faltanteText:  { fontSize: 10, color: "#d97706" },
  masText:       { fontSize: 10, color: "#9ca3af", alignSelf: "center" },
  vacio:         { alignItems: "center", justifyContent: "center", gap: 8, padding: 32 },
  vacioText:     { fontSize: 14, color: "#6b7280", fontWeight: "600", textAlign: "center" },
  // Posición del técnico
  posicionSection: { backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 10,
                      borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  posicionRow:   { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  posicionBadge: { backgroundColor: VERDE, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  posicionBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  posicionLabel: { fontSize: 12, color: "#6b7280" },
  miCampoBadge:  { backgroundColor: "#eff6ff", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
                    borderWidth: 1, borderColor: "#bfdbfe" },
  miCampoText:   { fontSize: 10, color: "#1d4ed8", fontWeight: "500" },
  sinPosicionBanner: { flexDirection: "row", alignItems: "center", gap: 6,
                        backgroundColor: "#fffbeb", paddingHorizontal: 14, paddingVertical: 8,
                        borderBottomWidth: 1, borderBottomColor: "#fde68a" },
  sinPosicionText: { fontSize: 12, color: "#d97706" },
  // Ya aportó badge
  yaAporteBadge: { flexDirection: "row", alignItems: "center", gap: 3,
                    backgroundColor: VERDE, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  yaAporteText:  { fontSize: 10, color: "#fff", fontWeight: "600" },
});
