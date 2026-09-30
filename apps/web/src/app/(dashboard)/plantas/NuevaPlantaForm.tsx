"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ParcelaOpcion {
  id: string;
  codigoParcela: string;
  nombre: string | null;
}

const ORIGENES_MATERIAL = [
  { value: "", label: "— Seleccionar —" },
  { value: "SEMILLA", label: "Semilla" },
  { value: "INJERTO", label: "Injerto" },
  { value: "ESQUEJE", label: "Esqueje" },
  { value: "ACODO", label: "Acodo" },
  { value: "MERISTEMO", label: "Meristemo (in vitro)" },
];

export function NuevaPlantaForm() {
  const [abierto, setAbierto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [parcelas, setParcelas] = useState<ParcelaOpcion[]>([]);

  const [parcelaId, setParcelaId]                 = useState("");
  const [codigoPlanta, setCodigoPlanta]           = useState("");
  const [numeroPlanta, setNumeroPlanta]           = useState("");
  const [latitud, setLatitud]                     = useState("");
  const [longitud, setLongitud]                   = useState("");
  const [altitudMsnm, setAltitudMsnm]             = useState("");
  const [especie, setEspecie]                     = useState("");
  const [variedad, setVariedad]                   = useState("");
  const [origenMaterial, setOrigenMaterial]       = useState("");
  const [procedenciaVivero, setProcedenciaVivero] = useState("");
  const [fechaSiembra, setFechaSiembra]           = useState("");
  const [alturaCmInicial, setAlturaCmInicial]     = useState("");
  const [diametroTalloCmInicial, setDiametroTalloCmInicial] = useState("");
  const [numHojasInicial, setNumHojasInicial]     = useState("");
  const [estadoFenologicoInicial, setEstadoFenologicoInicial] = useState("");

  const router = useRouter();

  useEffect(() => {
    if (!abierto || parcelas.length > 0) return;
    fetch(`/api/parcelas`)
      .then((r) => r.json())
      .then((data) => setParcelas(data.parcelas ?? []))
      .catch(() => setParcelas([]));
  }, [abierto, parcelas.length]);

  function handleClose() {
    setAbierto(false);
    setError(null);
    setParcelaId("");
    setCodigoPlanta("");
    setNumeroPlanta("");
    setLatitud("");
    setLongitud("");
    setAltitudMsnm("");
    setEspecie("");
    setVariedad("");
    setOrigenMaterial("");
    setProcedenciaVivero("");
    setFechaSiembra("");
    setAlturaCmInicial("");
    setDiametroTalloCmInicial("");
    setNumHojasInicial("");
    setEstadoFenologicoInicial("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!parcelaId) { setError("Selecciona la parcela donde está sembrada esta planta."); return; }
    if (!codigoPlanta.trim()) { setError("El código de planta es obligatorio."); return; }
    if (!numeroPlanta.trim()) { setError("El número de planta es obligatorio."); return; }
    const lat = Number(latitud);
    const lon = Number(longitud);
    if (!latitud || Number.isNaN(lat) || lat < -90 || lat > 90) { setError("Latitud inválida."); return; }
    if (!longitud || Number.isNaN(lon) || lon < -180 || lon > 180) { setError("Longitud inválida."); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/plantas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parcelaId,
          codigoPlanta: codigoPlanta.trim().toUpperCase(),
          numeroPlanta: numeroPlanta.trim(),
          latitud: lat,
          longitud: lon,
          altitudMsnm: altitudMsnm ? Number(altitudMsnm) : undefined,
          especie: especie.trim() || undefined,
          variedad: variedad.trim() || undefined,
          origenMaterial: origenMaterial || undefined,
          procedenciaVivero: procedenciaVivero.trim() || undefined,
          fechaSiembra: fechaSiembra ? new Date(fechaSiembra).toISOString() : undefined,
          alturaCmInicial: alturaCmInicial ? Number(alturaCmInicial) : undefined,
          diametroTalloCmInicial: diametroTalloCmInicial ? Number(diametroTalloCmInicial) : undefined,
          numHojasInicial: numHojasInicial ? Number(numHojasInicial) : undefined,
          estadoFenologicoInicial: estadoFenologicoInicial.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? JSON.stringify(data.errors) ?? `HTTP ${res.status}`);
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
        Nueva planta
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">Nueva planta</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
          <div>
            <label className="label">Parcela</label>
            <select className="input" value={parcelaId} onChange={(e) => setParcelaId(e.target.value)}>
              <option value="">— Seleccionar parcela —</option>
              {parcelas.map((p) => (
                <option key={p.id} value={p.id}>{p.codigoParcela}{p.nombre ? ` — ${p.nombre}` : ""}</option>
              ))}
            </select>
            {parcelas.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">No hay parcelas registradas — crea una primero en /parcelas.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Código de planta</label>
              <input className="input" value={codigoPlanta} onChange={(e) => setCodigoPlanta(e.target.value)} placeholder="P001" />
            </div>
            <div>
              <label className="label">N° planta</label>
              <input className="input" value={numeroPlanta} onChange={(e) => setNumeroPlanta(e.target.value)} placeholder="1" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Especie (opcional)</label>
              <input className="input" value={especie} onChange={(e) => setEspecie(e.target.value)} placeholder="Coffea arabica" />
            </div>
            <div>
              <label className="label">Variedad (opcional)</label>
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
            <label className="label">Fecha de siembra (opcional)</label>
            <input className="input" type="date" value={fechaSiembra} onChange={(e) => setFechaSiembra(e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Latitud</label>
              <input className="input" type="number" step="any" value={latitud} onChange={(e) => setLatitud(e.target.value)} placeholder="5.70" />
            </div>
            <div>
              <label className="label">Longitud</label>
              <input className="input" type="number" step="any" value={longitud} onChange={(e) => setLongitud(e.target.value)} placeholder="-75.30" />
            </div>
            <div>
              <label className="label">Altitud (msnm)</label>
              <input className="input" type="number" step="any" value={altitudMsnm} onChange={(e) => setAltitudMsnm(e.target.value)} />
            </div>
          </div>

          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">Datos iniciales — NTC 5400 §4.3 (opcional)</p>

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
              {loading ? "Creando…" : "Crear planta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
