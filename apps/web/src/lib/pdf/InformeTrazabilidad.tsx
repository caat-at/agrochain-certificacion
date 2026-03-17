import {
  Document, Page, Text, View, StyleSheet, Font,
} from "@react-pdf/renderer";

// ─── Estilos ──────────────────────────────────────────────────────────────────

const C = {
  verde:    "#16a34a",
  verdeClaro: "#dcfce7",
  gris:     "#6b7280",
  grisClaro:"#f9fafb",
  borde:    "#e5e7eb",
  negro:    "#111827",
  rojo:     "#dc2626",
  rojoClaro:"#fef2f2",
  naranja:  "#d97706",
  azul:     "#2563eb",
  azulClaro:"#eff6ff",
  amber:    "#f59e0b",
};

const s = StyleSheet.create({
  page:          { padding: 40, fontFamily: "Helvetica", fontSize: 9, color: C.negro, backgroundColor: "#fff" },
  // Header
  header:        { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, paddingBottom: 16, borderBottomWidth: 2, borderBottomColor: C.verde },
  headerLeft:    { flex: 1 },
  headerRight:   { alignItems: "flex-end" },
  titulo:        { fontSize: 18, fontFamily: "Helvetica-Bold", color: C.verde, marginBottom: 2 },
  subtitulo:     { fontSize: 10, color: C.gris },
  codigoLote:    { fontSize: 14, fontFamily: "Helvetica-Bold", color: C.negro, marginBottom: 2 },
  badge:         { fontSize: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 4 },
  // Secciones
  section:       { marginBottom: 16 },
  sectionTitle:  { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.verde, marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: C.verdeClaro },
  // Grid de info
  grid2:         { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  infoBox:       { width: "47%", backgroundColor: C.grisClaro, borderRadius: 4, padding: 8, marginBottom: 4 },
  infoLabel:     { fontSize: 7, color: C.gris, marginBottom: 2, textTransform: "uppercase" },
  infoValue:     { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.negro },
  // KPIs de integridad
  kpiRow:        { flexDirection: "row", gap: 8, marginBottom: 16 },
  kpi:           { flex: 1, borderRadius: 6, padding: 10, alignItems: "center" },
  kpiNum:        { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  kpiLabel:      { fontSize: 7, textAlign: "center" },
  // Campañas
  campanaCard:   { borderWidth: 1, borderColor: C.borde, borderRadius: 6, marginBottom: 12, overflow: "hidden" },
  campanaHeader: { backgroundColor: C.grisClaro, padding: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  campanaTitle:  { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.negro },
  campanaHash:   { fontSize: 7, fontFamily: "Helvetica", color: C.gris, marginTop: 2 },
  // Registros
  registroRow:   { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.borde },
  registroPlanta:{ width: 80, fontSize: 8, fontFamily: "Helvetica-Bold" },
  registroEstado:{ width: 80, fontSize: 7 },
  registroCampos:{ flex: 1, fontSize: 7, color: C.gris },
  registroHash:  { width: 100, fontSize: 6, fontFamily: "Helvetica", color: C.gris },
  // Tabla aportes
  aporteBox:     { marginHorizontal: 10, marginBottom: 8, backgroundColor: C.azulClaro, borderRadius: 4, padding: 8 },
  aporteHeader:  { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  aporteTecnico: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.azul },
  aporteFecha:   { fontSize: 7, color: C.gris },
  camposGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  campoItem:     { backgroundColor: "#fff", borderRadius: 3, paddingHorizontal: 6, paddingVertical: 3, borderWidth: 1, borderColor: C.borde },
  campoKey:      { fontSize: 6, color: C.gris, marginBottom: 1 },
  campoVal:      { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.negro },
  // Certificado
  certCard:      { borderWidth: 2, borderColor: C.verde, borderRadius: 8, padding: 12, backgroundColor: C.verdeClaro },
  certTitle:     { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.verde, marginBottom: 8 },
  // Hash blockchain
  hashBox:       { backgroundColor: "#1e293b", borderRadius: 6, padding: 10, marginBottom: 16 },
  hashLabel:     { fontSize: 7, color: "#94a3b8", marginBottom: 4 },
  hashValue:     { fontSize: 7, fontFamily: "Helvetica", color: "#4ade80", letterSpacing: 0.5 },
  // Footer
  footer:        { position: "absolute", bottom: 24, left: 40, right: 40, borderTopWidth: 1, borderTopColor: C.borde, paddingTop: 8, flexDirection: "row", justifyContent: "space-between" },
  footerText:    { fontSize: 7, color: C.gris },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
}

function trunc(s: string | null | undefined, n = 24): string {
  if (!s) return "—";
  return s.length > n ? `${s.substring(0, n)}…` : s;
}

function estadoColor(estado: string): string {
  if (estado === "COMPLETO")             return C.verde;
  if (estado === "ADULTERADO")           return C.rojo;
  if (estado === "ADULTERADO_EVIDENCIA") return C.naranja;
  if (estado === "PARCIAL")              return C.amber;
  return C.gris;
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface InformeData {
  generadoEn: string;
  lote: {
    codigoLote: string; especie: string; variedad: string | null;
    areaHa: number; estado: string; fechaSiembra: string | null;
    fechaCosechaEst: string | null; dataHash: string | null; txRegistro: string | null;
    createdAt: string; totalPlantas: number; totalEventos: number;
    predio: { nombrePredio: string; departamento: string; municipio: string; vereda: string | null; altitudMsnm: number | null };
    agricultor: { nombres: string; apellidos: string; numeroDocumento: string; tipoDocumento: string };
    certificado: { numeroCertificado: string; tipo: string; fechaEmision: string; fechaVencimiento: string; revocado: boolean; tokenId: number | null } | null;
  };
  campanas: Array<{
    id: string; nombre: string; descripcion: string | null;
    estado: string; campanaHash: string | null;
    fechaApertura: string; fechaCierre: string | null;
    camposRequeridos: string[];
    creador: { nombres: string; apellidos: string; rol: string };
    cerrador: { nombres: string; apellidos: string } | null;
    registros: Array<{
      id: string; estado: string; contentHash: string | null;
      planta: { codigoPlanta: string; numeroPlanta: number | null };
      aportes: Array<{
        id: string; timestamp: string; firma: string; firmaVerificada: boolean | null;
        campos: Record<string, unknown>;
        tecnico: { nombres: string; apellidos: string; rol: string };
      }>;
    }>;
  }>;
  estadisticas: { totalRegistros: number; completos: number; parciales: number; adulterados: number; campanasAbiertas: number; campanasCerradas: number };
}

// ─── Documento PDF ────────────────────────────────────────────────────────────

export function InformeTrazabilidad({ data }: { data: InformeData }) {
  const { lote, campanas, estadisticas } = data;
  const pctCompleto = estadisticas.totalRegistros > 0
    ? Math.round((estadisticas.completos / estadisticas.totalRegistros) * 100)
    : 0;

  return (
    <Document
      title={`Informe Trazabilidad — ${lote.codigoLote}`}
      author="AgroChain"
      subject="Informe de trazabilidad agrícola con integridad blockchain"
    >
      <Page size="A4" style={s.page}>

        {/* ── HEADER ── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.titulo}>AgroChain</Text>
            <Text style={s.subtitulo}>Informe de Trazabilidad · Normas ICA / NTC 5400 BPA</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.codigoLote}>{lote.codigoLote}</Text>
            <Text style={{ fontSize: 8, color: C.gris }}>
              {lote.especie}{lote.variedad ? ` · ${lote.variedad}` : ""}
            </Text>
            <Text style={{ fontSize: 7, color: C.gris, marginTop: 4 }}>
              Generado: {fmt(data.generadoEn)}
            </Text>
          </View>
        </View>

        {/* ── KPIs INTEGRIDAD ── */}
        <View style={s.kpiRow}>
          {[
            { n: estadisticas.completos,   label: "Registros\ncompletos",  bg: C.verdeClaro,  tc: C.verde  },
            { n: estadisticas.parciales,   label: "Registros\nparciales",  bg: "#fffbeb",     tc: C.amber  },
            { n: estadisticas.adulterados, label: "Adulterados\n(evidencia)", bg: C.rojoClaro, tc: C.rojo  },
            { n: pctCompleto,              label: "% Integridad\nverificada", bg: C.azulClaro, tc: C.azul, suffix: "%" },
            { n: estadisticas.campanasCerradas, label: "Campañas\ncerradas", bg: C.grisClaro, tc: C.gris },
          ].map(({ n, label, bg, tc, suffix = "" }, i) => (
            <View key={i} style={[s.kpi, { backgroundColor: bg }]}>
              <Text style={[s.kpiNum, { color: tc }]}>{n}{suffix}</Text>
              <Text style={[s.kpiLabel, { color: tc }]}>{label}</Text>
            </View>
          ))}
        </View>

        {/* ── INFO LOTE ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Información del lote</Text>
          <View style={s.grid2}>
            <InfoItem label="Predio"       value={lote.predio.nombrePredio} />
            <InfoItem label="Área"         value={`${lote.areaHa} ha`} />
            <InfoItem label="Departamento" value={lote.predio.departamento} />
            <InfoItem label="Municipio"    value={lote.predio.municipio} />
            {lote.predio.vereda && <InfoItem label="Vereda" value={lote.predio.vereda} />}
            {lote.predio.altitudMsnm && <InfoItem label="Altitud" value={`${lote.predio.altitudMsnm} msnm`} />}
            {lote.fechaSiembra && <InfoItem label="Fecha siembra" value={fmt(lote.fechaSiembra)} />}
            {lote.fechaCosechaEst && <InfoItem label="Cosecha estimada" value={fmt(lote.fechaCosechaEst)} />}
            <InfoItem label="Total plantas" value={String(lote.totalPlantas)} />
            <InfoItem label="Estado lote"  value={lote.estado.replace(/_/g, " ")} />
          </View>
        </View>

        {/* ── AGRICULTOR ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Agricultor</Text>
          <View style={s.grid2}>
            <InfoItem label="Nombre" value={`${lote.agricultor.nombres} ${lote.agricultor.apellidos}`} />
            <InfoItem label="Documento" value={`${lote.agricultor.tipoDocumento} ${lote.agricultor.numeroDocumento}`} />
          </View>
        </View>

        {/* ── HASH BLOCKCHAIN ── */}
        {lote.dataHash && (
          <View style={[s.hashBox, { marginBottom: 16 }]}>
            <Text style={s.hashLabel}>HASH DE INTEGRIDAD (SHA256) — REGISTRADO EN POLYGON AMOY</Text>
            <Text style={s.hashValue}>{lote.dataHash}</Text>
            {lote.txRegistro && (
              <>
                <Text style={[s.hashLabel, { marginTop: 6 }]}>TRANSACCIÓN BLOCKCHAIN</Text>
                <Text style={s.hashValue}>{lote.txRegistro}</Text>
              </>
            )}
          </View>
        )}

        {/* ── CERTIFICADO ── */}
        {lote.certificado && (
          <View style={[s.section, s.certCard]}>
            <Text style={s.certTitle}>
              {lote.certificado.revocado ? "⚠ Certificado REVOCADO" : "✓ Certificado activo"}
            </Text>
            <View style={s.grid2}>
              <InfoItem label="N° Certificado" value={lote.certificado.numeroCertificado} />
              <InfoItem label="Tipo"           value={lote.certificado.tipo.replace(/_/g, " ")} />
              <InfoItem label="Fecha emisión"  value={fmt(lote.certificado.fechaEmision)} />
              <InfoItem label="Vence"          value={fmt(lote.certificado.fechaVencimiento)} />
              {lote.certificado.tokenId != null && (
                <InfoItem label="NFT Token Polygon" value={`#${lote.certificado.tokenId}`} />
              )}
            </View>
          </View>
        )}

        {/* ── FOOTER página 1 ── */}
        <FooterPagina codigo={lote.codigoLote} generado={data.generadoEn} />
      </Page>

      {/* ── PÁGINAS DE CAMPAÑAS ── */}
      {campanas.map((campana, ci) => (
        <Page key={campana.id} size="A4" style={s.page}>
          <View style={[s.header, { marginBottom: 16 }]}>
            <View style={s.headerLeft}>
              <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: C.negro }}>
                Campaña {ci + 1}: {campana.nombre}
              </Text>
              <Text style={{ fontSize: 8, color: C.gris, marginTop: 2 }}>
                Lote: {lote.codigoLote} · {lote.especie}
              </Text>
            </View>
            <View style={s.headerRight}>
              <View style={[s.badge, {
                backgroundColor: campana.estado === "CERRADA" ? C.verdeClaro : "#fffbeb",
                color: campana.estado === "CERRADA" ? C.verde : C.amber,
              }]}>
                <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: campana.estado === "CERRADA" ? C.verde : C.amber }}>
                  {campana.estado}
                </Text>
              </View>
              <Text style={{ fontSize: 7, color: C.gris, marginTop: 4 }}>
                Apertura: {fmt(campana.fechaApertura)}
                {campana.fechaCierre ? `  ·  Cierre: ${fmt(campana.fechaCierre)}` : ""}
              </Text>
            </View>
          </View>

          {/* Info campaña */}
          <View style={[s.grid2, { marginBottom: 12 }]}>
            <InfoItem label="Creada por" value={`${campana.creador.nombres} ${campana.creador.apellidos}`} />
            {campana.cerrador && <InfoItem label="Cerrada por" value={`${campana.cerrador.nombres} ${campana.cerrador.apellidos}`} />}
            <InfoItem label="Campos requeridos" value={campana.camposRequeridos.join(", ")} />
            <InfoItem label="Total registros"   value={String(campana.registros.length)} />
          </View>

          {/* Hash campaña */}
          {campana.campanaHash && (
            <View style={[s.hashBox, { marginBottom: 12 }]}>
              <Text style={s.hashLabel}>HASH DE CAMPAÑA (SHA256) — INTEGRIDAD FINAL VERIFICADA</Text>
              <Text style={s.hashValue}>{campana.campanaHash}</Text>
            </View>
          )}

          {/* Registros de plantas */}
          <Text style={s.sectionTitle}>Registros de plantas ({campana.registros.length})</Text>

          {/* Cabecera tabla */}
          <View style={[s.registroRow, { backgroundColor: C.grisClaro }]}>
            <Text style={[s.registroPlanta, { color: C.gris, fontSize: 7 }]}>PLANTA</Text>
            <Text style={[s.registroEstado,  { color: C.gris, fontSize: 7 }]}>ESTADO</Text>
            <Text style={[s.registroCampos,  { color: C.gris, fontSize: 7 }]}>CAMPOS CUBIERTOS</Text>
            <Text style={[s.registroHash,    { color: C.gris, fontSize: 7 }]}>CONTENT HASH</Text>
          </View>

          {campana.registros.map((reg) => {
            const camposCubiertos = new Set<string>();
            for (const a of reg.aportes) {
              for (const [k, v] of Object.entries(a.campos)) {
                if (v !== null && v !== undefined && v !== "") camposCubiertos.add(k);
              }
            }
            return (
              <View key={reg.id}>
                <View style={[s.registroRow, {
                  backgroundColor: reg.estado === "ADULTERADO" || reg.estado === "ADULTERADO_EVIDENCIA"
                    ? C.rojoClaro : "transparent",
                }]}>
                  <Text style={s.registroPlanta}>{reg.planta.codigoPlanta}</Text>
                  <Text style={[s.registroEstado, { color: estadoColor(reg.estado) }]}>
                    {reg.estado.replace(/_/g, " ")}
                  </Text>
                  <Text style={s.registroCampos}>
                    {[...camposCubiertos].join(", ") || "—"}
                  </Text>
                  <Text style={s.registroHash}>{trunc(reg.contentHash, 16)}</Text>
                </View>

                {/* Aportes del registro */}
                {reg.aportes.map((a) => (
                  <View key={a.id} style={s.aporteBox}>
                    <View style={s.aporteHeader}>
                      <Text style={s.aporteTecnico}>
                        {a.tecnico.nombres} {a.tecnico.apellidos} · {a.tecnico.rol}
                      </Text>
                      <Text style={s.aporteFecha}>{fmt(a.timestamp)}</Text>
                    </View>
                    <View style={s.camposGrid}>
                      {Object.entries(a.campos).map(([k, v]) => (
                        <View key={k} style={s.campoItem}>
                          <Text style={s.campoKey}>{k}</Text>
                          <Text style={s.campoVal}>{String(v)}</Text>
                        </View>
                      ))}
                    </View>
                    <Text style={{ fontSize: 6, color: C.gris, marginTop: 4, fontFamily: "Helvetica" }}>
                      firma: {trunc(a.firma, 32)}
                      {a.firmaVerificada === false ? "  ⚠ FIRMA INVÁLIDA" : "  ✓"}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })}

          <FooterPagina codigo={lote.codigoLote} generado={data.generadoEn} />
        </Page>
      ))}
    </Document>
  );
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoBox}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

function FooterPagina({ codigo, generado }: { codigo: string; generado: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>AgroChain · Trazabilidad certificada · {codigo}</Text>
      <Text style={s.footerText}>Generado: {new Date(generado).toLocaleString("es-CO")}</Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) =>
        `Página ${pageNumber} de ${totalPages}`
      } />
    </View>
  );
}
