"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const ROLES = [
  { value: "TECNICO",       label: "Técnico" },
  { value: "AGRICULTOR",    label: "Agricultor" },
  { value: "INSPECTOR_ICA", label: "Inspector ICA" },
  { value: "INSPECTOR_BPA", label: "Inspector BPA" },
  { value: "CERTIFICADORA", label: "Certificador(a)" },
  { value: "INVIMA",        label: "INVIMA" },
  { value: "ADMIN",         label: "Administrador" },
];

interface Props {
  usuario: {
    id: string;
    nombres: string;
    apellidos: string;
    email: string | null;
    rol: string;
    activo: boolean;
  };
}

export function EditarUsuarioBtn({ usuario }: Props) {
  const router = useRouter();
  const [abierto,   setAbierto]   = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const [nombres,   setNombres]   = useState(usuario.nombres);
  const [apellidos, setApellidos] = useState(usuario.apellidos);
  const [email,     setEmail]     = useState(usuario.email ?? "");
  const [rol,       setRol]       = useState(usuario.rol);
  const [activo,    setActivo]    = useState(usuario.activo);
  const [password,  setPassword]  = useState("");

  function handleClose() {
    setAbierto(false);
    setError(null);
    setPassword("");
    // Restaurar valores originales
    setNombres(usuario.nombres);
    setApellidos(usuario.apellidos);
    setEmail(usuario.email ?? "");
    setRol(usuario.rol);
    setActivo(usuario.activo);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombres.trim())   { setError("El nombre es obligatorio."); return; }
    if (!apellidos.trim()) { setError("Los apellidos son obligatorios."); return; }
    if (!email.trim())     { setError("El email es obligatorio."); return; }
    if (password && password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return; }

    setLoading(true);
    setError(null);

    try {
      const body: any = { nombres: nombres.trim(), apellidos: apellidos.trim(), email: email.trim(), rol, activo };
      if (password) body.password = password;

      const res = await fetch(`/api/usuarios/${usuario.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);

      setAbierto(false);
      router.refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        title="Editar usuario"
      >
        Editar
      </button>

      {abierto && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">Editar usuario</h2>
                <p className="text-xs text-gray-400 mt-0.5">{usuario.nombres} {usuario.apellidos}</p>
              </div>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {/* Nombres / Apellidos */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Nombres</label>
                  <input
                    type="text"
                    value={nombres}
                    onChange={(e) => setNombres(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-verde-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Apellidos</label>
                  <input
                    type="text"
                    value={apellidos}
                    onChange={(e) => setApellidos(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-verde-400"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-verde-400"
                />
              </div>

              {/* Rol + Estado */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Rol</label>
                  <select
                    value={rol}
                    onChange={(e) => setRol(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-verde-400"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Estado</label>
                  <select
                    value={activo ? "activo" : "inactivo"}
                    onChange={(e) => setActivo(e.target.value === "activo")}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-verde-400"
                  >
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
              </div>

              {/* Contraseña */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Contraseña
                </label>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 mb-2">
                  Por seguridad las contraseñas se almacenan cifradas y no pueden mostrarse. Escribe una nueva solo si deseas cambiarla.
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nueva contraseña (mín. 6 caracteres)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-verde-400"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-600">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-verde-500 hover:bg-verde-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
