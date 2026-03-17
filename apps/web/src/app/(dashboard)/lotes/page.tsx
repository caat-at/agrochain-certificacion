export const dynamic = "force-dynamic";
import { apiFetch } from "@/lib/api";
import { LoteResumen } from "@/types";
import { estadoColor, estadoLabel, formatFecha } from "@/lib/utils";
import Link from "next/link";
import { DescargarPdfBtn } from "./[id]/DescargarPdfBtn";

export default async function LotesPage() {
  let lotes: LoteResumen[] = [];
  let errorMsg: string | null = null;

  try {
    const data = await apiFetch<{ lotes: LoteResumen[] }>("/api/lotes");
    lotes = data.lotes;
  } catch (err) {
    errorMsg = String(err);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lotes agrícolas</h1>
          <p className="text-sm text-gray-500 mt-1">{lotes.length} lote(s) registrados</p>
        </div>
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
          <p className="text-sm text-gray-400 mt-1">Los lotes se crean desde la app móvil del agricultor</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Código</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Predio</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Especie / Variedad</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Integridad</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Informe</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lotes.map((lote) => (
                <tr key={lote.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-gray-800">
                      {lote.codigoLote}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{lote.predioNombre}</td>
                  <td className="px-4 py-3">
                    <span className="text-gray-800">{lote.especie}</span>
                    {lote.variedad && (
                      <span className="text-gray-400 text-xs ml-1">· {lote.variedad}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${estadoColor(lote.estadoLote)}`}>
                      {estadoLabel(lote.estadoLote)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {lote.dataHash ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.707-9.293a1 1 0 0 0-1.414-1.414L9 10.586 7.707 9.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4z"/>
                        </svg>
                        Hash registrado
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Sin hash</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <DescargarPdfBtn
                      loteId={lote.id}
                      codigoLote={lote.codigoLote}
                      compact
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/lotes/${lote.id}`}
                      className="text-xs text-verde-500 hover:text-verde-600 font-medium"
                    >
                      Ver detalle →
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
