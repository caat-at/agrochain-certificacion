"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getApiUrl } from "@/lib/client";
import type { StbnSubcriterio, PilarStbn } from "./StbnEvidenciaSeccion";

export interface StbnEvaluacion {
  id: string;
  predioId: string;
  estado: "EN_PROGRESO" | "FINALIZADA";
  puntajeTotal: number | null;
  resultadoHash: string | null;
  txHash: string | null;
}

export interface StbnCalificacion {
  id: string;
  evaluacionId: string;
  subcriterioCodigo: string;
  nivel: "ALTO" | "BAJO";
  puntajeAsignado: number;
  justificacion: string | null;
}

interface PilarStbnResumen {
  subcriterios: Array<{
    codigo: string;
    nombre: string;
    nivel: "ALTO" | "BAJO" | null;
    puntajeAsignado: number | null;
    puntajeMaximo: number;
  }>;
  subtotal: number;
  maximo: number;
}

export interface PuntajeStbnLote {
  loteId: string;
  predioId: string;
  pilares: {
    conservacion: PilarStbnResumen;
    comunidad: PilarStbnResumen;
    justiciaSocial: PilarStbnResumen;
    tecnologia: PilarStbnResumen;
    derechosHumanos: PilarStbnResumen;
    eudr: { cumpleUmbral: boolean; declaracionEstado: string | null; libreDeforestacion: boolean | null; subtotal: number; maximo: 40 };
  };
  puntajeTotal: number;
  estadoElegibilidad: "APROBADO" | "REVISION_CONDICIONAL" | "NO_ELEGIBLE";
  evaluacionPilaresCompleta: boolean;
}

const PILAR_LABEL: Record<PilarStbn, string> = {
  CONSERVACION: "Conservación",
  COMUNIDAD: "Comunidad",
  JUSTICIA_SOCIAL: "Justicia Social",
  TECNOLOGIA: "Tecnología",
  DERECHOS_HUMANOS: "Derechos Humanos",
};

const ELEGIBILIDAD_BADGE: Record<string, string> = {
  APROBADO: "bg-emerald-100 text-emerald-700",
  REVISION_CONDICIONAL: "bg-amber-100 text-amber-700",
  NO_ELEGIBLE: "bg-red-100 text-red-600",
};

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export function StbnEvaluacionSeccion({
  predioId,
  subcriterios,
  evaluacionInicial,
  calificacionesIniciales,
  puntajeInicial,
  lotes,
  token,
}: {
  predioId: string;
  subcriterios: StbnSubcriterio[];
  evaluacionInicial: StbnEvaluacion | null;
  calificacionesIniciales: StbnCalificacion[];
  puntajeInicial: PuntajeStbnLote | null;
  lotes: Array<{ id: string; codigoLote: string; registradoOnchain: boolean }>;
  token: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardandoCodigo, setGuardandoCodigo] = useState<string | null>(null);
  const [anclando, setAnclando] = useState(false);
  const [ancladoEnCola, setAncladoEnCola] = useState(false);
  // Preseleccionar un lote ya registrado on-chain si existe alguno — el
  // contrato exige loteExiste() para anclar, asi que preferimos no arrancar
  // en un lote que sabemos que va a fallar.
  const loteRegistradoDefault = lotes.find((l) => l.registradoOnchain)?.id ?? lotes[0]?.id ?? "";
  const [loteSeleccionado, setLoteSeleccionado] = useState(loteRegistradoDefault);
  const loteActual = lotes.find((l) => l.id === loteSeleccionado);

  const calMap = new Map(calificacionesIniciales.map((c) => [c.subcriterioCodigo, c]));
  const totalCalificados = calificacionesIniciales.length;

  async function handleIniciar() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/stbn/predios/${predioId}/evaluaciones`, {
        method: "POST",
        headers: authHeaders(token),
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

  async function handleCalificar(codigo: string, nivel: "ALTO" | "BAJO") {
    if (!evaluacionInicial) return;
    setError(null);
    setGuardandoCodigo(codigo);
    try {
      const res = await fetch(
        `${getApiUrl()}/api/stbn/evaluaciones/${evaluacionInicial.id}/subcriterios/${codigo}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders(token) },
          body: JSON.stringify({ nivel }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `Error ${res.status}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGuardandoCodigo(null);
    }
  }

  async function handleFinalizar() {
    if (!evaluacionInicial) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/stbn/evaluaciones/${evaluacionInicial.id}/finalizar`, {
        method: "POST",
        headers: authHeaders(token),
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

  async function handleAnclar() {
    if (!evaluacionInicial || !loteSeleccionado) return;
    setError(null);
    setAnclando(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/stbn/evaluaciones/${evaluacionInicial.id}/anclar-blockchain`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ loteId: loteSeleccionado }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `Error ${res.status}`);
      setAncladoEnCola(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnclando(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-600">{error}</div>
      )}

      {/* Sin evaluación — iniciar */}
      {!evaluacionInicial && (
        <div className="text-center py-4">
          <p className="text-sm text-gray-400 mb-3">Sin evaluación de pilares STBN para este predio.</p>
          <button onClick={handleIniciar} disabled={loading} className="btn-primary text-sm py-2 w-full disabled:opacity-50">
            {loading ? "Creando…" : "Iniciar evaluación"}
          </button>
        </div>
      )}

      {/* Evaluación EN_PROGRESO — calificar */}
      {evaluacionInicial && evaluacionInicial.estado === "EN_PROGRESO" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Calificación de subcriterios</span>
            <span className="badge bg-gray-100 text-gray-600 text-xs">{totalCalificados}/10</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-2 bg-verde-500 rounded-full transition-all"
              style={{ width: `${(totalCalificados / 10) * 100}%` }}
            />
          </div>

          {(Object.keys(PILAR_LABEL) as PilarStbn[]).map((pilar) => (
            <div key={pilar}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{PILAR_LABEL[pilar]}</p>
              <div className="space-y-2">
                {subcriterios.filter((s) => s.pilar === pilar).map((s) => {
                  const cal = calMap.get(s.codigo);
                  return (
                    <div key={s.codigo} className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs font-medium text-gray-700 mb-2">{s.nombre}</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={guardandoCodigo === s.codigo}
                          onClick={() => handleCalificar(s.codigo, "ALTO")}
                          className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${
                            cal?.nivel === "ALTO"
                              ? "bg-emerald-500 border-emerald-500 text-white"
                              : "border-gray-200 text-gray-500 hover:bg-gray-100"
                          }`}
                        >
                          Alto ({s.puntajeAlto})
                        </button>
                        <button
                          type="button"
                          disabled={guardandoCodigo === s.codigo}
                          onClick={() => handleCalificar(s.codigo, "BAJO")}
                          className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${
                            cal?.nivel === "BAJO"
                              ? "bg-amber-500 border-amber-500 text-white"
                              : "border-gray-200 text-gray-500 hover:bg-gray-100"
                          }`}
                        >
                          Bajo ({s.puntajeBajo})
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <button
            onClick={handleFinalizar}
            disabled={loading || totalCalificados < 10}
            className="btn-primary text-sm py-2 w-full disabled:opacity-50"
          >
            {loading ? "Finalizando…" : totalCalificados < 10 ? `Faltan ${10 - totalCalificados} por calificar` : "Finalizar evaluación"}
          </button>
        </div>
      )}

      {/* Evaluación FINALIZADA — anclar */}
      {evaluacionInicial && evaluacionInicial.estado === "FINALIZADA" && (
        <div className="space-y-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-700">
            Evaluación finalizada — {evaluacionInicial.puntajeTotal}/60 en pilares humanos.
          </div>

          {evaluacionInicial.txHash ? (
            <div className="text-xs text-gray-500">
              Anclada en blockchain:{" "}
              <a
                href={`https://amoy.polygonscan.com/tx/${evaluacionInicial.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 hover:underline font-mono"
              >
                {evaluacionInicial.txHash.slice(0, 18)}…
              </a>
            </div>
          ) : ancladoEnCola ? (
            <p className="text-xs text-blue-600">Anclaje enviado — actualiza en unos segundos para ver el TX.</p>
          ) : lotes.length === 0 ? (
            <p className="text-xs text-gray-400">Se necesita al menos un lote registrado en el predio para anclar.</p>
          ) : (
            <div className="space-y-2">
              <div>
                <label className="label text-xs">Lote de referencia</label>
                <select className="input text-xs" value={loteSeleccionado} onChange={(e) => setLoteSeleccionado(e.target.value)}>
                  {lotes.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.codigoLote}{l.registradoOnchain ? "" : " (sin blockchain)"}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  El anclaje se registra contra este lote (el contrato exige un lote ya en blockchain).
                </p>
              </div>
              {loteActual && !loteActual.registradoOnchain && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                  {loteActual.codigoLote} no está registrado en blockchain todavía — el anclaje va a fallar.{" "}
                  <Link href={`/lotes/${loteActual.id}`} className="underline font-medium">
                    Registrarlo primero →
                  </Link>
                </div>
              )}
              <button
                onClick={handleAnclar}
                disabled={anclando || !loteActual?.registradoOnchain}
                className="btn-primary text-sm py-2 w-full disabled:opacity-50"
              >
                {anclando ? "Enviando a Polygon…" : "Anclar en blockchain"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Puntaje combinado /100 */}
      {puntajeInicial && (
        <div className="pt-4 border-t border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Puntaje STBN</span>
            <span className={`badge text-xs ${ELEGIBILIDAD_BADGE[puntajeInicial.estadoElegibilidad]}`}>
              {puntajeInicial.estadoElegibilidad.replace(/_/g, " ")}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-bold text-gray-900 text-lg">{puntajeInicial.puntajeTotal}/100</span>
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  puntajeInicial.puntajeTotal >= 80 ? "bg-emerald-500" : puntajeInicial.puntajeTotal >= 70 ? "bg-amber-400" : "bg-red-500"
                }`}
                style={{ width: `${Math.min(puntajeInicial.puntajeTotal, 100)}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
            <div>Conservación: {puntajeInicial.pilares.conservacion.subtotal}/{puntajeInicial.pilares.conservacion.maximo}</div>
            <div>Comunidad: {puntajeInicial.pilares.comunidad.subtotal}/{puntajeInicial.pilares.comunidad.maximo}</div>
            <div>Justicia Social: {puntajeInicial.pilares.justiciaSocial.subtotal}/{puntajeInicial.pilares.justiciaSocial.maximo}</div>
            <div>Tecnología: {puntajeInicial.pilares.tecnologia.subtotal}/{puntajeInicial.pilares.tecnologia.maximo}</div>
            <div>Derechos Humanos: {puntajeInicial.pilares.derechosHumanos.subtotal}/{puntajeInicial.pilares.derechosHumanos.maximo}</div>
            <div>EUDR: {puntajeInicial.pilares.eudr.subtotal}/{puntajeInicial.pilares.eudr.maximo}</div>
          </div>
        </div>
      )}
    </div>
  );
}
