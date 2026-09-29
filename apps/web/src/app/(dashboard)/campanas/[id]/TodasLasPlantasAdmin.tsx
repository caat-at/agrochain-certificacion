"use client";
import { useState } from "react";
import { MisPlantasTecnico } from "./MisPlantasTecnico";

interface PosicionAdmin {
  posicion: number;
  tecnicoId: string;
  tecnicoNombre: string;
  camposAsignados: string[];
  camposFaltantes: string[];
  yaAporto: boolean;
}

interface PlantaCampana {
  id: string;
  codigoPlanta: string;
  numeroPlanta: number | null;
  registroId: string | null;
  consecutivo: number | null;
  estadoRegistro: string;
  completo: boolean;
  posicionesAdmin?: PosicionAdmin[];
}

interface Posicion {
  posicion: number;
  tecnicoId: string;
  tecnicoNombre: string;
  camposAsignados: string[];
}

interface Props {
  campanaId: string;
  posiciones: Posicion[];
  plantas: PlantaCampana[];
}

export function TodasLasPlantasAdmin({ campanaId, posiciones, plantas }: Props) {
  const [posicionElegida, setPosicionElegida] = useState<number | null>(posiciones[0]?.posicion ?? null);

  if (posiciones.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        Esta campaña no tiene técnicos asignados todavía.
      </div>
    );
  }

  const posicion = posiciones.find((p) => p.posicion === posicionElegida) ?? posiciones[0];

  // Traducir posicionesAdmin -> shape que espera MisPlantasTecnico, para la posición elegida
  const plantasPosicion = plantas.map((planta) => {
    const datosPos = planta.posicionesAdmin?.find((pa) => pa.posicion === posicion.posicion);
    return {
      id: planta.id,
      codigoPlanta: planta.codigoPlanta,
      numeroPlanta: planta.numeroPlanta,
      registroId: planta.registroId,
      consecutivo: planta.consecutivo,
      estadoRegistro: planta.estadoRegistro,
      camposFaltantes: datosPos?.camposFaltantes ?? [],
      completo: planta.completo,
      yaTecnicoAporto: datosPos?.yaAporto ?? false,
    };
  });

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-gray-800">Registrar aportes — modo administrador</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Elige la posición en nombre de la cual quieres registrar.
          </p>
        </div>
      </div>

      {/* Selector de posición */}
      <div className="flex gap-1.5 mb-4">
        {posiciones.map((p) => (
          <button
            key={p.posicion}
            onClick={() => setPosicionElegida(p.posicion)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              posicion.posicion === p.posicion
                ? "bg-verde-500 border-verde-500 text-white font-medium"
                : "bg-white border-gray-200 text-gray-600 hover:border-verde-300"
            }`}
          >
            P{p.posicion} · {p.tecnicoNombre || "Sin asignar"}
          </button>
        ))}
      </div>

      <MisPlantasTecnico
        campanaId={campanaId}
        tecnicoId={posicion.tecnicoId}
        miPosicion={posicion.posicion}
        misCampos={posicion.camposAsignados}
        plantas={plantasPosicion}
        modoAdmin
      />
    </div>
  );
}
