"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getApiUrl } from "@/lib/client";

export interface EudrPaisRiesgo {
  codigoPais: string;
  nombrePais: string;
  nivelRiesgo: "BAJO" | "ESTANDAR" | "ALTO";
}

export interface EudrEvaluacionRiesgoPredio {
  id: string;
  predioId: string;
  paisCodigo: string;
  historialIncumplimiento: boolean;
  historialIncumplimientoDetalle: string | null;
  tenenciaLegalVerificada: boolean;
  tenenciaLegalObservaciones: string | null;
  nivelRiesgoGlobal: "NULO" | "BAJO" | "MEDIO" | "ALTO";
  version: number;
  createdAt: string;
}

interface MedidaMitigacion {
  id: string;
  descripcion: string;
  responsable: string | null;
  createdAt: string;
}

interface DocumentoTenenciaLegal {
  id: string;
  originalName: string;
  url: string;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

const NIVELES: Array<"NULO" | "BAJO" | "MEDIO" | "ALTO"> = ["NULO", "BAJO", "MEDIO", "ALTO"];

export function EvaluacionRiesgoPredioSeccion({
  predioId,
  evaluacionInicial,
  medidasIniciales,
  documentoTenenciaLegal,
  paises,
  // Datos generales ya existentes en el predio — solo se MUESTRAN como
  // referencia, el usuario los edita en el formulario de predio, no aqui.
  datosGeneralesPredio,
  token,
}: {
  predioId: string;
  evaluacionInicial: EudrEvaluacionRiesgoPredio | null;
  medidasIniciales: MedidaMitigacion[];
  documentoTenenciaLegal: DocumentoTenenciaLegal | null;
  paises: EudrPaisRiesgo[];
  datosGeneralesPredio: {
    matriculaInmobiliaria: string | null;
    codigoIca: string | null;
    certifUsoSuelo: string | null;
    territorioIndigena: boolean;
    territorioIndigenaDetalle: string | null;
  };
  token: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [paisCodigo, setPaisCodigo] = useState(evaluacionInicial?.paisCodigo ?? "CO");
  const [historialIncumplimiento, setHistorialIncumplimiento] = useState(evaluacionInicial?.historialIncumplimiento ?? false);
  const [historialDetalle, setHistorialDetalle] = useState(evaluacionInicial?.historialIncumplimientoDetalle ?? "");
  const [tenenciaVerificada, setTenenciaVerificada] = useState(evaluacionInicial?.tenenciaLegalVerificada ?? false);
  const [tenenciaObs, setTenenciaObs] = useState(evaluacionInicial?.tenenciaLegalObservaciones ?? "");
  const [nivelGlobal, setNivelGlobal] = useState<"NULO" | "BAJO" | "MEDIO" | "ALTO">(evaluacionInicial?.nivelRiesgoGlobal ?? "BAJO");

  const [mitigacionDesc, setMitigacionDesc] = useState("");
  const [mitigacionResp, setMitigacionResp] = useState("");

  const paisSeleccionado = paises.find((p) => p.codigoPais === paisCodigo);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/eudr/predios/${predioId}/evaluacion-riesgo`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({
          paisCodigo,
          historialIncumplimiento,
          historialIncumplimientoDetalle: historialDetalle || undefined,
          tenenciaLegalVerificada: tenenciaVerificada,
          tenenciaLegalObservaciones: tenenciaObs || undefined,
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
      const res = await fetch(`${getApiUrl()}/api/eudr/evaluaciones-riesgo/predio/${evaluacionInicial.id}/mitigacion`, {
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
      {/* Datos generales del predio, solo referencia — se editan en /predios */}
      <div className="bg-gray-50 rounded-xl p-4 text-xs space-y-1.5">
        <p className="font-semibold text-gray-500 uppercase tracking-wide mb-2">Datos generales del predio (referencia)</p>
        <div className="flex justify-between"><span className="text-gray-400">Matrícula inmobiliaria</span><span className="text-gray-700">{datosGeneralesPredio.matriculaInmobiliaria ?? "—"}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">Código ICA</span><span className="text-gray-700">{datosGeneralesPredio.codigoIca ?? "—"}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">Certificación uso de suelo</span><span className="text-gray-700">{datosGeneralesPredio.certifUsoSuelo ?? "—"}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">Territorio indígena</span><span className="text-gray-700">{datosGeneralesPredio.territorioIndigena ? "Sí" : "No"}</span></div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Documento de tenencia legal</span>
          {documentoTenenciaLegal ? (
            <a href={documentoTenenciaLegal.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
              {documentoTenenciaLegal.originalName} →
            </a>
          ) : (
            <span className="text-gray-700">— sin cargar —</span>
          )}
        </div>
        <p className="text-gray-400 pt-1">
          Estos datos se editan en el formulario del predio, no aquí — incluyendo el documento de tenencia legal (Art. 9(1)(h)).
        </p>
      </div>

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
          Evaluación de riesgo (Art. 10 Reglamento UE 2023/1115) — criterios generales del predio, compartidos por todas sus parcelas.
        </p>

        <div>
          <label className="label">País de producción</label>
          <select className="input" value={paisCodigo} onChange={(e) => setPaisCodigo(e.target.value)}>
            {paises.map((p) => (
              <option key={p.codigoPais} value={p.codigoPais}>{p.nombrePais} ({p.nivelRiesgo})</option>
            ))}
          </select>
          {paisSeleccionado && (
            <p className="text-xs text-gray-400 mt-1">
              Clasificación oficial UE: {paisSeleccionado.nivelRiesgo} (Art. 29) — Art. 10(2)(a)(b)(c)(f)(h)(k)
            </p>
          )}
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={historialIncumplimiento} onChange={(e) => setHistorialIncumplimiento(e.target.checked)} />
            Historial de incumplimiento previo (Art. 10(2)(l))
          </label>
          {historialIncumplimiento && (
            <textarea
              className="input mt-2"
              rows={2}
              placeholder="Detalle del incumplimiento"
              value={historialDetalle}
              onChange={(e) => setHistorialDetalle(e.target.value)}
            />
          )}
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={tenenciaVerificada} onChange={(e) => setTenenciaVerificada(e.target.checked)} />
            Tenencia legal de la tierra verificada (Art. 9(1)(h))
          </label>
          <p className="text-xs text-gray-400 mt-1">Basado en matrícula inmobiliaria, código ICA y certificación de uso de suelo del predio.</p>
          <textarea
            className="input mt-2"
            rows={2}
            placeholder="Observaciones (opcional)"
            value={tenenciaObs}
            onChange={(e) => setTenenciaObs(e.target.value)}
          />
        </div>

        <div>
          <label className="label">Nivel de riesgo global del predio</label>
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
