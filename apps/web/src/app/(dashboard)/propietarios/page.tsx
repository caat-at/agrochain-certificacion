export const dynamic = "force-dynamic";
import { apiFetch } from "@/lib/api";
import { formatFecha } from "@/lib/utils";
import { getSession } from "@/lib/auth";
import { NuevoPropietarioForm } from "./NuevoPropietarioForm";
import { EditarPropietarioBtn } from "./EditarPropietarioBtn";

interface PropietarioItem {
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

export default async function PropietariosPage() {
  const session = await getSession();
  let propietarios: PropietarioItem[] = [];
  let error: string | null = null;

  try {
    const data = await apiFetch<{ propietarios: PropietarioItem[] }>("/api/propietarios");
    propietarios = data.propietarios;
  } catch (err) {
    error = String(err);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Propietarios</h1>
          <p className="text-sm text-gray-500 mt-1">
            {propietarios.length} propietario(s) registrados — dueños legales de predios, sin cuenta de acceso al sistema
          </p>
        </div>
        {session?.rol === "ADMIN" && <NuevoPropietarioForm />}
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
              <th className="text-left px-4 py-3 font-medium text-gray-500">Nombre</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Documento</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Teléfono</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Estado</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Registrado</th>
              {session?.rol === "ADMIN" && (
                <th className="text-left px-4 py-3 font-medium text-gray-500">Acciones</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {propietarios.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {p.nombres} {p.apellidos}
                </td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                  {p.tipoDocumento} {p.numeroDocumento}
                </td>
                <td className="px-4 py-3 text-gray-500">{p.telefono ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500">{p.email ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${p.activo ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                    {p.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {formatFecha(p.createdAt)}
                </td>
                {session?.rol === "ADMIN" && (
                  <td className="px-4 py-3">
                    <EditarPropietarioBtn propietario={p} />
                  </td>
                )}
              </tr>
            ))}
            {propietarios.length === 0 && !error && (
              <tr>
                <td colSpan={session?.rol === "ADMIN" ? 7 : 6} className="px-4 py-12 text-center text-gray-400">
                  Sin propietarios registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
