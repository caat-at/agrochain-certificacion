"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface LoteDetalle {
  id: string;
  codigoLote: string;
  especie: string;
  variedad: string | null;
  areaHa: number | null;
  fechaSiembra: string | null;
  destinoProduccion: string | null;
  sistemaRiego: string | null;
  dataHash: string | null;
  txRegistro: string | null;
  predio: { nombrePredio: string; municipio?: string; departamento?: string } | null;
  agricultor: { nombres: string; apellidos: string } | null;
  plantas: Array<{ id: string; variedad: string | null; activo: boolean }>;
  eventos: Array<{
    id: string;
    tipoEvento: string;
    fechaEvento: string;
    descripcion: string | null;
    contentHash: string | null;
    txHash: string | null;
  }>;
  campanas: Array<{
    id: string;
    nombre: string;
    campanaHash: string | null;
    txHash: string | null;
    fechaCierre: string | null;
  }>;
}

interface Props {
  loteId:        string;
  loteCode:      string;
  token:         string;
  inspeccionId?: string;
}

const TIPO_EVENTO_LABEL: Record<string, string> = {
  SIEMBRA:          "Siembra",
  RIEGO:            "Riego",
  FERTILIZACION:    "Fertilización",
  CONTROL_PLAGAS:   "Control plagas",
  COSECHA:          "Cosecha",
  FUMIGACION:       "Fumigación",
  PODA:             "Poda",
  MONITOREO:        "Monitoreo",
};

export default function CompletarInspeccionBtn({ loteId, loteCode, token, inspeccionId }: Props) {
  const router = useRouter();
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [loadingLote, setLoadingLote] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [lote, setLote]         = useState<LoteDetalle | null>(null);
  const [paso, setPaso]         = useState<"contexto" | "formulario">("contexto");

  const [resultado, setResultado]                 = useState("APROBADO");
  const [puntaje, setPuntaje]                     = useState("");
  const [hallazgosCriticos, setHallazgosCriticos] = useState("0");
  const [hallazgosMayores, setHallazgosMayores]   = useState("0");
  const [hallazgosMenores, setHallazgosMenores]   = useState("0");
  const [observaciones, setObservaciones]         = useState("");
  const [planMejora, setPlanMejora]               = useState("");

  async function handleOpen() {
    setOpen(true);
    setPaso("contexto");
    setError(null);
    setLote(null);
    setLoadingLote(true);
    try {
      const res = await fetch(`/api/lotes/${loteId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Error cargando lote");
      setLote(data.data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoadingLote(false);
    }
  }

  function handleClose() {
    setOpen(false);
    setError(null);
    setLote(null);
    setPaso("contexto");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
      let idACompletar = inspeccionId;

      if (!idACompletar) {
        const crearRes = await fetch(`${apiUrl}/api/inspecciones`, {
          method:  "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            loteId,
            inspectorId:    (JSON.parse(atob(token.split(".")[1]))).sub,
            organizacionId: "org_certificadora_demo",
            tipoInspeccion: "BPA_CERTIFICACION",
            fechaSolicitud: new Date().toISOString(),
          }),
        });
        if (!crearRes.ok) {
          const err = await crearRes.json() as { message?: string };
          throw new Error(err.message ?? "Error creando inspección");
        }
        const { data: inspeccionCreada } = await crearRes.json() as { data: { id: string } };
        idACompletar = inspeccionCreada.id;
      }

      const completarRes = await fetch(`${apiUrl}/api/inspecciones/${idACompletar}/completar`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          resultado,
          puntaje:           puntaje ? Number(puntaje) : undefined,
          hallazgosCriticos: Number(hallazgosCriticos),
          hallazgosMayores:  Number(hallazgosMayores),
          hallazgosMenores:  Number(hallazgosMenores),
          observaciones:     observaciones || undefined,
          planMejora:        planMejora || undefined,
          fechaRealizada:    new Date().toISOString(),
        }),
      });

      if (!completarRes.ok) {
        const err = await completarRes.json() as { message?: string };
        throw new Error(err.message ?? "Error completando inspección");
      }

      handleClose();
      router.refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button onClick={handleOpen} className="btn-primary text-sm py-1.5 px-3">
        {inspeccionId ? "Completar inspección" : "Registrar resultado"}
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Inspección BPA — NTC 5400</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Lote: <span className="font-mono font-semibold text-gray-800">{loteCode}</span>
                </p>
              </div>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            <div className="overflow-y-auto flex-1">

              {/* Paso 1: Contexto del lote */}
              {paso === "contexto" && (
                <div className="p-6 space-y-5">
                  {loadingLote ? (
                    <p className="text-sm text-gray-400 text-center py-8">Cargando datos del lote...</p>
                  ) : error ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{error}</div>
                  ) : lote ? (
                    <>
                      {/* Datos del cultivo */}
                      <section>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Datos del cultivo</h3>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                          <div><span className="text-gray-500">Especie:</span> <span className="font-medium text-gray-800">{lote.especie}{lote.variedad ? ` · ${lote.variedad}` : ""}</span></div>
                          <div><span className="text-gray-500">Área:</span> <span className="font-medium text-gray-800">{lote.areaHa ? `${lote.areaHa} ha` : "—"}</span></div>
                          <div><span className="text-gray-500">Predio:</span> <span className="font-medium text-gray-800">{lote.predio?.nombrePredio ?? "—"}</span></div>
                          <div><span className="text-gray-500">Agricultor:</span> <span className="font-medium text-gray-800">{lote.agricultor ? `${lote.agricultor.nombres} ${lote.agricultor.apellidos}` : "—"}</span></div>
                          {lote.fechaSiembra && (
                            <div><span className="text-gray-500">Siembra:</span> <span className="font-medium text-gray-800">{new Date(lote.fechaSiembra).toLocaleDateString("es-CO")}</span></div>
                          )}
                          {lote.destinoProduccion && (
                            <div><span className="text-gray-500">Destino:</span> <span className="font-medium text-gray-800">{lote.destinoProduccion.replace(/_/g, " ")}</span></div>
                          )}
                          {lote.sistemaRiego && (
                            <div><span className="text-gray-500">Riego:</span> <span className="font-medium text-gray-800">{lote.sistemaRiego.replace(/_/g, " ")}</span></div>
                          )}
                          <div><span className="text-gray-500">Plantas activas:</span> <span className="font-medium text-gray-800">{lote.plantas?.length ?? 0}</span></div>
                        </div>
                      </section>

                      {/* Trazabilidad blockchain */}
                      <section>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Trazabilidad en Polygon</h3>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-xs">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${lote.txRegistro ? "bg-emerald-400" : "bg-gray-300"}`} />
                            <span className="text-gray-500">Lote registrado en blockchain:</span>
                            {lote.txRegistro ? (
                              <span className="font-mono text-purple-600">{lote.txRegistro.slice(0, 18)}…</span>
                            ) : (
                              <span className="text-gray-400">Sin registro</span>
                            )}
                          </div>
                          {lote.dataHash && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                              <span className="text-gray-500">SHA256:</span>
                              <span className="font-mono text-gray-600">{lote.dataHash.replace("0x","").slice(0, 18)}…</span>
                            </div>
                          )}
                        </div>
                      </section>

                      {/* Historial de eventos de campo */}
                      {lote.eventos && lote.eventos.length > 0 && (
                        <section>
                          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                            Registros de campo ({lote.eventos.length})
                          </h3>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {lote.eventos.map((ev) => (
                              <div key={ev.id} className="flex items-start gap-3 text-xs bg-gray-50 rounded-lg px-3 py-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-gray-700">
                                      {TIPO_EVENTO_LABEL[ev.tipoEvento] ?? ev.tipoEvento}
                                    </span>
                                    <span className="text-gray-400">
                                      {new Date(ev.fechaEvento).toLocaleDateString("es-CO")}
                                    </span>
                                    {ev.txHash && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" title="Verificado en Polygon" />
                                    )}
                                  </div>
                                  {ev.descripcion && (
                                    <p className="text-gray-500 mt-0.5 truncate">{ev.descripcion}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}

                      {/* Campañas cerradas */}
                      <section>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                          Campañas de monitoreo cerradas
                        </h3>
                        {lote.campanas && lote.campanas.length > 0 ? (
                          <div className="space-y-2">
                            {lote.campanas.map((c) => (
                              <div key={c.id} className="bg-gray-50 rounded-lg px-3 py-2 text-xs space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.txHash ? "bg-emerald-400" : "bg-amber-400"}`} />
                                  <span className="font-semibold text-gray-700">{c.nombre}</span>
                                  {c.fechaCierre && (
                                    <span className="text-gray-400">{new Date(c.fechaCierre).toLocaleDateString("es-CO")}</span>
                                  )}
                                  {c.txHash && (
                                    <span className="text-emerald-600 font-medium">✓ Anclada en Polygon</span>
                                  )}
                                </div>
                                {c.campanaHash && (
                                  <div className="text-gray-400 pl-3">
                                    SHA256: <span className="font-mono text-gray-500">{c.campanaHash.slice(0, 20)}…</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700">
                            ⚠ Sin campañas de monitoreo cerradas — no hay evidencia de registros de campo verificados.
                          </div>
                        )}
                      </section>

                      {lote.eventos?.length === 0 && (
                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700">
                          Sin registros de campo en este lote.
                        </div>
                      )}
                    </>
                  ) : null}

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={handleClose} className="flex-1 btn-secondary">
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => { setError(null); setPaso("formulario"); }}
                      disabled={loadingLote}
                      className="flex-1 btn-primary"
                    >
                      Registrar resultado →
                    </button>
                  </div>
                </div>
              )}

              {/* Paso 2: Formulario de resultado */}
              {paso === "formulario" && (
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  <button
                    type="button"
                    onClick={() => setPaso("contexto")}
                    className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-2"
                  >
                    ← Volver al contexto del lote
                  </button>

                  {/* Resultado */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Resultado *</label>
                    <select
                      value={resultado}
                      onChange={e => setResultado(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500"
                    >
                      <option value="APROBADO">✅ Aprobado</option>
                      <option value="APROBADO_CON_OBSERVACIONES">⚠️ Aprobado con observaciones</option>
                      <option value="RECHAZADO">❌ Rechazado</option>
                    </select>
                  </div>

                  {/* Puntaje BPA */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Puntaje BPA (% cumplimiento NTC 5400)
                    </label>
                    <input
                      type="number" min="0" max="100" step="0.1"
                      value={puntaje}
                      onChange={e => setPuntaje(e.target.value)}
                      placeholder="Ej: 85.5"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500"
                    />
                  </div>

                  {/* Hallazgos */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Críticos",  value: hallazgosCriticos, setter: setHallazgosCriticos, color: "text-red-600",   bg: "bg-red-50" },
                      { label: "Mayores",   value: hallazgosMayores,  setter: setHallazgosMayores,  color: "text-amber-600", bg: "bg-amber-50" },
                      { label: "Menores",   value: hallazgosMenores,  setter: setHallazgosMenores,  color: "text-blue-600",  bg: "bg-blue-50" },
                    ].map(({ label, value, setter, color, bg }) => (
                      <div key={label} className={`${bg} rounded-lg p-3`}>
                        <label className={`block text-xs font-semibold mb-1.5 ${color}`}>{label}</label>
                        <input
                          type="number" min="0"
                          value={value}
                          onChange={e => setter(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-verde-500 bg-white"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Observaciones */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                    <textarea
                      value={observaciones}
                      onChange={e => setObservaciones(e.target.value)}
                      rows={3}
                      placeholder="Descripción de hallazgos y condiciones del cultivo..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500 resize-none"
                    />
                  </div>

                  {/* Plan de mejora */}
                  {resultado !== "APROBADO" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Plan de mejora</label>
                      <textarea
                        value={planMejora}
                        onChange={e => setPlanMejora(e.target.value)}
                        rows={2}
                        placeholder="Acciones correctivas requeridas..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500 resize-none"
                      />
                    </div>
                  )}

                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{error}</div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={handleClose} className="flex-1 btn-secondary" disabled={loading}>
                      Cancelar
                    </button>
                    <button type="submit" className="flex-1 btn-primary" disabled={loading}>
                      {loading ? "Guardando..." : "Guardar resultado"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
