import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Alert,
} from "react-native";
import { useState, useEffect, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  listarEventosPendientes,
  contarEventosPendientes, limpiarEventosRechazados, EventoLocal,
  listarAportesPendientes, AportePendiente,
} from "../../src/services/db";
import { sincronizarEventos, SyncResultado } from "../../src/services/sync";
import { sincronizarAportes, SyncAportesResultado } from "../../src/services/campanas";

const VERDE = "#1a7f4b";

export default function SyncScreen() {
  const [pendientes, setPendientes]         = useState<EventoLocal[]>([]);
  const [aportesPendientes, setAportesPendientes] = useState<AportePendiente[]>([]);
  const [sincronizando, setSincronizando]   = useState(false);
  const [ultimo, setUltimo]                 = useState<SyncResultado | null>(null);
  const [ultimoAportes, setUltimoAportes]   = useState<SyncAportesResultado | null>(null);

  const cargar = useCallback(async () => {
    const [lista, aportes] = await Promise.all([
      listarEventosPendientes(),
      listarAportesPendientes(),
    ]);
    setPendientes(lista);
    setAportesPendientes(aportes);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function handleLimpiarRechazados() {
    Alert.alert(
      "Limpiar rechazados",
      "Esto eliminará todos los eventos rechazados de la base de datos local. ¿Continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Limpiar",
          style: "destructive",
          onPress: async () => {
            const n = await limpiarEventosRechazados();
            await cargar();
            Alert.alert("Listo", `${n} evento(s) rechazado(s) eliminados.`);
          },
        },
      ]
    );
  }

  async function handleSync() {
    setSincronizando(true);
    try {
      const [resultado, resultadoAportes] = await Promise.all([
        sincronizarEventos(),
        sincronizarAportes(),
      ]);
      setUltimo(resultado);
      setUltimoAportes(resultadoAportes);
      await cargar();

      const totalEnviados = resultado.aceptados + resultadoAportes.enviados;
      const totalErrores  = [...resultado.errores, ...resultadoAportes.errores];
      const totalPendientes = resultado.total + resultadoAportes.total;

      if (totalErrores.length > 0) {
        Alert.alert(
          "Sincronización parcial",
          `✅ ${totalEnviados} enviados\n❌ ${resultado.rechazados + resultadoAportes.rechazados} rechazados\n\nErrores:\n${totalErrores.slice(0, 3).join("\n")}`
        );
      } else if (totalPendientes === 0) {
        Alert.alert("Sin pendientes", "No hay datos pendientes de sincronizar.");
      } else {
        Alert.alert(
          "✅ Sincronización completa",
          `${totalEnviados} dato(s) enviados correctamente.`
        );
      }
    } catch (err) {
      Alert.alert("Error de conexión", String(err));
    } finally {
      setSincronizando(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Estado de sincronización */}
      <View style={styles.estadoCard}>
        <View style={styles.estadoHeader}>
          <Ionicons
            name={(pendientes.length + aportesPendientes.length) > 0 ? "cloud-upload-outline" : "checkmark-circle-outline"}
            size={40}
            color={(pendientes.length + aportesPendientes.length) > 0 ? "#f59e0b" : VERDE}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.estadoNumero}>{pendientes.length + aportesPendientes.length}</Text>
            <Text style={styles.estadoLabel}>pendiente(s) de sincronizar</Text>
            {aportesPendientes.length > 0 && (
              <Text style={styles.estadoDetalle}>
                {aportesPendientes.length} aporte(s) de campaña · {pendientes.length} evento(s)
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.btnSync, sincronizando && styles.btnDeshabilitado]}
          onPress={handleSync}
          disabled={sincronizando}
        >
          {sincronizando ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.btnSyncText}>Sincronizando...</Text>
            </>
          ) : (
            <>
              <Ionicons name="cloud-upload" size={20} color="#fff" />
              <Text style={styles.btnSyncText}>Sincronizar ahora</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnLimpiar}
          onPress={handleLimpiarRechazados}
        >
          <Ionicons name="trash-outline" size={16} color="#ef4444" />
          <Text style={styles.btnLimpiarText}>Limpiar eventos rechazados</Text>
        </TouchableOpacity>
      </View>

      {/* Resultado del último sync */}
      {ultimo && (
        <View style={styles.resultadoCard}>
          <Text style={styles.sectionTitle}>Último resultado</Text>
          <View style={styles.resultadoFila}>
            <Ionicons name="checkmark-circle" size={16} color={VERDE} />
            <Text style={styles.resultadoText}>Aceptados: {ultimo.aceptados}</Text>
          </View>
          <View style={styles.resultadoFila}>
            <Ionicons name="close-circle" size={16} color="#ef4444" />
            <Text style={styles.resultadoText}>Rechazados: {ultimo.rechazados}</Text>
          </View>
          {ultimo.errores.length > 0 && (
            <View style={styles.erroresBox}>
              {ultimo.errores.map((e, i) => (
                <Text key={i} style={styles.errorText}>• {e}</Text>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Info de integridad */}
      <View style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Cómo funciona</Text>
        <View style={styles.paso}>
          <View style={styles.pasoNum}><Text style={styles.pasoNumText}>1</Text></View>
          <Text style={styles.pasoText}>
            Al guardar en campo, se genera un hash SHA256 que certifica la integridad de los datos.
          </Text>
        </View>
        <View style={styles.paso}>
          <View style={styles.pasoNum}><Text style={styles.pasoNumText}>2</Text></View>
          <Text style={styles.pasoText}>
            Al sincronizar, el servidor recalcula el hash y verifica que coincida con el original.
          </Text>
        </View>
        <View style={styles.paso}>
          <View style={styles.pasoNum}><Text style={styles.pasoNumText}>3</Text></View>
          <Text style={styles.pasoText}>
            Si la verificación es exitosa, las fotos locales se eliminan del dispositivo (el hash queda como evidencia).
          </Text>
        </View>
        <View style={styles.paso}>
          <View style={[styles.pasoNum, { backgroundColor: "#3b82f6" }]}>
            <Text style={styles.pasoNumText}>4</Text>
          </View>
          <Text style={styles.pasoText}>
            Los hashes quedan registrados permanentemente en Polygon Blockchain (inmutables).
          </Text>
        </View>
      </View>

      {/* Lista de aportes de campaña pendientes */}
      {aportesPendientes.length > 0 && (
        <View style={styles.pendientesCard}>
          <Text style={styles.sectionTitle}>Aportes de campaña pendientes</Text>
          {aportesPendientes.map((a) => (
            <View key={a.id} style={styles.eventoRow}>
              <Ionicons name="flag-outline" size={14} color="#f59e0b" />
              <View style={{ flex: 1 }}>
                <Text style={styles.eventoTipo}>Posición {a.posicion} · {a.fechaAporte.substring(0, 10)}</Text>
                <Text style={styles.eventoFecha}>
                  {a.fotoHash ? "📷 foto · " : ""}{a.audioHash ? "🎙 audio · " : ""}hash: {a.contentHash.substring(0, 8)}...
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Lista de eventos pendientes */}
      {pendientes.length > 0 && (
        <View style={styles.pendientesCard}>
          <Text style={styles.sectionTitle}>Eventos pendientes</Text>
          {pendientes.map((e) => (
            <View key={e.id} style={styles.eventoRow}>
              <Ionicons name="time-outline" size={14} color="#f59e0b" />
              <View style={{ flex: 1 }}>
                <Text style={styles.eventoTipo}>{e.tipoEvento.replace(/_/g, " ")}</Text>
                <Text style={styles.eventoFecha}>
                  {e.fechaEvento.substring(0, 10)} · {e.fotoUri ? "📷 con foto" : "sin foto"}
                </Text>
              </View>
              {e.contentHash && (
                <Text style={styles.eventoHash}>{e.contentHash.substring(0, 8)}...</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  estadoCard: {
    backgroundColor: "#fff",
    margin: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  estadoHeader: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 20 },
  estadoNumero: { fontSize: 36, fontWeight: "bold", color: "#222" },
  estadoLabel: { fontSize: 14, color: "#666" },
  estadoDetalle: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  btnSync: {
    backgroundColor: VERDE,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnDeshabilitado: { opacity: 0.6 },
  btnSyncText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  btnLimpiar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
  },
  btnLimpiarText: { color: "#ef4444", fontSize: 13 },
  resultadoCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
    padding: 16,
  },
  sectionTitle: { fontSize: 15, fontWeight: "bold", color: "#222", marginBottom: 12 },
  resultadoFila: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  resultadoText: { fontSize: 14, color: "#444" },
  erroresBox: {
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  errorText: { fontSize: 12, color: "#ef4444", lineHeight: 20 },
  infoCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
    padding: 16,
  },
  paso: { flexDirection: "row", gap: 12, marginBottom: 12, alignItems: "flex-start" },
  pasoNum: {
    backgroundColor: VERDE,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  pasoNumText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  pasoText: { flex: 1, fontSize: 13, color: "#555", lineHeight: 19 },
  pendientesCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
    padding: 16,
  },
  eventoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  eventoTipo: { fontSize: 13, fontWeight: "600", color: "#333" },
  eventoFecha: { fontSize: 12, color: "#888" },
  eventoHash: {
    fontSize: 10,
    color: "#aaa",
    fontFamily: "monospace",
  },
});
