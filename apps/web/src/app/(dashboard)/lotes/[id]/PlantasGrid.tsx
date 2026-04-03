"use client";
import { useState } from "react";
import { formatFecha } from "@/lib/utils";

export interface PlantaLote {
  id: string;
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
  latitud: number | null;
  longitud: number | null;
  altitudMsnm: number | null;
}

function Fila({ label, valor }: { label: string; valor: string | number | null | undefined }) {
  if (valor === null || valor === undefined || valor === "") return null;
  return (
    <div className="flex justify-between py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-xs font-medium text-gray-700 text-right max-w-[60%]">{String(valor)}</span>
    </div>
  );
}

export function PlantasGrid({ plantas }: { plantas: PlantaLote[] }) {
  const [seleccionada, setSeleccionada] = useState<PlantaLote | null>(null);

  if (plantas.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-6">Sin plantas registradas</p>;
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {plantas.map((p) => (
          <button
            key={p.id}
            onClick={() => setSeleccionada(p)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100 hover:bg-green-50 hover:border-green-200 transition-colors text-left w-full"
          >
            <span className="w-6 h-6 rounded-full bg-verde-50 text-verde-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
              {p.numeroPlanta}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-700 truncate">{p.codigoPlanta}</p>
              {p.fechaSiembra && (
                <p className="text-[10px] text-gray-400">{formatFecha(p.fechaSiembra)}</p>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Modal detalle planta */}
      {seleccionada && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setSeleccionada(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-verde-500 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-white font-bold text-sm">{seleccionada.codigoPlanta}</p>
                <p className="text-verde-100 text-xs">Planta N° {seleccionada.numeroPlanta}</p>
              </div>
              <button
                onClick={() => setSeleccionada(null)}
                className="text-white/70 hover:text-white text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {/* Datos */}
            <div className="px-4 py-3 space-y-0 max-h-[70vh] overflow-y-auto">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Identificación</p>
              <Fila label="Especie" valor={seleccionada.especie} />
              <Fila label="Variedad" valor={seleccionada.variedad} />
              <Fila label="Origen material" valor={seleccionada.origenMaterial?.replace(/_/g, " ")} />
              <Fila label="Procedencia / vivero" valor={seleccionada.procedenciaVivero} />
              <Fila label="Fecha siembra" valor={seleccionada.fechaSiembra ? formatFecha(seleccionada.fechaSiembra) : null} />

              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2 mt-4">Datos iniciales — NTC 5400 §4.3</p>
              <Fila label="Altura inicial" valor={seleccionada.alturaCmInicial != null ? `${seleccionada.alturaCmInicial} cm` : null} />
              <Fila label="Diámetro de tallo" valor={seleccionada.diametroTalloCmInicial != null ? `${seleccionada.diametroTalloCmInicial} cm` : null} />
              <Fila label="N° hojas" valor={seleccionada.numHojasInicial} />
              <Fila label="Estado fenológico" valor={seleccionada.estadoFenologicoInicial} />

              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2 mt-4">Ubicación GPS</p>
              <Fila
                label="Coordenadas"
                valor={seleccionada.latitud != null && seleccionada.longitud != null
                  ? `${seleccionada.latitud.toFixed(6)}, ${seleccionada.longitud.toFixed(6)}`
                  : null}
              />
              <Fila label="Altitud" valor={seleccionada.altitudMsnm != null ? `${seleccionada.altitudMsnm.toFixed(0)} msnm` : null} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
