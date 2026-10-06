export const dynamic = "force-dynamic";
import { apiFetch } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { NuevoPredioForm } from "./NuevoPredioForm";
import { PrediosTabla } from "./PrediosTabla";

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

export default async function PrediosPage() {
  const session = await getSession();
  let predios: PredioItem[] = [];
  let error: string | null = null;

  try {
    const data = await apiFetch<{ predios: PredioItem[] }>("/api/predios");
    predios = data.predios;
  } catch (err) {
    error = String(err);
  }

  const puedeCrear = session?.rol === "ADMIN" || session?.rol === "AGRICULTOR";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Predios</h1>
          <p className="text-sm text-gray-500 mt-1">{predios.length} predio(s) registrados</p>
        </div>
        {puedeCrear && session && <NuevoPredioForm rol={session.rol} userId={session.id} />}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm mb-6">
          {error}
        </div>
      )}

      <PrediosTabla predios={predios} esAdmin={session?.rol === "ADMIN"} />
    </div>
  );
}
