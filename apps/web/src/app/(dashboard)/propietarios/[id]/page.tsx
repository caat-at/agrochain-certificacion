export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface PropietarioDetalle {
  id: string;
  nombres: string;
  apellidos: string;
  tipoDocumento: string;
  numeroDocumento: string;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  activo: boolean;
  createdAt: string;
}

interface PredioPropietario {
  id: string;
  nombrePredio: string;
  codigoPredio: string;
  municipioNombre: string | null;
  departamentoNombre: string | null;
  areaTotalHa: number;
  totalParcelas: number;
  activo: boolean;
}

export default async function PropietarioDetallePage({ params }: { params: { id: string } }) {
  const { id } = params;

  let propietario: PropietarioDetalle;
  let predios: PredioPropietario[] = [];
  try {
    const [resPropietario, resPredios] = await Promise.all([
      apiFetch<{ success: boolean; data: PropietarioDetalle }>(`/api/propietarios/${id}`),
      apiFetch<{ predios: PredioPropietario[] }>(`/api/predios?propietarioId=${id}`),
    ]);
    if (!resPropietario.success) notFound();
    propietario = resPropietario.data;
    predios = resPredios.predios;
  } catch {
    notFound();
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link href="/propietarios" className="text-sm text-gray-400 hover:text-verde-500">
          ← Propietarios
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">
          {propietario.nombres} {propietario.apellidos}
        </h1>
        <p className="text-gray-500 mt-1">
          {propietario.tipoDocumento} {propietario.numeroDocumento}
        </p>
      </div>

      <div className="space-y-6">
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4">Datos de contacto</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <InfoItem label="Teléfono" value={propietario.telefono ?? "—"} />
            <InfoItem label="Email" value={propietario.email ?? "—"} />
            <InfoItem label="Dirección" value={propietario.direccion ?? "—"} />
            <InfoItem label="Estado" value={propietario.activo ? "Activo" : "Inactivo"} />
          </dl>
        </div>

        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4">
            Predios
            <span className="ml-2 text-xs font-normal text-gray-400">({predios.length})</span>
          </h2>
          {predios.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin predios registrados para este propietario</p>
          ) : (
            <div className="space-y-2">
              {predios.map((p) => (
                <Link key={p.id} href={`/predios/${p.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{p.nombrePredio}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {p.codigoPredio} · {p.municipioNombre ?? "—"}, {p.departamentoNombre ?? "—"} · {p.areaTotalHa} ha
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="badge bg-gray-100 text-gray-600 text-xs">{p.totalParcelas} parcela(s)</span>
                      <span className={`badge text-xs ${p.activo ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                        {p.activo ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-gray-400 text-xs">{label}</dt>
      <dd className="text-gray-800 font-medium text-sm mt-0.5">{value}</dd>
    </div>
  );
}
