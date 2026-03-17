/**
 * Pantalla: Registrar Aporte Técnico (nueva arquitectura multi-técnico)
 *
 * Cada técnico llena SOLO los campos de su posición asignada.
 * Fecha, GPS capturados automáticamente al guardar.
 * Cada aporte genera su propio contentHash inmutable.
 * Foto y audio son propios de cada técnico.
 */
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image,
} from "react-native";
import { useState, useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Audio } from "expo-av";
import { guardarAporteLocal } from "../src/services/campanas";
import { generarHashFoto, generarHashAudio } from "../src/lib/hash";
import { useSesion } from "../src/store/sesionStore";

const VERDE = "#1a7f4b";

// Opciones predefinidas para campos de selección
const OPCIONES_CAMPO: Record<string, string[]> = {
  estadoFenologico: ["Plántula", "Vegetativo", "Floración", "Fructificación", "Madurez"],
  estadoSanitario:  ["Sano", "Con plaga", "Con enfermedad", "Con deficiencia", "Requiere atención"],
};

// Metadata de campos conocidos
const META_CAMPO: Record<string, { label: string; tipo: "numero" | "texto" | "seleccion"; unidad?: string; placeholder?: string }> = {
  descripcion:      { label: "Descripción", tipo: "texto", placeholder: "Observaciones del evento en campo..." },
  alturaCm:         { label: "Altura de planta", tipo: "numero", unidad: "cm", placeholder: "Ej: 120" },
  diametroTalloCm:  { label: "Diámetro de tallo", tipo: "numero", unidad: "cm", placeholder: "Ej: 4.5" },
  numHojas:         { label: "Número de hojas", tipo: "numero", placeholder: "Ej: 12" },
  estadoFenologico: { label: "Estado fenológico", tipo: "seleccion" },
  estadoSanitario:  { label: "Estado sanitario", tipo: "seleccion" },
  profundidadCm:    { label: "Profundidad de siembra", tipo: "numero", unidad: "cm", placeholder: "Ej: 5" },
};

function getMeta(campo: string) {
  return META_CAMPO[campo] ?? {
    label: campo.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim(),
    tipo: "texto" as const,
    placeholder: "Ingresa el valor...",
  };
}

export default function RegistrarAporteScreen() {
  const router = useRouter();
  const { sesion } = useSesion();
  const {
    campanaId,
    plantaId,
    codigoPlanta,
    posicion: posicionParam,
    campos: camposParam,
  } = useLocalSearchParams<{
    campanaId: string;
    plantaId: string;
    codigoPlanta: string;
    posicion: string;
    campos: string | string[];  // Expo Router puede decodificar el array automáticamente
  }>();

  const posicion = parseInt(posicionParam ?? "0", 10);

  // Expo Router puede devolver el parámetro como string o string[] si detecta corchetes
  const camposAsignados: string[] = (() => {
    if (!camposParam) return [];
    if (Array.isArray(camposParam)) return camposParam;
    try {
      const parsed = JSON.parse(decodeURIComponent(camposParam));
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [camposParam];
    }
  })();

  // Separar campos de datos de foto/audio
  const camposDatos = camposAsignados.filter((c) => c !== "foto" && c !== "audio");
  const tieneFoto   = camposAsignados.includes("foto");
  const tieneAudio  = camposAsignados.includes("audio");

  const [valores, setValores] = useState<Record<string, string>>(
    Object.fromEntries(camposDatos.map((c) => [c, ""]))
  );
  const [guardando, setGuardando] = useState(false);
  const [fechaHora] = useState(() => {
    const now = new Date();
    return now.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" })
      + "  " + now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  });

  // GPS — automático al montar
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [obteniendoGps, setObteniendoGps] = useState(false);

  // Foto — propia del técnico
  const [fotoUri, setFotoUri]   = useState<string | null>(null);
  const [fotoHash, setFotoHash] = useState<string | null>(null);

  // Audio — propio del técnico
  const [audioUri, setAudioUri]     = useState<string | null>(null);
  const [audioHash, setAudioHash]   = useState<string | null>(null);
  const [grabando, setGrabando]     = useState(false);
  const [grabacion, setGrabacion]   = useState<Audio.Recording | null>(null);

  useEffect(() => {
    obtenerGps();
  }, []);

  async function obtenerGps() {
    setObteniendoGps(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setGps({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch {
      // GPS no disponible — continúa sin GPS
    } finally {
      setObteniendoGps(false);
    }
  }

  async function tomarFoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso denegado", "Se necesita acceso a la cámara.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: false });
    if (result.canceled) return;
    const asset = result.assets[0];
    const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: "base64" });
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
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setGrabacion(recording);
      setGrabando(true);
    } catch {
      Alert.alert("Error", "No se pudo iniciar la grabación.");
    }
  }

  async function detenerGrabacion() {
    if (!grabacion) { setGrabando(false); return; }
    const rec = grabacion;
    setGrabacion(null);
    setGrabando(false);
    try {
      const status = await rec.getStatusAsync();
      if (status.isRecording) await rec.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = rec.getURI();
      if (uri) {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
        const hash = await generarHashAudio(base64);
        setAudioUri(uri);
        setAudioHash(hash);
      }
    } catch { /* audio no crítico */ }
  }

  function validar(): string | null {
    for (const campo of camposDatos) {
      const meta = getMeta(campo);
      const v = valores[campo]?.trim();
      if (!v) return `El campo "${meta.label}" es obligatorio`;
      if (meta.tipo === "numero") {
        if (isNaN(parseFloat(v.replace(",", ".")))) return `"${meta.label}" debe ser un número`;
      }
    }
    if (tieneFoto && !fotoUri) return "Debes tomar la foto de evidencia";
    if (tieneAudio && !audioUri) return "Debes grabar la nota de voz";
    return null;
  }

  async function handleGuardar() {
    const error = validar();
    if (error) { Alert.alert("Datos incompletos", error); return; }

    setGuardando(true);
    try {
      const camposObj: Record<string, unknown> = {};
      for (const campo of camposDatos) {
        const meta = getMeta(campo);
        const v = valores[campo].trim().replace(",", ".");
        camposObj[campo] = meta.tipo === "numero" ? parseFloat(v) : v;
      }

      await guardarAporteLocal({
        campanaId,
        plantaId,
        posicion,
        campos:    camposObj,
        fotoHash:  fotoHash ?? undefined,
        fotoUri:   fotoUri ?? undefined,
        audioHash: audioHash ?? undefined,
        audioUri:  audioUri ?? undefined,
        latitud:   gps?.lat,
        longitud:  gps?.lng,
      });

      Alert.alert(
        "Aporte guardado",
        `Posición ${posicion} registrada con hash de integridad.\nSe enviará al servidor al sincronizar.`,
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (err) {
      Alert.alert("Error", String(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.btnBack}>
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <View style={s.headerInfo}>
          <Text style={s.headerTitle}>Registrar aporte</Text>
          <Text style={s.headerSub}>Planta {codigoPlanta} · Posición {posicion}</Text>
        </View>
        {/* Badge de posición */}
        <View style={s.posicionBadge}>
          <Text style={s.posicionText}>P{posicion}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Coordenadas GPS — solo lectura */}
        <View style={s.campoContainer}>
          <Text style={s.campoLabel}>
            <Ionicons name="location-outline" size={13} color="#6b7280" />{"  "}Coordenadas GPS
          </Text>
          <View style={s.inputBloqueado}>
            <Ionicons name="lock-closed-outline" size={14} color="#9ca3af" />
            <Text style={s.inputBloqueadoText}>
              {gps
                ? `${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}`
                : obteniendoGps ? "Obteniendo ubicación..." : "Sin GPS"}
            </Text>
            {!gps && !obteniendoGps && (
              <TouchableOpacity onPress={obtenerGps}>
                <Text style={s.gpsReintentar}>Reintentar</Text>
              </TouchableOpacity>
            )}
            {obteniendoGps && <ActivityIndicator size="small" color="#9ca3af" />}
          </View>
        </View>

        {/* Fecha y hora — solo lectura */}
        <View style={s.campoContainer}>
          <Text style={s.campoLabel}>
            <Ionicons name="calendar-outline" size={13} color="#6b7280" />{"  "}Fecha y hora de registro
          </Text>
          <View style={s.inputBloqueado}>
            <Ionicons name="lock-closed-outline" size={14} color="#9ca3af" />
            <Text style={s.inputBloqueadoText}>{fechaHora}</Text>
          </View>
        </View>

        {/* Campos de datos */}
        {camposDatos.length > 0 && (
          <View style={s.seccion}>
            <Text style={s.seccionTitle}>Datos — Posición {posicion}</Text>
            {camposDatos.map((campo) => {
              const meta = getMeta(campo);
              const opciones = OPCIONES_CAMPO[campo];
              return (
                <View key={campo} style={s.campoContainer}>
                  <Text style={s.campoLabel}>
                    {meta.label}{meta.unidad ? ` (${meta.unidad})` : ""}
                    <Text style={s.requerido}> *</Text>
                  </Text>
                  {opciones ? (
                    <View style={s.opcionesGrid}>
                      {opciones.map((op) => (
                        <TouchableOpacity
                          key={op}
                          style={[s.opcionBtn, valores[campo] === op && s.opcionBtnActive]}
                          onPress={() => setValores((p) => ({ ...p, [campo]: op }))}
                        >
                          <Text style={[s.opcionText, valores[campo] === op && s.opcionTextActive]}>
                            {op}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <TextInput
                      style={[s.input, valores[campo] ? s.inputFilled : null]}
                      value={valores[campo]}
                      onChangeText={(v) => setValores((p) => ({ ...p, [campo]: v }))}
                      placeholder={meta.placeholder ?? (meta.tipo === "numero" ? "0.0" : "Ingresa el valor...")}
                      keyboardType={meta.tipo === "numero" ? "decimal-pad" : "default"}
                      placeholderTextColor="#9ca3af"
                      multiline={campo === "descripcion"}
                      numberOfLines={campo === "descripcion" ? 3 : 1}
                    />
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Foto — si está asignada a esta posición */}
        {tieneFoto && (
          <View style={s.seccion}>
            <Text style={s.seccionTitle}>Evidencia fotográfica <Text style={s.requerido}>*</Text></Text>
            {fotoUri ? (
              <View style={s.mediaCard}>
                <Image source={{ uri: fotoUri }} style={s.fotoPreview} />
                <View style={s.mediaHashRow}>
                  <Ionicons name="checkmark-circle" size={14} color={VERDE} />
                  <Text style={s.mediaHashText}>Hash: {fotoHash?.substring(0, 20)}...</Text>
                </View>
                <TouchableOpacity onPress={() => { setFotoUri(null); setFotoHash(null); }}>
                  <Text style={s.mediaEliminar}>Cambiar foto</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={s.mediaBtn} onPress={tomarFoto}>
                <Ionicons name="camera-outline" size={28} color={VERDE} />
                <Text style={s.mediaBtnText}>Tomar foto de evidencia</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Audio — si está asignado a esta posición */}
        {tieneAudio && (
          <View style={s.seccion}>
            <Text style={s.seccionTitle}>Nota de voz <Text style={s.requerido}>*</Text></Text>
            {audioUri ? (
              <View style={s.audioCard}>
                <Ionicons name="checkmark-circle" size={20} color={VERDE} />
                <View style={{ flex: 1 }}>
                  <Text style={s.audioTexto}>Audio grabado</Text>
                  <Text style={s.mediaHashText}>Hash: {audioHash?.substring(0, 20)}...</Text>
                </View>
                <TouchableOpacity onPress={() => { setAudioUri(null); setAudioHash(null); }}>
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[s.mediaBtn, grabando && s.mediaBtnGrabando]}
                onPress={grabando ? detenerGrabacion : iniciarGrabacion}
              >
                <Ionicons
                  name={grabando ? "stop-circle" : "mic-outline"}
                  size={28} color={grabando ? "#ef4444" : VERDE}
                />
                <Text style={[s.mediaBtnText, grabando && { color: "#ef4444" }]}>
                  {grabando ? "Detener grabación" : "Grabar nota de voz"}
                </Text>
                {grabando && <ActivityIndicator size="small" color="#ef4444" />}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Hash info */}
        <View style={s.hashInfo}>
          <Ionicons name="shield-checkmark-outline" size={13} color="#3b82f6" />
          <Text style={s.hashInfoText}>
            Al guardar se genera un hash SHA256 que incluye tus datos, foto, audio, GPS y fecha.
            Es inmutable — cualquier cambio invalida el hash.
          </Text>
        </View>

        {/* Botón guardar */}
        <TouchableOpacity
          style={[s.btnGuardar, guardando && s.btnDisabled]}
          onPress={handleGuardar}
          disabled={guardando}
        >
          {guardando
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="save-outline" size={18} color="#fff" />
          }
          <Text style={s.btnGuardarText}>
            {guardando ? "Guardando..." : "Guardar aporte"}
          </Text>
        </TouchableOpacity>

        <Text style={s.notaSync}>Los datos se enviarán al servidor al sincronizar.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: "#f9fafb" },
  header:          { flexDirection: "row", alignItems: "center", gap: 10,
                     backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 12,
                     borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  btnBack:         { padding: 4 },
  headerInfo:      { flex: 1 },
  headerTitle:     { fontSize: 16, fontWeight: "700", color: "#111827" },
  headerSub:       { fontSize: 12, color: "#6b7280", marginTop: 1 },
  posicionBadge:   { backgroundColor: VERDE, borderRadius: 16, width: 32, height: 32,
                     alignItems: "center", justifyContent: "center" },
  posicionText:    { color: "#fff", fontWeight: "700", fontSize: 13 },
  scroll:          { padding: 16, gap: 16, paddingBottom: 40 },
  gpsReintentar:   { fontSize: 12, color: VERDE, fontWeight: "600" },
  infoCard:        { flexDirection: "row", gap: 8, padding: 10,
                     backgroundColor: "#eff6ff", borderRadius: 10, borderWidth: 1, borderColor: "#bfdbfe" },
  infoText:        { flex: 1, fontSize: 11, color: "#3b82f6", lineHeight: 16 },
  seccion:         { gap: 12 },
  seccionTitle:    { fontSize: 13, fontWeight: "700", color: "#374151",
                     borderBottomWidth: 1, borderBottomColor: "#f3f4f6", paddingBottom: 6 },
  campoContainer:  { gap: 6 },
  campoLabel:      { fontSize: 13, fontWeight: "600", color: "#374151" },
  requerido:       { color: "#ef4444" },
  input:           { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10,
                     padding: 12, fontSize: 15, color: "#111827", backgroundColor: "#fff" },
  inputFilled:     { borderColor: VERDE, backgroundColor: "#f0fdf4" },
  opcionesGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  opcionBtn:       { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8,
                     paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#fff" },
  opcionBtnActive: { borderColor: VERDE, backgroundColor: "#f0fdf4" },
  opcionText:      { fontSize: 13, color: "#374151" },
  opcionTextActive:{ color: VERDE, fontWeight: "600" },
  mediaCard:       { gap: 8 },
  fotoPreview:     { width: "100%", height: 180, borderRadius: 10 },
  mediaHashRow:    { flexDirection: "row", alignItems: "center", gap: 6 },
  mediaHashText:   { fontSize: 11, color: "#666", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  mediaEliminar:   { color: "#ef4444", fontSize: 13 },
  mediaBtn:        { borderWidth: 2, borderColor: VERDE, borderStyle: "dashed",
                     borderRadius: 12, paddingVertical: 20, alignItems: "center",
                     flexDirection: "row", justifyContent: "center", gap: 10, backgroundColor: "#f0fdf4" },
  mediaBtnGrabando:{ borderColor: "#ef4444", backgroundColor: "#fef2f2" },
  mediaBtnText:    { color: VERDE, fontSize: 14, fontWeight: "600" },
  audioCard:       { flexDirection: "row", alignItems: "center", gap: 10, padding: 12,
                     backgroundColor: "#f0fdf4", borderRadius: 10, borderWidth: 1, borderColor: "#bbf7d0" },
  audioTexto:      { fontSize: 14, fontWeight: "600", color: "#222" },
  hashInfo:        { flexDirection: "row", gap: 8, padding: 10,
                     backgroundColor: "#eff6ff", borderRadius: 10, borderWidth: 1, borderColor: "#bfdbfe" },
  hashInfoText:    { flex: 1, fontSize: 11, color: "#3b82f6", lineHeight: 16 },
  btnGuardar:      { flexDirection: "row", alignItems: "center", justifyContent: "center",
                     gap: 8, backgroundColor: VERDE, borderRadius: 12, paddingVertical: 14 },
  btnGuardarText:  { color: "#fff", fontSize: 15, fontWeight: "700" },
  btnDisabled:     { opacity: 0.5 },
  notaSync:        { textAlign: "center", fontSize: 11, color: "#9ca3af" },
  inputBloqueado:  { flexDirection: "row", alignItems: "center", gap: 8,
                     borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10,
                     padding: 12, backgroundColor: "#f3f4f6" },
  inputBloqueadoText: { fontSize: 15, color: "#6b7280", flex: 1 },
});
