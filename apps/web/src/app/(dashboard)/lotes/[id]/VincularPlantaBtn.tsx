"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface PlantaDisponible {
  id: string;
  codigoPlanta: string;
  numeroPlanta: string;
}

export function VincularPlantaBtn({
  loteId,
  parcelaId,
  especie,
}: {
  loteId: string;
  parcelaId: string;
  especie: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disponibles, setDisponibles] = useState<PlantaDisponible[]>([]);
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());

  const router = useRouter();

  useEffect(() => {
    if (!abierto) return;
    setCargando(true);
    fetch(`/api/parcelas/${parcelaId}/plantas-disponibles?especie=${encodeURIComponent(especie)}`)
      .then((r) => r.json())
      .then((data) => setDisponibles(data.plantas ?? []))
      .catch(() => setDisponibles([]))
      .finally(() => setCargando(false));
  }, [abierto, parcelaId, especie]);

  function toggle(id: string) {
    setSeleccionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleClose() {
    setAbierto(false);
    setError(null);
    setSeleccionadas(new Set());
  }

  async function handleVincular() {
    if (seleccionadas.size === 0) { setError("Selecciona al menos una planta."); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/lotes/${loteId}/plantas/vincular`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantaIds: [...seleccionadas] }),
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
        className="inline-flex items-center gap-1.5 text-xs font-medium text-verde-600 hover:text-verde-700 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
        Vincular planta existente
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">Vincular planta existente</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-3 overflow-y-auto">
          <p className="text-xs text-gray-500">
            Plantas de esta especie ya sembradas en la parcela, disponibles para este ciclo (no están en otro lote abierto).
          </p>

          {cargando ? (
            <p className="text-xs text-gray-400">Buscando plantas disponibles…</p>
          ) : disponibles.length === 0 ? (
            <p className="text-xs text-gray-400">No hay plantas disponibles de esta especie en la parcela.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-1.5">
              {disponibles.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-xs text-gray-700 border border-gray-100 rounded-md px-2.5 py-2">
                  <input type="checkbox" checked={seleccionadas.has(p.id)} onChange={() => toggle(p.id)} />
                  <span className="font-mono font-semibold">{p.codigoPlanta}</span> — planta N° {p.numeroPlanta}
                </label>
              ))}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-600">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={handleClose} className="flex-1 btn-secondary">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleVincular}
              disabled={loading || disponibles.length === 0}
              className="flex-1 btn-primary disabled:opacity-50"
            >
              {loading ? "Vinculando…" : "Vincular seleccionadas"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
