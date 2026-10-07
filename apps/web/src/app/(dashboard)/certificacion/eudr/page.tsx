export const dynamic = "force-dynamic";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface ParcelaItem {
  id: string;
  predioId: string;
  codigoParcela: string;
  nombre: string | null;
}

interface PredioItem {
  id: string;
  nombrePredio: string;
  codigoPredio: string;
}

interface EudrEstadoParcela {
  tienePoligono: boolean;
  declaracionEstado: "BORRADOR" | "FIRMADA" | "ANCLADA_BLOCKCHAIN" | "RECHAZADA" | null;
  cumpleUmbral: boolean;
}

const ESTADO_LABEL: Record<string, { label: string; color: string }> = {
  ANCLADA_BLOCKCHAIN: { label: "Anclada en blockchain", color: "bg-emerald-100 text-emerald-700" },
  FIRMADA: { label: "Firmada", color: "bg-blue-100 text-blue-700" },
  BORRADOR: { label: "Borrador", color: "bg-amber-100 text-amber-700" },
  RECHAZADA: { label: "Rechazada", color: "bg-red-100 text-red-600" },
};

export default async function CertificacionEudrPage() {
  let parcelas: ParcelaItem[] = [];
  let predios: PredioItem[] = [];
  try {
    const [resParcelas, resPredios] = await Promise.all([
      apiFetch<{ parcelas: ParcelaItem[] }>("/api/parcelas"),
      apiFetch<{ predios: PredioItem[] }>("/api/predios"),
    ]);
    parcelas = resParcelas.parcelas;
    predios = resPredios.predios;
  } catch {
    // sin datos
  }

  const estados = await Promise.all(
    parcelas.map((p) =>
      apiFetch<{ estado: EudrEstadoParcela }>(`/api/eudr/parcelas/${p.id}/estado`)
        .then((r) => r.estado)
        .catch(() => null)
    )
  );
  const estadoPorParcela = new Map(parcelas.map((p, i) => [p.id, estados[i]]));

  const prediosConParcelas = predios
    .map((predio) => ({ predio, parcelasDelPredio: parcelas.filter((p) => p.predioId === predio.id) }))
    .filter((pc) => pc.parcelasDelPredio.length > 0);

  return (
    <div>
      <div className="mb-6">
        <Link href="/certificacion" className="text-sm text-gray-400 hover:text-verde-500">← Certificación</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Certificación EUDR</h1>
        <p className="text-sm text-gray-500 mt-1">
          Debida diligencia de deforestación-cero (Reglamento UE 2023/1115) — demuestra la tierra física
          (predio y parcela) georreferenciada, requisito para exportar a la Unión Europea
        </p>
      </div>

      {prediosConParcelas.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">Sin predios con parcelas registradas</div>
      ) : (
        <div className="space-y-6">
          {prediosConParcelas.map(({ predio, parcelasDelPredio }) => (
            <div key={predio.id} className="card">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-semibold text-gray-900">{predio.nombrePredio}</h2>
                  <p className="text-xs text-gray-400 font-mono">{predio.codigoPredio}</p>
                </div>
                <Link href={`/predios/${predio.id}`} className="text-xs text-verde-500 hover:text-verde-600 font-medium">
                  Ver predio →
                </Link>
              </div>

              <div className="divide-y divide-gray-50 border-t border-gray-100">
                {parcelasDelPredio.map((parcela) => {
                  const estado = estadoPorParcela.get(parcela.id);
                  const declLabel = estado?.declaracionEstado ? ESTADO_LABEL[estado.declaracionEstado] : null;
                  return (
                    <div key={parcela.id} className="py-3 flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-800">
                        {parcela.codigoParcela}{parcela.nombre ? ` — ${parcela.nombre}` : ""}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span className={`badge text-[10px] ${estado?.tienePoligono ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
                          {estado?.tienePoligono ? "Polígono ok" : "Sin polígono"}
                        </span>
                        <span className={`badge text-[10px] ${declLabel?.color ?? "bg-gray-100 text-gray-400"}`}>
                          {declLabel?.label ?? "Sin declaración"}
                        </span>
                        <span className={`badge text-[10px] ${estado?.cumpleUmbral ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>
                          {estado?.cumpleUmbral ? "Cumple" : "No cumple"}
                        </span>
                        <Link href={`/certificacion/eudr/${parcela.id}`} className="text-xs text-verde-500 hover:text-verde-600 font-medium">
                          Gestionar →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
