"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { LoteResumen } from "@/types";
import { estadoColor, estadoLabel } from "@/lib/utils";
import { DescargarPdfBtn } from "./[id]/DescargarPdfBtn";
import { EditarLoteBtn } from "./EditarLoteBtn";

type Campo = "codigo" | "predio" | "parcela" | "especie" | "estado";

function valoresUnicos(valores: (string | null | undefined)[]): string[] {
  return [...new Set(valores.filter((v): v is string => Boolean(v)))].sort();
}

export function LotesTabla({ lotes, puedeEditar }: { lotes: LoteResumen[]; puedeEditar: boolean }) {
  const parcelaTexto = (lote: LoteResumen) => lote.parcelaNombre ?? lote.parcelaCodigo ?? "—";

  const [filtros, setFiltros] = useState<Record<Campo, string>>({
    codigo: "", predio: "", parcela: "", especie: "", estado: "",
  });

  function setFiltro(campo: Campo, valor: string) {
    setFiltros((prev) => ({ ...prev, [campo]: valor }));
  }

  const opciones = useMemo(() => ({
    codigo: valoresUnicos(lotes.map((l) => l.codigoLote)),
    predio: valoresUnicos(lotes.map((l) => l.predioNombre)),
    parcela: valoresUnicos(lotes.map(parcelaTexto)),
    especie: valoresUnicos(lotes.map((l) => l.especie)),
    estado: valoresUnicos(lotes.map((l) => estadoLabel(l.estadoLote))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [lotes]);

  const filtrados = useMemo(() => {
    return lotes.filter((lote) => {
      if (filtros.codigo && lote.codigoLote !== filtros.codigo) return false;
      if (filtros.predio && lote.predioNombre !== filtros.predio) return false;
      if (filtros.parcela && parcelaTexto(lote) !== filtros.parcela) return false;
      if (filtros.especie && lote.especie !== filtros.especie) return false;
      if (filtros.estado && estadoLabel(lote.estadoLote) !== filtros.estado) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lotes, filtros]);

  const hayFiltrosActivos = Object.values(filtros).some((v) => v !== "");

  return (
    <div>
      {hayFiltrosActivos && (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs text-gray-400">{filtrados.length} de {lotes.length} lotes</span>
          <button
            onClick={() => setFiltros({ codigo: "", predio: "", parcela: "", especie: "", estado: "" })}
            className="text-xs text-verde-600 hover:underline"
          >
            Limpiar filtros
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-2 font-medium text-gray-500">
                <div className="space-y-1">
                  <span>Código</span>
                  <select className="input" value={filtros.codigo} onChange={(e) => setFiltro("codigo", e.target.value)}>
                    <option value="">Todos</option>
                    {opciones.codigo.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </th>
              <th className="text-left px-4 py-2 font-medium text-gray-500">
                <div className="space-y-1">
                  <span>Predio</span>
                  <select className="input" value={filtros.predio} onChange={(e) => setFiltro("predio", e.target.value)}>
                    <option value="">Todos</option>
                    {opciones.predio.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </th>
              <th className="text-left px-4 py-2 font-medium text-gray-500">
                <div className="space-y-1">
                  <span>Parcela</span>
                  <select className="input" value={filtros.parcela} onChange={(e) => setFiltro("parcela", e.target.value)}>
                    <option value="">Todas</option>
                    {opciones.parcela.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </th>
              <th className="text-left px-4 py-2 font-medium text-gray-500">
                <div className="space-y-1">
                  <span>Especie</span>
                  <select className="input" value={filtros.especie} onChange={(e) => setFiltro("especie", e.target.value)}>
                    <option value="">Todas</option>
                    {opciones.especie.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </th>
              <th className="text-left px-4 py-2 font-medium text-gray-500">
                <div className="space-y-1">
                  <span>Estado</span>
                  <select className="input" value={filtros.estado} onChange={(e) => setFiltro("estado", e.target.value)}>
                    <option value="">Todos</option>
                    {opciones.estado.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Integridad</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Informe</th>
              {puedeEditar && <th className="text-left px-4 py-3 font-medium text-gray-500">Acciones</th>}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtrados.map((lote) => (
              <tr key={lote.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <span className="font-mono text-xs font-semibold text-gray-800">
                    {lote.codigoLote}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{lote.predioNombre}</td>
                <td className="px-4 py-3 text-gray-600">
                  {lote.parcelaNombre ?? lote.parcelaCodigo ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span className="text-gray-800">{lote.especie}</span>
                  {lote.variedad && (
                    <span className="text-gray-400 text-xs ml-1">· {lote.variedad}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`badge ${estadoColor(lote.estadoLote)}`}>
                    {estadoLabel(lote.estadoLote)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {lote.dataHash ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.707-9.293a1 1 0 0 0-1.414-1.414L9 10.586 7.707 9.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4z"/>
                      </svg>
                      Hash registrado
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">Sin hash</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <DescargarPdfBtn
                    loteId={lote.id}
                    codigoLote={lote.codigoLote}
                    compact
                  />
                </td>
                {puedeEditar && (
                  <td className="px-4 py-3">
                    <EditarLoteBtn
                      lote={{
                        id: lote.id,
                        codigoLote: lote.codigoLote,
                        variedad: lote.variedad ?? "",
                        fechaCosechaEst: lote.fechaCosechaEst,
                        fechaCosechaReal: lote.fechaCosechaReal,
                        volumenCosechaKg: lote.volumenCosechaKg,
                        destinoProduccion: lote.destinoProduccion,
                        sistemaRiego: lote.sistemaRiego,
                      }}
                    />
                  </td>
                )}
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/lotes/${lote.id}`}
                    className="text-xs text-verde-500 hover:text-verde-600 font-medium"
                  >
                    Ver detalle →
                  </Link>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={puedeEditar ? 9 : 8} className="px-4 py-12 text-center text-gray-400">
                  Sin lotes que coincidan con los filtros
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
