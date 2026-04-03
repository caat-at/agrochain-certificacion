export const dynamic = "force-dynamic";
import { apiFetch } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { estadoColor, formatFecha } from "@/lib/utils";
import Link from "next/link";
import { cookies } from "next/headers";
import CompletarInspeccionBtn from "./CompletarInspeccionBtn";
import IniciarInspeccionBtn from "./IniciarInspeccionBtn";
import AnclarInspeccionBtn from "./AnclarInspeccionBtn";

const AMOY_SCAN = "https://amoy.polygonscan.com/tx";

interface InspeccionItem {
  id: string;
  loteId: string;
  lote: {
    codigoLote: string;
    especie: string;
    estado: string;
    predio: { nombrePredio: string };
  };
  inspector: { nombres: string; apellidos: string };
  resultado: string;
  puntaje: number | null;
  hallazgosCriticos: number;
  hallazgosMayores: number;
  hallazgosMenores: number;
  observaciones: string | null;
  estado: string;
  txHash: string | null;
  fechaRealizada: string | null;
  createdAt: string;
}

const RESULTADO_BADGE: Record<string, string> = {
  APROBADO:                   "bg-green-100 text-green-700",
  APROBADO_CON_OBSERVACIONES: "bg-amber-100 text-amber-700",
  RECHAZADO:                  "bg-red-100 text-red-700",
  PENDIENTE:                  "bg-gray-100 text-gray-500",
};

const RESULTADO_LABEL: Record<string, string> = {
  APROBADO:                   "✅ Aprobado",
  APROBADO_CON_OBSERVACIONES: "⚠️ Aprobado c/ obs.",
  RECHAZADO:                  "❌ Rechazado",
  PENDIENTE:                  "Pendiente",
};

export default async function InspeccionesPage() {
  const session = await getSession();
  const cookieStore = await cookies();
  const token = cookieStore.get("ac_token")?.value ?? "";

  let lotesParaInspeccionar: Array<{
    id: string; codigoLote: string; especie: string;
    estadoLote: string; predioNombre: string;
  }> = [];

  let inspecciones: InspeccionItem[] = [];

  try {
    const [lotesData, inspeccionesData] = await Promise.all([
      apiFetch<{ lotes: any[] }>("/api/lotes"),
      apiFetch<{ inspecciones: InspeccionItem[] }>("/api/inspecciones"),
    ]);

    // Lotes sin inspección activa en estados inspeccionables
    const loteIdsConInspeccion = new Set(inspeccionesData.inspecciones.map(i => i.loteId));
    lotesParaInspeccionar = lotesData.lotes.filter((l) =>
      ["EN_PRODUCCION", "COSECHADO"].includes(l.estadoLote) && !loteIdsConInspeccion.has(l.id)
    ).map((l) => ({
      id: l.id, codigoLote: l.codigoLote, especie: l.especie,
      estadoLote: l.estadoLote, predioNombre: l.predioNombre,
    }));

    inspecciones = inspeccionesData.inspecciones;
  } catch {
    // sin datos
  }

  const enCurso    = inspecciones.filter(i => i.estado === "PROGRAMADA" || i.estado === "EN_CURSO");
  const completadas = inspecciones.filter(i => i.estado === "COMPLETADA");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inspecciones</h1>
        <p className="text-sm text-gray-500 mt-1">Gestión de inspecciones de campo NTC 5400 BPA</p>
      </div>

      {/* Lotes disponibles para inspeccionar */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          Lotes disponibles para inspeccionar
          <span className="ml-2 text-sm font-normal text-gray-400">({lotesParaInspeccionar.length})</span>
        </h2>

        {lotesParaInspeccionar.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-gray-400 text-sm">No hay lotes pendientes de inspección</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Código</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Predio</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Especie</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lotesParaInspeccionar.map((lote) => (
                  <tr key={lote.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-800">{lote.codigoLote}</td>
                    <td className="px-4 py-3 text-gray-600">{lote.predioNombre}</td>
                    <td className="px-4 py-3 text-gray-600">{lote.especie}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${estadoColor(lote.estadoLote as any)}`}>
                        {lote.estadoLote.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/lotes/${lote.id}`} className="text-xs text-verde-500 hover:text-verde-600 font-medium">
                          Ver lote
                        </Link>
                        <CompletarInspeccionBtn
                          loteId={lote.id}
                          loteCode={lote.codigoLote}
                          token={token}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Inspecciones en curso */}
      {enCurso.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-3">
            En curso
            <span className="ml-2 text-sm font-normal text-gray-400">({enCurso.length})</span>
          </h2>
          <div className="overflow-hidden rounded-xl border border-blue-100 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-blue-50 bg-blue-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Lote</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Inspector</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Estado</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Fecha solicitud</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {enCurso.map((i) => (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/lotes/${i.loteId}`} className="font-mono text-xs font-semibold text-verde-600 hover:underline">
                        {i.lote.codigoLote}
                      </Link>
                      <p className="text-xs text-gray-400">{i.lote.predio.nombrePredio}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {i.inspector.nombres} {i.inspector.apellidos}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge text-xs ${
                        i.estado === "EN_CURSO"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        {i.estado === "EN_CURSO" ? "En curso" : "Programada"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {formatFecha(i.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {i.estado === "PROGRAMADA" && (
                          <IniciarInspeccionBtn inspeccionId={i.id} />
                        )}
                        {i.estado === "EN_CURSO" && (
                          <CompletarInspeccionBtn
                            loteId={i.loteId}
                            loteCode={i.lote.codigoLote}
                            token={token}
                            inspeccionId={i.id}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Inspecciones completadas */}
      {completadas.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-3">
            Completadas
            <span className="ml-2 text-sm font-normal text-gray-400">({completadas.length})</span>
          </h2>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Lote</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Inspector</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Resultado</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Puntaje</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Hallazgos</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Polygon</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {completadas.map((i) => (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/lotes/${i.loteId}`} className="font-mono text-xs font-semibold text-verde-600 hover:underline">
                        {i.lote.codigoLote}
                      </Link>
                      <p className="text-xs text-gray-400">{i.lote.predio.nombrePredio}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {i.inspector.nombres} {i.inspector.apellidos}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge text-xs ${RESULTADO_BADGE[i.resultado] ?? "bg-gray-100 text-gray-500"}`}>
                        {RESULTADO_LABEL[i.resultado] ?? i.resultado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-sm font-medium">
                      {i.puntaje != null ? `${i.puntaje}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      <span className="text-red-600 font-medium">{i.hallazgosCriticos}C</span>{" "}
                      <span className="text-amber-600 font-medium">{i.hallazgosMayores}M</span>{" "}
                      <span className="text-blue-600 font-medium">{i.hallazgosMenores}m</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {i.txHash ? (
                        <a
                          href={`${AMOY_SCAN}/${i.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-600 hover:underline font-mono"
                          title={i.txHash}
                        >
                          {i.txHash.slice(0, 10)}…
                        </a>
                      ) : (
                        <AnclarInspeccionBtn inspeccionId={i.id} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {i.fechaRealizada ? formatFecha(i.fechaRealizada) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Info workflow */}
      <div className="card bg-amber-50 border border-amber-100">
        <h3 className="font-semibold text-amber-800 mb-3 text-sm">Flujo de inspección NTC 5400</h3>
        <ol className="space-y-2 text-sm text-amber-700">
          {[
            "El inspector selecciona un lote y registra la inspección — el lote pasa a INSPECCION_SOLICITADA",
            "Se inicia la inspección en campo — botón «Iniciar inspección» → estado EN_CURSO",
            "Se ingresa el puntaje de cumplimiento BPA (0-100%) y hallazgos críticos/mayores/menores",
            "Si aprobado → el lote pasa a COSECHADO y el resultado queda anclado en Polygon Amoy",
            "Si rechazado → el lote queda en RECHAZADO con plan de mejora obligatorio",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="w-5 h-5 bg-amber-200 text-amber-800 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
