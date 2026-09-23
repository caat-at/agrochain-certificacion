export const dynamic = "force-dynamic";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface PredioItem {
  id: string;
  nombrePredio: string;
  departamento: string;
  municipio: string;
  vereda: string | null;
  areaTotalHa: number;
  totalLotes: number;
  agricultor: { nombres: string; apellidos: string };
}

export default async function PrediosPage() {
  let predios: PredioItem[] = [];
  let error: string | null = null;

  try {
    const data = await apiFetch<{ predios: PredioItem[] }>("/api/predios");
    predios = data.predios;
  } catch (err) {
    error = String(err);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Predios</h1>
        <p className="text-sm text-gray-500 mt-1">{predios.length} predio(s) registrados</p>
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
              <th className="text-left px-4 py-3 font-medium text-gray-500">Predio</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Propietario</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Ubicación</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Área total</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Lotes</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {predios.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{p.nombrePredio}</td>
                <td className="px-4 py-3 text-gray-600">{p.agricultor.nombres} {p.agricultor.apellidos}</td>
                <td className="px-4 py-3 text-gray-500">
                  {p.municipio}, {p.departamento}
                  {p.vereda ? ` · ${p.vereda}` : ""}
                </td>
                <td className="px-4 py-3 text-gray-600">{p.areaTotalHa} ha</td>
                <td className="px-4 py-3 text-gray-600">{p.totalLotes}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/predios/${p.id}`} className="text-xs text-verde-500 hover:text-verde-600 font-medium">
                    Ver detalle →
                  </Link>
                </td>
              </tr>
            ))}
            {predios.length === 0 && !error && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                  Sin predios registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
