"use client";
import { useState } from "react";
import { RegistrarAporteTecnico } from "./RegistrarAporteTecnico";

interface PlantaCampana {
  id: string;
  codigoPlanta: string;
  numeroPlanta: number | null;
  registroId: string | null;
  consecutivo: number | null;
  estadoRegistro: string;
  camposFaltantes: string[];
  completo: boolean;
  yaTecnicoAporto: boolean;
}

const ESTADO_LABEL: Record<string, string> = {
  COMPLETO: "Completo",
  PARCIAL: "Parcial",
  PENDIENTE: "Pendiente",
  SIN_REGISTRO: "Sin datos",
  ADULTERADO: "Adulterado",
  INVALIDADO: "Invalidado",
};

const ESTADO_COLOR: Record<string, string> = {
  COMPLETO: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PARCIAL: "bg-amber-50 text-amber-700 border-amber-200",
  PENDIENTE: "bg-gray-100 text-gray-500 border-gray-200",
  SIN_REGISTRO: "bg-gray-100 text-gray-500 border-gray-200",
  ADULTERADO: "bg-red-100 text-red-700 border-red-300",
  INVALIDADO: "bg-purple-50 text-purple-600 border-purple-200",
};

interface Props {
  campanaId: string;
  tecnicoId: string;
  miPosicion: number | null;
  misCampos: string[];
  plantas: PlantaCampana[];
}

export function MisPlantasTecnico({ campanaId, tecnicoId, miPosicion, misCampos, plantas }: Props) {
  const [filtro, setFiltro] = useState<"PENDIENTES" | "COMPLETAS" | "TODAS">("PENDIENTES");
  const [plantaAbierta, setPlantaAbierta] = useState<string | null>(null);

  if (miPosicion === null) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        No tienes posición asignada en esta campaña. Contacta al administrador.
      </div>
    );
  }

  const pendientes = plantas.filter((p) => !p.yaTecnicoAporto && !p.completo);
  const completas  = plantas.filter((p) => p.yaTecnicoAporto || p.completo);
  const plantasFiltradas =
    filtro === "PENDIENTES" ? pendientes : filtro === "COMPLETAS" ? completas : plantas;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-gray-800">Mis plantas — Posición {miPosicion}</h2>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {misCampos.map((c) => (
              <span key={c} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">
                {c}
              </span>
            ))}
          </div>
        </div>
        <span className="text-xs text-gray-400">
          {completas.length}/{plantas.length} registradas
        </span>
      </div>

      {/* Filtros */}
      <div className="flex gap-1.5 mb-3">
        {(["PENDIENTES", "COMPLETAS", "TODAS"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              filtro === f
                ? "bg-verde-500 border-verde-500 text-white font-medium"
                : "bg-white border-gray-200 text-gray-500 hover:border-verde-300"
            }`}
          >
            {f === "PENDIENTES" ? `Pendientes (${pendientes.length})`
              : f === "COMPLETAS" ? `Completas (${completas.length})`
              : `Todas (${plantas.length})`}
          </button>
        ))}
      </div>

      {plantasFiltradas.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">
          {filtro === "PENDIENTES" ? "¡No tienes plantas pendientes!" : "Sin plantas en este filtro."}
        </p>
      ) : (
        <div className="space-y-2">
          {plantasFiltradas.map((planta) => {
            const bloqueada = planta.yaTecnicoAporto || planta.completo;
            const abierta = plantaAbierta === planta.id;
            return (
              <div key={planta.id} className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-gray-800">
                        {planta.codigoPlanta}
                      </span>
                      {planta.consecutivo != null && (
                        <span className="font-mono text-[10px] font-bold text-white bg-gray-500 px-1.5 py-0.5 rounded">
                          REG-{String(planta.consecutivo).padStart(3, "0")}
                        </span>
                      )}
                    </div>
                    <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ESTADO_COLOR[planta.estadoRegistro] ?? ESTADO_COLOR.SIN_REGISTRO}`}>
                      {ESTADO_LABEL[planta.estadoRegistro] ?? planta.estadoRegistro}
                    </span>
                  </div>

                  {bloqueada ? (
                    <span className="text-xs text-verde-600 font-medium flex-shrink-0">✓ Enviado</span>
                  ) : (
                    <button
                      onClick={() => setPlantaAbierta(abierta ? null : planta.id)}
                      className="text-xs bg-verde-500 hover:bg-verde-600 text-white font-semibold rounded-lg px-3 py-1.5 transition-colors flex-shrink-0"
                    >
                      {abierta ? "Cerrar" : "Registrar aporte"}
                    </button>
                  )}
                </div>

                {abierta && !bloqueada && (
                  <div className="mt-3">
                    <RegistrarAporteTecnico
                      campanaId={campanaId}
                      plantaId={planta.id}
                      codigoPlanta={planta.codigoPlanta}
                      tecnicoId={tecnicoId}
                      posicion={miPosicion}
                      camposAsignados={misCampos}
                      siempreAbierto
                      onGuardado={() => setPlantaAbierta(null)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
