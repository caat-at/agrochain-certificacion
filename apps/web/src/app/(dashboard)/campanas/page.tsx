export const dynamic = "force-dynamic";
import { apiFetch } from "@/lib/api";
import { formatFecha, truncarHash } from "@/lib/utils";
import Link from "next/link";
import { NuevaCampanaForm } from "./NuevaCampanaForm";

interface LoteResumen {
  id: string;
  codigoLote: string;
  especie: string;
  variedad: string | null;
}

interface CampanaResumen {
  id: string;
  nombre: string;
  descripcion: string | null;
  estado: "ACTIVA" | "ABIERTA" | "CERRADA";
  campanaHash: string | null;
  fechaApertura: string;
  fechaCierre: string | null;
  loteId: string;
  lote: { codigoLote: string; especie: string; variedad: string | null };
  creador: { nombres: string; apellidos: string };
  cerrador: { nombres: string; apellidos: string } | null;
  camposRequeridos: string;
  _count: { registros: number };
  tecnicos?: Array<{ posicion: number }>;
}

function EstadoBadge({ estado }: { estado: CampanaResumen["estado"] }) {
  if (estado === "ABIERTA") return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      Abierta
    </span>
  );
  if (estado === "ACTIVA") return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
      Activa
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
      Cerrada
    </span>
  );
}

export default async function CampanasPage() {
  let campanas: CampanaResumen[] = [];
  let lotes: LoteResumen[] = [];
  let errorMsg: string | null = null;

  try {
    const [dataCampanas, dataLotes] = await Promise.all([
      apiFetch<{ campanas: CampanaResumen[] }>("/api/campanas"),
      apiFetch<{ lotes: LoteResumen[] }>("/api/lotes"),
    ]);
    campanas = dataCampanas.campanas;
    lotes = dataLotes.lotes;
  } catch (err) {
    errorMsg = String(err);
  }

  const activas  = campanas.filter((c) => c.estado === "ACTIVA").length;
  const abiertas = campanas.filter((c) => c.estado === "ABIERTA").length;
  const cerradas = campanas.filter((c) => c.estado === "CERRADA").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campañas de visita</h1>
          <p className="text-sm text-gray-500 mt-1">
            {activas > 0 && <span className="text-blue-600 font-medium">{activas} activas · </span>}
            {abiertas > 0 && <span className="text-emerald-600 font-medium">{abiertas} abiertas · </span>}
            {cerradas} cerradas · {campanas.length} total
          </p>
        </div>
        <NuevaCampanaForm lotes={lotes} />
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm mb-6">
          Error cargando campañas: {errorMsg}
        </div>
      )}

      {campanas.length === 0 && !errorMsg ? (
        <div className="card text-center py-16">
          <svg className="w-14 h-14 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />
          </svg>
          <p className="text-gray-500 font-medium">No hay campañas registradas</p>
          <p className="text-sm text-gray-400 mt-1">Las campañas se crean para coordinar las visitas de campo por lote</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campanas.map((campana) => {
            const campos: string[] = (() => {
              try { return JSON.parse(campana.camposRequeridos); } catch { return []; }
            })();
            return (
              <div key={campana.id}
                className="bg-white border border-gray-200 rounded-xl p-5 hover:border-verde-300 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <EstadoBadge estado={campana.estado} />
                      <h2 className="font-semibold text-gray-900 truncate">{campana.nombre}</h2>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1.5">
                      <span className="font-mono text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                        {campana.lote?.codigoLote ?? "—"}
                      </span>
                      <span>{campana.lote?.especie}{campana.lote?.variedad ? ` · ${campana.lote.variedad}` : ""}</span>
                      <span className="text-gray-400">·</span>
                      <span>{campana._count.registros} plantas</span>
                    </div>
                    {campana.descripcion && (
                      <p className="text-xs text-gray-400 mt-2 truncate">{campana.descripcion}</p>
                    )}
                    <div className="flex items-center gap-3 mt-3">
                      {/* Indicadores posición P1–P4 */}
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((p) => {
                          const asignado = campana.tecnicos?.some((t) => t.posicion === p);
                          return (
                            <span
                              key={p}
                              className={`inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-bold ${
                                asignado
                                  ? "bg-verde-500 text-white"
                                  : "bg-gray-100 text-gray-300 border border-dashed border-gray-200"
                              }`}
                            >
                              P{p}
                            </span>
                          );
                        })}
                      </div>
                      {/* Primeros campos requeridos */}
                      {campos.slice(0, 3).map((c) => (
                        <span key={c}
                          className="text-[11px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">
                          {c}
                        </span>
                      ))}
                      {campos.length > 3 && (
                        <span className="text-[11px] text-gray-400">+{campos.length - 3} más</span>
                      )}
                    </div>
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <div className="text-xs text-gray-400 mb-1">
                      Abierta {formatFecha(campana.fechaApertura)}
                    </div>
                    {campana.fechaCierre && (
                      <div className="text-xs text-gray-400 mb-1">
                        Cerrada {formatFecha(campana.fechaCierre)}
                      </div>
                    )}
                    {campana.campanaHash && (
                      <div className="text-[10px] font-mono text-gray-300 mb-2">
                        Hash: {truncarHash(campana.campanaHash, 16)}
                      </div>
                    )}
                    <Link
                      href={`/campanas/${campana.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-verde-500 hover:text-verde-600 bg-verde-50 hover:bg-verde-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Ver detalle →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
