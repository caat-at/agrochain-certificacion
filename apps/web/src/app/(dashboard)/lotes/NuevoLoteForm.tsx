"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchEspecies, type EspecieOpcion } from "@/lib/catalogoEspecies";

interface PredioOpcion {
  id: string;
  nombrePredio: string;
  agricultorId: string;
  departamentoCod: string | null;
  departamentoNombre: string | null;
}

interface ParcelaOpcion {
  id: string;
  codigoParcela: string;
  nombre: string | null;
  areaHa: number;
}

interface PlantaDisponible {
  id: string;
  codigoPlanta: string;
  numeroPlanta: string;
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
  const [parcelas, setParcelas] = useState<ParcelaOpcion[]>([]);
  const [cargandoParcelas, setCargandoParcelas] = useState(false);
  const [especies, setEspecies] = useState<EspecieOpcion[]>([]);
  const [plantasDisponibles, setPlantasDisponibles] = useState<PlantaDisponible[]>([]);
  const [plantasSeleccionadas, setPlantasSeleccionadas] = useState<Set<string>>(new Set());
  const [cargandoPlantas, setCargandoPlantas] = useState(false);

  const [predioId, setPredioId] = useState("");
  const [parcelaId, setParcelaId] = useState("");
  const [especie, setEspecie] = useState("");
  const [variedad, setVariedad] = useState("");
  const [areaHa, setAreaHa] = useState("");
  const [fechaSiembra, setFechaSiembra] = useState("");
  const [destinoProduccion, setDestinoProduccion] = useState("");
  const [codigoDepartamento, setCodigoDepartamento] = useState("");
  const [departamentoNombre, setDepartamentoNombre] = useState("");

  const router = useRouter();

  useEffect(() => {
    if (!abierto) return;
    fetch(`/api/predios`)
      .then((r) => r.json())
      .then((data) => setPredios(data.predios ?? []))
      .catch(() => setPredios([]));
    fetchEspecies().then(setEspecies).catch(() => setEspecies([]));
  }, [abierto]);

  useEffect(() => {
    if (!predioId) { setParcelas([]); return; }
    setCargandoParcelas(true);
    fetch(`/api/parcelas?predioId=${predioId}`)
      .then((r) => r.json())
      .then((data) => setParcelas(data.parcelas ?? []))
      .catch(() => setParcelas([]))
      .finally(() => setCargandoParcelas(false));
  }, [predioId]);

  // Especie perenne (cafe, cacao, ...) + parcela elegida -> ofrecer reusar
  // plantas ya sembradas en esa parcela en vez de crear plantas nuevas.
  const especieElegida = especies.find((e) => e.nombreCientifico === especie);
  const esPerenne = especieElegida?.tipoCiclo === "PERENNE";

  useEffect(() => {
    setPlantasSeleccionadas(new Set());
    if (!parcelaId || !especie || !esPerenne) { setPlantasDisponibles([]); return; }
    setCargandoPlantas(true);
    fetch(`/api/parcelas/${parcelaId}/plantas-disponibles?especie=${encodeURIComponent(especie)}`)
      .then((r) => r.json())
      .then((data) => setPlantasDisponibles(data.plantas ?? []))
      .catch(() => setPlantasDisponibles([]))
      .finally(() => setCargandoPlantas(false));
  }, [parcelaId, especie, esPerenne]);

  function togglePlanta(id: string) {
    setPlantasSeleccionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleClose() {
    setAbierto(false);
    setError(null);
    setPredioId("");
    setParcelaId("");
    setEspecie("");
    setVariedad("");
    setAreaHa("");
    setFechaSiembra("");
    setDestinoProduccion("");
    setCodigoDepartamento("");
    setDepartamentoNombre("");
    setPlantasDisponibles([]);
    setPlantasSeleccionadas(new Set());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const predio = predios.find((p) => p.id === predioId);
    if (!predio) { setError("Selecciona el predio donde se ubica el lote."); return; }
    if (!parcelaId) { setError("Selecciona la parcela donde se sembró este lote."); return; }
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
      const res = await fetch(`/api/lotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parcelaId,
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

      if (plantasSeleccionadas.size > 0) {
        const loteId = data.data.id;
        await fetch(`/api/lotes/${loteId}/plantas/vincular`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plantaIds: [...plantasSeleccionadas] }),
        });
      }

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
            <select
              className="input"
              value={predioId}
              onChange={(e) => {
                const id = e.target.value;
                setPredioId(id);
                setParcelaId("");
                const predio = predios.find((p) => p.id === id);
                setCodigoDepartamento(predio?.departamentoCod ?? "");
                setDepartamentoNombre(predio?.departamentoNombre ?? "");
              }}
            >
              <option value="">— Seleccionar predio —</option>
              {predios.map((p) => (
                <option key={p.id} value={p.id}>{p.nombrePredio}</option>
              ))}
            </select>
            {predios.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">No hay predios registrados — crea uno primero en /predios.</p>
            )}
          </div>

          <div>
            <label className="label">Parcela</label>
            <select
              className="input"
              value={parcelaId}
              onChange={(e) => setParcelaId(e.target.value)}
              disabled={!predioId || cargandoParcelas}
            >
              <option value="">
                {!predioId ? "— Elige un predio primero —" : cargandoParcelas ? "Cargando…" : "— Seleccionar parcela —"}
              </option>
              {parcelas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.codigoParcela}{p.nombre ? ` — ${p.nombre}` : ""} ({p.areaHa} ha)
                </option>
              ))}
            </select>
            {predioId && !cargandoParcelas && parcelas.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">
                Este predio no tiene parcelas — créala primero en{" "}
                <a href="/parcelas" className="text-verde-600 hover:underline">Parcelas</a>.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Especie</label>
              <select className="input" value={especie} onChange={(e) => setEspecie(e.target.value)}>
                <option value="">— Seleccionar especie —</option>
                {especies.map((e) => (
                  <option key={e.id} value={e.nombreCientifico}>{e.nombreComun} ({e.nombreCientifico})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Variedad</label>
              <input className="input" value={variedad} onChange={(e) => setVariedad(e.target.value)} placeholder="Castillo" />
            </div>
          </div>

          {esPerenne && parcelaId && (
            <div className="rounded-lg border border-verde-200 bg-verde-50/40 p-4 space-y-2.5">
              <p className="text-xs font-semibold text-verde-800">
                Especie perenne — puedes reusar plantas ya sembradas en esta parcela
              </p>
              {cargandoPlantas ? (
                <p className="text-xs text-gray-400">Buscando plantas disponibles…</p>
              ) : plantasDisponibles.length === 0 ? (
                <p className="text-xs text-gray-400">No hay plantas disponibles de esta especie en la parcela — se creará el lote sin vincular ninguna.</p>
              ) : (
                <>
                  <p className="text-xs text-gray-500">
                    Se encontraron {plantasDisponibles.length} planta(s) de esta especie en la parcela. Selecciona cuáles vincular a este lote:
                  </p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {plantasDisponibles.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-xs text-gray-700">
                        <input
                          type="checkbox"
                          checked={plantasSeleccionadas.has(p.id)}
                          onChange={() => togglePlanta(p.id)}
                        />
                        <span className="font-mono">{p.codigoPlanta}</span> — planta N° {p.numeroPlanta}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

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
            <label className="label">Departamento (código DANE)</label>
            <input
              className="input bg-gray-50 text-gray-400 font-mono"
              value={codigoDepartamento ? `${codigoDepartamento} — ${departamentoNombre}` : ""}
              placeholder="Se completa al elegir el predio"
              disabled
            />
            <p className="text-xs text-gray-400 mt-1">Se toma del predio seleccionado y se usa para generar el código del lote.</p>
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
