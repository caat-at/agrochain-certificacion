export const dynamic = "force-dynamic";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { NuevoPredioForm } from "./NuevoPredioForm";
import { EditarPredioBtn } from "./EditarPredioBtn";

interface PredioItem {
  id: string;
  nombrePredio: string;
  codigoPredio: string;
  codigoIca: string | null;
  propietarioId: string | null;
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

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-500">Código</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Predio</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Propietario</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Ubicación</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Área total</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Lotes</th>
              {session?.rol === "ADMIN" && (
                <th className="text-left px-4 py-3 font-medium text-gray-500">Acciones</th>
              )}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {predios.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-700">{p.codigoPredio}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{p.nombrePredio}</td>
                <td className="px-4 py-3 text-gray-600">
                  {p.propietario ? `${p.propietario.nombres} ${p.propietario.apellidos}` : "—"}
                  {p.agricultor && (
                    <p className="text-[11px] text-gray-400">Operador: {p.agricultor.nombres} {p.agricultor.apellidos}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {p.municipioNombre ?? p.municipio}, {p.departamentoNombre ?? p.departamento}
                  {p.vereda ? ` · ${p.vereda}` : ""}
                </td>
                <td className="px-4 py-3 text-gray-600">{p.areaTotalHa} ha</td>
                <td className="px-4 py-3 text-gray-600">{p.totalLotes}</td>
                {session?.rol === "ADMIN" && (
                  <td className="px-4 py-3">
                    <EditarPredioBtn predio={p} />
                  </td>
                )}
                <td className="px-4 py-3 text-right">
                  <Link href={`/predios/${p.id}`} className="text-xs text-verde-500 hover:text-verde-600 font-medium">
                    Ver detalle →
                  </Link>
                </td>
              </tr>
            ))}
            {predios.length === 0 && !error && (
              <tr>
                <td colSpan={session?.rol === "ADMIN" ? 8 : 7} className="px-4 py-12 text-center text-gray-400">
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
