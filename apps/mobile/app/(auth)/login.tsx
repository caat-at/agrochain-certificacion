import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from "react-native";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useSesion } from "../../src/store/sesionStore";
import { login } from "../../src/services/sync";

const VERDE = "#1a7f4b";
const API_DEFAULT = "http://192.168.0.74:3001"; // IP local del servidor

export default function LoginScreen() {
  const { iniciarSesion } = useSesion();

  const [email, setEmail]       = useState("agricultor@agrochain.co");
  const [password, setPassword] = useState("password123");
  const [apiUrl, setApiUrl]     = useState(API_DEFAULT);
  const [verPass, setVerPass]   = useState(false);
  const [cargando, setCargando] = useState(false);
  const [mostrarUrl, setMostrarUrl] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Campos requeridos", "Ingrese email y contraseña.");
      return;
    }

    setCargando(true);
    try {
      const resp = await login(email.trim().toLowerCase(), password, apiUrl.trim());
      await iniciarSesion({
        userId: resp.usuario.id,
        nombre: resp.usuario.nombre,
        email: resp.usuario.email,
        rol: resp.usuario.rol,
        token: resp.token,
        apiUrl: apiUrl.trim(),
      });
    } catch (err) {
      Alert.alert("Error de acceso", String(err));
    } finally {
      setCargando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Logo / Encabezado */}
        <View style={styles.header}>
          <Ionicons name="leaf" size={60} color={VERDE} />
          <Text style={styles.titulo}>AgroChain</Text>
          <Text style={styles.subtitulo}>Trazabilidad agrícola certificada</Text>
        </View>

        {/* Formulario */}
        <View style={styles.card}>
          <Text style={styles.label}>Correo electrónico</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="tecnico@ejemplo.com"
            placeholderTextColor="#aaa"
          />

          <Text style={styles.label}>Contraseña</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!verPass}
              placeholder="••••••••"
              placeholderTextColor="#aaa"
            />
            <TouchableOpacity onPress={() => setVerPass(!verPass)} style={styles.ojito}>
              <Ionicons name={verPass ? "eye-off-outline" : "eye-outline"} size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* URL del servidor (colapsable) */}
          <TouchableOpacity onPress={() => setMostrarUrl(!mostrarUrl)} style={styles.urlToggle}>
            <Ionicons name="settings-outline" size={14} color="#999" />
            <Text style={styles.urlToggleText}>Configurar servidor</Text>
          </TouchableOpacity>
          {mostrarUrl && (
            <>
              <Text style={styles.label}>URL del servidor</Text>
              <TextInput
                style={styles.input}
                value={apiUrl}
                onChangeText={setApiUrl}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="http://192.168.1.100:3001"
                placeholderTextColor="#aaa"
              />
            </>
          )}

          <TouchableOpacity
            style={[styles.btn, cargando && styles.btnDeshabilitado]}
            onPress={handleLogin}
            disabled={cargando}
          >
            {cargando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnTexto}>Ingresar</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>v1.0.0 — Polygon Amoy</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#f0faf4",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  titulo: {
    fontSize: 32,
    fontWeight: "bold",
    color: VERDE,
    marginTop: 8,
  },
  subtitulo: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#444",
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#222",
    backgroundColor: "#fafafa",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  ojito: {
    position: "absolute",
    right: 12,
  },
  urlToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 12,
  },
  urlToggleText: {
    fontSize: 12,
    color: "#999",
  },
  btn: {
    backgroundColor: VERDE,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  btnDeshabilitado: {
    opacity: 0.6,
  },
  btnTexto: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  version: {
    marginTop: 24,
    fontSize: 12,
    color: "#bbb",
  },
});
