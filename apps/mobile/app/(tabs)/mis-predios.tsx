/**
 * Pantalla principal — Lista de predios del agrónomo.
 * ICA Res. 3168/2015 — Registro de predios productores.
 */
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, Modal, ScrollView, TextInput,
} from "react-native";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { listarPredios, upsertPredio, PredioLocal, contarEventosPendientes } from "../../src/services/db";
import { cargarPrediosDesdeServidor } from "../../src/services/sync";
import { useSesion } from "../../src/store/sesionStore";

const VERDE = "#1a7f4b";

const FUENTES_AGUA = ["ACUEDUCTO", "RIO", "POZO", "LLUVIA", "MIXTA"];

export default function MisPrediosScreen() {
  const router = useRouter();
  const { sesion } = useSesion();
  const [predios, setPredios]           = useState<PredioLocal[]>([]);
  const [cargando, setCargando]         = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [pendientes, setPendientes]     = useState(0);
  const [modalVisible, setModalVisible] = useState(false);

  const cargarLocal = useCallback(async () => {
    const [lista, cnt] = await Promise.all([listarPredios(), contarEventosPendientes()]);
    setPredios(lista);
    setPendientes(cnt);
  }, []);

  useEffect(() => {
    cargarLocal().finally(() => setCargando(false));
  }, [cargarLocal]);

  async function sincronizarPredios() {
    if (!sesion) return;
    setActualizando(true);
    try {
      const remotos = await cargarPrediosDesdeServidor();
      for (const p of remotos) {
        await upsertPredio({
          id: p.id,
          nombrePredio: p.nombrePredio,
          codigoIca: p.codigoIca ?? null,
          departamento: p.departamento,
          municipio: p.municipio,
          vereda: p.vereda ?? null,
          areaTotalHa: p.areaTotalHa ?? null,
          areaProductivaHa: p.areaProductivaHa ?? null,
          fuenteAgua: p.fuenteAgua ?? null,
          tipoSuelo: p.tipoSuelo ?? null,
          latitud: p.latitud ?? null,
          longitud: p.longitud ?? null,
          altitudMsnm: p.altitudMsnm ?? null,
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

  function renderPredio({ item }: { item: PredioLocal }) {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/lotes?predioId=${item.id}&predioNombre=${encodeURIComponent(item.nombrePredio)}`)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.codigoPredio}>
              {item.codigoIca ?? "SIN-CÓDIGO"}
            </Text>
            <Text style={styles.cardNombre}>{item.nombrePredio}</Text>
          </View>
          <View style={styles.badgeMunicipio}>
            <Text style={styles.badgeMunicipioText}>{item.municipio}</Text>
          </View>
        </View>

        <View style={styles.cardInfo}>
          {item.areaTotalHa != null && (
            <View style={styles.infoItem}>
              <Ionicons name="resize-outline" size={13} color="#666" />
              <Text style={styles.infoText}>{item.areaTotalHa} ha total</Text>
            </View>
          )}
          {item.areaProductivaHa != null && (
            <View style={styles.infoItem}>
              <Ionicons name="leaf-outline" size={13} color="#666" />
              <Text style={styles.infoText}>{item.areaProductivaHa} ha productiva</Text>
            </View>
          )}
          {item.fuenteAgua && (
            <View style={styles.infoItem}>
              <Ionicons name="water-outline" size={13} color="#666" />
              <Text style={styles.infoText}>{item.fuenteAgua.toLowerCase()}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.verLotesText}>Ver lotes →</Text>
        </View>
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
        data={predios}
        keyExtractor={(item) => item.id}
        renderItem={renderPredio}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl
            refreshing={actualizando}
            onRefresh={sincronizarPredios}
            colors={[VERDE]}
            tintColor={VERDE}
          />
        }
        ListEmptyComponent={
          <View style={styles.vacio}>
            <Ionicons name="home-outline" size={60} color="#ccc" />
            <Text style={styles.vacioText}>Sin predios registrados</Text>
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
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  codigoPredio: { fontFamily: "monospace", fontSize: 16, fontWeight: "700", color: "#222" },
  cardNombre: { fontSize: 13, color: "#666", marginTop: 2 },
  cardUbicacion: { fontSize: 12, color: "#666", marginTop: 1 },
  badgeMunicipio: {
    borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: "#dcfce7", borderColor: "#bbf7d0",
  },
  badgeMunicipioText: { fontSize: 11, fontWeight: "600", color: VERDE },
  cardInfo: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 10 },
  infoItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  infoText: { fontSize: 12, color: "#666" },
  cardFooter: {
    borderTopWidth: 1, borderTopColor: "#f0f0f0",
    paddingTop: 10, alignItems: "flex-end",
  },
  verLotesText: { color: VERDE, fontSize: 13, fontWeight: "600" },
  vacio: { alignItems: "center", paddingTop: 80 },
  vacioText: { fontSize: 18, color: "#999", marginTop: 16 },
  vacioSub: { fontSize: 13, color: "#bbb", marginTop: 8 },
});
