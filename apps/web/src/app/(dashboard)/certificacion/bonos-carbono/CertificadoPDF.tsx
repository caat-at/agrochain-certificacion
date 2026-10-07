"use client";
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

const AMOY_SCAN = "https://amoy.polygonscan.com/tx";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 48,
    backgroundColor: "#ffffff",
    color: "#1a1a1a",
  },
  // Cabecera
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#16a34a",
  },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#16a34a" },
  headerSubtitle: { fontSize: 10, color: "#6b7280", marginTop: 2 },
  headerBadge: {
    backgroundColor: "#16a34a",
    color: "#ffffff",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  numeroCert: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#1f2937", marginTop: 4 },

  // Sección
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
  },

  // Grid de campos
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 0 },
  field: { width: "50%", marginBottom: 8, paddingRight: 12 },
  fieldFull: { width: "100%", marginBottom: 8 },
  fieldLabel: { fontSize: 8, color: "#9ca3af", marginBottom: 2 },
  fieldValue: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#1f2937" },

  // Badge resultado
  resultadoBadge: {
    backgroundColor: "#d1fae5",
    color: "#065f46",
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginBottom: 8,
  },

  // Hallazgos
  hallazgosRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  hallazgoCritico: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
  },
  hallazgoMayor: {
    backgroundColor: "#fef3c7",
    color: "#92400e",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
  },
  hallazgoMenor: {
    backgroundColor: "#dbeafe",
    color: "#1e40af",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
  },

  // Blockchain
  blockchainBox: {
    backgroundColor: "#f5f3ff",
    borderWidth: 0.5,
    borderColor: "#c4b5fd",
    borderRadius: 6,
    padding: 10,
    marginBottom: 4,
  },
  blockchainTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#7c3aed", marginBottom: 6 },
  blockchainRow: { flexDirection: "row", marginBottom: 3, alignItems: "flex-start" },
  blockchainDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: "#10b981",
    marginRight: 6,
    marginTop: 1,
  },
  blockchainLabel: { fontSize: 8, color: "#6b7280", width: 80 },
  blockchainHash: { fontSize: 7, fontFamily: "Helvetica", color: "#7c3aed", flex: 1 },

  // Pie
  footer: {
    position: "absolute",
    bottom: 32,
    left: 48,
    right: 48,
    borderTopWidth: 0.5,
    borderTopColor: "#e5e7eb",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: { fontSize: 7, color: "#9ca3af" },
  footerBold: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#6b7280" },

  // Barra puntaje
  puntajeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  puntajeNum: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#1f2937", width: 48 },
  barContainer: { flex: 1, backgroundColor: "#e5e7eb", height: 8, borderRadius: 4 },
  barFill: { height: 8, borderRadius: 4 },
});

interface CertPDFProps {
  cert: {
    numeroCertificado: string;
    tipo: string;
    fechaEmision: string | null;
    fechaVencimiento?: string | null;
    revocado: boolean;
    nftTokenId?: string | null;
    txEmision?: string | null;
    aprobadoPor?: { nombres: string; apellidos: string } | null;
    lote?: {
      codigoLote: string;
      especie?: string;
      variedad?: string | null;
      predioNombre?: string;
      txRegistro?: string | null;
      dataHash?: string | null;
      campanas?: Array<{
        nombre: string;
        campanaHash: string | null;
        txHash: string | null;
      }>;
      inspeccion?: {
        resultado: string;
        puntaje: number | null;
        hallazgosCriticos: number;
        hallazgosMayores: number;
        hallazgosMenores: number;
        observaciones: string | null;
        fechaRealizada: string | null;
        txHash: string | null;
        inspector?: { nombres: string; apellidos: string } | null;
      } | null;
    } | null;
  };
}

const TIPO_LABEL: Record<string, string> = {
  BPA_ICA:          "BPA ICA — NTC 5400",
  ORGANICO:         "Orgánico certificado",
  GLOBAL_GAP:       "GlobalG.A.P",
  RAINFOREST:       "Rainforest Alliance",
  INVIMA_INOCUIDAD: "INVIMA Inocuidad",
};

const RESULTADO_LABEL: Record<string, string> = {
  APROBADO:                   "✓ Aprobado",
  APROBADO_CON_OBSERVACIONES: "⚠ Aprobado con observaciones",
  RECHAZADO:                  "✗ Rechazado",
};

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

function CertificadoDocument({ cert }: CertPDFProps) {
  const insp   = cert.lote?.inspeccion;
  const puntaje = insp?.puntaje ?? null;
  const barColor = puntaje != null
    ? (puntaje >= 80 ? "#10b981" : puntaje >= 60 ? "#f59e0b" : "#ef4444")
    : "#10b981";

  return (
    <Document title={`Certificado ${cert.numeroCertificado}`} author="AgroChain">
      <Page size="A4" style={styles.page}>

        {/* CABECERA */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>AgroChain</Text>
            <Text style={styles.headerSubtitle}>Sistema de Certificación Agrícola · Polygon Amoy</Text>
            <Text style={styles.numeroCert}>{cert.numeroCertificado}</Text>
            <Text style={styles.headerBadge}>{TIPO_LABEL[cert.tipo] ?? cert.tipo}</Text>
          </View>
          <View>
            <Text style={{ fontSize: 8, color: "#9ca3af", textAlign: "right" }}>Emitido</Text>
            <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: "#1f2937", textAlign: "right" }}>
              {fmt(cert.fechaEmision)}
            </Text>
            {cert.fechaVencimiento && (
              <>
                <Text style={{ fontSize: 8, color: "#9ca3af", textAlign: "right", marginTop: 4 }}>Vence</Text>
                <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: "#1f2937", textAlign: "right" }}>
                  {fmt(cert.fechaVencimiento)}
                </Text>
              </>
            )}
            <Text style={{
              fontSize: 9, fontFamily: "Helvetica-Bold", textAlign: "right", marginTop: 6,
              color: cert.revocado ? "#dc2626" : "#16a34a",
            }}>
              {cert.revocado ? "● REVOCADO" : "● VÁLIDO"}
            </Text>
          </View>
        </View>

        {/* DATOS DEL LOTE */}
        {cert.lote && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Datos del lote certificado</Text>
            <View style={styles.grid}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Código de lote</Text>
                <Text style={styles.fieldValue}>{cert.lote.codigoLote}</Text>
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Especie / Variedad</Text>
                <Text style={styles.fieldValue}>
                  {cert.lote.especie ?? "—"}{cert.lote.variedad ? ` · ${cert.lote.variedad}` : ""}
                </Text>
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Predio</Text>
                <Text style={styles.fieldValue}>{cert.lote.predioNombre ?? "—"}</Text>
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Certificador(a)</Text>
                <Text style={styles.fieldValue}>
                  {cert.aprobadoPor ? `${cert.aprobadoPor.nombres} ${cert.aprobadoPor.apellidos}` : "—"}
                </Text>
              </View>
              {cert.nftTokenId && (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>NFT Token ID</Text>
                  <Text style={styles.fieldValue}>#{cert.nftTokenId}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* RESULTADO INSPECCIÓN */}
        {insp && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resultado de inspección BPA — NTC 5400</Text>

            <Text style={styles.resultadoBadge}>
              {RESULTADO_LABEL[insp.resultado] ?? insp.resultado}
            </Text>

            {puntaje != null && (
              <>
                <Text style={{ fontSize: 8, color: "#6b7280", marginBottom: 4 }}>Puntaje de cumplimiento</Text>
                <View style={styles.puntajeRow}>
                  <Text style={styles.puntajeNum}>{puntaje}%</Text>
                  <View style={styles.barContainer}>
                    <View style={[styles.barFill, { width: `${puntaje}%`, backgroundColor: barColor }]} />
                  </View>
                </View>
              </>
            )}

            <View style={styles.hallazgosRow}>
              <Text style={styles.hallazgoCritico}>{insp.hallazgosCriticos} críticos</Text>
              <Text style={styles.hallazgoMayor}>{insp.hallazgosMayores} mayores</Text>
              <Text style={styles.hallazgoMenor}>{insp.hallazgosMenores} menores</Text>
            </View>

            <View style={[styles.grid, { marginTop: 8 }]}>
              {insp.inspector && (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Inspector</Text>
                  <Text style={styles.fieldValue}>
                    {insp.inspector.nombres} {insp.inspector.apellidos}
                  </Text>
                </View>
              )}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Fecha de inspección</Text>
                <Text style={styles.fieldValue}>{fmt(insp.fechaRealizada)}</Text>
              </View>
            </View>

            {insp.observaciones && (
              <View style={styles.fieldFull}>
                <Text style={styles.fieldLabel}>Observaciones</Text>
                <Text style={{ fontSize: 9, color: "#374151", lineHeight: 1.5 }}>{insp.observaciones}</Text>
              </View>
            )}
          </View>
        )}

        {/* TRAZABILIDAD BLOCKCHAIN */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trazabilidad en Polygon Amoy</Text>
          <View style={styles.blockchainBox}>
            <Text style={styles.blockchainTitle}>Registros on-chain verificables</Text>

            {/* TX Polygon = punto morado | Hash SHA256 = punto amarillo */}

            {/* TX Polygon = punto morado | Hash SHA256 = punto amarillo */}
            {/* Orden: siempre primero [Poly] y luego Hash SHA256 */}

            {/* 1. Registro del lote */}
            {cert.lote?.txRegistro && (
              <View style={styles.blockchainRow}>
                <View style={[styles.blockchainDot, { backgroundColor: "#7c3aed" }]} />
                <Text style={styles.blockchainLabel}>[Poly] Registro lote:</Text>
                <Text style={styles.blockchainHash}>{cert.lote.txRegistro}</Text>
              </View>
            )}
            {cert.lote?.dataHash && (
              <View style={[styles.blockchainRow, { marginBottom: 6 }]}>
                <View style={[styles.blockchainDot, { backgroundColor: "#f59e0b" }]} />
                <Text style={styles.blockchainLabel}>Hash datos lote:</Text>
                <Text style={styles.blockchainHash}>{cert.lote.dataHash}</Text>
              </View>
            )}

            {/* 2. Campañas cerradas */}
            {cert.lote?.campanas && cert.lote.campanas.length > 0 && cert.lote.campanas.map((c, i) => (
              <View key={i}>
                {c.txHash && (
                  <View style={styles.blockchainRow}>
                    <View style={[styles.blockchainDot, { backgroundColor: "#7c3aed" }]} />
                    <Text style={styles.blockchainLabel}>[Poly] Campaña {c.nombre}:</Text>
                    <Text style={styles.blockchainHash}>{c.txHash}</Text>
                  </View>
                )}
                {c.campanaHash && (
                  <View style={[styles.blockchainRow, { marginBottom: 6 }]}>
                    <View style={[styles.blockchainDot, { backgroundColor: "#f59e0b" }]} />
                    <Text style={styles.blockchainLabel}>Hash campaña {c.nombre}:</Text>
                    <Text style={styles.blockchainHash}>{c.campanaHash}</Text>
                  </View>
                )}
              </View>
            ))}

            {/* 3. Reporte de inspección BPA */}
            {insp?.txHash && (
              <View style={[styles.blockchainRow, { marginBottom: 6 }]}>
                <View style={[styles.blockchainDot, { backgroundColor: "#7c3aed" }]} />
                <Text style={styles.blockchainLabel}>[Poly] Reporte BPA:</Text>
                <Text style={styles.blockchainHash}>{insp.txHash}</Text>
              </View>
            )}

            {/* 4. Certificado NFT */}
            {cert.txEmision && (
              <View style={styles.blockchainRow}>
                <View style={[styles.blockchainDot, { backgroundColor: "#7c3aed" }]} />
                <Text style={styles.blockchainLabel}>[Poly] Certificado NFT:</Text>
                <Text style={styles.blockchainHash}>{cert.txEmision}</Text>
              </View>
            )}

            <Text style={{ fontSize: 7, color: "#8b5cf6", marginTop: 6 }}>
              Verificar en: amoy.polygonscan.com
            </Text>
          </View>
        </View>

        {/* PIE */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Generado por AgroChain · Certificación BPA Colombia
          </Text>
          <Text style={styles.footerBold}>{cert.numeroCertificado}</Text>
          <Text style={styles.footerText}>
            {fmt(cert.fechaEmision)}
          </Text>
        </View>

      </Page>
    </Document>
  );
}

export default function DescargarCertificadoBtn({ cert }: CertPDFProps) {
  const filename = `${cert.numeroCertificado.replace(/\//g, "-")}.pdf`;

  return (
    <PDFDownloadLink
      document={<CertificadoDocument cert={cert} />}
      fileName={filename}
      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-colors font-medium"
    >
      {({ loading }) => loading ? "Generando…" : "⬇ PDF"}
    </PDFDownloadLink>
  );
}
