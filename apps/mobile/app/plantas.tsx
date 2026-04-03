/**
 * Pantalla de plantas de un lote.
 * NTC 5400 §4.3 — Siembra e identificación individual de plantas.
 * ICA Res. 3168/2015 art. 7 — Trazabilidad de material vegetal.
 */
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Modal, ScrollView, Platform,
} from "react-native";
import { useState, useEffect, useCallback } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { listarPlantas, upsertPlanta, eliminarPlantasHuerfanas, PlantaLocal, listarAportesDeCampana } from "../src/services/db";
import { cargarPlantasDesdeServidor, registrarPlantaEnServidor } from "../src/services/sync";
import { cargarCampanaDesdeServidor, PlantaCampana } from "../src/services/campanas";
import { useSesion } from "../src/store/sesionStore";

const VERDE = "#1a7f4b";

const ORIGENES_MATERIAL = [
  "SEMILLA_CERTIFICADA", "ESQUEJE", "INJERTO", "ACODO", "VIVERO_CERTIFICADO",
];

const ORIGENES_LABEL: Record<string, string> = {
  SEMILLA_CERTIFICADA: "Semilla certificada",
  ESQUEJE:             "Esqueje",
  INJERTO:             "Injerto",
  ACODO:               "Acodo",
  VIVERO_CERTIFICADO:  "Vivero certificado",
};

export default function PlantasScreen() {
  const { loteId, codigoLote } = useLocalSearchParams<{ loteId: string; codigoLote: string }>();
  const router = useRouter();
  const { sesion } = useSesion();

  // Solo ADMIN puede registrar nuevas plantas
  const puedeRegistrarPlantas = sesion?.rol === "ADMIN";

  const [plantas, setPlantas]           = useState<PlantaLocal[]>([]);
  const [cargando, setCargando]         = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [guardando, setGuardando]       = useState(false);
  // Mapa de plantaId → estado en campaña activa
  const [estadosCampana, setEstadosCampana] = useState<Record<string, PlantaCampana>>({});
  const [campanaId, setCampanaId]           = useState<string | null>(null); // null = sin campaña
  const [miPosicion, setMiPosicion]         = useState<number | null>(null);
  const [misCampos, setMisCampos]           = useState<string[]>([]);
  // plantaIds con aporte local pendiente de sincronizar
  const [aportesLocales, setAportesLocales] = useState<Set<string>>(new Set());

  // Campos de identificación
  const [codigoPlanta, setCodigoPlanta]     = useState("");
  const [numeroPlanta, setNumeroPlanta]     = useState("");
  const [especie, setEspecie]               = useState("");
  const [variedad, setVariedad]             = useState("");
  const [origenMaterial, setOrigenMaterial] = useState("");
  const [procedenciaVivero, setProcedenciaVivero] = useState("");

  // Datos de siembra — NTC 5400 §4.3.1
  const [fechaSiembra, setFechaSiembra]               = useState(new Date().toISOString().substring(0, 10));
  const [alturaCm, setAlturaCm]                       = useState("");
  const [diametroTalloCm, setDiametroTalloCm]         = useState("");
  const [numHojas, setNumHojas]                       = useState("");
  const [estadoFenologico, setEstadoFenologico]       = useState("");

  // GPS
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lon: number; altitud?: number } | null>(null);
  const [obtenGPS, setObtenGPS]       = useState(false);

  const cargarLocal = useCallback(async () => {
    if (!loteId) return;
    setPlantas(await listarPlantas(loteId));
  }, [loteId]);

  useEffect(() => {
    async function init() {
      await cargarLocal();
      // Sincronizar con servidor al entrar (silencioso si no hay red)
      if (loteId) {
        // Cargar campaña activa para mostrar estado por planta
        try {
          const det = await cargarCampanaDesdeServidor(loteId);
          if (det) {
            const mapa: Record<string, PlantaCampana> = {};
            for (const p of det.plantas) mapa[p.id] = p;
            setEstadosCampana(mapa);
            setCampanaId(det.campana.id);
            setMiPosicion(det.miPosicion ?? null);
            setMisCampos(det.misCampos ?? []);
            // Construir set de plantaIds con aporte local (PENDIENTE o SINCRONIZADO)
            const aportesPend = await listarAportesDeCampana(det.campana.id);
            const localSet = new Set(aportesPend.map((a) => a.plantaId));
            setAportesLocales(localSet);
          } else {
            setEstadosCampana({});
            setCampanaId(null);
            setMiPosicion(null);
            setMisCampos([]);
            setAportesLocales(new Set());
          }
        } catch {
          setEstadosCampana({});
          setCampanaId(null);
          setMiPosicion(null);
          setMisCampos([]);
          setAportesLocales(new Set());
        }

        try {
          const remotas = await cargarPlantasDesdeServidor(loteId);
          for (const p of remotas) {
            await upsertPlanta({
              id: p.id,
              loteId,
              codigoPlanta: p.codigoPlanta,
              numeroPlanta: p.numeroPlanta,
              especie: p.especie ?? null,
              variedad: p.variedad ?? null,
              origenMaterial: (p as any).origenMaterial ?? null,
              procedenciaVivero: (p as any).procedenciaVivero ?? null,
              fechaSiembra: (p as any).fechaSiembra ?? null,
              alturaCmInicial: (p as any).alturaCmInicial ?? null,
              diametroTalloCmInicial: (p as any).diametroTalloCmInicial ?? null,
              numHojasInicial: (p as any).numHojasInicial ?? null,
              estadoFenologicoInicial: (p as any).estadoFenologicoInicial ?? null,
              latitud: p.latitud ?? null,
              longitud: p.longitud ?? null,
              altitudMsnm: (p as any).altitudMsnm ?? null,
              syncEstado: "SINCRONIZADO",
              creadoEn: new Date().toISOString(),
            });
          }
          // Eliminar plantas locales que ya no existen en el servidor
          await eliminarPlantasHuerfanas(loteId, remotas.map((p) => p.id));
          await cargarLocal();
        } catch { /* sin red — mostrar solo locales */ }
      }
    }
    init().finally(() => setCargando(false));
  }, [cargarLocal, loteId]);

  async function sincronizarPlantas() {
    if (!loteId) return;
    setActualizando(true);
    try {
      const remotas = await cargarPlantasDesdeServidor(loteId);
      for (const p of remotas) {
        await upsertPlanta({
          id: p.id,
          loteId,
          codigoPlanta: p.codigoPlanta,
          numeroPlanta: p.numeroPlanta ?? String(p.numeroPLanta ?? ""),
          especie: p.especie ?? null,
          variedad: p.variedad ?? null,
          origenMaterial: p.origenMaterial ?? null,
          procedenciaVivero: p.procedenciaVivero ?? null,
          fechaSiembra: p.fechaSiembra ?? null,
          alturaCmInicial: p.alturaCmInicial ?? null,
          diametroTalloCmInicial: p.diametroTalloCmInicial ?? null,
          numHojasInicial: p.numHojasInicial ?? null,
          estadoFenologicoInicial: p.estadoFenologicoInicial ?? null,
          latitud: p.latitud ?? null,
          longitud: p.longitud ?? null,
          altitudMsnm: p.altitudMsnm ?? null,
          syncEstado: "SINCRONIZADO",
          creadoEn: new Date().toISOString(),
        });
      }
      // Eliminar plantas locales que ya no existen en el servidor
      await eliminarPlantasHuerfanas(loteId, remotas.map((p) => p.id));
      await cargarLocal();
    } catch (err) {
      Alert.alert("Error", `No se pudieron cargar plantas: ${String(err)}`);
    } finally {
      setActualizando(false);
    }
  }

  async function obtenerUbicacion() {
    setObtenGPS(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permiso denegado", "Se necesita GPS para registrar la ubicación.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoordenadas({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        altitud: pos.coords.altitude ?? undefined,
      });
    } catch {
      Alert.alert("Error GPS", "No se pudo obtener la ubicación.");
    } finally {
      setObtenGPS(false);
    }
  }

  function abrirModal() {
    setCodigoPlanta("");
    setNumeroPlanta(String(plantas.length + 1));
    setEspecie("");
    setVariedad("");
    setOrigenMaterial("");
    setProcedenciaVivero("");
    setFechaSiembra(new Date().toISOString().substring(0, 10));
    setAlturaCm("");
    setDiametroTalloCm("");
    setNumHojas("");
    setEstadoFenologico("");
    setCoordenadas(null);
    setModalVisible(true);
    obtenerUbicacion();
  }

  async function registrarPlanta() {
    if (!loteId) return;
    if (!codigoPlanta.trim()) {
      Alert.alert("Requerido", "Ingrese el código de la planta.");
      return;
    }
    if (!numeroPlanta.trim()) {
      Alert.alert("Requerido", "Ingrese el número secuencial.");
      return;
    }
    if (!origenMaterial) {
      Alert.alert("Requerido", "Seleccione el origen del material vegetal (ICA obligatorio).");
      return;
    }
    if (!coordenadas) {
      Alert.alert("GPS requerido", "Se necesita la ubicación GPS de la planta.");
      return;
    }

    setGuardando(true);
    try {
      const planta = await registrarPlantaEnServidor(loteId, {
        codigoPlanta: codigoPlanta.trim().toUpperCase(),
        numeroPlanta: numeroPlanta.trim(),
        latitud: coordenadas.lat,
        longitud: coordenadas.lon,
        altitudMsnm: coordenadas.altitud,
        especie: especie.trim() || undefined,
        variedad: variedad.trim() || undefined,
        origenMaterial: origenMaterial || undefined,
        procedenciaVivero: procedenciaVivero.trim() || undefined,
        fechaSiembra: fechaSiembra.trim()
          ? new Date(`${fechaSiembra.trim()}T12:00:00`).toISOString()
          : undefined,
        alturaCmInicial: alturaCm ? parseFloat(alturaCm) : undefined,
        diametroTalloCmInicial: diametroTalloCm ? parseFloat(diametroTalloCm) : undefined,
        numHojasInicial: numHojas ? parseInt(numHojas) : undefined,
        estadoFenologicoInicial: estadoFenologico.trim() || undefined,
      });

      await upsertPlanta({
        id: planta.id,
        loteId,
        codigoPlanta: planta.codigoPlanta,
        numeroPlanta: planta.numeroPlanta ?? planta.numeroPLanta ?? numeroPlanta,
        especie: planta.especie ?? null,
        variedad: planta.variedad ?? null,
        origenMaterial: planta.origenMaterial ?? origenMaterial,
        procedenciaVivero: planta.procedenciaVivero ?? null,
        fechaSiembra: planta.fechaSiembra ?? null,
        alturaCmInicial: planta.alturaCmInicial ?? null,
        diametroTalloCmInicial: planta.diametroTalloCmInicial ?? null,
        numHojasInicial: planta.numHojasInicial ?? null,
        estadoFenologicoInicial: planta.estadoFenologicoInicial ?? null,
        latitud: coordenadas.lat,
        longitud: coordenadas.lon,
        altitudMsnm: coordenadas.altitud ?? null,
        syncEstado: "SINCRONIZADO",
        creadoEn: new Date().toISOString(),
      });

      await cargarLocal();
      setModalVisible(false);
      Alert.alert("✅ Planta registrada", `${planta.codigoPlanta} agregada al lote.`);
    } catch (err) {
      Alert.alert("Error", String(err));
    } finally {
      setGuardando(false);
    }
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
          <Text style={styles.headerTitulo}>Plantas del lote</Text>
          <Text style={styles.headerLote}>{codigoLote}</Text>
        </View>
        <TouchableOpacity onPress={sincronizarPlantas} style={styles.syncBtn} disabled={actualizando}>
          {actualizando
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="refresh-outline" size={20} color="#fff" />
          }
        </TouchableOpacity>
      </View>

      {/* Banner campaña activa / sin campaña */}
      {campanaId ? (
        miPosicion !== null ? (
          <View style={styles.bannerCampana}>
            <View style={styles.posicionBadge}>
              <Text style={styles.posicionBadgeText}>P{miPosicion}</Text>
            </View>
            <Text style={styles.bannerCampanaText}>
              Campos: {misCampos.filter(c => c !== "foto" && c !== "audio").join(", ")}
            </Text>
          </View>
        ) : (
          <View style={styles.bannerSinPosicion}>
            <Ionicons name="alert-circle-outline" size={14} color="#d97706" />
            <Text style={styles.bannerSinPosicionText}>Sin posición asignada — contacta al administrador</Text>
          </View>
        )
      ) : (
        <View style={styles.bannerSinCampana}>
          <Ionicons name="lock-closed-outline" size={14} color="#9ca3af" />
          <Text style={styles.bannerSinCampanaText}>Sin campaña activa — registro de eventos bloqueado</Text>
        </View>
      )}

      <FlatList
        data={plantas}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        renderItem={({ item }) => {
          const estadoC = estadosCampana[item.id];
          const estadoReg = estadoC?.estadoRegistro ?? (campanaId ? "SIN_REGISTRO" : null);
          // Puede registrar si: hay campaña activa Y la planta fue cargada desde el servidor
          // Y su estado permite registro Y el técnico tiene posición Y aún no aportó
          // Y no tiene aporte guardado localmente pendiente de sincronizar
          const tieneAporteLocal = aportesLocales.has(item.id);
          const puedeRegistrar = campanaId != null &&
            estadoC != null &&
            miPosicion !== null &&
            misCampos.length > 0 &&
            !estadoC.yaTecnicoAporto &&
            !tieneAporteLocal &&
            ["SIN_REGISTRO", "PARCIAL", "PENDIENTE", "ADULTERADO"].includes(estadoReg ?? "");

          const ESTADO_COLOR_CAM: Record<string, { bg: string; text: string; label: string }> = {
            COMPLETO:     { bg: "#dcfce7", text: VERDE,    label: "Completo"   },
            PARCIAL:      { bg: "#fef3c7", text: "#d97706", label: "Parcial"   },
            PENDIENTE:    { bg: "#f3f4f6", text: "#6b7280", label: "Pendiente" },
            SIN_REGISTRO: { bg: "#f3f4f6", text: "#6b7280", label: "Sin datos" },
            ADULTERADO:   { bg: "#fee2e2", text: "#dc2626", label: "Adulterado"},
            INVALIDADO:   { bg: "#ede9fe", text: "#7c3aed", label: "Invalidado"},
          };
          const est = ESTADO_COLOR_CAM[estadoReg ?? "SIN_REGISTRO"] ?? ESTADO_COLOR_CAM["SIN_REGISTRO"];

          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(
                `/detalle-planta?plantaId=${item.id}&loteId=${loteId}&codigoLote=${encodeURIComponent(codigoLote ?? "")}`
              )}
            >
              <View style={styles.cardLeft}>
                <View style={styles.cardIcono}>
                  <Ionicons name="leaf" size={20} color={VERDE} />
                </View>
                <View>
                  <Text style={styles.cardCodigo}>{item.codigoPlanta}</Text>
                  <Text style={styles.cardNumero}>N° {item.numeroPlanta}</Text>
                  {item.especie && <Text style={styles.cardEspecie}>{item.especie}</Text>}
                </View>
              </View>
              <View style={styles.cardRight}>
                {/* Badge de campaña (si hay campaña activa) */}
                {campanaId && (
                  <View style={[styles.badge, { backgroundColor: est.bg }]}>
                    <Text style={[styles.badgeText, { color: est.text }]}>{est.label}</Text>
                  </View>
                )}
                {/* Ícono de acción rápida para registrar */}
                {puedeRegistrar && (
                  <TouchableOpacity
                    style={styles.btnAccionRapida}
                    onPress={() => {
                      router.push(
                        `/registrar-aporte?campanaId=${campanaId}&plantaId=${item.id}&codigoPlanta=${encodeURIComponent(item.codigoPlanta)}&posicion=${miPosicion}&campos=${encodeURIComponent(JSON.stringify(misCampos))}`
                      );
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={estadoReg === "ADULTERADO" ? "warning-outline" : "add-circle"}
                      size={22}
                      color={estadoReg === "ADULTERADO" ? "#dc2626" : VERDE}
                    />
                  </TouchableOpacity>
                )}
                {!campanaId && (
                  <Ionicons name="chevron-forward" size={18} color="#ccc" />
                )}
                {campanaId && !puedeRegistrar && (
                  <Ionicons name="chevron-forward" size={18} color="#ccc" />
                )}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.vacio}>
            <Ionicons name="leaf-outline" size={60} color="#ccc" />
            <Text style={styles.vacioText}>Sin plantas registradas</Text>
            {puedeRegistrarPlantas && (
              <Text style={styles.vacioSub}>Toca + para registrar la primera planta</Text>
            )}
          </View>
        }
      />

      {puedeRegistrarPlantas && (
        <TouchableOpacity style={styles.fab} onPress={abrirModal}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Modal registro de planta */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitulo}>Registrar planta</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* ── IDENTIFICACIÓN ─────────────────────────────── */}
          <View style={styles.seccion}>
            <Ionicons name="qr-code-outline" size={15} color={VERDE} />
            <Text style={styles.seccionTexto}>Identificación — ICA Res. 3168/2015</Text>
          </View>

          <Text style={styles.label}>Código de planta *</Text>
          <TextInput
            style={styles.input}
            value={codigoPlanta}
            onChangeText={setCodigoPlanta}
            autoCapitalize="characters"
            placeholder="Ej: PL-001, A23, NFC-004"
            placeholderTextColor="#aaa"
          />

          <Text style={styles.label}>Número secuencial</Text>
          <View style={[styles.input, { backgroundColor: "#f3f4f6", justifyContent: "center" }]}>
            <Text style={{ color: "#6b7280", fontSize: 15 }}>#{numeroPlanta} — asignado automáticamente</Text>
          </View>

          <Text style={styles.label}>Especie (si difiere del lote)</Text>
          <TextInput
            style={styles.input}
            value={especie}
            onChangeText={setEspecie}
            placeholder="Ej: Coffea arabica"
            placeholderTextColor="#aaa"
          />

          <Text style={styles.label}>Variedad (si difiere del lote)</Text>
          <TextInput
            style={styles.input}
            value={variedad}
            onChangeText={setVariedad}
            placeholder="Ej: Castillo, Hass, Williams"
            placeholderTextColor="#aaa"
          />

          {/* ── ORIGEN MATERIAL VEGETAL ─────────────────────── */}
          <View style={[styles.seccion, { marginTop: 20 }]}>
            <Ionicons name="git-branch-outline" size={15} color={VERDE} />
            <Text style={styles.seccionTexto}>Origen del material vegetal *</Text>
          </View>
          <Text style={styles.labelInfo}>ICA Res. 3168/2015 art. 7 — obligatorio para certificación BPA</Text>

          <View style={styles.chipsWrap}>
            {ORIGENES_MATERIAL.map((o) => (
              <TouchableOpacity
                key={o}
                style={[styles.chip, origenMaterial === o && styles.chipActivo]}
                onPress={() => setOrigenMaterial(o)}
              >
                <Text style={[styles.chipText, origenMaterial === o && styles.chipTextActivo]}>
                  {ORIGENES_LABEL[o]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Procedencia / vivero proveedor</Text>
          <TextInput
            style={styles.input}
            value={procedenciaVivero}
            onChangeText={setProcedenciaVivero}
            placeholder="Ej: Vivero Cenicafé, CORPOICA"
            placeholderTextColor="#aaa"
          />

          {/* ── DATOS DE SIEMBRA ────────────────────────────── */}
          <View style={[styles.seccion, { marginTop: 20 }]}>
            <Ionicons name="calendar-outline" size={15} color={VERDE} />
            <Text style={styles.seccionTexto}>Datos de siembra — NTC 5400 §4.3</Text>
          </View>

          <Text style={styles.label}>Fecha de siembra *</Text>
          <TextInput
            style={styles.input}
            value={fechaSiembra}
            onChangeText={setFechaSiembra}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#aaa"
            keyboardType="numeric"
          />

          <Text style={styles.label}>Altura inicial (cm)</Text>
          <TextInput
            style={styles.input}
            value={alturaCm}
            onChangeText={setAlturaCm}
            keyboardType="decimal-pad"
            placeholder="Ej: 25"
            placeholderTextColor="#aaa"
          />

          <Text style={styles.label}>Diámetro de tallo (cm)</Text>
          <TextInput
            style={styles.input}
            value={diametroTalloCm}
            onChangeText={setDiametroTalloCm}
            keyboardType="decimal-pad"
            placeholder="Ej: 1.5"
            placeholderTextColor="#aaa"
          />

          <Text style={styles.label}>Número de hojas</Text>
          <TextInput
            style={styles.input}
            value={numHojas}
            onChangeText={setNumHojas}
            keyboardType="numeric"
            placeholder="Ej: 8"
            placeholderTextColor="#aaa"
          />

          <Text style={styles.label}>Estado fenológico inicial</Text>
          <TextInput
            style={styles.input}
            value={estadoFenologico}
            onChangeText={setEstadoFenologico}
            placeholder="Ej: Plántula, V1, V2, R1"
            placeholderTextColor="#aaa"
          />

          {/* ── UBICACIÓN GPS ───────────────────────────────── */}
          <View style={[styles.seccion, { marginTop: 20 }]}>
            <Ionicons name="location-outline" size={15} color={VERDE} />
            <Text style={styles.seccionTexto}>Ubicación GPS * — georeferenciación ICA</Text>
          </View>

          <View style={styles.gpsRow}>
            <Ionicons
              name={coordenadas ? "location" : "location-outline"}
              size={18}
              color={coordenadas ? VERDE : "#999"}
            />
            {obtenGPS ? (
              <ActivityIndicator size="small" color={VERDE} />
            ) : coordenadas ? (
              <Text style={styles.gpsText}>
                {coordenadas.lat.toFixed(6)}, {coordenadas.lon.toFixed(6)}
                {coordenadas.altitud != null ? `\nAltitud: ${coordenadas.altitud.toFixed(0)} msnm` : ""}
              </Text>
            ) : (
              <TouchableOpacity onPress={obtenerUbicacion}>
                <Text style={styles.gpsLink}>Obtener GPS</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[styles.btnGuardar, guardando && styles.btnDes]}
            onPress={registrarPlanta}
            disabled={guardando}
          >
            {guardando
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Ionicons name="save-outline" size={20} color="#fff" />
                  <Text style={styles.btnGuardarText}>Registrar planta</Text>
                </>
            }
          </TouchableOpacity>
        </ScrollView>
      </Modal>
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
  headerLote: { fontSize: 13, color: "#b7dfca" },
  lista: { paddingHorizontal: 16, paddingBottom: 100, gap: 10 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  cardLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardIcono: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "#f0faf4",
    alignItems: "center", justifyContent: "center",
  },
  cardCodigo: { fontSize: 15, fontWeight: "bold", color: "#222" },
  cardNumero: { fontSize: 12, color: "#888", marginTop: 1 },
  cardEspecie: { fontSize: 12, color: "#666", marginTop: 1 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeSync: { backgroundColor: "#dcfce7" },
  badgePend: { backgroundColor: "#fef9c3" },
  badgeText: { fontSize: 11, fontWeight: "600", color: "#444" },
  btnAccionRapida: { padding: 2 },
  bannerCampana: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#f0fdf4", borderBottomWidth: 1, borderBottomColor: "#bbf7d0",
    paddingHorizontal: 16, paddingVertical: 8,
  },
  bannerCampanaText: { fontSize: 12, color: VERDE, fontWeight: "500", flex: 1 },
  posicionBadge: { backgroundColor: VERDE, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  posicionBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  bannerSinPosicion: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#fffbeb", borderBottomWidth: 1, borderBottomColor: "#fde68a",
    paddingHorizontal: 16, paddingVertical: 8,
  },
  bannerSinPosicionText: { fontSize: 12, color: "#d97706" },
  bannerSinCampana: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#f9fafb", borderBottomWidth: 1, borderBottomColor: "#e5e7eb",
    paddingHorizontal: 16, paddingVertical: 8,
  },
  bannerSinCampanaText: { fontSize: 12, color: "#9ca3af" },
  vacio: { alignItems: "center", paddingTop: 60 },
  vacioText: { fontSize: 17, color: "#999", marginTop: 16 },
  vacioSub: { fontSize: 13, color: "#bbb", marginTop: 6 },
  fab: {
    position: "absolute", bottom: 28, right: 24,
    backgroundColor: VERDE,
    width: 56, height: 56, borderRadius: 28,
    alignItems: "center", justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2, shadowRadius: 5,
  },
  modal: { flex: 1, padding: 20, backgroundColor: "#fff" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingTop: Platform.OS === "android" ? 16 : 8,
  },
  modalTitulo: { fontSize: 20, fontWeight: "bold", color: "#222" },
  seccion: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#f0faf4",
  },
  seccionTexto: { fontSize: 13, fontWeight: "700", color: VERDE },
  label: { fontSize: 13, fontWeight: "600", color: "#444", marginTop: 16, marginBottom: 6 },
  labelInfo: { fontSize: 11, color: "#888", marginBottom: 8, fontStyle: "italic" },
  input: {
    borderWidth: 1, borderColor: "#ddd", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: "#222", backgroundColor: "#fafafa",
  },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chip: {
    borderWidth: 1, borderColor: "#ddd", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7, backgroundColor: "#fff",
  },
  chipActivo: { backgroundColor: VERDE, borderColor: VERDE },
  chipText: { fontSize: 13, color: "#555" },
  chipTextActivo: { color: "#fff", fontWeight: "600" },
  gpsRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, backgroundColor: "#f0faf4", borderRadius: 8, marginTop: 8,
  },
  gpsText: { fontSize: 12, color: "#444", flex: 1 },
  gpsLink: { fontSize: 14, color: VERDE, fontWeight: "600" },
  btnGuardar: {
    backgroundColor: VERDE, borderRadius: 12, paddingVertical: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, marginTop: 28,
  },
  btnDes: { opacity: 0.6 },
  btnGuardarText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
