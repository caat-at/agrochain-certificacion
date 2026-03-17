"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getApiUrl } from "@/lib/client";

interface Lote {
  id: string;
  codigoLote: string;
  especie: string;
  variedad: string | null;
}

function getToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)ac_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

// Campos predefinidos comunes para sugerencias rápidas
const CAMPOS_SUGERIDOS = [
  "altura_cm", "diametro_cm", "estado_fitosanitario", "presencia_plaga",
  "nivel_riesgo", "color_fruto", "madurez", "calidad_general",
  "humedad_suelo", "temperatura", "observaciones",
];

export function NuevaCampanaForm({ lotes }: { lotes: Lote[] }) {
  const [abierto, setAbierto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [loteId, setLoteId] = useState(lotes[0]?.id ?? "");
  const [campos, setCampos] = useState<string[]>([]);
  const [campoInput, setCampoInput] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function agregarCampo(campo: string) {
    const limpio = campo.trim().toLowerCase().replace(/\s+/g, "_");
    if (!limpio || campos.includes(limpio)) return;
    setCampos([...campos, limpio]);
    setCampoInput("");
    inputRef.current?.focus();
  }

  function quitarCampo(campo: string) {
    setCampos(campos.filter((c) => c !== campo));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) { setError("El nombre es obligatorio."); return; }
    if (!loteId) { setError("Selecciona un lote."); return; }
    if (campos.length === 0) { setError("Agrega al menos un campo requerido."); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/campanas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          loteId,
          nombre: nombre.trim(),
          codigo: codigo.trim().toUpperCase() || undefined,
          descripcion: descripcion.trim() || undefined,
          camposRequeridos: campos,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);

      // Redirigir al detalle de la nueva campaña
      router.push(`/campanas/${data.campana.id}`);
      router.refresh();
    } catch (e) {
      setError(String(e));
      setLoading(false);
    }
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-verde-500 hover:bg-verde-600 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Nueva campaña
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">Nueva campaña</h2>
          <button
            onClick={() => setAbierto(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Lote */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Lote
            </label>
            <select
              value={loteId}
              onChange={(e) => setLoteId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-verde-400 bg-white"
            >
              {lotes.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.codigoLote} — {l.especie}{l.variedad ? ` · ${l.variedad}` : ""}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">
              Solo puede haber una campaña ABIERTA por lote a la vez.
            </p>
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Nombre de la campaña
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Visita BPA — Junio 2025"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-verde-400"
            />
          </div>

          {/* Código */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Código de campaña <span className="font-normal text-gray-400 normal-case">(opcional)</span>
            </label>
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9\-_]/g, ""))}
              placeholder="Ej: MANGO26, AGUAC-2026-01"
              maxLength={20}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-verde-400"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Código único legible. Solo mayúsculas, números y guiones. Ej: <code className="bg-gray-100 px-1 rounded">MANGO26</code>
            </p>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Descripción <span className="font-normal text-gray-400 normal-case">(opcional)</span>
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Objetivo de la visita, notas para los técnicos..."
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-verde-400 resize-none"
            />
          </div>

          {/* Campos requeridos */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Campos requeridos
            </label>
            <p className="text-[11px] text-gray-400 mb-2">
              Define qué datos deben registrar los técnicos en campo para cada planta.
            </p>

            {/* Chips de campos agregados */}
            {campos.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                {campos.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium"
                  >
                    {c}
                    <button
                      type="button"
                      onClick={() => quitarCampo(c)}
                      className="text-blue-400 hover:text-blue-700 transition-colors ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Input para agregar campo */}
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={campoInput}
                onChange={(e) => setCampoInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); agregarCampo(campoInput); }
                }}
                placeholder="nombre_campo (Enter para agregar)"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-400"
              />
              <button
                type="button"
                onClick={() => agregarCampo(campoInput)}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition-colors font-medium"
              >
                +
              </button>
            </div>

            {/* Sugerencias rápidas */}
            <div className="mt-2">
              <p className="text-[10px] text-gray-400 mb-1.5">Sugerencias rápidas:</p>
              <div className="flex flex-wrap gap-1">
                {CAMPOS_SUGERIDOS.filter((s) => !campos.includes(s)).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => agregarCampo(s)}
                    className="text-[11px] text-gray-500 hover:text-verde-600 bg-gray-100 hover:bg-verde-50 border border-gray-200 hover:border-verde-200 px-2 py-0.5 rounded-full transition-colors"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-600">
              {error}
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-verde-500 hover:bg-verde-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? "Creando…" : "Crear campaña"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
