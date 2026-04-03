"use client";
import { useState } from "react";
import { formatFechaHora } from "@/lib/utils";

interface VerificacionHash {
  id: string;
  fechaVerificacion: string;
  ok: boolean;
  totalRegistros: number;
  hashGuardado: string;
  hashRecalculado: string;
  ejecutadoPor: { nombres: string; apellidos: string };
}

export function HistorialHashCampana({
  campanaId,
  refrescadoEn,
}: {
  campanaId: string;
  refrescadoEn?: number;
}) {
  const [abierto, setAbierto]           = useState(false);
  const [cargando, setCargando]         = useState(false);
  const [historial, setHistorial]       = useState<VerificacionHash[] | null>(null);
  const [ultimoRefresco, setUltimoRefresco] = useState(refrescadoEn ?? 0);
  const [expandido, setExpandido]       = useState<string | null>(null);

  // Recargar si el padre señala nueva verificación
  if (refrescadoEn && refrescadoEn !== ultimoRefresco) {
    setUltimoRefresco(refrescadoEn);
    setHistorial(null);
    setAbierto(false);
  }

  async function cargar() {
    if (historial !== null) { setAbierto(true); return; }
    setCargando(true);
    try {
      const res = await fetch(`/api/campanas/${campanaId}/historial-hash-campana`);
      const data = await res.json();
      setHistorial(data.historial ?? []);
      setAbierto(true);
    } catch {
      setHistorial([]);
      setAbierto(true);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={abierto ? () => setAbierto(false) : cargar}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="text-sm font-medium text-gray-700">
          Historial de verificaciones del hash de campaña
        </span>
        <span className="text-xs text-gray-400">
          {cargando ? "Cargando…" : abierto ? "▲" : "▼"}
        </span>
      </button>

      {abierto && (
        <div className="divide-y divide-gray-100">
          {historial?.length === 0 && (
            <p className="px-4 py-6 text-xs text-gray-400 text-center">
              No hay verificaciones del hash de campaña registradas aún.
            </p>
          )}

          {historial?.map((v) => (
            <div key={v.id} className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      v.ok
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}>
                      {v.ok ? "✓ Válido" : "⚠ No coincide"}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatFechaHora(v.fechaVerificacion)}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Por {v.ejecutadoPor.nombres} {v.ejecutadoPor.apellidos}
                    {" · "}{v.totalRegistros} registro(s) en el sello
                  </p>
                </div>
                <button
                  onClick={() => setExpandido(expandido === v.id ? null : v.id)}
                  className="text-[11px] text-blue-500 hover:underline"
                >
                  {expandido === v.id ? "Ocultar" : "Ver hashes"}
                </button>
              </div>

              {expandido === v.id && (
                <div className={`rounded-lg border px-3 py-2.5 space-y-2 text-[11px] ${
                  v.ok ? "border-gray-100 bg-gray-50" : "border-red-200 bg-red-50"
                }`}>
                  <div>
                    <p className="text-gray-400 mb-0.5">Hash sellado al cierre:</p>
                    <p className="font-mono text-gray-700 break-all">{v.hashGuardado}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-0.5">Hash recalculado:</p>
                    <p className={`font-mono break-all ${v.ok ? "text-gray-700" : "text-red-600"}`}>
                      {v.hashRecalculado}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
