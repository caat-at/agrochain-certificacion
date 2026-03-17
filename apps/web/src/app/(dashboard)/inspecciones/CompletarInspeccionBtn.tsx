"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  loteId:    string;
  loteCode:  string;
  token:     string;
}

export default function CompletarInspeccionBtn({ loteId, loteCode, token }: Props) {
  const router = useRouter();
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const [resultado, setResultado]               = useState("APROBADO");
  const [puntaje, setPuntaje]                   = useState("");
  const [hallazgosCriticos, setHallazgosCriticos] = useState("0");
  const [hallazgosMayores, setHallazgosMayores]   = useState("0");
  const [hallazgosMenores, setHallazgosMenores]   = useState("0");
  const [observaciones, setObservaciones]         = useState("");
  const [planMejora, setPlanMejora]               = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Crear inspección y completarla en un solo flujo
      //    Primero buscamos si hay inspección existente para este lote
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

      // Crear inspección
      const crearRes = await fetch(`${apiUrl}/api/inspecciones`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          loteId,
          inspectorId:    (JSON.parse(atob(token.split(".")[1]))).sub,
          organizacionId: "org_ica_001",   // organización por defecto
          tipoInspeccion: "BPA_CERTIFICACION",
          fechaSolicitud: new Date().toISOString(),
        }),
      });

      if (!crearRes.ok) {
        const err = await crearRes.json() as { message?: string };
        throw new Error(err.message ?? "Error creando inspección");
      }

      const { data: inspeccion } = await crearRes.json() as { data: { id: string } };

      // Completar inspección
      const completarRes = await fetch(`${apiUrl}/api/inspecciones/${inspeccion.id}/completar`, {
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

      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-primary text-sm py-1.5 px-3"
      >
        Registrar resultado
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Resultado de inspección</h2>
              <p className="text-sm text-gray-500 mt-1">Lote: <span className="font-mono font-semibold">{loteCode}</span></p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                  { label: "Críticos", value: hallazgosCriticos, setter: setHallazgosCriticos, color: "text-red-600" },
                  { label: "Mayores",  value: hallazgosMayores,  setter: setHallazgosMayores,  color: "text-amber-600" },
                  { label: "Menores",  value: hallazgosMenores,  setter: setHallazgosMenores,  color: "text-blue-600" },
                ].map(({ label, value, setter, color }) => (
                  <div key={label}>
                    <label className={`block text-xs font-medium mb-1 ${color}`}>{label}</label>
                    <input
                      type="number" min="0"
                      value={value}
                      onChange={e => setter(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500"
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

              {/* Plan de mejora (solo si no es APROBADO) */}
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
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 btn-secondary"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-primary"
                  disabled={loading}
                >
                  {loading ? "Guardando..." : "Guardar resultado"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
