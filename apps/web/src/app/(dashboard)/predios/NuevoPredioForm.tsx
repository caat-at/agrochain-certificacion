"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getApiUrl } from "@/lib/client";

function getToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)ac_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

interface AgricultorOpcion {
  id: string;
  nombres: string;
  apellidos: string;
}

const FUENTES_AGUA = [
  { value: "", label: "— Sin especificar —" },
  { value: "ACUEDUCTO", label: "Acueducto" },
  { value: "RIO", label: "Río" },
  { value: "POZO", label: "Pozo" },
  { value: "LLUVIA", label: "Lluvia" },
  { value: "MIXTA", label: "Mixta" },
];

export function NuevoPredioForm({ rol, userId }: { rol: string; userId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agricultores, setAgricultores] = useState<AgricultorOpcion[]>([]);

  const [agricultorId, setAgricultorId] = useState(rol === "AGRICULTOR" ? userId : "");
  const [nombrePredio, setNombrePredio] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [vereda, setVereda] = useState("");
  const [latitud, setLatitud] = useState("");
  const [longitud, setLongitud] = useState("");
  const [altitudMsnm, setAltitudMsnm] = useState("");
  const [areaTotalHa, setAreaTotalHa] = useState("");
  const [areaProductivaHa, setAreaProductivaHa] = useState("");
  const [fuenteAgua, setFuenteAgua] = useState("");

  const router = useRouter();

  useEffect(() => {
    if (rol !== "ADMIN" || !abierto) return;
    fetch(`${getApiUrl()}/api/usuarios?rol=AGRICULTOR`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((data) => setAgricultores(data.usuarios ?? []))
      .catch(() => setAgricultores([]));
  }, [rol, abierto]);

  function handleClose() {
    setAbierto(false);
    setError(null);
    setAgricultorId(rol === "AGRICULTOR" ? userId : "");
    setNombrePredio("");
    setDepartamento("");
    setMunicipio("");
    setVereda("");
    setLatitud("");
    setLongitud("");
    setAltitudMsnm("");
    setAreaTotalHa("");
    setAreaProductivaHa("");
    setFuenteAgua("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agricultorId) { setError("Selecciona el propietario del predio."); return; }
    if (!nombrePredio.trim()) { setError("El nombre del predio es obligatorio."); return; }
    if (!departamento.trim() || !municipio.trim()) { setError("Departamento y municipio son obligatorios."); return; }
    const lat = Number(latitud);
    const lon = Number(longitud);
    const area = Number(areaTotalHa);
    if (!latitud || Number.isNaN(lat) || lat < -90 || lat > 90) { setError("Latitud inválida."); return; }
    if (!longitud || Number.isNaN(lon) || lon < -180 || lon > 180) { setError("Longitud inválida."); return; }
    if (!areaTotalHa || Number.isNaN(area) || area <= 0) { setError("El área total debe ser un número mayor a 0."); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/predios`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          agricultorId,
          nombrePredio: nombrePredio.trim(),
          departamento: departamento.trim(),
          municipio: municipio.trim(),
          vereda: vereda.trim() || undefined,
          latitud: lat,
          longitud: lon,
          altitudMsnm: altitudMsnm ? Number(altitudMsnm) : undefined,
          areaTotalHa: area,
          areaProductivaHa: areaProductivaHa ? Number(areaProductivaHa) : undefined,
          fuenteAgua: fuenteAgua || undefined,
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
        Nuevo predio
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">Nuevo predio</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
          {rol === "ADMIN" && (
            <div>
              <label className="label">Propietario</label>
              <select className="input" value={agricultorId} onChange={(e) => setAgricultorId(e.target.value)}>
                <option value="">— Seleccionar agricultor —</option>
                {agricultores.map((a) => (
                  <option key={a.id} value={a.id}>{a.nombres} {a.apellidos}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label">Nombre del predio</label>
            <input className="input" value={nombrePredio} onChange={(e) => setNombrePredio(e.target.value)} placeholder="Finca El Paraíso" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Departamento</label>
              <input className="input" value={departamento} onChange={(e) => setDepartamento(e.target.value)} placeholder="Antioquia" />
            </div>
            <div>
              <label className="label">Municipio</label>
              <input className="input" value={municipio} onChange={(e) => setMunicipio(e.target.value)} placeholder="Sonsón" />
            </div>
          </div>

          <div>
            <label className="label">Vereda (opcional)</label>
            <input className="input" value={vereda} onChange={(e) => setVereda(e.target.value)} />
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Área total (ha)</label>
              <input className="input" type="number" step="any" value={areaTotalHa} onChange={(e) => setAreaTotalHa(e.target.value)} />
            </div>
            <div>
              <label className="label">Área productiva (ha, opcional)</label>
              <input className="input" type="number" step="any" value={areaProductivaHa} onChange={(e) => setAreaProductivaHa(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Fuente de agua</label>
            <select className="input" value={fuenteAgua} onChange={(e) => setFuenteAgua(e.target.value)}>
              {FUENTES_AGUA.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
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
              {loading ? "Creando…" : "Crear predio"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
