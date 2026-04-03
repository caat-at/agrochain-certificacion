/**
 * Pantalla de detalle de una planta individual.
 * Muestra datos fijos de identificación/siembra + historial de eventos.
 * NTC 5400 §4.3 — Trazabilidad individual por planta.
 */
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform, Alert,
} from "react-native";
import { useCallback, useState } from "react";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { obtenerPlanta, PlantaLocal, listarEventosPorPlanta, guardarEvento, EventoLocal, obtenerSyncEstadoAporte, AportePendiente, listarAportesPorPlanta, obtenerSesion } from "../src/services/db";
import { cargarEventosDesdeServidor, cargarAportesCampanaDesdeServidor, RegistroCampanaApi } from "../src/services/sync";
import { cargarCampanaDesdeServidor, PlantaCampana } from "../src/services/campanas";

const VERDE = "#1a7f4b";

const TIPO_ICONO: Record<string, string> = {
  SIEMBRA:               "leaf",
  RIEGO:                 "water",
  FERTILIZACION:         "flask",
  CONTROL_PLAGAS:        "bug",
  CONTROL_ENFERMEDADES:  "medical",
  PODA:                  "cut",
  COSECHA:               "basket",
  INSPECCION_BPA:        "clipboard",
  APLICACION_AGROQUIMICO:"warning",
  ANALISIS_SUELO:        "analytics",
  MONITOREO:             "eye",
  OTRO:                  "ellipsis-horizontal",
};

const SYNC_COLOR: Record<string, string> = {
  PENDIENTE:    "#f59e0b",
  SINCRONIZADO: "#10b981",
  RECHAZADO:    "#ef4444",
};

function fila(label: string, valor: string | null | undefined) {
  if (!valor) return null;
  return (
    <View style={styles.fila}>
      <Text style={styles.filaLabel}>{label}</Text>
      <Text style={styles.filaValor}>{valor}</Text>
    </View>
  );
}

export default function DetallePlantaScreen() {
  const { plantaId, loteId, codigoLote } = useLocalSearchParams<{
    plantaId: string;
    loteId: string;
    codigoLote: string;
  }>();
  const router = useRouter();

  const [planta, setPlanta]   = useState<PlantaLocal | null>(null);
  const [eventos, setEventos] = useState<EventoLocal[]>([]);
  const [registrosCampana, setRegistrosCampana] = useState<RegistroCampanaApi[]>([]);
  const [aporteLocal, setAporteLocal] = useState<AportePendiente | null>(null);
  const [cargando, setCargando] = useState(true);
  // Estado de la planta en la campaña activa del lote
  const [estadoEnCampana, setEstadoEnCampana] = useState<{
    campanaId: string;
    estadoRegistro: string;
    camposFaltantes: string[];
    misCampos: string[];      // todos los campos asignados al técnico (incluye foto/audio)
    miPosicion: number | null;
    puedeRegistrar: boolean;
    tieneAporteLocal: boolean; // aporte guardado localmente pero aún no sincronizado
  } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let activo = true;
      setCargando(true);
      async function cargar() {
        const [p, locales, aportesDelTecnico] = await Promise.all([
          obtenerPlanta(plantaId),
          listarEventosPorPlanta(plantaId),
          listarAportesPorPlanta(plantaId),
        ]);
        if (!activo) return;
        setPlanta(p);
        // Mostrar el aporte local del técnico actual en historial (pendiente o sincronizado)
        if (activo) setAporteLocal(aportesDelTecnico[0] ?? null);

        // Consultar campaña activa del lote para saber si puede registrar evento
        if (loteId) {
          try {
            const det = await cargarCampanaDesdeServidor(loteId);
            if (det) {
              const plantaEnCampana = det.plantas.find((pp: PlantaCampana) => pp.id === plantaId);
              const estado = plantaEnCampana?.estadoRegistro ?? "SIN_REGISTRO";
              // El servidor indica si este técnico ya aportó en esta planta
              const yaAportoEnServidor = plantaEnCampana?.yaTecnicoAporto ?? false;
              // Puede registrar si el estado lo permite Y el servidor no confirma aporte previo
              const estadoPermite = ["SIN_REGISTRO", "PARCIAL", "PENDIENTE", "ADULTERADO"].includes(estado);
              // Verificar aporte local PENDIENTE de sync (solo para detectar offline pendiente)
              const sesion = await obtenerSesion();
              // Solo bloquear por aporte local si está PENDIENTE de sync (no si ya se sincronizó)
              // Si ya está SINCRONIZADO, el servidor es la fuente de verdad (yaTecnicoAporto)
              const estadoAporteLocal = sesion
                ? await obtenerSyncEstadoAporte(det.campana.id, plantaId, sesion.userId)
                : null;
              const tieneAportePendienteLocal = estadoAporteLocal === "PENDIENTE";
              const yaRegistrado = yaAportoEnServidor || tieneAportePendienteLocal;
              setEstadoEnCampana({
                campanaId:        det.campana.id,
                estadoRegistro:   estado,
                camposFaltantes:  plantaEnCampana?.camposFaltantes ?? [],
                misCampos:        det.misCampos ?? [],
                miPosicion:       det.miPosicion ?? null,
                puedeRegistrar:   estadoPermite && !yaRegistrado,
                tieneAporteLocal: tieneAportePendienteLocal, // solo true si hay algo local PENDIENTE de enviar
              });
            } else {
              setEstadoEnCampana(null); // Sin campaña activa
            }
          } catch {
            setEstadoEnCampana(null);
          }
        }

        // Intentar traer eventos clásicos y aportes de campaña desde el servidor
        let todos = locales;
        let regCampana: RegistroCampanaApi[] = [];
        try {
          const [remotos, registros] = await Promise.all([
            cargarEventosDesdeServidor(plantaId),
            cargarAportesCampanaDesdeServidor(plantaId),
          ]);
          regCampana = registros;

          const hashsLocales = new Set(locales.map((e) => e.contentHash));
          for (const r of remotos) {
            if (!hashsLocales.has(r.contentHash)) {
              // Extraer campos morfológicos embebidos en la descripción (formato "clave:valor")
              const extra: Record<string, string> = {};
              const desc = r.descripcion ?? "";
              const claves = ["alturaCm", "diametroTalloCm", "estadoFenologico", "estadoSanitario"];
              for (const clave of claves) {
                const m = desc.match(new RegExp(`${clave}:([^\\s.]+)`));
                if (m) extra[clave] = m[1];
              }
              // Limpiar la descripción dejando solo el texto narrativo
              const descripcionLimpia = desc.replace(/\s*(alturaCm|diametroTalloCm|estadoFenologico|estadoSanitario):[^\s.]+/g, "").trim();

              const ev: EventoLocal = {
                id:          r.id,
                loteId:      r.loteId,
                plantaId:    r.plantaId,
                tipoEvento:  r.tipoEvento,
                fechaEvento: r.fechaEvento,
                descripcion: descripcionLimpia,
                datosExtra:  JSON.stringify(extra),
                latitud:     r.latitud,
                longitud:    r.longitud,
                altitudMsnm: null,
                tecnicoId:   "",
                fotoHash:    null,
                fotoUri:     null,
                audioHash:   null,
                audioUri:    null,
                contentHash: r.contentHash,
                syncEstado:  "SINCRONIZADO",
                creadoEn:    r.fechaEvento,
              };
              try { await guardarEvento(ev); } catch { /* ya existe */ }
            }
          }
          todos = await listarEventosPorPlanta(plantaId);
        } catch {
          // Sin red — mostrar solo locales
        }

        if (activo) {
          setEventos(todos);
          setRegistrosCampana(regCampana);
        }
      }
      cargar().finally(() => { if (activo) setCargando(false); });
      return () => { activo = false; };
    }, [plantaId])
  );

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color={VERDE} />
      </View>
    );
  }

  if (!planta) {
    return (
      <View style={styles.centro}>
        <Text style={{ color: "#666" }}>Planta no encontrada.</Text>
      </View>
    );
  }

  const ultimoEvento = eventos[0];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitulo}>{planta.codigoPlanta}</Text>
          <Text style={styles.headerSub}>
            {codigoLote} · Planta N° {planta.numeroPlanta}
          </Text>
        </View>
        {/* Botón Nueva visita — solo si hay campaña activa y la planta puede registrar */}
        {estadoEnCampana === null ? (
          // Sin campaña activa
          <TouchableOpacity
            style={[styles.btnNuevoEvento, styles.btnDeshabilitado]}
            onPress={() => Alert.alert(
              "Sin campaña activa",
              "No hay campaña de recolección abierta para este lote. El supervisor debe crear una campaña antes de registrar eventos."
            )}
          >
            <Ionicons name="lock-closed-outline" size={16} color="rgba(255,255,255,0.5)" />
            <Text style={[styles.btnNuevoEventoText, { opacity: 0.5 }]}>Sin campaña</Text>
          </TouchableOpacity>
        ) : estadoEnCampana.puedeRegistrar ? (
          // Puede registrar
          <TouchableOpacity
            style={styles.btnNuevoEvento}
            onPress={() => router.push(
              `/registrar-aporte?campanaId=${estadoEnCampana.campanaId}&plantaId=${plantaId}&codigoPlanta=${encodeURIComponent(planta.codigoPlanta)}&posicion=${estadoEnCampana.miPosicion ?? 0}&campos=${encodeURIComponent(JSON.stringify(estadoEnCampana.misCampos))}`
            )}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.btnNuevoEventoText}>
              {estadoEnCampana.estadoRegistro === "ADULTERADO" ? "Reregistrar" : "Registrar datos"}
            </Text>
          </TouchableOpacity>
        ) : estadoEnCampana.estadoRegistro === "COMPLETO" ? (
          // Todos los técnicos aportaron — registro completo en servidor
          <TouchableOpacity
            style={[styles.btnNuevoEvento, styles.btnCompleto]}
            onPress={() => Alert.alert(
              "Registro completo",
              "Esta planta ya tiene todos los campos requeridos registrados en el servidor."
            )}
          >
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={styles.btnNuevoEventoText}>Completo</Text>
          </TouchableOpacity>
        ) : (
          // Ya registrado — el técnico ya aportó (servidor o local pendiente)
          <TouchableOpacity
            style={[styles.btnNuevoEvento, styles.btnDeshabilitado]}
            onPress={() => Alert.alert(
              "Ya registrado",
              estadoEnCampana.tieneAporteLocal
                ? "Ya tienes un aporte guardado para esta planta. Ve a la pestaña Sincronizar cuando tengas conexión."
                : "Ya enviaste tu aporte para esta planta en esta campaña."
            )}
          >
            <Ionicons name="lock-closed-outline" size={16} color="rgba(255,255,255,0.5)" />
            <Text style={[styles.btnNuevoEventoText, { opacity: 0.5 }]}>Ya registrado</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── IDENTIFICACIÓN ─────────────────────────────── */}
        <View style={styles.tarjeta}>
          <View style={styles.tarjetaHeader}>
            <Ionicons name="qr-code-outline" size={16} color={VERDE} />
            <Text style={styles.tarjetaTitulo}>Identificación</Text>
          </View>
          {fila("Código", planta.codigoPlanta)}
          {fila("N° en lote", planta.numeroPlanta)}
          {fila("Especie", planta.especie)}
          {fila("Variedad", planta.variedad)}
          {fila("Origen material", planta.origenMaterial?.replace(/_/g, " "))}
          {fila("Procedencia / vivero", planta.procedenciaVivero)}
        </View>

        {/* ── DATOS DE SIEMBRA ────────────────────────────── */}
        <View style={styles.tarjeta}>
          <View style={styles.tarjetaHeader}>
            <Ionicons name="calendar-outline" size={16} color={VERDE} />
            <Text style={styles.tarjetaTitulo}>Datos de siembra — NTC 5400 §4.3</Text>
          </View>
          {fila("Fecha de siembra", planta.fechaSiembra?.substring(0, 10))}
          {fila("Altura inicial", planta.alturaCmInicial != null ? `${planta.alturaCmInicial} cm` : null)}
          {fila("Diámetro de tallo", planta.diametroTalloCmInicial != null ? `${planta.diametroTalloCmInicial} cm` : null)}
          {fila("N° de hojas", planta.numHojasInicial != null ? String(planta.numHojasInicial) : null)}
          {fila("Estado fenológico inicial", planta.estadoFenologicoInicial)}
        </View>

        {/* ── UBICACIÓN GPS ───────────────────────────────── */}
        {(planta.latitud != null || planta.longitud != null) && (
          <View style={styles.tarjeta}>
            <View style={styles.tarjetaHeader}>
              <Ionicons name="location-outline" size={16} color={VERDE} />
              <Text style={styles.tarjetaTitulo}>Ubicación GPS</Text>
            </View>
            {fila("Coordenadas",
              planta.latitud != null && planta.longitud != null
                ? `${planta.latitud.toFixed(6)}, ${planta.longitud.toFixed(6)}`
                : null
            )}
            {fila("Altitud", planta.altitudMsnm != null ? `${planta.altitudMsnm.toFixed(0)} msnm` : null)}
          </View>
        )}

        {/* ── ÚLTIMA MEDICIÓN ─────────────────────────────── */}
        {ultimoEvento && (() => {
          let extra: Record<string, string> = {};
          try { extra = JSON.parse(ultimoEvento.datosExtra); } catch {}
          const tieneMorfologia = extra.alturaCm || extra.diametroTalloCm || extra.estadoFenologico || extra.estadoSanitario;
          if (!tieneMorfologia) return null;
          return (
            <View style={styles.tarjeta}>
              <View style={styles.tarjetaHeader}>
                <Ionicons name="pulse-outline" size={16} color="#8b5cf6" />
                <Text style={[styles.tarjetaTitulo, { color: "#8b5cf6" }]}>
                  Última medición — {ultimoEvento.fechaEvento.substring(0, 10)}
                </Text>
              </View>
              {fila("Altura actual", extra.alturaCm ? `${extra.alturaCm} cm` : null)}
              {fila("Diámetro tallo", extra.diametroTalloCm ? `${extra.diametroTalloCm} cm` : null)}
              {fila("Estado fenológico", extra.estadoFenologico)}
              {fila("Estado sanitario", extra.estadoSanitario)}
            </View>
          );
        })()}

        {/* ── HISTORIAL DE VISITAS ────────────────────────── */}
        <View style={styles.seccionHistorial}>
          <Text style={styles.seccionHistorialTitulo}>
            Historial de visitas ({eventos.length + registrosCampana.length + (aporteLocal && !registrosCampana.some((r) => r.aportes.some((a) => a.contentHash === aporteLocal.contentHash)) ? 1 : 0)})
          </Text>
        </View>

        {eventos.length === 0 && registrosCampana.length === 0 && !aporteLocal ? (
          <View style={styles.vacioHistorial}>
            <Ionicons name="time-outline" size={40} color="#ccc" />
            <Text style={styles.vacioHistorialText}>Sin visitas registradas</Text>
            <Text style={styles.vacioHistorialSub}>Toca "Registrar datos" para registrar la primera</Text>
          </View>
        ) : (
          <>
            {/* Aporte local del técnico — solo si no pertenece a ningún registro de campaña conocido */}
            {aporteLocal && (() => {
              // Ocultar si ya está en el servidor O si pertenece a un registro conocido (se muestra integrado)
              const yaEnServidor = registrosCampana.some((reg) =>
                reg.aportes.some((a) => a.contentHash === aporteLocal.contentHash)
              );
              const perteneceARegistroConocido = registrosCampana.some(
                (reg) => reg.campana.id === aporteLocal.campanaId
              );
              if (yaEnServidor || perteneceARegistroConocido) return null;
              return (
              <View key={aporteLocal.id} style={[styles.eventoCard, { borderLeftWidth: 3, borderLeftColor: "#f59e0b" }]}>
                <View style={styles.eventoLeft}>
                  <View style={[styles.eventoIcono, { backgroundColor: "#fffbeb" }]}>
                    <Ionicons name="cloud-upload-outline" size={18} color="#f59e0b" />
                  </View>
                </View>
                <View style={styles.eventoCentro}>
                  <Text style={styles.eventoTipo}>Tu aporte (pendiente)</Text>
                  <Text style={styles.eventoFecha}>
                    {aporteLocal.creadoEn?.substring(0, 16).replace("T", " ") ?? ""}
                  </Text>
                  {(() => {
                    let campos: Record<string, unknown> = {};
                    try { campos = JSON.parse(aporteLocal.campos); } catch {}
                    const texto = Object.entries(campos)
                      .filter(([, v]) => v !== null && v !== undefined && v !== "")
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ");
                    return texto ? <Text style={styles.eventoExtra} numberOfLines={2}>{texto}</Text> : null;
                  })()}
                  {aporteLocal.fotoHash && <Text style={styles.eventoExtra}>Foto registrada 📷</Text>}
                  {aporteLocal.audioHash && <Text style={styles.eventoExtra}>Audio registrado 🎤</Text>}
                </View>
                <View style={styles.eventoRight}>
                  <View style={[styles.syncBadge, { backgroundColor: "#f59e0b22" }]}>
                    <Text style={[styles.syncBadgeText, { color: "#f59e0b" }]}>
                      {aporteLocal.syncEstado === "RECHAZADO" ? "Error" : "Pend."}
                    </Text>
                  </View>
                </View>
              </View>
              );
            })()}

            {/* Registros de campaña multi-técnico */}
            {registrosCampana.map((reg) => {
              const ESTADO_COLOR: Record<string, string> = {
                COMPLETO:   "#10b981",
                PARCIAL:    "#f59e0b",
                ADULTERADO: "#ef4444",
                INVALIDADO: "#9ca3af",
              };
              const estadoColor = ESTADO_COLOR[reg.estado] ?? "#888";
              // Posiciones ya confirmadas en el servidor
              const posicionesEnServidor = new Set(reg.aportes.map((a) => a.posicion));
              // Si el técnico actual tiene aporte local para este registro (mismo campanaId)
              // y su posición aún no está en el servidor, lo incluimos como "pendiente"
              const aporteLocalEnEsteRegistro =
                aporteLocal &&
                aporteLocal.campanaId === reg.campana.id &&
                !posicionesEnServidor.has(aporteLocal.posicion)
                  ? aporteLocal
                  : null;
              const totalAportes = reg.aportes.length + (aporteLocalEnEsteRegistro ? 1 : 0);
              return (
                <View key={reg.id} style={styles.eventoCard}>
                  <View style={styles.eventoLeft}>
                    <View style={[styles.eventoIcono, { backgroundColor: "#f0f4ff" }]}>
                      <Ionicons name="people" size={18} color="#4f46e5" />
                    </View>
                  </View>
                  <View style={styles.eventoCentro}>
                    <Text style={styles.eventoTipo}>
                      Registro campaña #{reg.consecutivo}
                    </Text>
                    <Text style={[styles.eventoFecha, { color: "#4f46e5" }]}>
                      {reg.campana.nombre}{reg.campana.codigo ? ` · ${reg.campana.codigo}` : ""}
                    </Text>
                    <Text style={styles.eventoFecha}>
                      {reg.fechaEvento.substring(0, 16).replace("T", " ")}
                    </Text>
                    <Text style={styles.eventoExtra}>
                      {totalAportes} de 4 técnicos aportaron
                    </Text>
                    {/* Aportes sincronizados con el servidor */}
                    {reg.aportes.map((a) => {
                      const camposTexto = Object.entries(a.campos as Record<string, unknown>)
                        .filter(([, v]) => v !== null && v !== undefined && v !== "")
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" · ");
                      return (
                        <Text key={a.id} style={styles.aporteLinea} numberOfLines={2}>
                          P{a.posicion}: {camposTexto || "—"}
                          {a.fotoHash ? " 📷" : ""}{a.audioHash ? " 🎤" : ""}
                        </Text>
                      );
                    })}
                    {/* Aporte local pendiente de sincronizar para este registro */}
                    {aporteLocalEnEsteRegistro && (() => {
                      let campos: Record<string, unknown> = {};
                      try { campos = JSON.parse(aporteLocalEnEsteRegistro.campos); } catch {}
                      const camposTexto = Object.entries(campos)
                        .filter(([, v]) => v !== null && v !== undefined && v !== "")
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" · ");
                      return (
                        <Text style={[styles.aporteLinea, { color: "#f59e0b" }]} numberOfLines={2}>
                          P{aporteLocalEnEsteRegistro.posicion}: {camposTexto || "—"}
                          {aporteLocalEnEsteRegistro.fotoHash ? " 📷" : ""}
                          {aporteLocalEnEsteRegistro.audioHash ? " 🎤" : ""}
                          {" ⏳"}
                        </Text>
                      );
                    })()}
                    {/* Posiciones que aún faltan (sin aporte local tampoco) */}
                    {[1, 2, 3, 4].filter((pos) =>
                      !posicionesEnServidor.has(pos) &&
                      pos !== aporteLocalEnEsteRegistro?.posicion
                    ).map((pos) => (
                      <Text key={`falta-${pos}`} style={[styles.aporteLinea, { color: "#d1d5db" }]}>
                        P{pos}: pendiente…
                      </Text>
                    ))}
                  </View>
                  <View style={styles.eventoRight}>
                    <View style={[styles.syncBadge, { backgroundColor: estadoColor + "22" }]}>
                      <Text style={[styles.syncBadgeText, { color: estadoColor }]}>
                        {reg.estado}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}

            {/* Eventos clásicos de producción */}
            {eventos.map((ev) => {
              let extra: Record<string, string> = {};
              try { extra = JSON.parse(ev.datosExtra); } catch {}
              return (
                <View key={ev.id} style={styles.eventoCard}>
                  <View style={styles.eventoLeft}>
                    <View style={[styles.eventoIcono, { backgroundColor: "#f0faf4" }]}>
                      <Ionicons
                        name={(TIPO_ICONO[ev.tipoEvento] ?? "ellipsis-horizontal") as any}
                        size={18}
                        color={VERDE}
                      />
                    </View>
                  </View>
                  <View style={styles.eventoCentro}>
                    <Text style={styles.eventoTipo}>{ev.tipoEvento.replace(/_/g, " ")}</Text>
                    <Text style={styles.eventoFecha}>{ev.fechaEvento.substring(0, 16).replace("T", " ")}</Text>
                    {ev.descripcion ? (
                      <Text style={styles.eventoDesc} numberOfLines={2}>{ev.descripcion}</Text>
                    ) : null}
                    {extra.alturaCm && (
                      <Text style={styles.eventoExtra}>Altura: {extra.alturaCm} cm</Text>
                    )}
                  </View>
                  <View style={styles.eventoRight}>
                    <View style={[styles.syncBadge, { backgroundColor: (SYNC_COLOR[ev.syncEstado] ?? "#ccc") + "22" }]}>
                      <Text style={[styles.syncBadgeText, { color: SYNC_COLOR[ev.syncEstado] ?? "#ccc" }]}>
                        {ev.syncEstado === "SINCRONIZADO" ? "Sync" : ev.syncEstado === "PENDIENTE" ? "Pend." : "Error"}
                      </Text>
                    </View>
                    {ev.fotoHash && <Ionicons name="camera" size={14} color="#888" style={{ marginTop: 4 }} />}
                    {ev.audioHash && <Ionicons name="mic" size={14} color="#888" style={{ marginTop: 2 }} />}
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
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
  headerTitulo: { fontSize: 18, fontWeight: "bold", color: "#fff" },
  headerSub: { fontSize: 12, color: "#b7dfca", marginTop: 2 },
  btnNuevoEvento: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  btnNuevoEventoText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  btnDeshabilitado:   { backgroundColor: "rgba(255,255,255,0.1)" },
  btnCompleto:        { backgroundColor: "rgba(16,185,129,0.3)" },
  tarjeta: {
    backgroundColor: "#fff", marginHorizontal: 16, marginTop: 12,
    borderRadius: 12, padding: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  tarjetaHeader: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginBottom: 12, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: "#f0faf4",
  },
  tarjetaTitulo: { fontSize: 13, fontWeight: "700", color: VERDE },
  fila: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", paddingVertical: 5,
    borderBottomWidth: 1, borderBottomColor: "#fafafa",
  },
  filaLabel: { fontSize: 13, color: "#666", flex: 1 },
  filaValor: { fontSize: 13, color: "#222", fontWeight: "600", flex: 1, textAlign: "right" },
  seccionHistorial: {
    marginHorizontal: 16, marginTop: 20, marginBottom: 8,
  },
  seccionHistorialTitulo: { fontSize: 14, fontWeight: "700", color: "#444" },
  vacioHistorial: {
    alignItems: "center", paddingVertical: 32,
    marginHorizontal: 16,
    backgroundColor: "#fff", borderRadius: 12,
  },
  vacioHistorialText: { fontSize: 15, color: "#999", marginTop: 10 },
  vacioHistorialSub: { fontSize: 12, color: "#bbb", marginTop: 4 },
  eventoCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 16, marginBottom: 8,
    borderRadius: 12, padding: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
  },
  eventoLeft: { marginRight: 12 },
  eventoIcono: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  eventoCentro: { flex: 1 },
  eventoTipo: { fontSize: 14, fontWeight: "700", color: "#222" },
  eventoFecha: { fontSize: 12, color: "#888", marginTop: 2 },
  eventoDesc: { fontSize: 12, color: "#666", marginTop: 4, lineHeight: 16 },
  eventoExtra: { fontSize: 11, color: "#888", marginTop: 2 },
  aporteLinea: { fontSize: 11, color: "#555", marginTop: 2 },
  eventoRight: { alignItems: "flex-end", minWidth: 60 },
  syncBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  syncBadgeText: { fontSize: 10, fontWeight: "700" },
});
