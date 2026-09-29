export const dynamic = "force-dynamic";
import { apiFetch } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { NuevaParcelaForm } from "./NuevaParcelaForm";
import { EditarParcelaBtn } from "./EditarParcelaBtn";

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

  const nombrePredio = (predioId: string) =>
    predios.find((p) => p.id === predioId)?.nombrePredio ?? "—";

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

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-500">Código</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Predio</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Nombre</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Área</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Uso actual</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Estado</th>
              {puedeCrear && (
                <th className="text-left px-4 py-3 font-medium text-gray-500">Acciones</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {parcelas.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-700">{p.codigoParcela}</td>
                <td className="px-4 py-3 text-gray-600">{nombrePredio(p.predioId)}</td>
                <td className="px-4 py-3 text-gray-600">{p.nombre ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{p.areaHa} ha</td>
                <td className="px-4 py-3 text-gray-600">{p.usoActual ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${p.activo ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                    {p.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                {puedeCrear && (
                  <td className="px-4 py-3">
                    <EditarParcelaBtn parcela={p} />
                  </td>
                )}
              </tr>
            ))}
            {parcelas.length === 0 && !error && (
              <tr>
                <td colSpan={puedeCrear ? 7 : 6} className="px-4 py-12 text-center text-gray-400">
                  Sin parcelas registradas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
