"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { EditarPredioBtn } from "./EditarPredioBtn";

interface PredioItem {
  id: string;
  nombrePredio: string;
  codigoPredio: string;
  codigoIca: string | null;
  propietarioId: string | null;
  agricultorId: string | null;
  matriculaInmobiliaria: string | null;
  departamento: string;
  municipio: string;
  departamentoCod: string | null;
  municipioCod: string | null;
  departamentoNombre: string | null;
  municipioNombre: string | null;
  vereda: string | null;
  direccion: string | null;
  latitud: number;
  longitud: number;
  altitudMsnm: number | null;
  areaTotalHa: number;
  areaProductivaHa: number | null;
  activo: boolean;
  totalLotes: number;
  agricultor: { nombres: string; apellidos: string } | null;
  propietario: { nombres: string; apellidos: string; numeroDocumento: string } | null;
}

type Campo = "codigo" | "predio" | "propietario" | "ubicacion";

function valoresUnicos(valores: (string | null | undefined)[]): string[] {
  return [...new Set(valores.filter((v): v is string => Boolean(v)))].sort();
}

export function PrediosTabla({ predios, esAdmin }: { predios: PredioItem[]; esAdmin: boolean }) {
  const nombrePropietario = (p: PredioItem) =>
    p.propietario ? `${p.propietario.nombres} ${p.propietario.apellidos}` : "—";
  const ubicacionTexto = (p: PredioItem) =>
    `${p.municipioNombre ?? p.municipio}, ${p.departamentoNombre ?? p.departamento}`;

  const [filtros, setFiltros] = useState<Record<Campo, string>>({
    codigo: "", predio: "", propietario: "", ubicacion: "",
  });

  function setFiltro(campo: Campo, valor: string) {
    setFiltros((prev) => ({ ...prev, [campo]: valor }));
  }

  const opciones = useMemo(() => ({
    codigo: valoresUnicos(predios.map((p) => p.codigoPredio)),
    predio: valoresUnicos(predios.map((p) => p.nombrePredio)),
    propietario: valoresUnicos(predios.map(nombrePropietario)),
    ubicacion: valoresUnicos(predios.map(ubicacionTexto)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [predios]);

  const filtrados = useMemo(() => {
    return predios.filter((p) => {
      if (filtros.codigo && p.codigoPredio !== filtros.codigo) return false;
      if (filtros.predio && p.nombrePredio !== filtros.predio) return false;
      if (filtros.propietario && nombrePropietario(p) !== filtros.propietario) return false;
      if (filtros.ubicacion && ubicacionTexto(p) !== filtros.ubicacion) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [predios, filtros]);

  const hayFiltrosActivos = Object.values(filtros).some((v) => v !== "");

  return (
    <div>
      {hayFiltrosActivos && (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs text-gray-400">{filtrados.length} de {predios.length} predios</span>
          <button
            onClick={() => setFiltros({ codigo: "", predio: "", propietario: "", ubicacion: "" })}
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
                  <span>Propietario</span>
                  <select className="input" value={filtros.propietario} onChange={(e) => setFiltro("propietario", e.target.value)}>
                    <option value="">Todos</option>
                    {opciones.propietario.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </th>
              <th className="text-left px-4 py-2 font-medium text-gray-500">
                <div className="space-y-1">
                  <span>Ubicación</span>
                  <select className="input" value={filtros.ubicacion} onChange={(e) => setFiltro("ubicacion", e.target.value)}>
                    <option value="">Todas</option>
                    {opciones.ubicacion.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Área total</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Lotes</th>
              {esAdmin && <th className="text-left px-4 py-3 font-medium text-gray-500">Acciones</th>}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtrados.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-700">{p.codigoPredio}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{p.nombrePredio}</td>
                <td className="px-4 py-3 text-gray-600">
                  {p.propietario ? `${p.propietario.nombres} ${p.propietario.apellidos}` : "—"}
                  {p.agricultor && (
                    <p className="text-[11px] text-gray-400">Operador: {p.agricultor.nombres} {p.agricultor.apellidos}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {p.municipioNombre ?? p.municipio}, {p.departamentoNombre ?? p.departamento}
                  {p.vereda ? ` · ${p.vereda}` : ""}
                </td>
                <td className="px-4 py-3 text-gray-600">{p.areaTotalHa} ha</td>
                <td className="px-4 py-3 text-gray-600">{p.totalLotes}</td>
                {esAdmin && (
                  <td className="px-4 py-3">
                    <EditarPredioBtn predio={p} />
                  </td>
                )}
                <td className="px-4 py-3 text-right">
                  <Link href={`/predios/${p.id}`} className="text-xs text-verde-500 hover:text-verde-600 font-medium">
                    Ver detalle →
                  </Link>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={esAdmin ? 8 : 7} className="px-4 py-12 text-center text-gray-400">
                  Sin predios que coincidan con los filtros
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
