"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchDepartamentos, fetchMunicipios, type DepartamentoOpcion, type MunicipioOpcion } from "@/lib/ubicacion";

interface PropietarioOpcion {
  id: string;
  nombres: string;
  apellidos: string;
  numeroDocumento: string;
}

interface AgricultorOpcion {
  id: string;
  nombres: string;
  apellidos: string;
}

interface Props {
  predio: {
    id: string;
    nombrePredio: string;
    codigoPredio: string;
    codigoIca: string | null;
    matriculaInmobiliaria: string | null;
    propietarioId: string | null;
    agricultorId?: string | null;
    departamentoCod: string | null;
    municipioCod: string | null;
    vereda: string | null;
    direccion: string | null;
    latitud: number;
    longitud: number;
    altitudMsnm: number | null;
    areaTotalHa: number;
    areaProductivaHa: number | null;
    activo: boolean;
  };
}

export function EditarPredioBtn({ predio }: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [departamentos, setDepartamentos] = useState<DepartamentoOpcion[]>([]);
  const [municipios, setMunicipios]       = useState<MunicipioOpcion[]>([]);
  const [propietarios, setPropietarios]   = useState<PropietarioOpcion[]>([]);
  const [agricultores, setAgricultores]   = useState<AgricultorOpcion[]>([]);

  const [nombrePredio, setNombrePredio]           = useState(predio.nombrePredio);
  const [propietarioId, setPropietarioId]         = useState(predio.propietarioId ?? "");
  const [agricultorId, setAgricultorId]           = useState(predio.agricultorId ?? "");
  const [codigoIca, setCodigoIca]                 = useState(predio.codigoIca ?? "");
  const [departamentoCod, setDepartamentoCod]     = useState(predio.departamentoCod ?? "");
  const [municipioCod, setMunicipioCod]           = useState(predio.municipioCod ?? "");
  const [vereda, setVereda]                       = useState(predio.vereda ?? "");
  const [direccion, setDireccion]                 = useState(predio.direccion ?? "");
  const [latitud, setLatitud]                     = useState(String(predio.latitud));
  const [longitud, setLongitud]                   = useState(String(predio.longitud));
  const [altitudMsnm, setAltitudMsnm]             = useState(predio.altitudMsnm != null ? String(predio.altitudMsnm) : "");
  const [areaTotalHa, setAreaTotalHa]             = useState(String(predio.areaTotalHa));
  const [areaProductivaHa, setAreaProductivaHa]   = useState(predio.areaProductivaHa != null ? String(predio.areaProductivaHa) : "");
  const [activo, setActivo]                       = useState(predio.activo);

  useEffect(() => {
    if (!abierto || departamentos.length > 0) return;
    fetchDepartamentos("COL").then(setDepartamentos);
  }, [abierto, departamentos.length]);

  useEffect(() => {
    if (!abierto || propietarios.length > 0) return;
    fetch(`/api/propietarios`)
      .then((r) => r.json())
      .then((data) => setPropietarios(data.propietarios ?? []))
      .catch(() => setPropietarios([]));
  }, [abierto, propietarios.length]);

  useEffect(() => {
    if (!abierto || agricultores.length > 0) return;
    fetch(`/api/usuarios?rol=AGRICULTOR`)
      .then((r) => r.json())
      .then((data) => setAgricultores(data.usuarios ?? []))
      .catch(() => setAgricultores([]));
  }, [abierto, agricultores.length]);

  useEffect(() => {
    if (!departamentoCod) { setMunicipios([]); return; }
    fetchMunicipios(departamentoCod).then(setMunicipios);
  }, [departamentoCod]);

  function handleClose() {
    setAbierto(false);
    setError(null);
    setNombrePredio(predio.nombrePredio);
    setPropietarioId(predio.propietarioId ?? "");
    setAgricultorId(predio.agricultorId ?? "");
    setCodigoIca(predio.codigoIca ?? "");
    setDepartamentoCod(predio.departamentoCod ?? "");
    setMunicipioCod(predio.municipioCod ?? "");
    setVereda(predio.vereda ?? "");
    setDireccion(predio.direccion ?? "");
    setLatitud(String(predio.latitud));
    setLongitud(String(predio.longitud));
    setAltitudMsnm(predio.altitudMsnm != null ? String(predio.altitudMsnm) : "");
    setAreaTotalHa(String(predio.areaTotalHa));
    setAreaProductivaHa(predio.areaProductivaHa != null ? String(predio.areaProductivaHa) : "");
    setActivo(predio.activo);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombrePredio.trim()) { setError("El nombre del predio es obligatorio."); return; }
    if (!propietarioId) { setError("Selecciona el propietario del predio."); return; }
    const lat = Number(latitud);
    const lon = Number(longitud);
    const area = Number(areaTotalHa);
    if (Number.isNaN(lat) || lat < -90 || lat > 90) { setError("Latitud inválida."); return; }
    if (Number.isNaN(lon) || lon < -180 || lon > 180) { setError("Longitud inválida."); return; }
    if (Number.isNaN(area) || area <= 0) { setError("El área total debe ser un número mayor a 0."); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/predios/${predio.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombrePredio: nombrePredio.trim(),
          propietarioId,
          agricultorId: agricultorId || null,
          codigoIca: codigoIca.trim() || null,
          departamentoCod: departamentoCod || undefined,
          municipioCod: municipioCod || undefined,
          vereda: vereda.trim() || null,
          direccion: direccion.trim() || null,
          latitud: lat,
          longitud: lon,
          altitudMsnm: altitudMsnm ? Number(altitudMsnm) : null,
          areaTotalHa: area,
          areaProductivaHa: areaProductivaHa ? Number(areaProductivaHa) : null,
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
        title="Editar predio"
      >
        Editar
      </button>

      {abierto && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900 text-lg">Editar predio</h2>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
              <div>
                <label className="label">Nombre del predio</label>
                <input className="input" value={nombrePredio} onChange={(e) => setNombrePredio(e.target.value)} />
              </div>

              <div>
                <label className="label">Propietario</label>
                <select className="input" value={propietarioId} onChange={(e) => setPropietarioId(e.target.value)}>
                  <option value="">— Seleccionar propietario —</option>
                  {propietarios.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombres} {p.apellidos} — {p.numeroDocumento}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Operador (opcional)</label>
                <select className="input" value={agricultorId} onChange={(e) => setAgricultorId(e.target.value)}>
                  <option value="">— Sin operador asignado —</option>
                  {agricultores.map((a) => (
                    <option key={a.id} value={a.id}>{a.nombres} {a.apellidos}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Usuario con rol AGRICULTOR que opera este predio en el sistema (distinto del propietario legal).</p>
              </div>

              <div>
                <label className="label">Código de predio</label>
                <input className="input bg-gray-50 text-gray-400 font-mono" value={predio.codigoPredio} disabled />
              </div>

              <div>
                <label className="label">Código ICA (opcional)</label>
                <input
                  className="input font-mono"
                  value={codigoIca}
                  onChange={(e) => setCodigoIca(e.target.value)}
                  placeholder="Ej: RTS0012345 — número oficial asignado por el ICA"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Departamento</label>
                  <select
                    className="input"
                    value={departamentoCod}
                    onChange={(e) => { setDepartamentoCod(e.target.value); setMunicipioCod(""); }}
                  >
                    <option value="">— Seleccionar —</option>
                    {departamentos.map((d) => (
                      <option key={d.codigo} value={d.codigo}>{d.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Municipio</label>
                  <select
                    className="input"
                    value={municipioCod}
                    onChange={(e) => setMunicipioCod(e.target.value)}
                    disabled={!departamentoCod}
                  >
                    <option value="">{!departamentoCod ? "— Elige un departamento primero —" : "— Seleccionar —"}</option>
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

              <div>
                <label className="label">Dirección (opcional)</label>
                <input className="input" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Latitud</label>
                  <input className="input" type="number" step="any" value={latitud} onChange={(e) => setLatitud(e.target.value)} />
                </div>
                <div>
                  <label className="label">Longitud</label>
                  <input className="input" type="number" step="any" value={longitud} onChange={(e) => setLongitud(e.target.value)} />
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
                <label className="label">Estado</label>
                <select
                  className="input"
                  value={activo ? "activo" : "inactivo"}
                  onChange={(e) => setActivo(e.target.value === "activo")}
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
