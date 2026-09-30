"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

const CAMPOS_SUGERIDOS = [
  "altura_cm", "diametro_cm", "estado_fitosanitario", "presencia_plaga",
  "nivel_riesgo", "color_fruto", "madurez", "calidad_general",
  "humedad_suelo", "temperatura", "observaciones",
];

interface Props {
  campana: {
    id: string;
    nombre: string;
    descripcion: string | null;
    estado: "ACTIVA" | "ABIERTA" | "CERRADA";
    camposRequeridos: string[];
  };
}

export function EditarCampanaBtn({ campana }: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const [nombre, setNombre]           = useState(campana.nombre);
  const [descripcion, setDescripcion] = useState(campana.descripcion ?? "");
  const [campos, setCampos]           = useState<string[]>(campana.camposRequeridos);
  const [campoInput, setCampoInput]   = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const puedeEditarCampos = campana.estado === "ACTIVA";

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

  function handleClose() {
    setAbierto(false);
    setError(null);
    setNombre(campana.nombre);
    setDescripcion(campana.descripcion ?? "");
    setCampos(campana.camposRequeridos);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) { setError("El nombre es obligatorio."); return; }
    if (puedeEditarCampos && campos.length === 0) { setError("Agrega al menos un campo requerido."); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/campanas/${campana.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
          ...(puedeEditarCampos ? { camposRequeridos: campos } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      setAbierto(false);
      router.refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors"
      >
        Editar
      </button>

      {abierto && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900 text-lg">Editar campaña</h2>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Nombre</label>
                <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </div>

              <div>
                <label className="label">Descripción (opcional)</label>
                <textarea
                  className="input"
                  rows={2}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Campos requeridos</label>
                {!puedeEditarCampos && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
                    Solo se pueden editar mientras la campaña está ACTIVA (sin abrir).
                  </p>
                )}
                {puedeEditarCampos && (
                  <>
                    <div className="flex gap-2 mb-2">
                      <input
                        ref={inputRef}
                        className="input flex-1"
                        value={campoInput}
                        onChange={(e) => setCampoInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); agregarCampo(campoInput); }
                        }}
                        placeholder="Escribe un campo y presiona Enter"
                      />
                      <button type="button" onClick={() => agregarCampo(campoInput)} className="btn-secondary px-3">
                        Agregar
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {CAMPOS_SUGERIDOS.filter((c) => !campos.includes(c)).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => agregarCampo(c)}
                          className="text-[11px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full border border-gray-200 hover:bg-gray-100"
                        >
                          + {c}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {campos.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1 text-xs bg-verde-50 text-verde-700 px-2 py-1 rounded-full border border-verde-100">
                      {c}
                      {puedeEditarCampos && (
                        <button type="button" onClick={() => quitarCampo(c)} className="text-verde-400 hover:text-verde-600">
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>

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
                  {loading ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
