/**
 * Pantalla de lotes de un predio.
 * NTC 5400 §3 — Lote como unidad de trazabilidad.
 */
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, Platform,
} from "react-native";
import { useEffect, useState, useCallback } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { listarLotes, upsertLote, LoteLocal, obtenerCampanaPorLote } from "../src/services/db";
import { cargarLotesDesdeServidor } from "../src/services/sync";

const VERDE = "#1a7f4b";

const ESTADO_COLOR: Record<string, string> = {
  REGISTRADO:            "#3b82f6",
  EN_PRODUCCION:         "#10b981",
  COSECHADO:             "#f59e0b",
  INSPECCION_SOLICITADA: "#8b5cf6",
  EN_INSPECCION:         "#f97316",
  CERTIFICADO:           "#1a7f4b",
  RECHAZADO:             "#ef4444",
  REVOCADO:              "#6b7280",
};

const ESTADO_LABEL: Record<string, string> = {
  REGISTRADO:            "Registrado",
  EN_PRODUCCION:         "En producción",
  COSECHADO:             "Cosechado",
  INSPECCION_SOLICITADA: "Insp. solicitada",
  EN_INSPECCION:         "En inspección",
  CERTIFICADO:           "Certificado",
  RECHAZADO:             "Rechazado",
  REVOCADO:              "Revocado",
};

export default function LotesScreen() {
  const { predioId, predioNombre } = useLocalSearchParams<{ predioId: string; predioNombre: string }>();
  const router = useRouter();
  const [lotes, setLotes]               = useState<LoteLocal[]>([]);
  const [campanas, setCampanas]         = useState<Record<string, boolean>>({});
  const [cargando, setCargando]         = useState(true);
  const [actualizando, setActualizando] = useState(false);

  const cargarLocal = useCallback(async () => {
    const lista = await listarLotes(predioId);
    setLotes(lista);
    // Consultar campaña abierta por cada lote
    const mapa: Record<string, boolean> = {};
    await Promise.all(lista.map(async (l) => {
      const campana = await obtenerCampanaPorLote(l.id);
      mapa[l.id] = campana != null;
    }));
    setCampanas(mapa);
  }, [predioId]);

  useEffect(() => {
    cargarLocal().finally(() => setCargando(false));
  }, [cargarLocal]);

  async function sincronizarLotes() {
    setActualizando(true);
    try {
      const remotos = await cargarLotesDesdeServidor();
      const delPrediо = remotos.filter((r: any) => !predioId || r.predioId === predioId);
      for (const r of delPrediо) {
        await upsertLote({
          id: r.id,
          predioId: r.predioId ?? predioId ?? null,
          predioNombre: r.predioNombre ?? predioNombre ?? "",
          codigoLote: r.codigoLote,
          especie: r.especie,
          variedad: r.variedad ?? null,
          areaHa: r.areaHa ?? null,
          fechaSiembra: r.fechaSiembra ?? null,
          destinoProduccion: r.destinoProduccion ?? null,
          sistemaRiego: r.sistemaRiego ?? null,
          estadoLote: r.estadoLote,
          dataHash: r.dataHash ?? null,
          syncEstado: "SINCRONIZADO",
          creadoEn: new Date().toISOString(),
        });
      }
      await cargarLocal();
    } catch (err) {
      Alert.alert("Error", `No se pudo actualizar: ${String(err)}`);
    } finally {
      setActualizando(false);
    }
  }

  function renderLote({ item }: { item: LoteLocal }) {
    const color = ESTADO_COLOR[item.estadoLote] ?? "#6b7280";
    const activo = item.estadoLote !== "RECHAZADO" && item.estadoLote !== "REVOCADO";
    const tieneCampana = campanas[item.id] === true;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => activo && router.push(
          `/plantas?loteId=${item.id}&codigoLote=${encodeURIComponent(item.codigoLote)}`
        )}
        activeOpacity={activo ? 0.7 : 1}
      >
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.codigoLote}>{item.codigoLote}</Text>
            <Text style={styles.especie}>
              {item.especie}{item.variedad ? ` · ${item.variedad}` : ""}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: color + "22", borderColor: color }]}>
            <Text style={[styles.badgeText, { color }]}>
              {ESTADO_LABEL[item.estadoLote] ?? item.estadoLote}
            </Text>
          </View>
        </View>

        <View style={styles.cardInfo}>
          {item.areaHa != null && (
            <View style={styles.infoItem}>
              <Ionicons name="resize-outline" size={13} color="#666" />
              <Text style={styles.infoText}>{item.areaHa} ha</Text>
            </View>
          )}
          {item.sistemaRiego && (
            <View style={styles.infoItem}>
              <Ionicons name="water-outline" size={13} color="#666" />
              <Text style={styles.infoText}>{item.sistemaRiego.toLowerCase()}</Text>
            </View>
          )}
          {item.fechaSiembra && (
            <View style={styles.infoItem}>
              <Ionicons name="calendar-outline" size={13} color="#666" />
              <Text style={styles.infoText}>
                Siembra: {item.fechaSiembra.substring(0, 10)}
              </Text>
            </View>
          )}
        </View>

        {tieneCampana && (
          <View style={styles.campanaBanner}>
            <Ionicons name="flag-outline" size={13} color={VERDE} />
            <Text style={styles.campanaBannerText}>Campaña abierta</Text>
          </View>
        )}

        {activo && (
          <View style={styles.cardFooter}>
            <Text style={styles.verPlantasText}>Ver plantas →</Text>
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitulo}>Lotes del predio</Text>
          <Text style={styles.headerSub}>{decodeURIComponent(predioNombre ?? "")}</Text>
        </View>
        <TouchableOpacity onPress={sincronizarLotes} style={styles.syncBtn} disabled={actualizando}>
          {actualizando
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="refresh-outline" size={20} color="#fff" />
          }
        </TouchableOpacity>
      </View>

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
  header: {
    backgroundColor: VERDE,
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Platform.OS === "android" ? 40 : 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  backBtn: { padding: 4 },
  syncBtn: { padding: 4 },
  headerTitulo: { fontSize: 18, fontWeight: "bold", color: "#fff" },
  headerSub: { fontSize: 12, color: "#b7dfca", marginTop: 2 },
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
    marginBottom: 10,
  },
  codigoLote: { fontSize: 16, fontWeight: "bold", color: "#222" },
  especie: { fontSize: 13, color: "#666", marginTop: 2 },
  badge: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  cardInfo: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 8 },
  infoItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  infoText: { fontSize: 12, color: "#666" },
  cardFooter: {
    borderTopWidth: 1, borderTopColor: "#f0f0f0",
    paddingTop: 10, alignItems: "flex-end",
  },
  verPlantasText: { color: VERDE, fontSize: 13, fontWeight: "600" },
  campanaBanner: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#f0fdf4", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: "#bbf7d0",
    marginTop: 2, marginBottom: 4,
  },
  campanaBannerText: { fontSize: 12, color: VERDE, fontWeight: "600" },
  vacio: { alignItems: "center", paddingTop: 80 },
  vacioText: { fontSize: 18, color: "#999", marginTop: 16 },
  vacioSub: { fontSize: 13, color: "#bbb", marginTop: 8 },
});
