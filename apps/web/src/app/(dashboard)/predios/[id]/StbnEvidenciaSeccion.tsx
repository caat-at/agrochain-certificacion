"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getApiUrl } from "@/lib/client";

export type PilarStbn = "CONSERVACION" | "COMUNIDAD" | "JUSTICIA_SOCIAL" | "TECNOLOGIA" | "DERECHOS_HUMANOS";

export interface StbnSubcriterio {
  codigo: string;
  pilar: PilarStbn;
  nombre: string;
  orden: number;
  puntajeAlto: number;
  puntajeBajo: number;
  descripcionAlto: string;
  descripcionBajo: string;
  nombreEs: string | null;
  descripcionAltoEs: string | null;
  descripcionBajoEs: string | null;
}

interface AdjuntoBinario {
  id: string;
  originalName: string;
  mimetype: string;
}

export interface StbnEvidenciaPilar {
  id: string;
  predioId: string;
  pilar: PilarStbn;
  titulo: string;
  narrativa: string;
  periodoDesde: string | null;
  periodoHasta: string | null;
  createdAt: string;
  adjuntos: AdjuntoBinario[];
}

const PILARES: { value: PilarStbn; label: string }[] = [
  { value: "CONSERVACION", label: "Conservación" },
  { value: "COMUNIDAD", label: "Comunidad" },
  { value: "JUSTICIA_SOCIAL", label: "Justicia Social" },
  { value: "TECNOLOGIA", label: "Tecnología" },
  { value: "DERECHOS_HUMANOS", label: "Derechos Humanos" },
];

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

// Mismo set de mimetypes que apps/api/src/routes/stbn.ts (fotos, PDF, audio,
// video) — evidencia STBN puede ser una entrevista a la comunidad o un
// recorrido en video, a diferencia de la evidencia satelital EUDR.
const ACCEPT_ADJUNTOS =
  "image/jpeg,image/png,image/webp,application/pdf,audio/mpeg,audio/mp4,audio/wav,audio/webm,audio/ogg,video/mp4,video/webm,video/quicktime";

export function StbnEvidenciaSeccion({
  predioId,
  evidenciasIniciales,
  token,
}: {
  predioId: string;
  evidenciasIniciales: StbnEvidenciaPilar[];
  token: string;
}) {
  const router = useRouter();
  const [pilarActivo, setPilarActivo] = useState<PilarStbn>("CONSERVACION");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [narrativa, setNarrativa] = useState("");
  const [periodoDesde, setPeriodoDesde] = useState("");
  const [periodoHasta, setPeriodoHasta] = useState("");
  const [archivosNuevos, setArchivosNuevos] = useState<File[]>([]);

  const [subiendoAdjunto, setSubiendoAdjunto] = useState<string | null>(null);

  const evidenciasPilar = evidenciasIniciales.filter((e) => e.pilar === pilarActivo);

  async function subirArchivo(evidenciaPilarId: string, file: File): Promise<void> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${getApiUrl()}/api/stbn/evidencias/${evidenciaPilarId}/binarios`, {
      method: "POST",
      headers: authHeaders(token),
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? `Error ${res.status}`);
  }

  async function handleCrearEvidencia(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/stbn/predios/${predioId}/evidencias`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({
          pilar: pilarActivo,
          titulo,
          narrativa,
          periodoDesde: periodoDesde || undefined,
          periodoHasta: periodoHasta || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `Error ${res.status}`);

      const evidenciaId = data.evidencia.id as string;
      for (const file of archivosNuevos) {
        await subirArchivo(evidenciaId, file);
      }

      setTitulo("");
      setNarrativa("");
      setPeriodoDesde("");
      setPeriodoHasta("");
      setArchivosNuevos([]);
      setMostrarForm(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubirAdjunto(evidenciaPilarId: string, file: File) {
    setError(null);
    setSubiendoAdjunto(evidenciaPilarId);
    try {
      await subirArchivo(evidenciaPilarId, file);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubiendoAdjunto(null);
    }
  }

  return (
    <div>
      {/* Tabs por pilar */}
      <div className="flex flex-wrap border-b border-gray-100 mb-4">
        {PILARES.map((p) => {
          const count = evidenciasIniciales.filter((e) => e.pilar === p.value).length;
          return (
            <button
              key={p.value}
              onClick={() => { setPilarActivo(p.value); setMostrarForm(false); setError(null); }}
              className={`py-2.5 px-3 mr-2 text-xs font-semibold border-b-2 transition-colors ${
                pilarActivo === p.value
                  ? "border-verde-500 text-verde-600"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              {p.label}
              {count > 0 && <span className="ml-1 text-gray-300">({count})</span>}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-600 mb-3">{error}</div>
      )}

      {/* Lista de evidencias del pilar activo */}
      <div className="space-y-3 mb-4">
        {evidenciasPilar.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Sin evidencia registrada para este pilar</p>
        ) : (
          evidenciasPilar.map((ev) => (
            <div key={ev.id} className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-gray-800">{ev.titulo}</p>
                {(ev.periodoDesde || ev.periodoHasta) && (
                  <span className="text-[10px] text-gray-400">
                    {ev.periodoDesde ?? "…"} → {ev.periodoHasta ?? "…"}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600">{ev.narrativa}</p>

              {ev.adjuntos.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {ev.adjuntos.map((a) => (
                    <span key={a.id} className="badge bg-blue-50 text-blue-600 text-[10px]">{a.originalName}</span>
                  ))}
                </div>
              )}

              <label className="inline-block text-xs text-verde-500 hover:text-verde-600 font-medium cursor-pointer">
                {subiendoAdjunto === ev.id ? "Subiendo…" : "+ Adjuntar archivo"}
                <input
                  type="file"
                  accept={ACCEPT_ADJUNTOS}
                  className="hidden"
                  disabled={subiendoAdjunto === ev.id}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleSubirAdjunto(ev.id, file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          ))
        )}
      </div>

      {/* Formulario nueva evidencia */}
      {mostrarForm ? (
        <form onSubmit={handleCrearEvidencia} className="space-y-3 bg-gray-50 rounded-xl p-4">
          <div>
            <label className="label">Título</label>
            <input className="input" value={titulo} onChange={(e) => setTitulo(e.target.value)} required maxLength={200} />
          </div>
          <div>
            <label className="label">Narrativa</label>
            <textarea className="input" rows={3} value={narrativa} onChange={(e) => setNarrativa(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Periodo desde</label>
              <input type="date" className="input" value={periodoDesde} onChange={(e) => setPeriodoDesde(e.target.value)} />
            </div>
            <div>
              <label className="label">Periodo hasta</label>
              <input type="date" className="input" value={periodoHasta} onChange={(e) => setPeriodoHasta(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Adjuntos (fotos, PDF, audio, video)</label>
            <input
              type="file"
              accept={ACCEPT_ADJUNTOS}
              multiple
              onChange={(e) => {
                const nuevos = Array.from(e.target.files ?? []);
                setArchivosNuevos((prev) => [...prev, ...nuevos]);
                e.target.value = "";
              }}
              className="text-xs"
            />
            {archivosNuevos.length > 0 && (
              <div className="mt-2 space-y-1">
                {archivosNuevos.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-white rounded-lg px-2 py-1 border border-gray-200">
                    <span className="truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setArchivosNuevos((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-red-400 hover:text-red-600 ml-2 flex-shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setMostrarForm(false); setArchivosNuevos([]); }} className="btn-secondary text-sm py-1.5 flex-1">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="btn-primary text-sm py-1.5 flex-1 disabled:opacity-50">
              {loading ? "Guardando…" : "Guardar evidencia"}
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setMostrarForm(true)} className="btn-secondary text-sm py-1.5 w-full">
          + Agregar evidencia
        </button>
      )}
    </div>
  );
}
