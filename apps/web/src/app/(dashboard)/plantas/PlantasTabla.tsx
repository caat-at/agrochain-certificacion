"use client";
import { useState, useMemo } from "react";
import { EditarPlantaBtn } from "./EditarPlantaBtn";

interface PlantaItem {
  id: string;
  parcelaId: string;
  codigoPlanta: string;
  numeroPlanta: string;
  especie: string | null;
  variedad: string | null;
  origenMaterial: string | null;
  procedenciaVivero: string | null;
  fechaSiembra: string | null;
  alturaCmInicial: number | null;
  diametroTalloCmInicial: number | null;
  numHojasInicial: number | null;
  estadoFenologicoInicial: string | null;
  activo: boolean;
}

interface ParcelaItem {
  id: string;
  codigoParcela: string;
  nombre: string | null;
}

type Campo = "codigo" | "numero" | "parcela" | "especie" | "estado";

function valoresUnicos(valores: (string | null | undefined)[]): string[] {
  return [...new Set(valores.filter((v): v is string => Boolean(v)))].sort();
}

export function PlantasTabla({ plantas, parcelas, puedeEditar }: { plantas: PlantaItem[]; parcelas: ParcelaItem[]; puedeEditar: boolean }) {
  const parcela = (parcelaId: string) => parcelas.find((p) => p.id === parcelaId);
  const nombreParcela = (pl: PlantaItem) => {
    const par = parcela(pl.parcelaId);
    return par ? `${par.codigoParcela}${par.nombre ? ` — ${par.nombre}` : ""}` : "—";
  };
  const estadoTexto = (pl: PlantaItem) => (pl.activo ? "Activa" : "Inactiva");

  const [filtros, setFiltros] = useState<Record<Campo, string>>({
    codigo: "", numero: "", parcela: "", especie: "", estado: "",
  });

  function setFiltro(campo: Campo, valor: string) {
    setFiltros((prev) => ({ ...prev, [campo]: valor }));
  }

  const opciones = useMemo(() => ({
    codigo: valoresUnicos(plantas.map((p) => p.codigoPlanta)),
    numero: valoresUnicos(plantas.map((p) => p.numeroPlanta)),
    parcela: valoresUnicos(plantas.map(nombreParcela)),
    especie: valoresUnicos(plantas.map((p) => p.especie)),
    estado: valoresUnicos(plantas.map(estadoTexto)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [plantas, parcelas]);

  const filtradas = useMemo(() => {
    return plantas.filter((pl) => {
      if (filtros.codigo && pl.codigoPlanta !== filtros.codigo) return false;
      if (filtros.numero && pl.numeroPlanta !== filtros.numero) return false;
      if (filtros.parcela && nombreParcela(pl) !== filtros.parcela) return false;
      if (filtros.especie && pl.especie !== filtros.especie) return false;
      if (filtros.estado && estadoTexto(pl) !== filtros.estado) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantas, filtros]);

  const hayFiltrosActivos = Object.values(filtros).some((v) => v !== "");

  return (
    <div>
      {hayFiltrosActivos && (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs text-gray-400">{filtradas.length} de {plantas.length} plantas</span>
          <button
            onClick={() => setFiltros({ codigo: "", numero: "", parcela: "", especie: "", estado: "" })}
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
                  <span>N° planta</span>
                  <select className="input" value={filtros.numero} onChange={(e) => setFiltro("numero", e.target.value)}>
                    <option value="">Todos</option>
                    {opciones.numero.map((v) => <option key={v} value={v}>{v}</option>)}
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
              {puedeEditar && <th className="text-left px-4 py-3 font-medium text-gray-500">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtradas.map((pl) => (
              <tr key={pl.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-700">{pl.codigoPlanta}</td>
                <td className="px-4 py-3 text-gray-600">{pl.numeroPlanta}</td>
                <td className="px-4 py-3 text-gray-600">{nombreParcela(pl)}</td>
                <td className="px-4 py-3">
                  <span className="text-gray-800">{pl.especie ?? "—"}</span>
                  {pl.variedad && <span className="text-gray-400 text-xs ml-1">· {pl.variedad}</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`badge ${pl.activo ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                    {estadoTexto(pl)}
                  </span>
                </td>
                {puedeEditar && (
                  <td className="px-4 py-3">
                    <EditarPlantaBtn planta={pl} />
                  </td>
                )}
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={puedeEditar ? 6 : 5} className="px-4 py-12 text-center text-gray-400">
                  Sin plantas que coincidan con los filtros
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
