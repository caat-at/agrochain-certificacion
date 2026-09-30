"use client";
import { useState, useMemo } from "react";
import { EditarParcelaBtn } from "./EditarParcelaBtn";

interface ParcelaItem {
  id: string;
  predioId: string;
  codigoParcela: string;
  nombre: string | null;
  areaHa: number;
  usoActual: string | null;
  latitud: number | null;
  longitud: number | null;
  activo: boolean;
}

interface PredioItem {
  id: string;
  nombrePredio: string;
}

type Campo = "codigo" | "predio" | "nombre" | "usoActual" | "estado";

function valoresUnicos(valores: (string | null | undefined)[]): string[] {
  return [...new Set(valores.filter((v): v is string => Boolean(v)))].sort();
}

export function ParcelasTabla({ parcelas, predios, puedeEditar }: { parcelas: ParcelaItem[]; predios: PredioItem[]; puedeEditar: boolean }) {
  const nombrePredio = (predioId: string) =>
    predios.find((p) => p.id === predioId)?.nombrePredio ?? "—";
  const estadoTexto = (p: ParcelaItem) => (p.activo ? "Activo" : "Inactivo");

  const [filtros, setFiltros] = useState<Record<Campo, string>>({
    codigo: "", predio: "", nombre: "", usoActual: "", estado: "",
  });

  function setFiltro(campo: Campo, valor: string) {
    setFiltros((prev) => ({ ...prev, [campo]: valor }));
  }

  const opciones = useMemo(() => ({
    codigo: valoresUnicos(parcelas.map((p) => p.codigoParcela)),
    predio: valoresUnicos(parcelas.map((p) => nombrePredio(p.predioId))),
    nombre: valoresUnicos(parcelas.map((p) => p.nombre)),
    usoActual: valoresUnicos(parcelas.map((p) => p.usoActual)),
    estado: valoresUnicos(parcelas.map(estadoTexto)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [parcelas, predios]);

  const filtradas = useMemo(() => {
    return parcelas.filter((p) => {
      if (filtros.codigo && p.codigoParcela !== filtros.codigo) return false;
      if (filtros.predio && nombrePredio(p.predioId) !== filtros.predio) return false;
      if (filtros.nombre && p.nombre !== filtros.nombre) return false;
      if (filtros.usoActual && p.usoActual !== filtros.usoActual) return false;
      if (filtros.estado && estadoTexto(p) !== filtros.estado) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcelas, filtros]);

  const hayFiltrosActivos = Object.values(filtros).some((v) => v !== "");

  return (
    <div>
      {hayFiltrosActivos && (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs text-gray-400">{filtradas.length} de {parcelas.length} parcelas</span>
          <button
            onClick={() => setFiltros({ codigo: "", predio: "", nombre: "", usoActual: "", estado: "" })}
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
                  <span>Nombre</span>
                  <select className="input" value={filtros.nombre} onChange={(e) => setFiltro("nombre", e.target.value)}>
                    <option value="">Todos</option>
                    {opciones.nombre.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Área</th>
              <th className="text-left px-4 py-2 font-medium text-gray-500">
                <div className="space-y-1">
                  <span>Uso actual</span>
                  <select className="input" value={filtros.usoActual} onChange={(e) => setFiltro("usoActual", e.target.value)}>
                    <option value="">Todos</option>
                    {opciones.usoActual.map((v) => <option key={v} value={v}>{v}</option>)}
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
              {puedeEditar && <th className="text-left px-4 py-3 font-medium text-gray-500">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtradas.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-700">{p.codigoParcela}</td>
                <td className="px-4 py-3 text-gray-600">{nombrePredio(p.predioId)}</td>
                <td className="px-4 py-3 text-gray-600">{p.nombre ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{p.areaHa} ha</td>
                <td className="px-4 py-3 text-gray-600">{p.usoActual ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${p.activo ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                    {estadoTexto(p)}
                  </span>
                </td>
                {puedeEditar && (
                  <td className="px-4 py-3">
                    <EditarParcelaBtn parcela={p} />
                  </td>
                )}
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={puedeEditar ? 7 : 6} className="px-4 py-12 text-center text-gray-400">
                  Sin parcelas que coincidan con los filtros
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
