"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function IniciarInspeccionBtn({ inspeccionId }: { inspeccionId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleIniciar() {
    if (!confirm("¿Iniciar la inspección? El lote pasará a estado EN INSPECCIÓN.")) return;
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/inspecciones/${inspeccionId}/iniciar`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      router.refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleIniciar}
        disabled={loading}
        className="text-xs px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? "Iniciando…" : "Iniciar inspección"}
      </button>
      {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}
