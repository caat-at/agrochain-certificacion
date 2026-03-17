export const dynamic = "force-dynamic";
import { apiFetch } from "@/lib/api";
import { formatFecha } from "@/lib/utils";
import { getSession } from "@/lib/auth";
import { NuevoUsuarioForm } from "./NuevoUsuarioForm";

interface UsuarioItem {
  id: string;
  nombres: string;
  apellidos: string;
  email: string | null;
  rol: string;
  activo: boolean;
  createdAt: string;
}

const ROL_BADGE: Record<string, string> = {
  ADMIN:          "bg-red-100 text-red-700",
  AGRICULTOR:     "bg-green-100 text-green-700",
  INSPECTOR_ICA:  "bg-blue-100 text-blue-700",
  INSPECTOR_BPA:  "bg-purple-100 text-purple-700",
  CERTIFICADORA:  "bg-amber-100 text-amber-700",
  INVIMA:         "bg-orange-100 text-orange-700",
};

export default async function UsuariosPage() {
  const session = await getSession();
  let usuarios: UsuarioItem[] = [];
  let error: string | null = null;

  try {
    const data = await apiFetch<{ usuarios: UsuarioItem[] }>("/api/usuarios");
    usuarios = data.usuarios;
  } catch (err) {
    error = String(err);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-sm text-gray-500 mt-1">{usuarios.length} usuario(s) registrados</p>
        </div>
        {session?.rol === "ADMIN" && <NuevoUsuarioForm />}
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
              <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Rol</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Estado</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Registrado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {usuarios.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {u.nombres} {u.apellidos}
                </td>
                <td className="px-4 py-3 text-gray-500">{u.email ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${ROL_BADGE[u.rol] ?? "bg-gray-100 text-gray-600"}`}>
                    {u.rol.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`badge ${u.activo ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                    {u.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {formatFecha(u.createdAt)}
                </td>
              </tr>
            ))}
            {usuarios.length === 0 && !error && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                  Sin usuarios registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
