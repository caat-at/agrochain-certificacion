export const dynamic = "force-dynamic";
import { apiFetch } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { NuevaParcelaForm } from "./NuevaParcelaForm";
import { ParcelasTabla } from "./ParcelasTabla";

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

export default async function ParcelasPage() {
  const session = await getSession();
  let parcelas: ParcelaItem[] = [];
  let predios: PredioItem[] = [];
  let error: string | null = null;

  try {
    const [dataParcelas, dataPredios] = await Promise.all([
      apiFetch<{ parcelas: ParcelaItem[] }>("/api/parcelas"),
      apiFetch<{ predios: PredioItem[] }>("/api/predios"),
    ]);
    parcelas = dataParcelas.parcelas;
    predios = dataPredios.predios;
  } catch (err) {
    error = String(err);
  }

  const puedeCrear = session?.rol === "ADMIN" || session?.rol === "AGRICULTOR";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parcelas</h1>
          <p className="text-sm text-gray-500 mt-1">
            {parcelas.length} parcela(s) — subdivisiones físicas permanentes de los predios
          </p>
        </div>
        {puedeCrear && <NuevaParcelaForm />}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm mb-6">
          {error}
        </div>
      )}

      <ParcelasTabla parcelas={parcelas} predios={predios} puedeEditar={puedeCrear} />
    </div>
  );
}
