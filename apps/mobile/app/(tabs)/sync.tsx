import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Alert,
} from "react-native";
import { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  listarEventosPendientes,
  limpiarEventosRechazados, EventoLocal,
  listarAportesPendientes, AportePendiente, limpiarAportesRechazados,
  limpiarTodosAportesLocales, obtenerSesion, reintentarAporteRechazado,
  obtenerContadoresAportes, ContadoresAportes, contarEventosRechazados,
  limpiarAportesPorPosicion,
} from "../../src/services/db";
import { sincronizarEventos, SyncResultado } from "../../src/services/sync";
import { sincronizarAportes, SyncAportesResultado } from "../../src/services/campanas";

const VERDE = "#1a7f4b";

export default function SyncScreen() {
  const [pendientes, setPendientes]               = useState<EventoLocal[]>([]);
  const [aportesPendientes, setAportesPendientes] = useState<AportePendiente[]>([]);
  const [contadores, setContadores]               = useState<ContadoresAportes | null>(null);
  const [eventosRechazados, setEventosRechazados] = useState(0);
  const [sincronizando, setSincronizando]         = useState(false);
  const [ultimo, setUltimo]                       = useState<SyncResultado | null>(null);
  const [ultimoAportes, setUltimoAportes]         = useState<SyncAportesResultado | null>(null);
  const [esAdmin, setEsAdmin]                     = useState(false);

  useFocusEffect(
    useCallback(() => {
      let activo = true;
      (async () => {
        const [lista, aportes, cont, evRechazados, sesion] = await Promise.all([
          listarEventosPendientes(),
          listarAportesPendientes(),
          obtenerContadoresAportes(),
          contarEventosRechazados(),
          obtenerSesion(),
        ]);
        if (activo) {
          setPendientes(lista);
          setAportesPendientes(aportes);
          setContadores(cont);
          setEventosRechazados(evRechazados);
          setEsAdmin(sesion?.rol === "ADMIN");
        }
      })();
      return () => { activo = false; };
    }, [])
  );

  async function cargar() {
    const [lista, aportes, cont, evRechazados] = await Promise.all([
      listarEventosPendientes(),
      listarAportesPendientes(),
      obtenerContadoresAportes(),
      contarEventosRechazados(),
    ]);
    setPendientes(lista);
    setAportesPendientes(aportes);
    setContadores(cont);
    setEventosRechazados(evRechazados);
  }

  async function handleLimpiarEventosRechazados() {
    Alert.alert(
      "Limpiar eventos rechazados",
      `Esto eliminará ${eventosRechazados} evento(s) rechazado(s). ¿Continuar?`,
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

  async function handleLimpiarAportesRechazados() {
    const n = contadores?.rechazados ?? 0;
    Alert.alert(
      "Limpiar aportes rechazados",
      `Esto eliminará ${n} aporte(s) que el servidor rechazó. ¿Continuar?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Limpiar",
          style: "destructive",
          onPress: async () => {
            const eliminados = await limpiarAportesRechazados();
            await cargar();
            Alert.alert("Listo", `${eliminados} aporte(s) rechazado(s) eliminados.`);
          },
        },
      ]
    );
  }

  async function handleLimpiarPorPosicion(posicion: number) {
    const total = contadores?.porPosicion[posicion] ?? 0;
    Alert.alert(
      `Limpiar aportes P${posicion}`,
      `Esto eliminará ${total} aporte(s) locales de la posición ${posicion} (todos los estados). Los datos ya enviados al servidor NO se perderán.\n\n¿Continuar?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Limpiar P" + posicion,
          style: "destructive",
          onPress: async () => {
            const eliminados = await limpiarAportesPorPosicion(posicion);
            await cargar();
            Alert.alert("Listo", `${eliminados} aporte(s) de P${posicion} eliminados.`);
          },
        },
      ]
    );
  }

  async function handleLimpiarTodos() {
    const total = contadores?.total ?? 0;
    Alert.alert(
      "⚠️ Limpiar TODOS los aportes",
      `Esto eliminará ${total} aporte(s) locales de los 4 técnicos (pendientes, sincronizados y rechazados). Los datos ya sincronizados al servidor NO se perderán.\n\n¿Continuar?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Limpiar todo",
          style: "destructive",
          onPress: async () => {
            const n = await limpiarTodosAportesLocales();
            await cargar();
            Alert.alert("Listo", `${n} aporte(s) locales eliminados.`);
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

      const totalEnviados   = resultado.aceptados + resultadoAportes.enviados;
      const totalErrores    = [...resultado.errores, ...resultadoAportes.errores];
      const totalPendientes = resultado.total + resultadoAportes.total;

      if (totalErrores.length > 0) {
        Alert.alert(
          "Sincronización con errores",
          `✅ ${totalEnviados} enviados\n❌ ${resultado.rechazados + resultadoAportes.rechazados} rechazados\n\n${totalErrores.join("\n")}`
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

  const nPendientesReales = aportesPendientes.filter(a => a.syncEstado === "PENDIENTE").length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>

      {/* Banner de aportes pendientes */}
      {nPendientesReales > 0 && (
        <View style={styles.bannerPendiente}>
          <Ionicons name="warning-outline" size={22} color="#92400e" />
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerPendienteTitulo}>
              {nPendientesReales} aporte(s) pendiente(s) de sincronizar
            </Text>
            <Text style={styles.bannerPendienteSub}>
              Presiona "Sincronizar ahora" para enviarlos al servidor.
            </Text>
          </View>
        </View>
      )}

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
                {nPendientesReales} aporte(s) de campaña · {pendientes.length} evento(s)
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
      </View>

      {/* ── Herramientas de limpieza (solo ADMIN) ── */}
      {esAdmin && (
        <View style={styles.limpiezaCard}>
          <Text style={styles.sectionTitle}>Herramientas de limpieza</Text>

          {/* Limpiar eventos rechazados */}
          <TouchableOpacity
            style={[styles.limpiezaFila, eventosRechazados === 0 && styles.limpiezaFilaDisabled]}
            onPress={handleLimpiarEventosRechazados}
            disabled={eventosRechazados === 0}
          >
            <View style={styles.limpiezaInfo}>
              <Ionicons name="trash-outline" size={16} color={eventosRechazados > 0 ? "#ef4444" : "#d1d5db"} />
              <Text style={[styles.limpiezaTexto, eventosRechazados === 0 && styles.limpiezaTextoDisabled]}>Limpiar eventos rechazados</Text>
            </View>
            <View style={[styles.contadorBadge, eventosRechazados > 0 ? styles.badgeRojo : styles.badgeGris]}>
              <Text style={[styles.contadorText, eventosRechazados > 0 ? { color: "#ef4444" } : { color: "#9ca3af" }]}>
                {eventosRechazados}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Limpiar aportes rechazados */}
          <TouchableOpacity
            style={[styles.limpiezaFila, (contadores?.rechazados ?? 0) === 0 && styles.limpiezaFilaDisabled]}
            onPress={handleLimpiarAportesRechazados}
            disabled={(contadores?.rechazados ?? 0) === 0}
          >
            <View style={styles.limpiezaInfo}>
              <Ionicons name="flag-outline" size={16} color={(contadores?.rechazados ?? 0) > 0 ? "#ef4444" : "#d1d5db"} />
              <Text style={[styles.limpiezaTexto, (contadores?.rechazados ?? 0) === 0 && styles.limpiezaTextoDisabled]}>Limpiar aportes rechazados</Text>
            </View>
            <View style={[styles.contadorBadge, (contadores?.rechazados ?? 0) > 0 ? styles.badgeRojo : styles.badgeGris]}>
              <Text style={[styles.contadorText, (contadores?.rechazados ?? 0) > 0 ? { color: "#ef4444" } : { color: "#9ca3af" }]}>
                {contadores?.rechazados ?? 0}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Limpiar por posición */}
          <View style={styles.limpiezaSeccion}>
            <Text style={styles.limpiezaSubtitulo}>Limpiar aportes locales por posición</Text>
            <View style={styles.posicionesGrid}>
              {[1, 2, 3, 4].map((pos) => {
                const total = contadores?.porPosicion[pos] ?? 0;
                return (
                  <TouchableOpacity
                    key={pos}
                    style={[styles.posicionBtn, total > 0 ? styles.posicionBtnActivo : styles.posicionBtnVacio]}
                    onPress={() => handleLimpiarPorPosicion(pos)}
                    disabled={total === 0}
                  >
                    <Text style={[styles.posicionLabel, total > 0 ? { color: "#7c3aed" } : { color: "#d1d5db" }]}>
                      P{pos}
                    </Text>
                    <Text style={[styles.posicionContador, total > 0 ? { color: "#7c3aed" } : { color: "#d1d5db" }]}>
                      {total}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.posicionNota}>
              Elimina todos los aportes de esa posición (pendientes, sync y rechazados).
            </Text>
          </View>

          {/* Limpiar todos */}
          <TouchableOpacity
            style={[styles.limpiezaFila, { borderTopWidth: 1, borderTopColor: "#f0f0f0", marginTop: 4, paddingTop: 12 }, (contadores?.total ?? 0) === 0 && styles.limpiezaFilaDisabled]}
            onPress={handleLimpiarTodos}
            disabled={(contadores?.total ?? 0) === 0}
          >
            <View style={styles.limpiezaInfo}>
              <Ionicons name="nuclear-outline" size={16} color={(contadores?.total ?? 0) > 0 ? "#7c3aed" : "#d1d5db"} />
              <Text style={[styles.limpiezaTexto, (contadores?.total ?? 0) > 0 ? { color: "#7c3aed" } : styles.limpiezaTextoDisabled]}>Limpiar TODOS los aportes locales</Text>
            </View>
            <View style={[styles.contadorBadge, (contadores?.total ?? 0) > 0 ? styles.badgePurple : styles.badgeGris]}>
              <Text style={[styles.contadorText, (contadores?.total ?? 0) > 0 ? { color: "#7c3aed" } : { color: "#9ca3af" }]}>
                {contadores?.total ?? 0}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Resultado del último sync */}
      {(ultimo || ultimoAportes) && (
        <View style={styles.resultadoCard}>
          <Text style={styles.sectionTitle}>Último resultado</Text>
          {ultimo && (
            <>
              <View style={styles.resultadoFila}>
                <Ionicons name="checkmark-circle" size={16} color={VERDE} />
                <Text style={styles.resultadoText}>Eventos aceptados: {ultimo.aceptados}</Text>
              </View>
              {ultimo.rechazados > 0 && (
                <View style={styles.resultadoFila}>
                  <Ionicons name="close-circle" size={16} color="#ef4444" />
                  <Text style={styles.resultadoText}>Eventos rechazados: {ultimo.rechazados}</Text>
                </View>
              )}
            </>
          )}
          {ultimoAportes && (
            <>
              <View style={styles.resultadoFila}>
                <Ionicons name="checkmark-circle" size={16} color={VERDE} />
                <Text style={styles.resultadoText}>Aportes enviados: {ultimoAportes.enviados}</Text>
              </View>
              {ultimoAportes.rechazados > 0 && (
                <View style={styles.resultadoFila}>
                  <Ionicons name="close-circle" size={16} color="#ef4444" />
                  <Text style={styles.resultadoText}>Aportes rechazados: {ultimoAportes.rechazados}</Text>
                </View>
              )}
            </>
          )}
          {[...(ultimo?.errores ?? []), ...(ultimoAportes?.errores ?? [])].length > 0 && (
            <View style={styles.erroresBox}>
              {[...(ultimo?.errores ?? []), ...(ultimoAportes?.errores ?? [])].map((e, i) => (
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
            Si la verificación es exitosa, las fotos locales se eliminan del dispositivo.
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
          <Text style={styles.sectionTitle}>
            Aportes de campaña ({aportesPendientes.length})
          </Text>
          {aportesPendientes.map((a) => {
            let camposTexto = "";
            try { camposTexto = Object.keys(JSON.parse(a.campos)).join(", "); } catch {}
            const esRechazado = a.syncEstado === "RECHAZADO";
            return (
              <View key={a.id} style={styles.eventoRow}>
                <Ionicons
                  name={esRechazado ? "close-circle-outline" : "flag-outline"}
                  size={14}
                  color={esRechazado ? "#ef4444" : "#f59e0b"}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.eventoTipo, esRechazado && { color: "#ef4444" }]}>
                    P{a.posicion} · {a.fechaAporte.substring(0, 10)}
                    {esRechazado ? "  ❌ RECHAZADO" : "  ⏳ pendiente"}
                  </Text>
                  <Text style={styles.eventoFecha}>
                    Campos: {camposTexto || "—"}
                    {a.fotoHash ? " · 📷" : ""}{a.audioHash ? " · 🎙" : ""}
                  </Text>
                  {esRechazado && (
                    <TouchableOpacity
                      onPress={async () => {
                        await reintentarAporteRechazado(a.id);
                        await cargar();
                      }}
                    >
                      <Text style={styles.reintentarText}>↺ Marcar para reintentar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Lista de eventos pendientes */}
      {pendientes.length > 0 && (
        <View style={styles.pendientesCard}>
          <Text style={styles.sectionTitle}>Eventos pendientes ({pendientes.length})</Text>
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
  bannerPendiente: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: "#fef3c7", borderBottomWidth: 2, borderBottomColor: "#f59e0b",
    paddingHorizontal: 16, paddingVertical: 14,
  },
  bannerPendienteTitulo: { fontSize: 14, fontWeight: "700", color: "#92400e", lineHeight: 20 },
  bannerPendienteSub:    { fontSize: 12, color: "#b45309", marginTop: 2 },
  estadoCard: {
    backgroundColor: "#fff", margin: 16, borderRadius: 16, padding: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  estadoHeader: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 20 },
  estadoNumero: { fontSize: 36, fontWeight: "bold", color: "#222" },
  estadoLabel:  { fontSize: 14, color: "#666" },
  estadoDetalle:{ fontSize: 12, color: "#9ca3af", marginTop: 2 },
  btnSync: {
    backgroundColor: VERDE, borderRadius: 12, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  btnDeshabilitado: { opacity: 0.6 },
  btnSyncText: { color: "#fff", fontSize: 16, fontWeight: "bold" },

  // ── Limpieza ─────────────────────────────────────────────────────────────────
  limpiezaCard: {
    backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 16,
    borderRadius: 14, padding: 16,
  },
  limpiezaFila: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 10,
  },
  limpiezaInfo: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  limpiezaTexto: { fontSize: 13, color: "#374151" },
  limpiezaTextoDisabled: { color: "#d1d5db" },
  limpiezaFilaDisabled: { opacity: 0.5 },
  contadorBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, minWidth: 32, alignItems: "center" },
  badgeRojo:   { backgroundColor: "#fee2e2" },
  badgeGris:   { backgroundColor: "#f3f4f6" },
  badgePurple: { backgroundColor: "#ede9fe" },
  contadorText: { fontSize: 12, fontWeight: "700" },

  limpiezaSeccion: { marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  limpiezaSubtitulo: { fontSize: 12, fontWeight: "600", color: "#6b7280", marginBottom: 8 },
  posicionesGrid: { flexDirection: "row", gap: 8, marginBottom: 6 },
  posicionBtn: {
    flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center",
    borderWidth: 1,
  },
  posicionBtnActivo: { backgroundColor: "#ede9fe", borderColor: "#c4b5fd" },
  posicionBtnVacio:  { backgroundColor: "#f9fafb", borderColor: "#e5e7eb" },
  posicionLabel:   { fontSize: 13, fontWeight: "700" },
  posicionContador:{ fontSize: 11, marginTop: 2 },
  posicionNota:    { fontSize: 11, color: "#9ca3af", lineHeight: 16 },

  // ── Resultado ─────────────────────────────────────────────────────────────────
  resultadoCard: {
    backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 16,
    borderRadius: 14, padding: 16,
  },
  sectionTitle: { fontSize: 15, fontWeight: "bold", color: "#222", marginBottom: 12 },
  resultadoFila: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  resultadoText: { fontSize: 14, color: "#444" },
  erroresBox: {
    backgroundColor: "#fef2f2", borderRadius: 8, padding: 10, marginTop: 8,
  },
  errorText: { fontSize: 12, color: "#ef4444", lineHeight: 20 },

  // ── Info ─────────────────────────────────────────────────────────────────────
  infoCard: {
    backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 16,
    borderRadius: 14, padding: 16,
  },
  paso: { flexDirection: "row", gap: 12, marginBottom: 12, alignItems: "flex-start" },
  pasoNum: {
    backgroundColor: VERDE, width: 22, height: 22, borderRadius: 11,
    alignItems: "center", justifyContent: "center",
  },
  pasoNumText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  pasoText: { flex: 1, fontSize: 13, color: "#555", lineHeight: 19 },

  // ── Listas ──────────────────────────────────────────────────────────────────
  pendientesCard: {
    backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 16,
    borderRadius: 14, padding: 16,
  },
  eventoRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f0f0f0",
  },
  eventoTipo: { fontSize: 13, fontWeight: "600", color: "#333" },
  eventoFecha: { fontSize: 12, color: "#888" },
  eventoHash: { fontSize: 10, color: "#aaa", fontFamily: "monospace" },
  reintentarText: { fontSize: 12, color: "#3b82f6", fontWeight: "600", marginTop: 4 },
});
