"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface PredioOpcion {
  id: string;
  nombrePredio: string;
}

interface Props {
  parcela: {
    id: string;
    predioId: string;
    codigoParcela: string;
    nombre: string | null;
    areaHa: number;
    usoActual: string | null;
    latitud: number | null;
    longitud: number | null;
    activo: boolean;
  };
}

export function EditarParcelaBtn({ parcela }: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [predios, setPredios] = useState<PredioOpcion[]>([]);

  const [predioId, setPredioId]   = useState(parcela.predioId);
  const [nombre, setNombre]       = useState(parcela.nombre ?? "");
  const [areaHa, setAreaHa]       = useState(String(parcela.areaHa));
  const [usoActual, setUsoActual] = useState(parcela.usoActual ?? "");
  const [latitud, setLatitud]     = useState(parcela.latitud != null ? String(parcela.latitud) : "");
  const [longitud, setLongitud]   = useState(parcela.longitud != null ? String(parcela.longitud) : "");
  const [activo, setActivo]       = useState(parcela.activo);

  useEffect(() => {
    if (!abierto || predios.length > 0) return;
    fetch(`/api/predios`)
      .then((r) => r.json())
      .then((data) => setPredios(data.predios ?? []))
      .catch(() => setPredios([]));
  }, [abierto, predios.length]);

  function handleClose() {
    setAbierto(false);
    setError(null);
    setPredioId(parcela.predioId);
    setNombre(parcela.nombre ?? "");
    setAreaHa(String(parcela.areaHa));
    setUsoActual(parcela.usoActual ?? "");
    setLatitud(parcela.latitud != null ? String(parcela.latitud) : "");
    setLongitud(parcela.longitud != null ? String(parcela.longitud) : "");
    setActivo(parcela.activo);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!predioId) { setError("Selecciona el predio al que pertenece la parcela."); return; }
    const area = Number(areaHa);
    if (!areaHa || Number.isNaN(area) || area <= 0) { setError("El área debe ser un número mayor a 0."); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/parcelas/${parcela.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predioId,
          nombre: nombre.trim() || null,
          areaHa: area,
          usoActual: usoActual.trim() || null,
          latitud: latitud ? Number(latitud) : null,
          longitud: longitud ? Number(longitud) : null,
          activo,
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
        title="Editar parcela"
      >
        Editar
      </button>

      {abierto && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">Editar parcela</h2>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">{parcela.codigoParcela}</p>
              </div>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Predio</label>
                <select
                  value={predioId}
                  onChange={(e) => setPredioId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-verde-400"
                >
                  <option value="">— Seleccionar predio —</option>
                  {predios.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombrePredio}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Nombre</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-verde-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Área (ha)</label>
                  <input
                    type="number"
                    step="any"
                    value={areaHa}
                    onChange={(e) => setAreaHa(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-verde-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Uso actual</label>
                  <input
                    type="text"
                    value={usoActual}
                    onChange={(e) => setUsoActual(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-verde-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Latitud</label>
                  <input
                    type="number"
                    step="any"
                    value={latitud}
                    onChange={(e) => setLatitud(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-verde-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Longitud</label>
                  <input
                    type="number"
                    step="any"
                    value={longitud}
                    onChange={(e) => setLongitud(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-verde-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Estado</label>
                <select
                  value={activo ? "activo" : "inactivo"}
                  onChange={(e) => setActivo(e.target.value === "activo")}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-verde-400"
                >
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
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
