import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { listarLotes, upsertLote, LoteLocal, contarEventosPendientes, obtenerCampanaPorLote } from "../../src/services/db";
import { cargarLotesDesdeServidor } from "../../src/services/sync";
import { cargarCampanaDesdeServidor } from "../../src/services/campanas";
import { useSesion } from "../../src/store/sesionStore";

const VERDE = "#1a7f4b";

const ESTADO_COLOR: Record<string, string> = {
  REGISTRADO:             "#3b82f6",
  EN_PRODUCCION:          "#10b981",
  COSECHADO:              "#f59e0b",
  INSPECCION_SOLICITADA:  "#8b5cf6",
  EN_INSPECCION:          "#f97316",
  CERTIFICADO:            "#1a7f4b",
  RECHAZADO:              "#ef4444",
  REVOCADO:               "#6b7280",
};

export default function MisLotesScreen() {
  const router  = useRouter();
  const { sesion } = useSesion();
  const [lotes, setLotes]             = useState<LoteLocal[]>([]);
  const [cargando, setCargando]       = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [pendientes, setPendientes]   = useState(0);

  const cargarLocal = useCallback(async () => {
    const [local, cnt] = await Promise.all([
      listarLotes(),
      contarEventosPendientes(),
    ]);
    setLotes(local);
    setPendientes(cnt);
  }, []);

  useEffect(() => {
    cargarLocal().finally(() => setCargando(false));
  }, [cargarLocal]);

  async function sincronizarLotes() {
    setActualizando(true);
    try {
      const remotos = await cargarLotesDesdeServidor();
      for (const r of remotos) {
        await upsertLote({
          id:           r.id,
          codigoLote:   r.codigoLote,
          predioNombre: r.predioNombre,
          especie:      r.especie,
          variedad:     r.variedad,
          estadoLote:   r.estadoLote,
          dataHash:     r.dataHash,
          syncEstado:   "SINCRONIZADO",
          creadoEn:     new Date().toISOString(),
        });
      }
      await cargarLocal();
    } catch (err) {
      Alert.alert("Error", `No se pudo actualizar: ${String(err)}`);
    } finally {
      setActualizando(false);
    }
  }

  function irAPlantas(loteId: string, codigoLote: string) {
    router.push(`/plantas?loteId=${loteId}&codigoLote=${encodeURIComponent(codigoLote)}`);
  }

  async function irACampana(loteId: string) {
    try {
      // Intentar cargar desde servidor primero
      let det = await cargarCampanaDesdeServidor(loteId).catch(() => null);
      if (!det) {
        // Fallback a caché local
        const local = await obtenerCampanaPorLote(loteId);
        if (!local) {
          Alert.alert("Sin campaña", "No hay campaña activa para este lote en este momento.");
          return;
        }
        router.push(`/campana-detalle?campanaId=${local.id}&loteId=${loteId}`);
        return;
      }
      router.push(`/campana-detalle?campanaId=${det.campana.id}&loteId=${loteId}`);
    } catch (err) {
      Alert.alert("Error", String(err));
    }
  }

  function renderLote({ item }: { item: LoteLocal }) {
    const color = ESTADO_COLOR[item.estadoLote] ?? "#6b7280";
    const activo = item.estadoLote !== "RECHAZADO" && item.estadoLote !== "REVOCADO";

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => activo && irAPlantas(item.id, item.codigoLote)}
        activeOpacity={activo ? 0.7 : 1}
      >
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.codigoLote}>{item.codigoLote}</Text>
            <Text style={styles.predio}>{item.predioNombre}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: color + "22", borderColor: color }]}>
            <Text style={[styles.badgeText, { color }]}>
              {item.estadoLote.replace(/_/g, " ")}
            </Text>
          </View>
        </View>

        <View style={styles.cardInfo}>
          <Ionicons name="leaf-outline" size={14} color="#666" />
          <Text style={styles.infoText}>
            {item.especie}{item.variedad ? ` · ${item.variedad}` : ""}
          </Text>
        </View>

        {activo && (
          <View style={styles.botonesRow}>
            <TouchableOpacity
              style={[styles.btnEvento, { flex: 1 }]}
              onPress={() => irAPlantas(item.id, item.codigoLote)}
            >
              <Ionicons name="add-circle-outline" size={16} color={VERDE} />
              <Text style={styles.btnEventoText}>Plantas</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnCampana, { flex: 1 }]}
              onPress={() => irACampana(item.id)}
            >
              <Ionicons name="clipboard-outline" size={16} color="#7c3aed" />
              <Text style={styles.btnCampanaText}>Campaña activa</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color={VERDE} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Banner de pendientes */}
      {pendientes > 0 && (
        <TouchableOpacity
          style={styles.bannerPendientes}
          onPress={() => router.push("/(tabs)/sync")}
        >
          <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
          <Text style={styles.bannerText}>
            {pendientes} evento{pendientes > 1 ? "s" : ""} pendiente{pendientes > 1 ? "s" : ""} de sincronizar
          </Text>
          <Ionicons name="chevron-forward" size={14} color="#fff" />
        </TouchableOpacity>
      )}

      <FlatList
        data={lotes}
        keyExtractor={(item) => item.id}
        renderItem={renderLote}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl
            refreshing={actualizando}
            onRefresh={sincronizarLotes}
            colors={[VERDE]}
            tintColor={VERDE}
          />
        }
        ListEmptyComponent={
          <View style={styles.vacio}>
            <Ionicons name="leaf-outline" size={60} color="#ccc" />
            <Text style={styles.vacioText}>Sin lotes registrados</Text>
            <Text style={styles.vacioSub}>Desliza hacia abajo para actualizar</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  bannerPendientes: {
    backgroundColor: "#f59e0b",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  bannerText: { flex: 1, color: "#fff", fontWeight: "600", fontSize: 13 },
  lista: { padding: 16, gap: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  codigoLote: { fontSize: 16, fontWeight: "bold", color: "#222" },
  predio: { fontSize: 13, color: "#666", marginTop: 2 },
  badge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 11, fontWeight: "600" },
  cardInfo: { flexDirection: "row", alignItems: "center", gap: 4 },
  infoText: { fontSize: 13, color: "#666" },
  botonesRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  btnEvento: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
  },
  btnEventoText: { color: VERDE, fontSize: 13, fontWeight: "600" },
  btnCampana: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
    backgroundColor: "#f5f3ff",
    borderRadius: 8,
  },
  btnCampanaText: { color: "#7c3aed", fontSize: 13, fontWeight: "600" },
  vacio: { alignItems: "center", paddingTop: 80 },
  vacioText: { fontSize: 18, color: "#999", marginTop: 16 },
  vacioSub: { fontSize: 13, color: "#bbb", marginTop: 8 },
});
