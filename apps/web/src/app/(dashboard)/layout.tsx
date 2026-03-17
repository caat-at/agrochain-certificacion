export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Conteo de adulterados sin resolver para badge en sidebar
  let adulteradosSinResolver = 0;
  try {
    const metricas = await apiFetch<{ resumen: { adulteradosSinResolver: number } }>("/api/metricas/dashboard");
    adulteradosSinResolver = metricas.resumen?.adulteradosSinResolver ?? 0;
  } catch { /* no bloquea el layout */ }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar rol={session.rol} alertas={adulteradosSinResolver} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar nombre={session.nombre} rol={session.rol} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
