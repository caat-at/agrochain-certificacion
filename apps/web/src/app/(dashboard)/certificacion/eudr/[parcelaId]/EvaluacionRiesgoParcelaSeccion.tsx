"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getApiUrl } from "@/lib/client";

export interface EudrEvaluacionRiesgoParcela {
  id: string;
  parcelaId: string;
  fiabilidadPoligono: "ALTA" | "MEDIA" | "BAJA";
  complejidadCadena: "BAJA" | "MEDIA" | "ALTA";
  complejidadCadenaDetalle: string | null;
  riesgoMezclaOrigen: "NULO" | "BAJO" | "MEDIO" | "ALTO";
  informacionNoConformidad: string | null;
  nivelRiesgoGlobal: "NULO" | "BAJO" | "MEDIO" | "ALTO";
  version: number;
}

interface MedidaMitigacion {
  id: string;
  descripcion: string;
  responsable: string | null;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

const NIVELES: Array<"NULO" | "BAJO" | "MEDIO" | "ALTO"> = ["NULO", "BAJO", "MEDIO", "ALTO"];

export function EvaluacionRiesgoParcelaSeccion({
  parcelaId,
  evaluacionInicial,
  medidasIniciales,
  poligonoFuente,
  token,
}: {
  parcelaId: string;
  evaluacionInicial: EudrEvaluacionRiesgoParcela | null;
  medidasIniciales: MedidaMitigacion[];
  poligonoFuente: string | null;
  token: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fiabilidadPoligono, setFiabilidadPoligono] = useState<"ALTA" | "MEDIA" | "BAJA">(
    evaluacionInicial?.fiabilidadPoligono ?? (poligonoFuente === "GPS_CAMPO" ? "ALTA" : "MEDIA")
  );
  const [complejidadCadena, setComplejidadCadena] = useState<"BAJA" | "MEDIA" | "ALTA">(evaluacionInicial?.complejidadCadena ?? "BAJA");
  const [complejidadDetalle, setComplejidadDetalle] = useState(evaluacionInicial?.complejidadCadenaDetalle ?? "");
  const [riesgoMezcla, setRiesgoMezcla] = useState<"NULO" | "BAJO" | "MEDIO" | "ALTO">(evaluacionInicial?.riesgoMezclaOrigen ?? "NULO");
  const [infoNoConformidad, setInfoNoConformidad] = useState(evaluacionInicial?.informacionNoConformidad ?? "");
  const [nivelGlobal, setNivelGlobal] = useState<"NULO" | "BAJO" | "MEDIO" | "ALTO">(evaluacionInicial?.nivelRiesgoGlobal ?? "BAJO");

  const [mitigacionDesc, setMitigacionDesc] = useState("");
  const [mitigacionResp, setMitigacionResp] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/eudr/parcelas/${parcelaId}/evaluacion-riesgo`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({
          fiabilidadPoligono,
          complejidadCadena,
          complejidadCadenaDetalle: complejidadDetalle || undefined,
          riesgoMezclaOrigen: riesgoMezcla,
          informacionNoConformidad: infoNoConformidad || undefined,
          nivelRiesgoGlobal: nivelGlobal,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `Error ${res.status}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleMitigacion(e: React.FormEvent) {
    e.preventDefault();
    if (!evaluacionInicial || !mitigacionDesc.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/eudr/evaluaciones-riesgo/parcela/${evaluacionInicial.id}/mitigacion`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({
          descripcion: mitigacionDesc.trim(),
          responsable: mitigacionResp.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `Error ${res.status}`);
      setMitigacionDesc("");
      setMitigacionResp("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const requiereMitigacion = evaluacionInicial && (evaluacionInicial.nivelRiesgoGlobal === "MEDIO" || evaluacionInicial.nivelRiesgoGlobal === "ALTO");

  return (
    <div className="space-y-4">
      {evaluacionInicial && (
        <div className="flex flex-wrap gap-2">
          <span className="badge bg-gray-100 text-gray-600">Evaluación v{evaluacionInicial.version}</span>
          <span className={`badge ${evaluacionInicial.nivelRiesgoGlobal === "NULO" || evaluacionInicial.nivelRiesgoGlobal === "BAJO" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            Riesgo global: {evaluacionInicial.nivelRiesgoGlobal}
          </span>
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-600">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-3 bg-gray-50 rounded-xl p-4">
        <p className="text-xs text-gray-500">
          Evaluación de riesgo (Art. 10) — criterios específicos del área de producción.
        </p>

        <div>
          <label className="label">Fiabilidad del polígono (Art. 10(2)(g))</label>
          <select className="input" value={fiabilidadPoligono} onChange={(e) => setFiabilidadPoligono(e.target.value as typeof fiabilidadPoligono)}>
            <option value="ALTA">Alta (GPS de campo)</option>
            <option value="MEDIA">Media (dibujado manual)</option>
            <option value="BAJA">Baja (origen incierto)</option>
          </select>
          {poligonoFuente && <p className="text-xs text-gray-400 mt-1">Fuente del polígono registrado: {poligonoFuente}</p>}
        </div>

        <div>
          <label className="label">Complejidad de la cadena de suministro (Art. 10(2)(i))</label>
          <select className="input" value={complejidadCadena} onChange={(e) => setComplejidadCadena(e.target.value as typeof complejidadCadena)}>
            <option value="BAJA">Baja (venta directa)</option>
            <option value="MEDIA">Media (1-2 intermediarios)</option>
            <option value="ALTA">Alta (múltiples intermediarios/procesamiento)</option>
          </select>
          <textarea
            className="input mt-2"
            rows={2}
            placeholder="Detalle de la cadena (opcional)"
            value={complejidadDetalle}
            onChange={(e) => setComplejidadDetalle(e.target.value)}
          />
        </div>

        <div>
          <label className="label">Riesgo de mezcla con origen desconocido (Art. 10(2)(j))</label>
          <select className="input" value={riesgoMezcla} onChange={(e) => setRiesgoMezcla(e.target.value as typeof riesgoMezcla)}>
            {NIVELES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Información que apunte a no conformidad (Art. 10(2)(m))</label>
          <textarea
            className="input"
            rows={2}
            placeholder="Dejar vacío si no hay información de este tipo"
            value={infoNoConformidad}
            onChange={(e) => setInfoNoConformidad(e.target.value)}
          />
        </div>

        <div>
          <label className="label">Nivel de riesgo global de la parcela</label>
          <select className="input" value={nivelGlobal} onChange={(e) => setNivelGlobal(e.target.value as typeof nivelGlobal)}>
            {NIVELES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        <button type="submit" disabled={loading} className="btn-primary text-sm py-2 w-full disabled:opacity-50">
          {loading ? "Guardando…" : evaluacionInicial ? "Registrar nueva evaluación" : "Crear evaluación"}
        </button>
      </form>

      {requiereMitigacion && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Medidas de mitigación (Art. 11) — requeridas por riesgo {evaluacionInicial!.nivelRiesgoGlobal}
          </h3>
          {medidasIniciales.length > 0 && (
            <div className="space-y-1.5">
              {medidasIniciales.map((m) => (
                <div key={m.id} className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-xs text-emerald-700">
                  {m.descripcion}{m.responsable ? ` — ${m.responsable}` : ""}
                </div>
              ))}
            </div>
          )}
          {medidasIniciales.length === 0 && (
            <p className="text-xs text-amber-600">Sin medidas registradas — la declaración EUDR queda bloqueada hasta documentar al menos una.</p>
          )}
          <form onSubmit={handleMitigacion} className="space-y-2 bg-gray-50 rounded-xl p-3">
            <textarea
              className="input text-xs"
              rows={2}
              placeholder="Descripción de la medida de mitigación"
              value={mitigacionDesc}
              onChange={(e) => setMitigacionDesc(e.target.value)}
              required
            />
            <input
              className="input text-xs"
              placeholder="Responsable (opcional)"
              value={mitigacionResp}
              onChange={(e) => setMitigacionResp(e.target.value)}
            />
            <button type="submit" disabled={loading || !mitigacionDesc.trim()} className="btn-secondary text-xs py-1.5 w-full disabled:opacity-50">
              Registrar medida
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
