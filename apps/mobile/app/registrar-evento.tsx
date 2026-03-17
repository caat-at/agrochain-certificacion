/**
 * Pantalla de registro de eventos en campo.
 *
 * Flujo de integridad:
 *  1. Técnico llena el formulario + foto (opcional)
 *  2. Al presionar "Guardar":
 *     a. Si hay foto → se calcula SHA256 de los bytes (fotoHash)
 *     b. Se calcula contentHash = SHA256 de todos los campos del evento
 *     c. Se verifica que NO exista un evento igual para misma planta+tipo+fecha
 *     d. Se guarda localmente con syncEstado = 'PENDIENTE'
 *  3. Al sincronizar → el servidor recalcula contentHash y lo verifica
 */
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Image, Platform,
} from "react-native";
import { useState, useCallback, useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system/legacy";
import { Audio } from "expo-av";
import { useSesion } from "../src/store/sesionStore";
import { generarHashEvento, generarHashFoto, generarHashAudio } from "../src/lib/hash";
import {
  guardarEvento, verificarDuplicadoLocal,
} from "../src/services/db";

const VERDE = "#1a7f4b";

const TIPOS_EVENTO = [
  "PREPARACION_SUELO", "SIEMBRA", "RIEGO", "FERTILIZACION",
  "CONTROL_PLAGAS", "CONTROL_ENFERMEDADES", "PODA", "COSECHA",
  "POSTCOSECHA", "MONITOREO", "OTRO",
];

// ── DEFINICIÓN DE CAMPOS EXTRA POR TIPO DE EVENTO ────────────────────────────
type CampoExtra = {
  key: string;
  label: string;
  placeholder: string;
  keyboardType?: "default" | "numeric" | "decimal-pad";
  opciones?: string[]; // para selección
};

const CAMPOS_EXTRA: Record<string, CampoExtra[]> = {
  SIEMBRA: [
    { key: "alturaCm",        label: "Altura de planta (cm)",    placeholder: "Ej: 25",   keyboardType: "decimal-pad" },
    { key: "diametroTalloCm", label: "Diámetro de tallo (cm)",   placeholder: "Ej: 1.5",  keyboardType: "decimal-pad" },
    { key: "numHojas",        label: "Número de hojas",          placeholder: "Ej: 8",    keyboardType: "numeric" },
    { key: "estadoFenologico",label: "Estado fenológico",        placeholder: "Ej: V2, R1, floración" },
    { key: "profundidadCm",   label: "Profundidad de siembra (cm)", placeholder: "Ej: 5", keyboardType: "decimal-pad" },
  ],
  RIEGO: [
    { key: "volumenLitros",   label: "Volumen de agua (L)",      placeholder: "Ej: 10",   keyboardType: "decimal-pad" },
    { key: "metodo",          label: "Método de riego",          placeholder: "Ej: goteo, aspersión, surco" },
    { key: "duracionMin",     label: "Duración (min)",           placeholder: "Ej: 30",   keyboardType: "numeric" },
  ],
  FERTILIZACION: [
    { key: "producto",        label: "Producto/fertilizante",    placeholder: "Ej: Urea, 15-15-15" },
    { key: "registroICA",     label: "Registro ICA",             placeholder: "Ej: 1234-A" },
    { key: "dosis",           label: "Dosis",                    placeholder: "Ej: 200",  keyboardType: "decimal-pad" },
    { key: "unidad",          label: "Unidad",                   placeholder: "Ej: g/planta, kg/ha, cc/L" },
    { key: "metodo",          label: "Método de aplicación",     placeholder: "Ej: foliar, edáfico, fertiriego" },
  ],
  CONTROL_PLAGAS: [
    { key: "plagaDetectada",  label: "Plaga detectada",          placeholder: "Ej: Áfido, trips, minador" },
    { key: "incidenciaPct",   label: "Incidencia (%)",           placeholder: "Ej: 15",   keyboardType: "decimal-pad" },
    { key: "severidad",       label: "Severidad",                placeholder: "Ej: leve, moderada, severa" },
    { key: "producto",        label: "Producto aplicado",        placeholder: "Ej: Imidacloprid" },
    { key: "registroICA",     label: "Registro ICA",             placeholder: "Ej: 1234-A" },
    { key: "dosis",           label: "Dosis (cc o g / L agua)",  placeholder: "Ej: 0.5",  keyboardType: "decimal-pad" },
    { key: "periodoReentrada",label: "Período reentrada (días)", placeholder: "Ej: 3",    keyboardType: "numeric" },
  ],
  CONTROL_ENFERMEDADES: [
    { key: "enfermedad",      label: "Enfermedad detectada",     placeholder: "Ej: Antracnosis, mildiu" },
    { key: "incidenciaPct",   label: "Incidencia (%)",           placeholder: "Ej: 20",   keyboardType: "decimal-pad" },
    { key: "producto",        label: "Producto aplicado",        placeholder: "Ej: Mancozeb" },
    { key: "registroICA",     label: "Registro ICA",             placeholder: "Ej: 1234-A" },
    { key: "dosis",           label: "Dosis (cc o g / L agua)",  placeholder: "Ej: 2",    keyboardType: "decimal-pad" },
    { key: "periodoReentrada",label: "Período reentrada (días)", placeholder: "Ej: 7",    keyboardType: "numeric" },
  ],
  PODA: [
    { key: "tipoPoda",        label: "Tipo de poda",             placeholder: "Ej: formación, producción, sanitaria" },
    { key: "pctRamasRemovidas",label: "% ramas removidas",      placeholder: "Ej: 20",   keyboardType: "decimal-pad" },
    { key: "alturaCm",        label: "Altura resultante (cm)",   placeholder: "Ej: 150",  keyboardType: "decimal-pad" },
  ],
  COSECHA: [
    { key: "pesoKg",          label: "Peso cosechado (kg)",      placeholder: "Ej: 12.5", keyboardType: "decimal-pad" },
    { key: "unidades",        label: "Número de unidades/frutos",placeholder: "Ej: 48",   keyboardType: "numeric" },
    { key: "calidad",         label: "Calidad",                  placeholder: "Ej: primera, segunda, exportación" },
    { key: "destino",         label: "Destino",                  placeholder: "Ej: exportación, mercado local" },
    { key: "gradoBrix",       label: "Grados Brix (si aplica)",  placeholder: "Ej: 18",   keyboardType: "decimal-pad" },
  ],
  INSPECCION_BPA: [
    { key: "numeralNTC5400",  label: "Numeral NTC5400",          placeholder: "Ej: 5.1.2" },
    { key: "resultado",       label: "Resultado",                placeholder: "CUMPLE / NO CUMPLE / PARCIAL" },
    { key: "hallazgo",        label: "Hallazgo principal",       placeholder: "Ej: Sin registros de aplicación" },
    { key: "accionCorrectiva",label: "Acción correctiva",        placeholder: "Ej: Capacitar al operario" },
  ],
  APLICACION_AGROQUIMICO: [
    { key: "nombreProducto",  label: "Nombre del producto",      placeholder: "Ej: Roundup" },
    { key: "registroICA",     label: "Registro ICA",             placeholder: "Ej: 1234-A" },
    { key: "principioActivo", label: "Principio activo",         placeholder: "Ej: Glifosato 480 g/L" },
    { key: "dosis",           label: "Dosis (cc o g / L agua)",  placeholder: "Ej: 5",    keyboardType: "decimal-pad" },
    { key: "volumenAguaL",    label: "Volumen agua (L/ha)",      placeholder: "Ej: 200",  keyboardType: "decimal-pad" },
    { key: "periodoReentrada",label: "Período reentrada (días)", placeholder: "Ej: 1",    keyboardType: "numeric" },
    { key: "lca",             label: "LMR / LCA",                placeholder: "Ej: 0.1 mg/kg" },
  ],
  ANALISIS_SUELO: [
    { key: "pH",              label: "pH",                       placeholder: "Ej: 6.2",  keyboardType: "decimal-pad" },
    { key: "materiaOrganicaPct",label: "Materia orgánica (%)",   placeholder: "Ej: 3.5",  keyboardType: "decimal-pad" },
    { key: "nitrogeno",       label: "Nitrógeno (ppm)",          placeholder: "Ej: 45",   keyboardType: "decimal-pad" },
    { key: "fosforo",         label: "Fósforo (ppm)",            placeholder: "Ej: 28",   keyboardType: "decimal-pad" },
    { key: "potasio",         label: "Potasio (meq/100g)",       placeholder: "Ej: 0.35", keyboardType: "decimal-pad" },
    { key: "calcio",          label: "Calcio (meq/100g)",        placeholder: "Ej: 8.5",  keyboardType: "decimal-pad" },
    { key: "magnesio",        label: "Magnesio (meq/100g)",      placeholder: "Ej: 2.1",  keyboardType: "decimal-pad" },
    { key: "laboratorio",     label: "Laboratorio análisis",     placeholder: "Ej: IGAC, Corpoica" },
  ],
};

// Campos morfológicos que se miden en CUALQUIER visita de seguimiento
const CAMPOS_MORFOLOGICOS: CampoExtra[] = [
  { key: "alturaCm",        label: "Altura de planta (cm)",    placeholder: "Ej: 120",  keyboardType: "decimal-pad" },
  { key: "diametroTalloCm", label: "Diámetro de tallo (cm)",   placeholder: "Ej: 4.5",  keyboardType: "decimal-pad" },
  { key: "estadoFenologico",label: "Estado fenológico",        placeholder: "Ej: vegetativo, floración, fructificación" },
  { key: "estadoSanitario", label: "Estado sanitario general", placeholder: "Ej: bueno, regular, con plagas" },
];

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export default function RegistrarEventoScreen() {
  const { loteId, codigoLote, plantaId: plantaIdParam, codigoPlanta: codigoPlantaParam } = useLocalSearchParams<{
    loteId: string;
    codigoLote: string;
    plantaId?: string;
    codigoPlanta?: string;
  }>();
  const router = useRouter();
  const { sesion } = useSesion();

  const [tipoEvento, setTipoEvento]   = useState("SIEMBRA");
  const [descripcion, setDescripcion] = useState("");
  // Fecha y hora local en formato YYYY-MM-DDTHH:mm
  const [fechaEvento, setFechaEvento] = useState(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });
  const [plantaId]                    = useState<string | null>(plantaIdParam ?? null);
  const [fotoUri, setFotoUri]         = useState<string | null>(null);
  const [fotoHash, setFotoHash]       = useState<string | null>(null);
  const [audioUri, setAudioUri]       = useState<string | null>(null);
  const [audioHash, setAudioHash]     = useState<string | null>(null);
  const [grabando, setGrabando]       = useState(false);
  const [grabacion, setGrabacion]     = useState<Audio.Recording | null>(null);
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lon: number } | null>(null);
  const [guardando, setGuardando]     = useState(false);
  const [obtenGPS, setObtenGPS]       = useState(false);
  const [datosExtra, setDatosExtra]   = useState<Record<string, string>>({});
  const [incluyeMorfologia, setIncluyeMorfologia] = useState(false);

  function cambiarTipoEvento(tipo: string) {
    setTipoEvento(tipo);
    setDatosExtra({});
    setIncluyeMorfologia(false);
  }

  function setCampoExtra(key: string, valor: string) {
    setDatosExtra((prev) => ({ ...prev, [key]: valor }));
  }

  // Obtener GPS automáticamente al abrir
  useEffect(() => {
    obtenerUbicacion();
  }, []);

  async function obtenerUbicacion() {
    setObtenGPS(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCoordenadas({ lat: pos.coords.latitude, lon: pos.coords.longitude });
    } catch {
      // GPS no disponible — continuar sin coordenadas
    } finally {
      setObtenGPS(false);
    }
  }

  async function seleccionarFoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso denegado", "Se necesita acceso a la cámara.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: false,
      base64: false,
    });

    if (result.canceled) return;
    const asset = result.assets[0];

    // Leer bytes de la foto para calcular hash
    const base64 = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: "base64",
    });
    const hash = await generarHashFoto(base64);

    setFotoUri(asset.uri);
    setFotoHash(hash);
  }

  async function iniciarGrabacion() {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permiso denegado", "Se necesita acceso al micrófono.");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setGrabacion(recording);
      setGrabando(true);
    } catch (err) {
      Alert.alert("Error", "No se pudo iniciar la grabación.");
    }
  }

  async function detenerGrabacion() {
    if (!grabacion) {
      setGrabando(false);
      return;
    }
    const rec = grabacion;
    setGrabacion(null);
    setGrabando(false);
    try {
      const status = await rec.getStatusAsync();
      if (status.isRecording) {
        await rec.stopAndUnloadAsync();
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = rec.getURI();
      if (uri) {
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: "base64",
        });
        const hash = await generarHashAudio(base64);
        setAudioUri(uri);
        setAudioHash(hash);
      }
    } catch (err) {
      // Audio no crítico — el evento se puede guardar sin él
      console.warn("Error al detener grabación:", err);
    }
  }

  async function guardar() {
    if (!sesion) return;
    if (!descripcion.trim()) {
      Alert.alert("Campo requerido", "Ingrese una descripción del evento.");
      return;
    }

    setGuardando(true);
    try {
      // 1. Verificar duplicado local (misma planta + tipo + fecha)
      const fechaDia = fechaEvento.substring(0, 10);
      const isDup = await verificarDuplicadoLocal(
        loteId!, plantaId, tipoEvento, fechaDia
      );
      if (isDup) {
        Alert.alert(
          "Evento duplicado",
          `Ya existe un evento "${tipoEvento}" para esta planta/lote en la fecha ${fechaDia}.\n\nNo se puede registrar el mismo evento dos veces en el mismo día.`
        );
        return;
      }

      // 2. Calcular SHA256 del evento (misma lógica que el servidor)
      // Filtrar campos vacíos de datosExtra
      const datosExtraFiltrados: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(datosExtra)) {
        if (v.trim() !== "") datosExtraFiltrados[k] = v.trim();
      }

      // Convertir YYYY-MM-DDTHH:mm a ISO 8601 con segundos
      const fechaIso = fechaEvento.length === 16 ? `${fechaEvento}:00.000Z` : new Date(fechaEvento).toISOString();

      const eventoData = {
        plantaId: plantaId,
        loteId: loteId!,
        tipoEvento,
        fechaEvento: fechaIso,
        latitud: coordenadas?.lat ?? null,
        longitud: coordenadas?.lon ?? null,
        tecnicoId: sesion.userId,
        descripcion: descripcion.trim(),
        datosExtra: datosExtraFiltrados,
        fotoHash: fotoHash ?? undefined,
        audioHash: audioHash ?? undefined,
      };
      const contentHash = await generarHashEvento(eventoData);

      // 3. Guardar en SQLite local
      await guardarEvento({
        id:          uuid(),
        loteId:      loteId!,
        plantaId:    plantaId,
        tipoEvento,
        fechaEvento: fechaIso,
        latitud:     coordenadas?.lat ?? null,
        longitud:    coordenadas?.lon ?? null,
        tecnicoId:   sesion.userId,
        descripcion: descripcion.trim(),
        datosExtra:  JSON.stringify(datosExtraFiltrados),
        fotoHash:    fotoHash,
        fotoUri:     fotoUri,
        audioHash:   audioHash,
        audioUri:    audioUri,
        contentHash,
        syncEstado:  "PENDIENTE",
        creadoEn:    new Date().toISOString(),
      });

      Alert.alert(
        "✅ Evento guardado",
        `Hash de integridad generado:\n${contentHash.substring(0, 20)}...\n\nSe sincronizará con el servidor cuando tenga conexión.`,
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (err) {
      Alert.alert("Error", String(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Encabezado */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitulo}>Registrar Evento</Text>
          <Text style={styles.headerLote}>
            {codigoLote}{codigoPlantaParam ? ` · Planta ${codigoPlantaParam}` : " · Todo el lote"}
          </Text>
        </View>
      </View>

      <View style={styles.form}>
        {/* Tipo de evento */}
        <Text style={styles.label}>Tipo de evento *</Text>
        <View style={styles.chipsWrap}>
          {TIPOS_EVENTO.map((tipo) => (
            <TouchableOpacity
              key={tipo}
              style={[styles.chip, tipoEvento === tipo && styles.chipActivo]}
              onPress={() => cambiarTipoEvento(tipo)}
            >
              <Text style={[styles.chipText, tipoEvento === tipo && styles.chipTextActivo]}>
                {tipo.replace(/_/g, " ")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Fecha y hora */}
        <Text style={styles.label}>Fecha y hora del evento *</Text>
        <TextInput
          style={styles.input}
          value={fechaEvento}
          onChangeText={setFechaEvento}
          placeholder="YYYY-MM-DDTHH:mm"
          placeholderTextColor="#aaa"
          keyboardType="default"
        />

        {/* Campos específicos por tipo de evento */}
        {CAMPOS_EXTRA[tipoEvento] && (
          <>
            <View style={styles.seccionExtra}>
              <Ionicons name="analytics-outline" size={15} color="#3b82f6" />
              <Text style={styles.seccionExtraText}>Datos agronómicos — {tipoEvento.replace(/_/g, " ")}</Text>
            </View>
            {CAMPOS_EXTRA[tipoEvento].map((campo) => (
              <View key={campo.key} style={{ marginBottom: 4 }}>
                <Text style={styles.label}>{campo.label}</Text>
                <TextInput
                  style={styles.input}
                  value={datosExtra[campo.key] ?? ""}
                  onChangeText={(v) => setCampoExtra(campo.key, v)}
                  placeholder={campo.placeholder}
                  placeholderTextColor="#aaa"
                  keyboardType={campo.keyboardType ?? "default"}
                />
              </View>
            ))}
          </>
        )}

        {/* Medidas morfológicas (toggle para todos los tipos) */}
        {tipoEvento !== "SIEMBRA" && (
          <TouchableOpacity
            style={styles.toggleMorfologia}
            onPress={() => setIncluyeMorfologia(!incluyeMorfologia)}
          >
            <Ionicons
              name={incluyeMorfologia ? "checkbox" : "square-outline"}
              size={20}
              color={VERDE}
            />
            <Text style={styles.toggleMorfologiaText}>Incluir medidas de la planta (altura, diámetro, fenología)</Text>
          </TouchableOpacity>
        )}
        {incluyeMorfologia && CAMPOS_MORFOLOGICOS.map((campo) => (
          <View key={campo.key} style={{ marginBottom: 4 }}>
            <Text style={styles.label}>{campo.label}</Text>
            <TextInput
              style={styles.input}
              value={datosExtra[campo.key] ?? ""}
              onChangeText={(v) => setCampoExtra(campo.key, v)}
              placeholder={campo.placeholder}
              placeholderTextColor="#aaa"
              keyboardType={campo.keyboardType ?? "default"}
            />
          </View>
        ))}

        {/* Descripción */}
        <Text style={styles.label}>Descripción *</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={descripcion}
          onChangeText={setDescripcion}
          multiline
          numberOfLines={4}
          placeholder="Describa las observaciones del evento en campo..."
          placeholderTextColor="#aaa"
          textAlignVertical="top"
        />

        {/* GPS */}
        <View style={styles.gpsRow}>
          <Ionicons
            name={coordenadas ? "location" : "location-outline"}
            size={16}
            color={coordenadas ? VERDE : "#999"}
          />
          {obtenGPS ? (
            <ActivityIndicator size="small" color={VERDE} />
          ) : coordenadas ? (
            <Text style={styles.gpsText}>
              {coordenadas.lat.toFixed(6)}, {coordenadas.lon.toFixed(6)}
            </Text>
          ) : (
            <TouchableOpacity onPress={obtenerUbicacion}>
              <Text style={styles.gpsLink}>Obtener ubicación GPS</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Foto */}
        <Text style={styles.label}>Evidencia fotográfica</Text>
        {fotoUri ? (
          <View style={styles.fotoContainer}>
            <Image source={{ uri: fotoUri }} style={styles.foto} />
            <View style={styles.fotoInfo}>
              <Ionicons name="checkmark-circle" size={16} color={VERDE} />
              <Text style={styles.fotoHash}>
                Hash: {fotoHash?.substring(0, 16)}...
              </Text>
            </View>
            <TouchableOpacity onPress={() => { setFotoUri(null); setFotoHash(null); }}>
              <Text style={styles.fotoEliminar}>Eliminar foto</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.fotoBtn} onPress={seleccionarFoto}>
            <Ionicons name="camera-outline" size={28} color={VERDE} />
            <Text style={styles.fotoBtnText}>Tomar foto de evidencia</Text>
          </TouchableOpacity>
        )}

        {/* Audio */}
        <Text style={styles.label}>Nota de voz</Text>
        {audioUri ? (
          <View style={styles.audioContainer}>
            <Ionicons name="checkmark-circle" size={20} color={VERDE} />
            <View style={{ flex: 1 }}>
              <Text style={styles.audioTexto}>Audio grabado</Text>
              <Text style={styles.audioHash}>Hash: {audioHash?.substring(0, 16)}...</Text>
            </View>
            <TouchableOpacity onPress={() => { setAudioUri(null); setAudioHash(null); }}>
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.audioBtn, grabando && styles.audioBtnGrabando]}
            onPress={grabando ? detenerGrabacion : iniciarGrabacion}
          >
            <Ionicons
              name={grabando ? "stop-circle" : "mic-outline"}
              size={28}
              color={grabando ? "#ef4444" : VERDE}
            />
            <Text style={[styles.audioBtnText, grabando && { color: "#ef4444" }]}>
              {grabando ? "Detener grabación" : "Grabar nota de voz"}
            </Text>
            {grabando && <ActivityIndicator size="small" color="#ef4444" />}
          </TouchableOpacity>
        )}

        {/* Información de integridad */}
        <View style={styles.infoIntegridad}>
          <Ionicons name="shield-checkmark-outline" size={14} color="#3b82f6" />
          <Text style={styles.infoIntegridadText}>
            Al guardar se generará un hash SHA256 que garantiza que los datos no fueron alterados en tránsito.
          </Text>
        </View>

        {/* Botón guardar */}
        <TouchableOpacity
          style={[styles.btnGuardar, guardando && styles.btnDeshabilitado]}
          onPress={guardar}
          disabled={guardando}
        >
          {guardando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color="#fff" />
              <Text style={styles.btnGuardarTexto}>Guardar evento</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
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
  headerTitulo: { fontSize: 18, fontWeight: "bold", color: "#fff" },
  headerLote: { fontSize: 13, color: "#b7dfca" },
  form: { padding: 16 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#444",
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#222",
    backgroundColor: "#fff",
  },
  textarea: { height: 100 },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  chip: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
    backgroundColor: "#fff",
  },
  chipActivo: { backgroundColor: VERDE, borderColor: VERDE },
  chipText: { fontSize: 13, color: "#555" },
  chipTextActivo: { color: "#fff", fontWeight: "600" },
  gpsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    padding: 10,
    backgroundColor: "#f0faf4",
    borderRadius: 8,
  },
  gpsText: { fontSize: 12, color: "#444", flex: 1 },
  gpsLink: { fontSize: 13, color: VERDE, fontWeight: "600" },
  fotoContainer: { gap: 8 },
  foto: { width: "100%", height: 200, borderRadius: 10 },
  fotoInfo: { flexDirection: "row", alignItems: "center", gap: 6 },
  fotoHash: { fontSize: 12, color: "#666", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  fotoEliminar: { color: "#ef4444", fontSize: 13 },
  fotoBtn: {
    borderWidth: 2,
    borderColor: VERDE,
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 24,
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f0faf4",
  },
  fotoBtnText: { color: VERDE, fontSize: 14, fontWeight: "600" },
  infoIntegridad: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    backgroundColor: "#eff6ff",
    borderRadius: 10,
    marginTop: 16,
    alignItems: "flex-start",
  },
  infoIntegridadText: { flex: 1, fontSize: 12, color: "#3b82f6", lineHeight: 18 },
  btnGuardar: {
    backgroundColor: VERDE,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
  },
  btnDeshabilitado: { opacity: 0.6 },
  btnGuardarTexto: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  audioBtn: {
    borderWidth: 2,
    borderColor: VERDE,
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#f0faf4",
  },
  audioBtnGrabando: {
    borderColor: "#ef4444",
    backgroundColor: "#fef2f2",
  },
  audioBtnText: { color: VERDE, fontSize: 14, fontWeight: "600" },
  audioContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    backgroundColor: "#f0faf4",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  audioTexto: { fontSize: 14, fontWeight: "600", color: "#222" },
  audioHash: { fontSize: 11, color: "#666", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  seccionExtra: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 20,
    marginBottom: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#dbeafe",
  },
  seccionExtraText: { fontSize: 13, fontWeight: "700", color: "#3b82f6" },
  toggleMorfologia: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    padding: 12,
    backgroundColor: "#f0faf4",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  toggleMorfologiaText: { flex: 1, fontSize: 13, color: "#444", lineHeight: 18 },
});
