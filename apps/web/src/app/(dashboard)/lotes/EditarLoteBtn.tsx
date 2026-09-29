"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const DESTINOS = [
  { value: "", label: "— Sin especificar —" },
  { value: "CONSUMO_INTERNO", label: "Consumo interno" },
  { value: "EXPORTACION", label: "Exportación" },
  { value: "AGROINDUSTRIA", label: "Agroindustria" },
  { value: "MIXTO", label: "Mixto" },
];

interface Props {
  lote: {
    id: string;
    codigoLote: string;
    variedad: string;
    fechaCosechaEst: string | null;
    fechaCosechaReal: string | null;
    volumenCosechaKg: number | null;
    destinoProduccion: string | null;
    sistemaRiego: string | null;
  };
}

export function EditarLoteBtn({ lote }: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const [variedad, setVariedad]                 = useState(lote.variedad);
  const [fechaCosechaEst, setFechaCosechaEst]   = useState(lote.fechaCosechaEst?.slice(0, 10) ?? "");
  const [fechaCosechaReal, setFechaCosechaReal] = useState(lote.fechaCosechaReal?.slice(0, 10) ?? "");
  const [volumenCosechaKg, setVolumenCosechaKg] = useState(lote.volumenCosechaKg != null ? String(lote.volumenCosechaKg) : "");
  const [destinoProduccion, setDestinoProduccion] = useState(lote.destinoProduccion ?? "");
  const [sistemaRiego, setSistemaRiego]         = useState(lote.sistemaRiego ?? "");

  function handleClose() {
    setAbierto(false);
    setError(null);
    setVariedad(lote.variedad);
    setFechaCosechaEst(lote.fechaCosechaEst?.slice(0, 10) ?? "");
    setFechaCosechaReal(lote.fechaCosechaReal?.slice(0, 10) ?? "");
    setVolumenCosechaKg(lote.volumenCosechaKg != null ? String(lote.volumenCosechaKg) : "");
    setDestinoProduccion(lote.destinoProduccion ?? "");
    setSistemaRiego(lote.sistemaRiego ?? "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!variedad.trim()) { setError("La variedad es obligatoria."); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/lotes/${lote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variedad: variedad.trim(),
          fechaCosechaEst: fechaCosechaEst ? new Date(fechaCosechaEst).toISOString() : null,
          fechaCosechaReal: fechaCosechaReal ? new Date(fechaCosechaReal).toISOString() : null,
          volumenCosechaKg: volumenCosechaKg ? Number(volumenCosechaKg) : null,
          destinoProduccion: destinoProduccion || null,
          sistemaRiego: sistemaRiego.trim() || null,
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
        className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        title="Editar lote"
      >
        Editar
      </button>

      {abierto && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">Editar lote</h2>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">{lote.codigoLote}</p>
              </div>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Variedad</label>
                <input
                  type="text"
                  value={variedad}
                  onChange={(e) => setVariedad(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-verde-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Cosecha estimada</label>
                  <input
                    type="date"
                    value={fechaCosechaEst}
                    onChange={(e) => setFechaCosechaEst(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-verde-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Cosecha real</label>
                  <input
                    type="date"
                    value={fechaCosechaReal}
                    onChange={(e) => setFechaCosechaReal(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-verde-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Volumen cosechado (kg)</label>
                <input
                  type="number"
                  step="any"
                  value={volumenCosechaKg}
                  onChange={(e) => setVolumenCosechaKg(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-verde-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Destino de producción</label>
                <select
                  value={destinoProduccion}
                  onChange={(e) => setDestinoProduccion(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-verde-400"
                >
                  {DESTINOS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Sistema de riego</label>
                <input
                  type="text"
                  value={sistemaRiego}
                  onChange={(e) => setSistemaRiego(e.target.value)}
                  placeholder="Ej: goteo, aspersión"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-verde-400"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-600">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-verde-500 hover:bg-verde-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
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
