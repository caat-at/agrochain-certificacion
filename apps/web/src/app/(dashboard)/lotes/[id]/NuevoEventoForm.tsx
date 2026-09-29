"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { generarHashEvento } from "@/lib/hashAporte";

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const TIPOS_EVENTO = [
  "PREPARACION_SUELO", "SIEMBRA", "RIEGO", "FERTILIZACION",
  "CONTROL_PLAGAS", "CONTROL_ENFERMEDADES", "PODA", "COSECHA",
  "POSTCOSECHA", "MONITOREO", "OTRO",
];

type CampoExtra = {
  key: string;
  label: string;
  placeholder: string;
  tipo?: "numero" | "texto";
};

// Mismo criterio que apps/mobile/app/registrar-evento.tsx
const CAMPOS_EXTRA: Record<string, CampoExtra[]> = {
  SIEMBRA: [
    { key: "alturaCm", label: "Altura de planta (cm)", placeholder: "Ej: 25", tipo: "numero" },
    { key: "diametroTalloCm", label: "Diámetro de tallo (cm)", placeholder: "Ej: 1.5", tipo: "numero" },
    { key: "numHojas", label: "Número de hojas", placeholder: "Ej: 8", tipo: "numero" },
    { key: "estadoFenologico", label: "Estado fenológico", placeholder: "Ej: V2, R1, floración" },
    { key: "profundidadCm", label: "Profundidad de siembra (cm)", placeholder: "Ej: 5", tipo: "numero" },
  ],
  RIEGO: [
    { key: "volumenLitros", label: "Volumen de agua (L)", placeholder: "Ej: 10", tipo: "numero" },
    { key: "metodo", label: "Método de riego", placeholder: "Ej: goteo, aspersión, surco" },
    { key: "duracionMin", label: "Duración (min)", placeholder: "Ej: 30", tipo: "numero" },
  ],
  FERTILIZACION: [
    { key: "producto", label: "Producto/fertilizante", placeholder: "Ej: Urea, 15-15-15" },
    { key: "registroICA", label: "Registro ICA", placeholder: "Ej: 1234-A" },
    { key: "dosis", label: "Dosis", placeholder: "Ej: 200", tipo: "numero" },
    { key: "unidad", label: "Unidad", placeholder: "Ej: g/planta, kg/ha, cc/L" },
    { key: "metodo", label: "Método de aplicación", placeholder: "Ej: foliar, edáfico, fertiriego" },
  ],
  CONTROL_PLAGAS: [
    { key: "plagaDetectada", label: "Plaga detectada", placeholder: "Ej: Áfido, trips, minador" },
    { key: "incidenciaPct", label: "Incidencia (%)", placeholder: "Ej: 15", tipo: "numero" },
    { key: "severidad", label: "Severidad", placeholder: "Ej: leve, moderada, severa" },
    { key: "producto", label: "Producto aplicado", placeholder: "Ej: Imidacloprid" },
    { key: "registroICA", label: "Registro ICA", placeholder: "Ej: 1234-A" },
    { key: "dosis", label: "Dosis (cc o g / L agua)", placeholder: "Ej: 0.5", tipo: "numero" },
    { key: "periodoReentrada", label: "Período reentrada (días)", placeholder: "Ej: 3", tipo: "numero" },
  ],
  CONTROL_ENFERMEDADES: [
    { key: "enfermedad", label: "Enfermedad detectada", placeholder: "Ej: Antracnosis, mildiu" },
    { key: "incidenciaPct", label: "Incidencia (%)", placeholder: "Ej: 20", tipo: "numero" },
    { key: "producto", label: "Producto aplicado", placeholder: "Ej: Mancozeb" },
    { key: "registroICA", label: "Registro ICA", placeholder: "Ej: 1234-A" },
    { key: "dosis", label: "Dosis (cc o g / L agua)", placeholder: "Ej: 2", tipo: "numero" },
    { key: "periodoReentrada", label: "Período reentrada (días)", placeholder: "Ej: 7", tipo: "numero" },
  ],
  PODA: [
    { key: "tipoPoda", label: "Tipo de poda", placeholder: "Ej: formación, producción, sanitaria" },
    { key: "pctRamasRemovidas", label: "% ramas removidas", placeholder: "Ej: 20", tipo: "numero" },
    { key: "alturaCm", label: "Altura resultante (cm)", placeholder: "Ej: 150", tipo: "numero" },
  ],
  COSECHA: [
    { key: "pesoKg", label: "Peso cosechado (kg)", placeholder: "Ej: 12.5", tipo: "numero" },
    { key: "unidades", label: "Número de unidades/frutos", placeholder: "Ej: 48", tipo: "numero" },
    { key: "calidad", label: "Calidad", placeholder: "Ej: primera, segunda, exportación" },
    { key: "destino", label: "Destino", placeholder: "Ej: exportación, mercado local" },
    { key: "gradoBrix", label: "Grados Brix (si aplica)", placeholder: "Ej: 18", tipo: "numero" },
  ],
};

const CAMPOS_MORFOLOGICOS: CampoExtra[] = [
  { key: "alturaCm", label: "Altura de planta (cm)", placeholder: "Ej: 120", tipo: "numero" },
  { key: "diametroTalloCm", label: "Diámetro de tallo (cm)", placeholder: "Ej: 4.5", tipo: "numero" },
  { key: "estadoFenologico", label: "Estado fenológico", placeholder: "Ej: vegetativo, floración, fructificación" },
  { key: "estadoSanitario", label: "Estado sanitario general", placeholder: "Ej: bueno, regular, con plagas" },
];

interface Props {
  loteId: string;
  tecnicoId: string;
  plantaId?: string | null;
}

export function NuevoEventoForm({ loteId, tecnicoId, plantaId = null }: Props) {
  const router = useRouter();
  const [abierto, setAbierto]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const [tipoEvento, setTipoEvento]   = useState("SIEMBRA");
  const [descripcion, setDescripcion] = useState("");
  const [fechaEvento, setFechaEvento] = useState(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });
  const [latitud, setLatitud]   = useState("");
  const [longitud, setLongitud] = useState("");
  const [datosExtra, setDatosExtra] = useState<Record<string, string>>({});
  const [incluyeMorfologia, setIncluyeMorfologia] = useState(false);

  function cambiarTipoEvento(tipo: string) {
    setTipoEvento(tipo);
    setDatosExtra({});
    setIncluyeMorfologia(false);
  }

  function setCampoExtra(key: string, valor: string) {
    setDatosExtra((prev) => ({ ...prev, [key]: valor }));
  }

  function obtenerUbicacion() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitud(String(pos.coords.latitude));
        setLongitud(String(pos.coords.longitude));
      },
      () => { /* GPS no disponible — continua sin coordenadas */ },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function handleClose() {
    setAbierto(false);
    setError(null);
    setTipoEvento("SIEMBRA");
    setDescripcion("");
    setLatitud("");
    setLongitud("");
    setDatosExtra({});
    setIncluyeMorfologia(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!descripcion.trim()) { setError("Ingresa una descripción del evento."); return; }

    setLoading(true);
    setError(null);
    try {
      const datosExtraFiltrados: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(datosExtra)) {
        if (v.trim() !== "") datosExtraFiltrados[k] = v.trim();
      }

      const fechaIso = fechaEvento.length === 16 ? `${fechaEvento}:00.000Z` : new Date(fechaEvento).toISOString();
      const lat = latitud ? Number(latitud) : null;
      const lon = longitud ? Number(longitud) : null;

      const eventoData = {
        plantaId,
        loteId,
        tipoEvento,
        fechaEvento: fechaIso,
        latitud: lat,
        longitud: lon,
        tecnicoId,
        descripcion: descripcion.trim(),
        datosExtra: datosExtraFiltrados,
      };
      const contentHash = await generarHashEvento(eventoData);

      const res = await fetch(`/api/sync/eventos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventos: [{
            eventoId: uuid(),
            contentHash,
            loteId,
            plantaId,
            tipoEvento,
            descripcion: descripcion.trim(),
            fechaEvento: fechaIso,
            latitud: lat,
            longitud: lon,
            altitudMsnm: null,
            tecnicoId,
            datosExtra: datosExtraFiltrados,
          }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);

      const resultado = data.resultados?.[0];
      if (!resultado?.aceptado) {
        throw new Error(resultado?.motivo ?? "El evento fue rechazado por el servidor");
      }

      handleClose();
      router.refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-verde-600 hover:text-verde-700 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Nuevo evento
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">Nuevo evento de trazabilidad</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
          {/* Tipo de evento */}
          <div>
            <label className="label">Tipo de evento</label>
            <div className="flex flex-wrap gap-1.5">
              {TIPOS_EVENTO.map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => cambiarTipoEvento(tipo)}
                  className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                    tipoEvento === tipo
                      ? "bg-verde-500 border-verde-500 text-white font-medium"
                      : "bg-white border-gray-200 text-gray-600 hover:border-verde-300"
                  }`}
                >
                  {tipo.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Fecha */}
          <div>
            <label className="label">Fecha y hora del evento</label>
            <input
              className="input"
              type="datetime-local"
              value={fechaEvento}
              onChange={(e) => setFechaEvento(e.target.value)}
            />
          </div>

          {/* Campos específicos por tipo */}
          {CAMPOS_EXTRA[tipoEvento] && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                Datos agronómicos — {tipoEvento.replace(/_/g, " ")}
              </p>
              {CAMPOS_EXTRA[tipoEvento].map((campo) => (
                <div key={campo.key}>
                  <label className="label">{campo.label}</label>
                  <input
                    className="input"
                    type={campo.tipo === "numero" ? "text" : "text"}
                    inputMode={campo.tipo === "numero" ? "decimal" : "text"}
                    value={datosExtra[campo.key] ?? ""}
                    onChange={(e) => setCampoExtra(campo.key, e.target.value)}
                    placeholder={campo.placeholder}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Medidas morfológicas */}
          {tipoEvento !== "SIEMBRA" && (
            <label className="flex items-center gap-2 text-xs text-gray-600 bg-verde-50/60 border border-verde-100 rounded-lg px-3 py-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={incluyeMorfologia}
                onChange={(e) => setIncluyeMorfologia(e.target.checked)}
                className="accent-verde-500"
              />
              Incluir medidas de la planta (altura, diámetro, fenología)
            </label>
          )}
          {incluyeMorfologia && (
            <div className="space-y-3">
              {CAMPOS_MORFOLOGICOS.map((campo) => (
                <div key={campo.key}>
                  <label className="label">{campo.label}</label>
                  <input
                    className="input"
                    value={datosExtra[campo.key] ?? ""}
                    onChange={(e) => setCampoExtra(campo.key, e.target.value)}
                    placeholder={campo.placeholder}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Descripción */}
          <div>
            <label className="label">Descripción</label>
            <textarea
              className="input"
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describe las observaciones del evento en campo..."
            />
          </div>

          {/* GPS */}
          <div>
            <label className="label">Coordenadas GPS (opcional)</label>
            <div className="flex items-center gap-2 text-xs border border-gray-200 rounded-md px-3 py-2 bg-white text-gray-500">
              {latitud && longitud ? `${Number(latitud).toFixed(6)}, ${Number(longitud).toFixed(6)}` : "Sin GPS"}
              <button type="button" onClick={obtenerUbicacion} className="ml-auto text-verde-600 font-medium hover:underline">
                Obtener ubicación
              </button>
            </div>
          </div>

          <p className="text-[11px] text-blue-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            Al guardar se genera un hash SHA256 que garantiza que los datos no fueron alterados. El servidor recalcula y verifica este hash.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-600">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={handleClose} className="flex-1 btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="flex-1 btn-primary disabled:opacity-50">
              {loading ? "Guardando…" : "Guardar evento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
