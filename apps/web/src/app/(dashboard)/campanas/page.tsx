export const dynamic = "force-dynamic";
import { apiFetch } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { NuevaCampanaForm } from "./NuevaCampanaForm";
import { CampanasLista } from "./CampanasLista";

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
  camposRequeridos: string[];
  _count: { registros: number };
  tecnicos?: Array<{ posicion: number }>;
}

export default async function CampanasPage() {
  const session = await getSession();
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
        <CampanasLista campanas={campanas} esAdmin={session?.rol === "ADMIN"} />
      )}
    </div>
  );
}
