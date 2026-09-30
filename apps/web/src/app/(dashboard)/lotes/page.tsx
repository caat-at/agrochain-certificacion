export const dynamic = "force-dynamic";
import { apiFetch } from "@/lib/api";
import { LoteResumen } from "@/types";
import { getSession } from "@/lib/auth";
import { NuevoLoteForm } from "./NuevoLoteForm";
import { LotesTabla } from "./LotesTabla";

export default async function LotesPage() {
  const session = await getSession();
  let lotes: LoteResumen[] = [];
  let errorMsg: string | null = null;

  try {
    const data = await apiFetch<{ lotes: LoteResumen[] }>("/api/lotes");
    lotes = data.lotes;
  } catch (err) {
    errorMsg = String(err);
  }

  const puedeCrear = session?.rol === "ADMIN" || session?.rol === "AGRICULTOR";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lotes agrícolas</h1>
          <p className="text-sm text-gray-500 mt-1">{lotes.length} lote(s) registrados</p>
        </div>
        {puedeCrear && <NuevoLoteForm />}
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm mb-6">
          Error cargando lotes: {errorMsg}
        </div>
      )}

      {lotes.length === 0 && !errorMsg ? (
        <div className="card text-center py-16">
          <svg className="w-14 h-14 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2m0 6v6m0 4h.01" />
          </svg>
          <p className="text-gray-500 font-medium">No hay lotes registrados</p>
          <p className="text-sm text-gray-400 mt-1">Crea uno desde el botón "Nuevo lote" o desde la app móvil del agricultor</p>
        </div>
      ) : (
        <LotesTabla lotes={lotes} puedeEditar={puedeCrear} />
      )}
    </div>
  );
}
