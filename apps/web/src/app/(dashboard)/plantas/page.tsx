export const dynamic = "force-dynamic";
import { apiFetch } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { NuevaPlantaForm } from "./NuevaPlantaForm";
import { PlantasTabla } from "./PlantasTabla";

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

export default async function PlantasPage() {
  const session = await getSession();
  let parcelas: ParcelaItem[] = [];
  let plantas: PlantaItem[] = [];
  let error: string | null = null;

  try {
    const dataParcelas = await apiFetch<{ parcelas: ParcelaItem[] }>("/api/parcelas");
    parcelas = dataParcelas.parcelas;
    const porParcela = await Promise.all(
      parcelas.map((p) => apiFetch<{ plantas: PlantaItem[] }>(`/api/plantas?parcelaId=${p.id}`))
    );
    plantas = porParcela.flatMap((r) => r.plantas);
  } catch (err) {
    error = String(err);
  }

  const puedeCrear = session?.rol === "ADMIN" || session?.rol === "AGRICULTOR";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plantas</h1>
          <p className="text-sm text-gray-500 mt-1">
            {plantas.length} planta(s) — viven en la parcela, se vinculan a cada lote/cosecha
          </p>
        </div>
        {puedeCrear && <NuevaPlantaForm />}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm mb-6">
          {error}
        </div>
      )}

      <PlantasTabla plantas={plantas} parcelas={parcelas} puedeEditar={puedeCrear} />
    </div>
  );
}
