"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const ORIGENES_MATERIAL = [
  { value: "", label: "— Seleccionar —" },
  { value: "SEMILLA", label: "Semilla" },
  { value: "INJERTO", label: "Injerto" },
  { value: "ESQUEJE", label: "Esqueje" },
  { value: "ACODO", label: "Acodo" },
  { value: "MERISTEMO", label: "Meristemo (in vitro)" },
];

interface Props {
  planta: {
    id: string;
    codigoPlanta: string;
    especie: string | null;
    variedad: string | null;
    origenMaterial: string | null;
    procedenciaVivero: string | null;
    fechaSiembra: string | null;
    alturaCmInicial: number | null;
    diametroTalloCmInicial: number | null;
    numHojasInicial: number | null;
    estadoFenologicoInicial: string | null;
    activo: boolean;
  };
}

export function EditarPlantaBtn({ planta }: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const [especie, setEspecie]                     = useState(planta.especie ?? "");
  const [variedad, setVariedad]                   = useState(planta.variedad ?? "");
  const [origenMaterial, setOrigenMaterial]       = useState(planta.origenMaterial ?? "");
  const [procedenciaVivero, setProcedenciaVivero] = useState(planta.procedenciaVivero ?? "");
  const [fechaSiembra, setFechaSiembra]           = useState(planta.fechaSiembra?.slice(0, 10) ?? "");
  const [alturaCmInicial, setAlturaCmInicial]     = useState(planta.alturaCmInicial != null ? String(planta.alturaCmInicial) : "");
  const [diametroTalloCmInicial, setDiametroTalloCmInicial] = useState(planta.diametroTalloCmInicial != null ? String(planta.diametroTalloCmInicial) : "");
  const [numHojasInicial, setNumHojasInicial]     = useState(planta.numHojasInicial != null ? String(planta.numHojasInicial) : "");
  const [estadoFenologicoInicial, setEstadoFenologicoInicial] = useState(planta.estadoFenologicoInicial ?? "");
  const [activo, setActivo]                       = useState(planta.activo);

  function handleClose() {
    setAbierto(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/plantas/${planta.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          especie: especie.trim() || null,
          variedad: variedad.trim() || null,
          origenMaterial: origenMaterial || null,
          procedenciaVivero: procedenciaVivero.trim() || null,
          fechaSiembra: fechaSiembra ? new Date(fechaSiembra).toISOString() : null,
          alturaCmInicial: alturaCmInicial ? Number(alturaCmInicial) : null,
          diametroTalloCmInicial: diametroTalloCmInicial ? Number(diametroTalloCmInicial) : null,
          numHojasInicial: numHojasInicial ? Number(numHojasInicial) : null,
          estadoFenologicoInicial: estadoFenologicoInicial.trim() || null,
          activo,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? JSON.stringify(data.errors) ?? `HTTP ${res.status}`);
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
        title="Editar planta"
      >
        Editar
      </button>

      {abierto && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">Editar planta</h2>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">{planta.codigoPlanta}</p>
              </div>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
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
                  <label className="label">Origen del material</label>
                  <select className="input" value={origenMaterial} onChange={(e) => setOrigenMaterial(e.target.value)}>
                    {ORIGENES_MATERIAL.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Procedencia / vivero</label>
                  <input className="input" value={procedenciaVivero} onChange={(e) => setProcedenciaVivero(e.target.value)} placeholder="Vivero El Aguacatal" />
                </div>
              </div>

              <div>
                <label className="label">Fecha de siembra</label>
                <input className="input" type="date" value={fechaSiembra} onChange={(e) => setFechaSiembra(e.target.value)} />
              </div>

              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">Datos iniciales — NTC 5400 §4.3</p>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Altura (cm)</label>
                  <input className="input" type="number" step="any" value={alturaCmInicial} onChange={(e) => setAlturaCmInicial(e.target.value)} />
                </div>
                <div>
                  <label className="label">Diám. tallo (cm)</label>
                  <input className="input" type="number" step="any" value={diametroTalloCmInicial} onChange={(e) => setDiametroTalloCmInicial(e.target.value)} />
                </div>
                <div>
                  <label className="label">N° hojas</label>
                  <input className="input" type="number" value={numHojasInicial} onChange={(e) => setNumHojasInicial(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="label">Estado fenológico inicial</label>
                <input className="input" value={estadoFenologicoInicial} onChange={(e) => setEstadoFenologicoInicial(e.target.value)} placeholder="Ej: Trasplante, vegetativo..." />
              </div>

              <div className="flex items-center gap-2">
                <input id="activo" type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
                <label htmlFor="activo" className="text-sm text-gray-700">Planta activa (viva en campo)</label>
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
