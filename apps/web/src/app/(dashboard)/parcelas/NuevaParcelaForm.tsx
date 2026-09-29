"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface PredioOpcion {
  id: string;
  nombrePredio: string;
}

export function NuevaParcelaForm() {
  const [abierto, setAbierto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [predios, setPredios] = useState<PredioOpcion[]>([]);

  const [predioId, setPredioId]     = useState("");
  const [nombre, setNombre]         = useState("");
  const [areaHa, setAreaHa]         = useState("");
  const [usoActual, setUsoActual]   = useState("");
  const [latitud, setLatitud]       = useState("");
  const [longitud, setLongitud]     = useState("");

  const router = useRouter();

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
    setPredioId("");
    setNombre("");
    setAreaHa("");
    setUsoActual("");
    setLatitud("");
    setLongitud("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!predioId) { setError("Selecciona el predio al que pertenece la parcela."); return; }
    const area = Number(areaHa);
    if (!areaHa || Number.isNaN(area) || area <= 0) { setError("El área debe ser un número mayor a 0."); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/parcelas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predioId,
          nombre: nombre.trim() || undefined,
          areaHa: area,
          usoActual: usoActual.trim() || undefined,
          latitud: latitud ? Number(latitud) : undefined,
          longitud: longitud ? Number(longitud) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
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
        className="inline-flex items-center gap-2 px-4 py-2 bg-verde-500 hover:bg-verde-600 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Nueva parcela
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">Nueva parcela</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="label">Predio</label>
            <select className="input" value={predioId} onChange={(e) => setPredioId(e.target.value)}>
              <option value="">— Seleccionar predio —</option>
              {predios.map((p) => (
                <option key={p.id} value={p.id}>{p.nombrePredio}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              El código de parcela se genera automáticamente al guardar.
            </p>
          </div>

          <div>
            <label className="label">Nombre (opcional)</label>
            <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Lote alto, La quiebra" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Área (ha)</label>
              <input className="input" type="number" step="any" value={areaHa} onChange={(e) => setAreaHa(e.target.value)} placeholder="10" />
            </div>
            <div>
              <label className="label">Uso actual</label>
              <input className="input" value={usoActual} onChange={(e) => setUsoActual(e.target.value)} placeholder="Ej: Café, Plátano" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Latitud (opcional)</label>
              <input className="input" type="number" step="any" value={latitud} onChange={(e) => setLatitud(e.target.value)} placeholder="5.70" />
            </div>
            <div>
              <label className="label">Longitud (opcional)</label>
              <input className="input" type="number" step="any" value={longitud} onChange={(e) => setLongitud(e.target.value)} placeholder="-75.30" />
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
              {loading ? "Creando…" : "Crear parcela"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
