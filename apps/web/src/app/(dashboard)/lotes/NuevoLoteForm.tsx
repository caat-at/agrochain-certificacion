"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getApiUrl } from "@/lib/client";

function getToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)ac_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

interface PredioOpcion {
  id: string;
  nombrePredio: string;
  agricultorId: string;
}

const DESTINOS = [
  { value: "", label: "— Sin especificar —" },
  { value: "CONSUMO_INTERNO", label: "Consumo interno" },
  { value: "EXPORTACION", label: "Exportación" },
  { value: "AGROINDUSTRIA", label: "Agroindustria" },
  { value: "MIXTO", label: "Mixto" },
];

export function NuevoLoteForm() {
  const [abierto, setAbierto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [predios, setPredios] = useState<PredioOpcion[]>([]);

  const [predioId, setPredioId] = useState("");
  const [especie, setEspecie] = useState("");
  const [variedad, setVariedad] = useState("");
  const [areaHa, setAreaHa] = useState("");
  const [fechaSiembra, setFechaSiembra] = useState("");
  const [destinoProduccion, setDestinoProduccion] = useState("");
  const [codigoDepartamento, setCodigoDepartamento] = useState("");

  const router = useRouter();

  useEffect(() => {
    if (!abierto) return;
    fetch(`${getApiUrl()}/api/predios`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((data) => setPredios(data.predios ?? []))
      .catch(() => setPredios([]));
  }, [abierto]);

  function handleClose() {
    setAbierto(false);
    setError(null);
    setPredioId("");
    setEspecie("");
    setVariedad("");
    setAreaHa("");
    setFechaSiembra("");
    setDestinoProduccion("");
    setCodigoDepartamento("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const predio = predios.find((p) => p.id === predioId);
    if (!predio) { setError("Selecciona el predio donde se ubica el lote."); return; }
    if (!especie.trim()) { setError("La especie es obligatoria."); return; }
    if (!variedad.trim()) { setError("La variedad es obligatoria."); return; }
    const area = Number(areaHa);
    if (!areaHa || Number.isNaN(area) || area <= 0) { setError("El área debe ser un número mayor a 0."); return; }
    if (!/^\d{2}$/.test(codigoDepartamento)) {
      setError("El código DANE del departamento debe tener 2 dígitos (ej: 05 para Antioquia).");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/lotes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          predioId,
          agricultorId: predio.agricultorId,
          especie: especie.trim(),
          variedad: variedad.trim(),
          areaHa: area,
          fechaSiembra: fechaSiembra ? new Date(fechaSiembra).toISOString() : undefined,
          destinoProduccion: destinoProduccion || undefined,
          codigoDepartamento,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ? JSON.stringify(data.error) : data.message ?? `HTTP ${res.status}`);
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
        Nuevo lote
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">Nuevo lote</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
          <div>
            <label className="label">Predio</label>
            <select className="input" value={predioId} onChange={(e) => setPredioId(e.target.value)}>
              <option value="">— Seleccionar predio —</option>
              {predios.map((p) => (
                <option key={p.id} value={p.id}>{p.nombrePredio}</option>
              ))}
            </select>
            {predios.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">No hay predios registrados — crea uno primero en /predios.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Especie</label>
              <input className="input" value={especie} onChange={(e) => setEspecie(e.target.value)} placeholder="Coffea arabica" />
            </div>
            <div>
              <label className="label">Variedad</label>
              <input className="input" value={variedad} onChange={(e) => setVariedad(e.target.value)} placeholder="Castillo" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Área (ha)</label>
              <input className="input" type="number" step="any" value={areaHa} onChange={(e) => setAreaHa(e.target.value)} />
            </div>
            <div>
              <label className="label">Fecha de siembra (opcional)</label>
              <input className="input" type="date" value={fechaSiembra} onChange={(e) => setFechaSiembra(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Destino de producción</label>
            <select className="input" value={destinoProduccion} onChange={(e) => setDestinoProduccion(e.target.value)}>
              {DESTINOS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Código DANE del departamento</label>
            <input
              className="input font-mono"
              value={codigoDepartamento}
              onChange={(e) => setCodigoDepartamento(e.target.value)}
              placeholder="05"
              maxLength={2}
            />
            <p className="text-xs text-gray-400 mt-1">2 dígitos — se usa para generar el código del lote (ej. 05 = Antioquia).</p>
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
              {loading ? "Creando…" : "Crear lote"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
