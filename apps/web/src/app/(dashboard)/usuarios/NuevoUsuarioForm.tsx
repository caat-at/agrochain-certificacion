"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getApiUrl } from "@/lib/client";

function getToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)ac_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

const ROLES = [
  { value: "TECNICO",       label: "Técnico" },
  { value: "AGRICULTOR",    label: "Agricultor" },
  { value: "INSPECTOR_ICA", label: "Inspector ICA" },
  { value: "INSPECTOR_BPA", label: "Inspector BPA" },
  { value: "CERTIFICADORA", label: "Certificadora" },
  { value: "INVIMA",        label: "INVIMA" },
  { value: "ADMIN",         label: "Administrador" },
];

export function NuevoUsuarioForm() {
  const [abierto, setAbierto]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const [nombres, setNombres]     = useState("");
  const [apellidos, setApellidos] = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [rol, setRol]             = useState("TECNICO");

  const router = useRouter();

  function handleClose() {
    setAbierto(false);
    setError(null);
    setNombres("");
    setApellidos("");
    setEmail("");
    setPassword("");
    setRol("TECNICO");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombres.trim()) { setError("El nombre es obligatorio."); return; }
    if (!apellidos.trim()) { setError("Los apellidos son obligatorios."); return; }
    if (!email.trim()) { setError("El email es obligatorio."); return; }
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/usuarios`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ nombres: nombres.trim(), apellidos: apellidos.trim(), email: email.trim(), password, rol }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      handleClose();
      router.refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-verde-500 hover:bg-verde-600 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Nuevo usuario
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">Nuevo usuario</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Nombres / Apellidos */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Nombres
              </label>
              <input
                type="text"
                value={nombres}
                onChange={(e) => setNombres(e.target.value)}
                placeholder="Juan"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-verde-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Apellidos
              </label>
              <input
                type="text"
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value)}
                placeholder="García"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-verde-400"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@ejemplo.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-verde-400"
            />
          </div>

          {/* Contraseña */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-verde-400"
            />
          </div>

          {/* Rol */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Rol
            </label>
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-verde-400 bg-white"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
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
              {loading ? "Creando…" : "Crear usuario"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
