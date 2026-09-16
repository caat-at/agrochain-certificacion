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
  // Fase 2 — campos de verificación contra Polygon
  hashGuardadoDB?:   string;
  txHash?:           string | null;
  hashEnPolygon?:    string | null;
  blockNumber?:      number | null;
  timestampPolygon?: number | null;
  okDB?:             boolean | null;
  okPolygon?:        boolean | null;
  polygonError?:     string | null;
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
                  {/* Badges DB y Polygon */}
                  <div className="flex gap-1.5 mt-1">
                    {v.okDB !== undefined && v.okDB !== null && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        v.okDB ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                      }`}>
                        DB {v.okDB ? "✓" : "✗"}
                      </span>
                    )}
                    {v.txHash && v.okPolygon !== undefined && v.okPolygon !== null ? (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        v.okPolygon ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                      }`}>
                        Polygon {v.okPolygon ? "✓" : "✗"}
                      </span>
                    ) : v.txHash ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-yellow-50 text-yellow-600">
                        Polygon sin datos
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-gray-100 text-gray-400">
                        Sin txHash
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setExpandido(expandido === v.id ? null : v.id)}
                  className="text-[11px] text-blue-500 hover:underline"
                >
                  {expandido === v.id ? "Ocultar" : "Ver hashes"}
                </button>
              </div>

              {expandido === v.id && (
                <div className={`rounded-lg border px-3 py-2.5 space-y-3 text-[11px] ${
                  v.ok ? "border-gray-100 bg-gray-50" : "border-red-200 bg-red-50"
                }`}>

                  {/* Hash recalculado desde DB */}
                  <div>
                    <p className="text-gray-400 mb-0.5 font-medium">Hash recalculado (desde datos en DB):</p>
                    <p className="font-mono text-gray-700 break-all">{v.hashRecalculado}</p>
                  </div>

                  {/* Hash sellado en DB al cierre */}
                  <div>
                    <p className="text-gray-400 mb-0.5 font-medium">
                      Hash sellado al cierre (DB):{" "}
                      {v.okDB !== undefined && v.okDB !== null && (
                        <span className={v.okDB ? "text-emerald-600" : "text-red-600"}>
                          {v.okDB ? "✓ coincide" : "✗ NO coincide"}
                        </span>
                      )}
                    </p>
                    <p className={`font-mono break-all ${v.okDB === false ? "text-red-600" : "text-gray-700"}`}>
                      {v.hashGuardadoDB ?? v.hashGuardado}
                    </p>
                  </div>

                  {/* Hash en Polygon */}
                  <div>
                    <p className="text-gray-400 mb-0.5 font-medium">
                      Hash registrado en Polygon:{" "}
                      {v.txHash && v.okPolygon !== undefined && v.okPolygon !== null && (
                        <span className={v.okPolygon ? "text-emerald-600" : "text-red-600"}>
                          {v.okPolygon ? "✓ coincide" : "✗ NO coincide"}
                        </span>
                      )}
                    </p>
                    {v.hashEnPolygon ? (
                      <>
                        <p className={`font-mono break-all ${v.okPolygon === false ? "text-red-600" : "text-gray-700"}`}>
                          {v.hashEnPolygon}
                        </p>
                        {v.blockNumber && (
                          <p className="text-gray-400 mt-0.5">
                            Bloque #{v.blockNumber}
                            {v.timestampPolygon
                              ? ` · ${new Date(v.timestampPolygon * 1000).toLocaleString("es-CO")}`
                              : ""}
                          </p>
                        )}
                      </>
                    ) : v.polygonError ? (
                      <p className="text-yellow-600">{v.polygonError}</p>
                    ) : v.txHash ? (
                      <p className="text-gray-400 italic">No se pudo leer el hash desde Polygon.</p>
                    ) : (
                      <p className="text-gray-400 italic">
                        Sin txHash — la campaña no fue anclada en Polygon o es anterior a esta versión.
                      </p>
                    )}
                  </div>

                  {/* Link a PolygonScan */}
                  {v.txHash && (
                    <div>
                      <p className="text-gray-400 mb-0.5 font-medium">Transacción en Polygon Amoy:</p>
                      <a
                        href={`https://amoy.polygonscan.com/tx/${v.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-blue-500 hover:underline break-all"
                      >
                        {v.txHash}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
