"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { formatFecha, truncarHash } from "@/lib/utils";
import { EditarCampanaBtn } from "./EditarCampanaBtn";

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
  camposRequeridos: string[];
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

const ESTADO_LABEL: Record<CampanaResumen["estado"], string> = {
  ACTIVA: "Activa",
  ABIERTA: "Abierta",
  CERRADA: "Cerrada",
};

export function CampanasLista({ campanas, esAdmin }: { campanas: CampanaResumen[]; esAdmin: boolean }) {
  const [filtroEstado, setFiltroEstado] = useState("");

  const filtradas = useMemo(() => {
    if (!filtroEstado) return campanas;
    return campanas.filter((c) => c.estado === filtroEstado);
  }, [campanas, filtroEstado]);

  return (
    <div>
      <div className="mb-4">
        <label className="label">Estado</label>
        <select className="input max-w-xs" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="">Todos</option>
          <option value="ACTIVA">Activa</option>
          <option value="ABIERTA">Abierta</option>
          <option value="CERRADA">Cerrada</option>
        </select>
      </div>

      {filtradas.length === 0 ? (
        <p className="text-center text-gray-400 py-12 text-sm">
          {filtroEstado ? `Sin campañas en estado ${ESTADO_LABEL[filtroEstado as CampanaResumen["estado"]]}` : "Sin campañas registradas"}
        </p>
      ) : (
        <div className="space-y-3">
          {filtradas.map((campana) => {
            const campos: string[] = campana.camposRequeridos ?? [];
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
                    <div className="flex items-center gap-2 justify-end">
                      {esAdmin && <EditarCampanaBtn campana={campana} />}
                      <Link
                        href={`/campanas/${campana.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-verde-500 hover:text-verde-600 bg-verde-50 hover:bg-verde-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Ver detalle →
                      </Link>
                    </div>
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
