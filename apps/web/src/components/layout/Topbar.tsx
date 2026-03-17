"use client";
import { useRouter } from "next/navigation";
import { RolUsuario } from "@/types";

const ROL_LABEL: Record<RolUsuario, string> = {
  ADMIN:          "Administrador",
  AGRICULTOR:     "Agricultor",
  INSPECTOR_ICA:  "Inspector ICA",
  INSPECTOR_BPA:  "Inspector BPA",
  CERTIFICADORA:  "Certificadora",
  INVIMA:         "INVIMA",
  CONSUMIDOR:     "Consumidor",
};

export default function Topbar({ nombre, rol }: { nombre: string; rol: RolUsuario }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
      <div />
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900 leading-none">{nombre}</p>
          <p className="text-xs text-gray-400 mt-0.5">{ROL_LABEL[rol] ?? rol}</p>
        </div>
        <div className="w-8 h-8 bg-verde-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
          {nombre.charAt(0).toUpperCase()}
        </div>
        <button
          onClick={handleLogout}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          title="Cerrar sesión"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1" />
          </svg>
        </button>
      </div>
    </header>
  );
}
