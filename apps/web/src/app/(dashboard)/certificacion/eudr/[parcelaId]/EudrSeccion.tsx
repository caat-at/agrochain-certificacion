"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getApiUrl } from "@/lib/client";

export interface EudrEstadoParcela {
  parcelaId: string;
  tienePoligono: boolean;
  poligonoVersion: number | null;
  tieneDeclaracionVigente: boolean;
  declaracionId: string | null;
  declaracionEstado: "BORRADOR" | "FIRMADA" | "ANCLADA_BLOCKCHAIN" | "RECHAZADA" | null;
  libreDeforestacion: boolean | null;
  cumpleUmbral: boolean;
  evidenciasCount: number;
}

interface EvidenciaSatelital {
  id: string;
  tipoEvidencia: string;
  descripcion: string | null;
  originalName: string;
  url: string;
  createdAt: string;
}

const TIPOS_EVIDENCIA = [
  { value: "IMAGEN_SATELITAL", label: "Imagen satelital" },
  { value: "REPORTE_NDVI", label: "Reporte NDVI" },
  { value: "CERTIFICADO_TERCERO", label: "Certificado de tercero" },
  { value: "OTRO", label: "Otro" },
];

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export function EudrSeccion({
  parcelaId,
  estadoInicial,
  token,
}: {
  parcelaId: string;
  estadoInicial: EudrEstadoParcela | null;
  token: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Declaración
  const [libreDeforestacion, setLibreDeforestacion] = useState(true);
  const [fechaCorte, setFechaCorte] = useState("");
  const [observaciones, setObservaciones] = useState("");

  // Evidencia
  const [evidencias, setEvidencias] = useState<EvidenciaSatelital[]>([]);
  const [evidenciasCargadas, setEvidenciasCargadas] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [tipoEvidencia, setTipoEvidencia] = useState("IMAGEN_SATELITAL");
  const [descEvidencia, setDescEvidencia] = useState("");

  const estado = estadoInicial;

  async function handleCrearDeclaracion(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/eudr/parcelas/${parcelaId}/declaracion`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({
          libreDeforestacion,
          fechaCorte: fechaCorte || undefined,
          observaciones: observaciones || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `Error ${res.status}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleFirmar(declaracionId: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/eudr/declaraciones/${declaracionId}/firmar`, {
        method: "POST",
        headers: authHeaders(token),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `Error ${res.status}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function cargarEvidencias(declaracionId: string) {
    try {
      const res = await fetch(`${getApiUrl()}/api/eudr/declaraciones/${declaracionId}/evidencias`, {
        headers: authHeaders(token),
      });
      const data = await res.json();
      if (res.ok) {
        setEvidencias(data.evidencias ?? []);
        setEvidenciasCargadas(true);
      }
    } catch {
      // silencioso
    }
  }

  async function handleSubirEvidencia(e: React.FormEvent, declaracionId: string) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tipoEvidencia", tipoEvidencia);
      if (descEvidencia) formData.append("descripcion", descEvidencia);

      const res = await fetch(`${getApiUrl()}/api/eudr/declaraciones/${declaracionId}/evidencias`, {
        method: "POST",
        headers: authHeaders(token),
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `Error ${res.status}`);
      setFile(null);
      setDescEvidencia("");
      await cargarEvidencias(declaracionId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  if (!estado) {
    return <p className="text-sm text-gray-400">No se pudo cargar el estado EUDR de la parcela.</p>;
  }

  const declaracionId = estado.declaracionId;

  return (
    <div className="space-y-4">
      {/* Resumen de estado */}
      <div className="flex flex-wrap gap-2">
        <span className={`badge ${estado.tienePoligono ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
          {estado.tienePoligono ? `Polígono v${estado.poligonoVersion}` : "Sin polígono"}
        </span>
        <span className={`badge ${estado.tieneDeclaracionVigente ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
          {estado.declaracionEstado ? `Declaración: ${estado.declaracionEstado}` : "Sin declaración"}
        </span>
        <span className={`badge ${estado.cumpleUmbral ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
          {estado.cumpleUmbral ? "Cumple umbral EUDR" : "No cumple umbral EUDR aún"}
        </span>
        {estado.evidenciasCount > 0 && (
          <span className="badge bg-blue-50 text-blue-600">{estado.evidenciasCount} evidencia(s)</span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-600">{error}</div>
      )}

      {/* Sin poligono — EUDR usa el poligono general de la parcela (el mismo
          que se dibuja arriba con el mapa interactivo), no pide uno propio */}
      {!estado.tienePoligono && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          Esta parcela aún no tiene un polígono georreferenciado. Dibújalo en la sección
          "Polígono de la parcela" (arriba) para poder declarar cumplimiento EUDR.
        </div>
      )}

      {/* Polígono ok, sin declaración vigente — crearla */}
      {estado.tienePoligono && !estado.tieneDeclaracionVigente && (
        <form onSubmit={handleCrearDeclaracion} className="space-y-3 bg-gray-50 rounded-xl p-4">
          <p className="text-xs text-gray-500">Declara si el área es libre de deforestación desde la fecha de corte EUDR.</p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={libreDeforestacion}
              onChange={(e) => setLibreDeforestacion(e.target.checked)}
            />
            Libre de deforestación
          </label>
          <div>
            <label className="label">Fecha de corte</label>
            <input type="date" className="input" value={fechaCorte} onChange={(e) => setFechaCorte(e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">Por defecto 2020-12-31 (umbral EUDR) si se deja vacío.</p>
          </div>
          <div>
            <label className="label">Observaciones</label>
            <textarea
              className="input"
              rows={2}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary text-sm py-2 w-full disabled:opacity-50">
            {loading ? "Guardando…" : "Crear declaración"}
          </button>
        </form>
      )}

      {/* Declaración BORRADOR — firmar */}
      {declaracionId && estado.declaracionEstado === "BORRADOR" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <p className="text-sm text-amber-700">Declaración en estado BORRADOR — falta firmarla.</p>
          <button
            onClick={() => handleFirmar(declaracionId)}
            disabled={loading}
            className="btn-primary text-sm py-2 w-full disabled:opacity-50"
          >
            {loading ? "Firmando…" : "Firmar declaración"}
          </button>
        </div>
      )}

      {/* Declaración FIRMADA — el anclaje en blockchain aun no esta disponible
          para EUDR (requiere un contrato propio para parcelas, pendiente) */}
      {declaracionId && estado.declaracionEstado === "FIRMADA" && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <p className="text-sm text-blue-700">
            Declaración firmada y válida para certificación. El anclaje en blockchain para EUDR está en desarrollo.
          </p>
        </div>
      )}

      {/* Declaración ANCLADA_BLOCKCHAIN */}
      {estado.declaracionEstado === "ANCLADA_BLOCKCHAIN" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-700">
          Declaración anclada en blockchain.
        </div>
      )}

      {/* Evidencia satelital — disponible en cuanto existe una declaración */}
      {declaracionId && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Evidencia satelital</h3>

          {evidenciasCargadas && evidencias.length > 0 && (
            <div className="space-y-1.5">
              {evidencias.map((ev) => (
                <a
                  key={ev.id}
                  href={ev.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2 hover:bg-gray-100"
                >
                  <span className="text-gray-600">{ev.originalName} · {ev.tipoEvidencia.replace(/_/g, " ")}</span>
                  <span className="text-blue-500">Ver →</span>
                </a>
              ))}
            </div>
          )}
          {evidenciasCargadas && evidencias.length === 0 && (
            <p className="text-xs text-gray-400">Sin evidencias cargadas.</p>
          )}
          {!evidenciasCargadas && (
            <button
              type="button"
              onClick={() => cargarEvidencias(declaracionId)}
              className="text-xs text-verde-500 hover:text-verde-600 font-medium"
            >
              Ver evidencias cargadas →
            </button>
          )}

          <form onSubmit={(e) => handleSubirEvidencia(e, declaracionId)} className="space-y-2 bg-gray-50 rounded-xl p-3">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <select className="input text-xs" value={tipoEvidencia} onChange={(e) => setTipoEvidencia(e.target.value)}>
                {TIPOS_EVIDENCIA.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <input
                className="input text-xs"
                placeholder="Descripción (opcional)"
                value={descEvidencia}
                onChange={(e) => setDescEvidencia(e.target.value)}
              />
            </div>
            <button type="submit" disabled={loading || !file} className="btn-secondary text-xs py-1.5 w-full disabled:opacity-50">
              {loading ? "Subiendo…" : "Subir evidencia"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
