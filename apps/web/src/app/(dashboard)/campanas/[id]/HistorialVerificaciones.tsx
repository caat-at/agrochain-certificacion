"use client";
import { useState } from "react";
import { formatFechaHora } from "@/lib/utils";

interface DetalleRegistro {
  id: string;
  plantaId: string;
  hashGuardado: string;
  hashCalculado: string;
  resultado: "OK" | "FALLA";
  etiquetaRegistro: string | null;
}

interface Verificacion {
  id: string;
  fechaVerificacion: string;
  ok: boolean;
  totalRegistros: number;
  aprobados: number;
  adulterados: number;
  ejecutadoPor: { nombres: string; apellidos: string };
  detalles: DetalleRegistro[];
}

export function HistorialVerificaciones({ campanaId, refrescadoEn }: { campanaId: string; refrescadoEn?: number }) {
  const [abierto, setAbierto]               = useState(false);
  const [cargando, setCargando]             = useState(false);
  const [verificaciones, setVerificaciones] = useState<Verificacion[] | null>(null);
  const [ultimoRefresco, setUltimoRefresco] = useState(refrescadoEn ?? 0);
  const [expandido, setExpandido]           = useState<string | null>(null);

  // Si el padre señala una nueva verificación, resetear caché para recargar
  if (refrescadoEn && refrescadoEn !== ultimoRefresco) {
    setUltimoRefresco(refrescadoEn);
    setVerificaciones(null);
    setAbierto(false);
  }

  async function cargar() {
    if (verificaciones !== null) { setAbierto(true); return; }
    setCargando(true);
    try {
      const res = await fetch(`/api/campanas/${campanaId}/verificaciones`);
      const data = await res.json();
      setVerificaciones(data.verificaciones ?? []);
      setAbierto(true);
    } catch {
      setVerificaciones([]);
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
          Historial de verificaciones de integridad
        </span>
        <span className="text-xs text-gray-400">
          {cargando ? "Cargando…" : abierto ? "▲" : "▼"}
        </span>
      </button>

      {abierto && (
        <div className="divide-y divide-gray-100">
          {verificaciones?.length === 0 && (
            <p className="px-4 py-6 text-xs text-gray-400 text-center">
              No hay verificaciones registradas aún.
            </p>
          )}

          {verificaciones?.map((v) => (
            <div key={v.id} className="px-4 py-3 space-y-2">
              {/* Encabezado */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      v.ok
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}>
                      {v.ok ? "✓ OK" : "⚠ Adulteraciones"}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatFechaHora(v.fechaVerificacion)}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Por {v.ejecutadoPor.nombres} {v.ejecutadoPor.apellidos}
                    {" · "}
                    {v.aprobados}/{v.totalRegistros} registros válidos
                    {v.adulterados > 0 && (
                      <span className="text-red-500"> · {v.adulterados} adulterados</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setExpandido(expandido === v.id ? null : v.id)}
                  className="text-[11px] text-blue-500 hover:underline"
                >
                  {expandido === v.id ? "Ocultar detalle" : "Ver detalle"}
                </button>
              </div>

              {/* Detalle por registro */}
              {expandido === v.id && (
                <div className="space-y-2">
                  {v.detalles.length === 0 && (
                    <p className="text-[11px] text-gray-400 px-1">
                      No hay registros completos para verificar.
                    </p>
                  )}
                  {v.detalles.map((d) => (
                    <div
                      key={d.id}
                      className={`rounded-lg border px-3 py-2.5 space-y-1.5 text-[11px] ${
                        d.resultado === "FALLA"
                          ? "border-red-200 bg-red-50"
                          : "border-gray-100 bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-600">
                          {d.etiquetaRegistro ?? `REG-???`}
                        </span>
                        {d.resultado === "OK" ? (
                          <span className="text-emerald-600 font-semibold">✓ OK</span>
                        ) : (
                          <span className="text-red-600 font-semibold">⚠ FALLA</span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div>
                          <p className="text-gray-400 mb-0.5">Hash guardado (registro):</p>
                          <p className="font-mono text-gray-700 break-all">{d.hashGuardado}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 mb-0.5">Hash recalculado (servidor):</p>
                          <p className="font-mono text-gray-700 break-all">{d.hashCalculado}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
