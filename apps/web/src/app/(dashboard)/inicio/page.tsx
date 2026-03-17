export const dynamic = "force-dynamic";
import { apiFetch } from "@/lib/api";
import { formatFecha, estadoLabel, estadoColor } from "@/lib/utils";
import Link from "next/link";
import { DescargarPdfBtn } from "../lotes/[id]/DescargarPdfBtn";

interface LoteResumen {
  id: string;
  codigoLote: string;
  especie: string;
  variedad: string | null;
  estadoLote: string;
  predioNombre: string;
}

interface Metricas {
  resumen: {
    totalLotes: number;
    lotesActivos: number;
    lotesCertificados: number;
    lotesEnInspeccion: number;
    totalCampanas: number;
    campanasAbiertas: number;
    campanasCerradas: number;
    adulteradosSinResolver: number;
    totalPlantas: number;
    registrosCompletos: number;
  };
  lotesPorEstado: Record<string, number>;
  ultimasCampanas: Array<{
    id: string;
    nombre: string;
    estado: "ABIERTA" | "CERRADA";
    lote: { codigoLote: string; especie: string };
    creador: { nombres: string; apellidos: string };
    totalRegistros: number;
    createdAt: string;
  }>;
  ultimosEventos: Array<{
    id: string;
    tipoEvento: string;
    fechaEvento: string;
    lote: { codigoLote: string; especie: string };
    tecnico: { nombres: string; apellidos: string };
    hashVerificado: boolean;
  }>;
}

function KpiCard({
  label,
  value,
  sub,
  color = "gray",
  href,
  alerta,
}: {
  label: string;
  value: number | string;
  sub?: string;
  color?: "gray" | "green" | "blue" | "red" | "amber";
  href?: string;
  alerta?: boolean;
}) {
  const colorMap = {
    gray:  "bg-white border-gray-200",
    green: "bg-emerald-50 border-emerald-200",
    blue:  "bg-blue-50 border-blue-200",
    red:   "bg-red-50 border-red-300",
    amber: "bg-amber-50 border-amber-200",
  };
  const valueColor = {
    gray:  "text-gray-900",
    green: "text-emerald-700",
    blue:  "text-blue-700",
    red:   "text-red-700",
    amber: "text-amber-700",
  };

  const content = (
    <div className={`card border ${colorMap[color]} ${href ? "hover:shadow-md transition-shadow cursor-pointer" : ""}`}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        {alerta && (
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse mt-0.5" />
        )}
      </div>
      <p className={`text-3xl font-bold mt-2 ${valueColor[color]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

export default async function InicioDashboard() {
  let metricas: Metricas | null = null;
  let errorMsg: string | null = null;
  let lotes: LoteResumen[] = [];

  try {
    [metricas, { lotes }] = await Promise.all([
      apiFetch<Metricas>("/api/metricas/dashboard"),
      apiFetch<{ lotes: LoteResumen[] }>("/api/lotes").catch(() => ({ lotes: [] })),
    ]);
  } catch (err) {
    errorMsg = String(err);
  }

  if (!metricas) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">
        Error cargando métricas: {errorMsg}
      </div>
    );
  }

  const { resumen, ultimasCampanas, ultimosEventos } = metricas;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Panel de control</h1>
        <p className="text-sm text-gray-500 mt-1">Resumen del sistema AgroChain</p>
      </div>

      {/* Alerta adulterados */}
      {resumen.adulteradosSinResolver > 0 && (
        <Link href="/campanas">
          <div className="bg-red-50 border-2 border-red-300 rounded-xl px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-red-700">
                {resumen.adulteradosSinResolver} registro(s) adulterado(s) sin resolver
              </p>
              <p className="text-xs text-red-500 mt-0.5">
                Hay campañas que no se pueden cerrar hasta resolver estos registros. Haz clic para revisar.
              </p>
            </div>
            <svg className="w-5 h-5 text-red-400 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      )}

      {/* KPIs fila 1 — Lotes */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Lotes</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total lotes"
            value={resumen.totalLotes}
            href="/lotes"
            color="gray"
          />
          <KpiCard
            label="En producción"
            value={resumen.lotesActivos}
            sub="Registrados + En producción"
            href="/lotes"
            color="green"
          />
          <KpiCard
            label="Certificados"
            value={resumen.lotesCertificados}
            href="/certificacion"
            color="blue"
          />
          <KpiCard
            label="En inspección"
            value={resumen.lotesEnInspeccion}
            sub="Solicitada o en proceso"
            href="/inspecciones"
            color="amber"
          />
        </div>
      </div>

      {/* KPIs fila 2 — Campañas */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Campañas</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total campañas"
            value={resumen.totalCampanas}
            href="/campanas"
            color="gray"
          />
          <KpiCard
            label="Abiertas"
            value={resumen.campanasAbiertas}
            sub="En progreso en campo"
            href="/campanas"
            color="amber"
          />
          <KpiCard
            label="Cerradas"
            value={resumen.campanasCerradas}
            sub="Hash generado"
            href="/campanas"
            color="green"
          />
          <KpiCard
            label="Registros completos"
            value={resumen.registrosCompletos}
            sub="Con integridad verificada"
            color="blue"
          />
        </div>
      </div>

      {/* Informes PDF */}
      {lotes.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              Informes de trazabilidad PDF
            </h2>
            <Link href="/lotes" className="text-xs text-verde-500 hover:text-verde-600 font-medium">
              Ver todos los lotes →
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Código</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Especie</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Predio</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Estado</th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-center">Informe PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lotes.slice(0, 8).map((lote) => (
                  <tr key={lote.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/lotes/${lote.id}`} className="font-mono text-xs font-semibold text-gray-800 hover:text-verde-600">
                        {lote.codigoLote}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {lote.especie}{lote.variedad ? ` · ${lote.variedad}` : ""}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{lote.predioNombre}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${estadoColor(lote.estadoLote as any)}`}>
                        {estadoLabel(lote.estadoLote as any)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <DescargarPdfBtn loteId={lote.id} codigoLote={lote.codigoLote} compact />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tablas inferiores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Últimas campañas */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Últimas campañas</h2>
            <Link href="/campanas" className="text-xs text-verde-500 hover:text-verde-600 font-medium">
              Ver todas →
            </Link>
          </div>
          {ultimasCampanas.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin campañas aún</p>
          ) : (
            <div className="space-y-2">
              {ultimasCampanas.map((c) => (
                <Link key={c.id} href={`/campanas/${c.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        c.estado === "ABIERTA" ? "bg-emerald-500 animate-pulse" : "bg-gray-300"
                      }`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{c.nombre}</p>
                        <p className="text-xs text-gray-400">
                          <span className="font-mono">{c.lote.codigoLote}</span>
                          {" · "}{c.lote.especie}
                          {" · "}{c.totalRegistros} plantas
                        </p>
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right ml-3">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                        c.estado === "ABIERTA"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-gray-100 text-gray-500 border-gray-200"
                      }`}>
                        {c.estado === "ABIERTA" ? "Abierta" : "Cerrada"}
                      </span>
                      <p className="text-[10px] text-gray-400 mt-1">{formatFecha(c.createdAt)}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Últimos eventos de campo */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Últimos eventos de campo</h2>
            <Link href="/lotes" className="text-xs text-verde-500 hover:text-verde-600 font-medium">
              Ver lotes →
            </Link>
          </div>
          {ultimosEventos.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin eventos aún</p>
          ) : (
            <div className="space-y-2">
              {ultimosEventos.map((e) => (
                <div key={e.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-0.5 ${
                    e.hashVerificado ? "bg-emerald-400" : "bg-amber-400"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      {e.tipoEvento.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-gray-400">
                      <span className="font-mono">{e.lote.codigoLote}</span>
                      {" · "}{e.tecnico.nombres} {e.tecnico.apellidos}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-[10px] text-gray-400">{formatFecha(e.fechaEvento)}</p>
                    <span className={`text-[10px] font-medium ${
                      e.hashVerificado ? "text-emerald-600" : "text-amber-600"
                    }`}>
                      {e.hashVerificado ? "✓ Verificado" : "Pendiente"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
