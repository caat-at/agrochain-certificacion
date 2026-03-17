/**
 * Pantalla de verificación de certificados vía QR.
 * Escanea el QR del certificado → consulta el API → muestra trazabilidad.
 */
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, Alert, Platform,
} from "react-native";
import { useState, useRef } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useSesion } from "../../src/store/sesionStore";

const VERDE = "#1a7f4b";

interface VerificacionData {
  codigoLote: string;
  especie: string;
  variedad: string | null;
  predio: { nombre: string; municipio: string; departamento: string };
  agricultor: { nombre: string };
  estado: string;
  totalEventos: number;
  blockchain: {
    registrado: boolean;
    txHash: string | null;
    explorerUrl: string | null;
  };
  certificado: {
    numeroCertificado: string;
    tipo: string;
    fechaEmision: string;
    fechaVencimiento: string;
    valido: boolean;
    tokenId: number | null;
  } | null;
}

export default function VerificarScreen() {
  const { sesion } = useSesion();
  const [permission, requestPermission] = useCameraPermissions();
  const [escaneando, setEscaneando]     = useState(false);
  const [cargando, setCargando]         = useState(false);
  const [datos, setDatos]               = useState<VerificacionData | null>(null);
  const [error, setError]               = useState<string | null>(null);
  const procesando = useRef(false);

  function iniciarEscaneo() {
    if (!permission?.granted) {
      requestPermission();
      return;
    }
    setDatos(null);
    setError(null);
    setEscaneando(true);
    procesando.current = false;
  }

  async function onBarcodeScanned({ data }: { data: string }) {
    if (procesando.current) return;
    procesando.current = true;
    setEscaneando(false);

    // Extraer código de lote del QR (puede ser URL o código directo)
    let codigoLote = data.trim();
    try {
      const url = new URL(data);
      const partes = url.pathname.split("/");
      codigoLote = partes[partes.length - 1];
    } catch {
      // No es URL — usar el dato directamente
    }

    await verificarLote(codigoLote);
  }

  async function verificarLote(codigoLote: string) {
    if (!sesion) return;
    setCargando(true);
    setError(null);

    try {
      const resp = await fetch(`${sesion.apiUrl}/api/verificar/${encodeURIComponent(codigoLote)}`);
      if (!resp.ok) {
        const err = await resp.json() as { message?: string };
        throw new Error(err.message ?? `Error ${resp.status}`);
      }
      const data = await resp.json() as VerificacionData;
      setDatos(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setCargando(false);
    }
  }

  // Cámara activa
  if (escaneando) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onBarcodeScanned={onBarcodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        />
        <View style={styles.overlay}>
          <View style={styles.escanerMarco} />
          <Text style={styles.escanerTexto}>Apunta al código QR del certificado</Text>
        </View>
        <TouchableOpacity style={styles.cancelarBtn} onPress={() => setEscaneando(false)}>
          <Ionicons name="close-circle" size={40} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Botón de escaneo */}
      <View style={styles.scanCard}>
        <Ionicons name="qr-code-outline" size={60} color={VERDE} />
        <Text style={styles.scanTitulo}>Verificar certificado</Text>
        <Text style={styles.scanSubtitulo}>
          Escanea el QR del certificado o ingresa el código manualmente
        </Text>
        <TouchableOpacity style={styles.btnScan} onPress={iniciarEscaneo}>
          <Ionicons name="camera-outline" size={20} color="#fff" />
          <Text style={styles.btnScanText}>Escanear QR</Text>
        </TouchableOpacity>
      </View>

      {/* Cargando */}
      {cargando && (
        <View style={styles.centro}>
          <ActivityIndicator size="large" color={VERDE} />
          <Text style={styles.cargandoText}>Verificando en blockchain...</Text>
        </View>
      )}

      {/* Error */}
      {error && (
        <View style={styles.errorCard}>
          <Ionicons name="close-circle-outline" size={24} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Resultados */}
      {datos && (
        <View style={styles.resultados}>
          {/* Certificado */}
          {datos.certificado ? (
            <View style={[
              styles.certCard,
              datos.certificado.valido ? styles.certValido : styles.certInvalido
            ]}>
              <View style={styles.certHeader}>
                <Ionicons
                  name={datos.certificado.valido ? "ribbon" : "ribbon-outline"}
                  size={28}
                  color={datos.certificado.valido ? VERDE : "#ef4444"}
                />
                <View>
                  <Text style={styles.certNum}>{datos.certificado.numeroCertificado}</Text>
                  <Text style={styles.certEstado}>
                    {datos.certificado.valido ? "✅ CERTIFICADO VÁLIDO" : "❌ CERTIFICADO INVÁLIDO"}
                  </Text>
                </View>
              </View>
              <View style={styles.certInfo}>
                <Text style={styles.certInfoItem}>Tipo: {datos.certificado.tipo.replace(/_/g, " ")}</Text>
                <Text style={styles.certInfoItem}>
                  Emitido: {new Date(datos.certificado.fechaEmision).toLocaleDateString("es-CO")}
                </Text>
                <Text style={styles.certInfoItem}>
                  Vence: {new Date(datos.certificado.fechaVencimiento).toLocaleDateString("es-CO")}
                </Text>
                {datos.certificado.tokenId && (
                  <Text style={styles.certInfoItem}>NFT Token ID: #{datos.certificado.tokenId}</Text>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.sinCertCard}>
              <Ionicons name="information-circle-outline" size={20} color="#f59e0b" />
              <Text style={styles.sinCertText}>Este lote aún no tiene certificado emitido</Text>
            </View>
          )}

          {/* Lote */}
          <View style={styles.seccionCard}>
            <Text style={styles.seccionTitulo}>Información del lote</Text>
            <InfoFila label="Código" value={datos.codigoLote} />
            <InfoFila label="Especie" value={`${datos.especie}${datos.variedad ? ` · ${datos.variedad}` : ""}`} />
            <InfoFila label="Estado" value={datos.estado.replace(/_/g, " ")} />
            <InfoFila label="Predio" value={datos.predio.nombre} />
            <InfoFila label="Municipio" value={`${datos.predio.municipio}, ${datos.predio.departamento}`} />
            <InfoFila label="Agricultor" value={datos.agricultor.nombre} />
            <InfoFila label="Eventos registrados" value={String(datos.totalEventos)} />
          </View>

          {/* Blockchain */}
          <View style={styles.seccionCard}>
            <Text style={styles.seccionTitulo}>Registro en blockchain</Text>
            <View style={styles.bcRow}>
              <Ionicons
                name={datos.blockchain.registrado ? "checkmark-circle" : "close-circle"}
                size={18}
                color={datos.blockchain.registrado ? VERDE : "#ef4444"}
              />
              <Text style={styles.bcText}>
                {datos.blockchain.registrado
                  ? "Registrado en Polygon"
                  : "No registrado en blockchain"}
              </Text>
            </View>
            {datos.blockchain.txHash && (
              <Text style={styles.txHash} numberOfLines={1}>
                Tx: {datos.blockchain.txHash}
              </Text>
            )}
            {datos.blockchain.explorerUrl && (
              <Text style={styles.explorerLink}>
                Ver en PolygonScan →
              </Text>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function InfoFila({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoFila}>
      <Text style={styles.infoLabel}>{label}:</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  cameraContainer: { flex: 1, backgroundColor: "#000" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  escanerMarco: {
    width: 240,
    height: 240,
    borderWidth: 3,
    borderColor: "#fff",
    borderRadius: 16,
    backgroundColor: "transparent",
  },
  escanerTexto: {
    color: "#fff",
    fontSize: 14,
    marginTop: 20,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  cancelarBtn: {
    position: "absolute",
    bottom: 60,
    alignSelf: "center",
  },
  scanCard: {
    backgroundColor: "#fff",
    margin: 16,
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  scanTitulo: { fontSize: 20, fontWeight: "bold", color: "#222" },
  scanSubtitulo: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
  btnScan: {
    backgroundColor: VERDE,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  btnScanText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  centro: { alignItems: "center", padding: 32, gap: 12 },
  cargandoText: { color: "#666", fontSize: 14 },
  errorCard: {
    backgroundColor: "#fef2f2",
    margin: 16,
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  errorText: { color: "#ef4444", fontSize: 14, flex: 1 },
  resultados: { gap: 0 },
  certCard: {
    margin: 16,
    borderRadius: 14,
    padding: 16,
    borderWidth: 2,
  },
  certValido: { backgroundColor: "#f0faf4", borderColor: VERDE },
  certInvalido: { backgroundColor: "#fef2f2", borderColor: "#ef4444" },
  certHeader: { flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 12 },
  certNum: { fontSize: 16, fontWeight: "bold", color: "#222" },
  certEstado: { fontSize: 13, fontWeight: "600", color: "#444", marginTop: 2 },
  certInfo: { gap: 4 },
  certInfoItem: { fontSize: 13, color: "#555" },
  sinCertCard: {
    backgroundColor: "#fffbeb",
    marginHorizontal: 16,
    marginBottom: 0,
    borderRadius: 10,
    padding: 14,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  sinCertText: { color: "#92400e", fontSize: 13 },
  seccionCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    padding: 16,
  },
  seccionTitulo: { fontSize: 15, fontWeight: "bold", color: "#222", marginBottom: 12 },
  infoFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  infoLabel: { fontSize: 13, color: "#888", flex: 1 },
  infoValue: { fontSize: 13, color: "#333", fontWeight: "500", flex: 2, textAlign: "right" },
  bcRow: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 8 },
  bcText: { fontSize: 14, color: "#333" },
  txHash: {
    fontSize: 11,
    color: "#888",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  explorerLink: { fontSize: 13, color: "#3b82f6", marginTop: 8 },
});
