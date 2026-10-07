export const dynamic = "force-dynamic";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface PredioItem {
  id: string;
  nombrePredio: string;
  codigoPredio: string;
  municipioNombre: string | null;
  departamentoNombre: string | null;
}

export default async function CertificacionStbnPage() {
  let predios: PredioItem[] = [];
  try {
    const data = await apiFetch<{ predios: PredioItem[] }>("/api/predios");
    predios = data.predios;
  } catch {
    // sin datos
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/certificacion" className="text-sm text-gray-400 hover:text-verde-500">← Certificación</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Certificación STBN</h1>
        <p className="text-sm text-gray-500 mt-1">Elige un predio para ver su evidencia, evaluación y puntaje STBN</p>
      </div>

      {predios.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">Sin predios registrados</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Predio</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Código</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Ubicación</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {predios.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.nombrePredio}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.codigoPredio}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {p.municipioNombre ?? "—"}, {p.departamentoNombre ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/predios/${p.id}/stbn`} className="text-xs text-verde-500 hover:text-verde-600 font-medium">
                      Ver STBN →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
