"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchPaises, fetchDepartamentos, fetchMunicipios, type PaisOpcion, type DepartamentoOpcion, type MunicipioOpcion } from "@/lib/ubicacion";

interface AgricultorOpcion {
  id: string;
  nombres: string;
  apellidos: string;
}

interface PropietarioOpcion {
  id: string;
  nombres: string;
  apellidos: string;
  numeroDocumento: string;
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
  const [propietarios, setPropietarios] = useState<PropietarioOpcion[]>([]);
  const [paises, setPaises] = useState<PaisOpcion[]>([]);
  const [departamentos, setDepartamentos] = useState<DepartamentoOpcion[]>([]);
  const [municipios, setMunicipios] = useState<MunicipioOpcion[]>([]);
  const [cargandoDepartamentos, setCargandoDepartamentos] = useState(false);
  const [cargandoMunicipios, setCargandoMunicipios] = useState(false);

  const [propietarioId, setPropietarioId] = useState("");
  const [agricultorId, setAgricultorId] = useState(rol === "AGRICULTOR" ? userId : "");
  const [nombrePredio, setNombrePredio] = useState("");
  const [codigoIca, setCodigoIca] = useState("");
  const [paisCod, setPaisCod] = useState("COL");
  const [departamentoCod, setDepartamentoCod] = useState("");
  const [municipioCod, setMunicipioCod] = useState("");
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
    fetch(`/api/usuarios?rol=AGRICULTOR`)
      .then((r) => r.json())
      .then((data) => setAgricultores(data.usuarios ?? []))
      .catch(() => setAgricultores([]));

    fetch(`/api/propietarios`)
      .then((r) => r.json())
      .then((data) => setPropietarios(data.propietarios ?? []))
      .catch(() => setPropietarios([]));
  }, [rol, abierto]);

  useEffect(() => {
    if (!abierto || paises.length > 0) return;
    fetchPaises().then(setPaises);
  }, [abierto, paises.length]);

  useEffect(() => {
    if (!paisCod) { setDepartamentos([]); return; }
    setCargandoDepartamentos(true);
    fetchDepartamentos(paisCod)
      .then(setDepartamentos)
      .finally(() => setCargandoDepartamentos(false));
  }, [paisCod]);

  useEffect(() => {
    if (!departamentoCod) { setMunicipios([]); return; }
    setCargandoMunicipios(true);
    fetchMunicipios(departamentoCod)
      .then(setMunicipios)
      .finally(() => setCargandoMunicipios(false));
  }, [departamentoCod]);

  function handleClose() {
    setAbierto(false);
    setError(null);
    setPropietarioId("");
    setAgricultorId(rol === "AGRICULTOR" ? userId : "");
    setNombrePredio("");
    setCodigoIca("");
    setPaisCod("COL");
    setDepartamentoCod("");
    setMunicipioCod("");
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
    if (!propietarioId) { setError("Selecciona el propietario del predio."); return; }
    if (!nombrePredio.trim()) { setError("El nombre del predio es obligatorio."); return; }
    if (!departamentoCod || !municipioCod) { setError("Departamento y municipio son obligatorios."); return; }
    const lat = Number(latitud);
    const lon = Number(longitud);
    const area = Number(areaTotalHa);
    if (!latitud || Number.isNaN(lat) || lat < -90 || lat > 90) { setError("Latitud inválida."); return; }
    if (!longitud || Number.isNaN(lon) || lon < -180 || lon > 180) { setError("Longitud inválida."); return; }
    if (!areaTotalHa || Number.isNaN(area) || area <= 0) { setError("El área total debe ser un número mayor a 0."); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/predios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propietarioId,
          agricultorId: agricultorId || undefined,
          nombrePredio: nombrePredio.trim(),
          codigoIca: codigoIca.trim() || undefined,
          departamentoCod,
          municipioCod,
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
          <div>
            <label className="label">Propietario</label>
            <select className="input" value={propietarioId} onChange={(e) => setPropietarioId(e.target.value)}>
              <option value="">— Seleccionar propietario —</option>
              {propietarios.map((p) => (
                <option key={p.id} value={p.id}>{p.nombres} {p.apellidos} — {p.numeroDocumento}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Dueño legal del predio. Si no existe, créalo primero en{" "}
              <a href="/propietarios" className="text-verde-600 hover:underline">Propietarios</a>.
            </p>
          </div>

          {rol === "ADMIN" && (
            <div>
              <label className="label">Usuario operador (opcional)</label>
              <select className="input" value={agricultorId} onChange={(e) => setAgricultorId(e.target.value)}>
                <option value="">— Sin usuario asignado —</option>
                {agricultores.map((a) => (
                  <option key={a.id} value={a.id}>{a.nombres} {a.apellidos}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Usuario AGRICULTOR que podrá loguearse y ver este predio en el sistema (opcional).
              </p>
            </div>
          )}

          <div>
            <label className="label">Nombre del predio</label>
            <input className="input" value={nombrePredio} onChange={(e) => setNombrePredio(e.target.value)} placeholder="Finca El Paraíso" />
          </div>

          <div>
            <label className="label">Código de predio</label>
            <input className="input bg-gray-50 text-gray-400 font-mono" value="Se asigna automáticamente al guardar" disabled />
          </div>

          <div>
            <label className="label">Código ICA (opcional)</label>
            <input
              className="input font-mono"
              value={codigoIca}
              onChange={(e) => setCodigoIca(e.target.value)}
              placeholder="Ej: RTS0012345 — número oficial asignado por el ICA, si ya lo tienes"
            />
            <p className="text-xs text-gray-400 mt-1">
              Independiente del código de predio. Llénalo solo si tu finca ya tiene un registro ICA real.
            </p>
          </div>

          <div>
            <label className="label">País</label>
            <select
              className="input"
              value={paisCod}
              onChange={(e) => { setPaisCod(e.target.value); setDepartamentoCod(""); setMunicipioCod(""); }}
            >
              <option value="">— Seleccionar —</option>
              {paises.map((p) => (
                <option key={p.codigo} value={p.codigo}>{p.nombre}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Departamento</label>
              <select
                className="input"
                value={departamentoCod}
                onChange={(e) => { setDepartamentoCod(e.target.value); setMunicipioCod(""); }}
                disabled={!paisCod || cargandoDepartamentos}
              >
                <option value="">
                  {!paisCod ? "— Elige un país primero —" : cargandoDepartamentos ? "Cargando…" : "— Seleccionar —"}
                </option>
                {departamentos.map((d) => (
                  <option key={d.codigo} value={d.codigo}>{d.nombre}</option>
                ))}
              </select>
              {paisCod && !cargandoDepartamentos && departamentos.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">Sin departamentos registrados para este país.</p>
              )}
            </div>
            <div>
              <label className="label">Municipio</label>
              <select
                className="input"
                value={municipioCod}
                onChange={(e) => setMunicipioCod(e.target.value)}
                disabled={!departamentoCod || cargandoMunicipios}
              >
                <option value="">
                  {!departamentoCod ? "— Elige un departamento primero —" : cargandoMunicipios ? "Cargando…" : "— Seleccionar —"}
                </option>
                {municipios.map((m) => (
                  <option key={m.codigo} value={m.codigo}>{m.nombre}</option>
                ))}
              </select>
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
