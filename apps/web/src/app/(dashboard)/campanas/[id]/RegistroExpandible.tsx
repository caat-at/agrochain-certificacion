"use client";
import { useState } from "react";
import { RegistrarAporteFaltante } from "./RegistrarAporteFaltante";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AporteTecnico {
  id: string;
  tecnicoId: string;
  posicion: number;
  campos: string;           // JSON
  fotoHash: string | null;
  audioHash: string | null;
  contentHash: string;
  hashVerificado: boolean | null;
  hashRechazMotivo: string | null;
  latitud: number | null;
  longitud: number | null;
  fechaAporte: string;
  tecnico: { nombres: string; apellidos: string; rol: string };
}

interface RegistroPlanta {
  id: string;
  plantaId: string;
  consecutivo: number | null;
  estado: "PENDIENTE" | "PARCIAL" | "COMPLETO" | "ADULTERADO" | "INVALIDADO";
  contentHash: string | null;
  fechaEvento: string | null;
  planta: {
    codigoPlanta: string;
    numeroPlanta: number | null;
    latitud: number | null;
    longitud: number | null;
  };
  aportes: AporteTecnico[];
}

interface CampanaTecnico {
  posicion: number;
  camposAsignados: string;
  tecnico: { id: string; nombres: string; apellidos: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function estadoColor(estado: RegistroPlanta["estado"]): string {
  const map: Record<RegistroPlanta["estado"], string> = {
    PENDIENTE:  "bg-gray-100 text-gray-500 border-gray-200",
    PARCIAL:    "bg-amber-50 text-amber-700 border-amber-200",
    COMPLETO:   "bg-emerald-50 text-emerald-700 border-emerald-200",
    ADULTERADO: "bg-red-100 text-red-700 border-red-300",
    INVALIDADO: "bg-purple-50 text-purple-600 border-purple-200",
  };
  return map[estado] ?? "bg-gray-100 text-gray-500 border-gray-200";
}

function estadoLabel(estado: RegistroPlanta["estado"]): string {
  const map: Record<RegistroPlanta["estado"], string> = {
    PENDIENTE:  "Pendiente",
    PARCIAL:    "Parcial",
    COMPLETO:   "Completo ✓",
    ADULTERADO: "⚠ Adulterado",
    INVALIDADO: "Invalidado",
  };
  return map[estado] ?? estado;
}

function formatFechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Tabla consolidada: todos los campos de todos los aportes ─────────────────

function TablaConsolidada({
  aportes,
  camposRequeridos,
  tecnicos,
}: {
  aportes: AporteTecnico[];
  camposRequeridos: string[];
  tecnicos: CampanaTecnico[];
}) {
  // Mapa campo → { valor, tecnico, posicion, fechaAporte, hashOk }
  const mapaCampos: Record<string, {
    valor: unknown;
    tecnico: string;
    posicion: number;
    fechaAporte: string;
    hashOk: boolean | null;
  }> = {};

  for (const aporte of aportes) {
    let campos: Record<string, unknown> = {};
    try { campos = JSON.parse(aporte.campos); } catch { /* ignore */ }
    for (const [k, v] of Object.entries(campos)) {
      if (v !== null && v !== undefined && v !== "") {
        mapaCampos[k] = {
          valor: v,
          tecnico: `${aporte.tecnico.nombres} ${aporte.tecnico.apellidos}`,
          posicion: aporte.posicion,
          fechaAporte: aporte.fechaAporte,
          hashOk: aporte.hashVerificado,
        };
      }
    }
    // Foto/audio como campos visuales
    if (aporte.fotoHash) {
      mapaCampos["foto"] = {
        valor: `📷 ${aporte.fotoHash.substring(0, 12)}…`,
        tecnico: `${aporte.tecnico.nombres} ${aporte.tecnico.apellidos}`,
        posicion: aporte.posicion,
        fechaAporte: aporte.fechaAporte,
        hashOk: aporte.hashVerificado,
      };
    }
    if (aporte.audioHash) {
      mapaCampos["audio"] = {
        valor: `🎤 ${aporte.audioHash.substring(0, 12)}…`,
        tecnico: `${aporte.tecnico.nombres} ${aporte.tecnico.apellidos}`,
        posicion: aporte.posicion,
        fechaAporte: aporte.fechaAporte,
        hashOk: aporte.hashVerificado,
      };
    }
  }

  const camposExtra = Object.keys(mapaCampos).filter((c) => !camposRequeridos.includes(c));
  const todosLosCampos = [...camposRequeridos, ...camposExtra];

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-100">
          <th className="text-left py-1.5 px-2 font-medium text-gray-400 w-1/4">Campo</th>
          <th className="text-left py-1.5 px-2 font-medium text-gray-400 w-1/4">Valor</th>
          <th className="text-left py-1.5 px-2 font-medium text-gray-400">Técnico</th>
          <th className="text-left py-1.5 px-2 font-medium text-gray-400 w-28">Fecha</th>
          <th className="py-1.5 px-2 w-8" />
        </tr>
      </thead>
      <tbody>
        {todosLosCampos.map((campo) => {
          const dato = mapaCampos[campo];
          const requerido = camposRequeridos.includes(campo);
          return (
            <tr key={campo} className="border-b border-gray-50 hover:bg-gray-50/50">
              <td className="py-2 px-2">
                <span className={`font-medium ${requerido ? "text-gray-700" : "text-gray-400"}`}>
                  {campo}
                </span>
                {requerido && !dato && (
                  <span className="ml-1.5 text-[10px] text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded">
                    faltante
                  </span>
                )}
              </td>
              <td className="py-2 px-2">
                {dato ? (
                  <span className="font-semibold text-gray-900">{String(dato.valor)}</span>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              <td className="py-2 px-2 text-gray-500">
                {dato ? (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-bold bg-verde-100 text-verde-600">
                      P{dato.posicion}
                    </span>
                    {dato.tecnico}
                  </span>
                ) : "—"}
              </td>
              <td className="py-2 px-2 text-gray-400 text-[10px]">
                {dato ? formatFechaHora(dato.fechaAporte) : "—"}
              </td>
              <td className="py-2 px-2 text-center">
                {dato?.hashOk === false ? (
                  <span title="Hash inválido" className="text-red-500">⚠</span>
                ) : dato ? (
                  <span className="text-emerald-500" title="Hash verificado">✓</span>
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── Vista de aportes individuales por técnico ────────────────────────────────

function TablaAportes({ aportes }: { aportes: AporteTecnico[] }) {
  return (
    <div className="space-y-3">
      {aportes.map((aporte) => {
        let campos: Record<string, unknown> = {};
        try { campos = JSON.parse(aporte.campos); } catch { /* ignore */ }

        return (
          <div
            key={aporte.id}
            className={`rounded-lg border p-3 ${
              aporte.hashVerificado === false
                ? "bg-red-50 border-red-200"
                : "bg-white border-gray-100"
            }`}
          >
            {/* Cabecera */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-verde-500 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                  P{aporte.posicion}
                </div>
                <div>
                  <span className="font-semibold text-gray-800 text-xs">
                    {aporte.tecnico.nombres} {aporte.tecnico.apellidos}
                  </span>
                  <span className="ml-2 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                    {aporte.tecnico.rol}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                {aporte.hashVerificado === false ? (
                  <span className="text-red-600 font-semibold bg-red-100 px-1.5 py-0.5 rounded">
                    ⚠ Hash inválido
                    {aporte.hashRechazMotivo && (
                      <span className="font-normal ml-1">· {aporte.hashRechazMotivo}</span>
                    )}
                  </span>
                ) : aporte.hashVerificado === true ? (
                  <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                    ✓ Verificado
                  </span>
                ) : (
                  <span className="text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                    Pendiente verificación
                  </span>
                )}
                <span className="text-gray-400">{formatFechaHora(aporte.fechaAporte)}</span>
              </div>
            </div>

            {/* Datos en cuadrícula */}
            {Object.keys(campos).length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 bg-gray-50 rounded-lg p-3">
                {Object.entries(campos).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[10px] text-gray-400 uppercase tracking-wide">{k}</dt>
                    <dd className="text-sm font-semibold text-gray-900 mt-0.5">{String(v)}</dd>
                  </div>
                ))}
              </div>
            )}

            {/* Foto / Audio hashes */}
            {(aporte.fotoHash || aporte.audioHash) && (
              <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-gray-400">
                {aporte.fotoHash && (
                  <span className="flex items-center gap-1">
                    📷 <span className="font-mono">{aporte.fotoHash.substring(0, 16)}…</span>
                  </span>
                )}
                {aporte.audioHash && (
                  <span className="flex items-center gap-1">
                    🎤 <span className="font-mono">{aporte.audioHash.substring(0, 16)}…</span>
                  </span>
                )}
              </div>
            )}

            {/* GPS */}
            {aporte.latitud != null && (
              <div className="mt-2 flex items-center gap-1.5 text-[10px] text-gray-400">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
                </svg>
                {aporte.latitud.toFixed(6)}, {aporte.longitud?.toFixed(6)}
              </div>
            )}

            {/* contentHash */}
            <div className="mt-2 text-[10px] font-mono text-gray-300 truncate">
              hash: {aporte.contentHash.substring(0, 32)}…
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Componente principal expandible ─────────────────────────────────────────

export function RegistroExpandible({
  registro,
  camposRequeridos,
  campanaId: _campanaId,
  codigoCampana,
  campanaAbierta,
  tecnicos,
}: {
  registro: RegistroPlanta;
  camposRequeridos: string[];
  campanaId: string;
  codigoCampana: string | null;
  campanaAbierta: boolean;
  tecnicos: CampanaTecnico[];
}) {
  const [expandido, setExpandido]     = useState(false);
  const [vistaActiva, setVistaActiva] = useState<"consolidado" | "aportes">("consolidado");

  const esAdulterado  = registro.estado === "ADULTERADO";
  const esInvalidado  = registro.estado === "INVALIDADO";
  const nAportes      = registro.aportes.length;

  // Posiciones que ya aportaron
  const posicionesAportadas = new Set(registro.aportes.map((a) => a.posicion));
  const posicionesTotales   = tecnicos.length > 0 ? [1, 2, 3, 4] : [];

  // Campos cubiertos (para mini barra)
  const camposCubiertos = new Set<string>();
  for (const aporte of registro.aportes) {
    try {
      const c = JSON.parse(aporte.campos) as Record<string, unknown>;
      for (const [k, v] of Object.entries(c)) {
        if (v !== null && v !== undefined && v !== "") camposCubiertos.add(k);
      }
    } catch { /* ignore */ }
  }
  const faltantes    = camposRequeridos.filter((c) => !camposCubiertos.has(c));
  const pctCompleto  = camposRequeridos.length > 0
    ? Math.round((camposCubiertos.size / camposRequeridos.length) * 100)
    : 0;

  return (
    <div className={`rounded-xl border transition-all ${
      esAdulterado
        ? "border-red-300 bg-red-50/30"
        : esInvalidado
        ? "border-purple-200 bg-purple-50/20"
        : expandido
        ? "border-verde-200 bg-white shadow-sm"
        : "border-gray-200 bg-white hover:border-gray-300"
    }`}>
      {/* ── Cabecera ──────────────────────────────────────────────────────── */}
      <button
        className="w-full text-left p-4"
        onClick={() => setExpandido(!expandido)}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Indicador estado */}
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
              registro.estado === "COMPLETO"   ? "bg-emerald-500" :
              registro.estado === "ADULTERADO" ? "bg-red-500 animate-pulse" :
              registro.estado === "INVALIDADO" ? "bg-purple-400" :
              registro.estado === "PARCIAL"    ? "bg-amber-400" :
              "bg-gray-300"
            }`} />

            {/* Consecutivo del registro */}
            {registro.consecutivo != null && (
              <span className="font-mono text-[11px] font-bold text-white bg-gray-500 px-1.5 py-0.5 rounded flex-shrink-0">
                {codigoCampana ? `${codigoCampana}-${String(registro.consecutivo).padStart(3, "0")}` : `REG-${String(registro.consecutivo).padStart(3, "0")}`}
              </span>
            )}

            {/* Código planta */}
            <span className="font-mono text-sm font-bold text-gray-800">
              {registro.planta.codigoPlanta}
            </span>
            {registro.planta.numeroPlanta && (
              <span className="text-xs text-gray-400">#{registro.planta.numeroPlanta}</span>
            )}

            {/* Mini barra de progreso de campos */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    registro.estado === "COMPLETO"   ? "bg-emerald-500" :
                    registro.estado === "ADULTERADO" ? "bg-red-400" :
                    registro.estado === "INVALIDADO" ? "bg-purple-400" : "bg-amber-400"
                  }`}
                  style={{ width: `${pctCompleto}%` }}
                />
              </div>
              <span className="text-[11px] text-gray-400">
                {camposCubiertos.size}/{camposRequeridos.length}
              </span>
            </div>

            {/* Indicadores de posiciones (P1–P4) */}
            {posicionesTotales.length > 0 && (
              <div className="hidden sm:flex gap-1">
                {[1, 2, 3, 4].map((p) => (
                  <span
                    key={p}
                    className={`inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-bold ${
                      posicionesAportadas.has(p)
                        ? "bg-verde-500 text-white"
                        : "bg-gray-100 text-gray-300"
                    }`}
                  >
                    P{p}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Badge de estado */}
            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${estadoColor(registro.estado)}`}>
              {estadoLabel(registro.estado)}
            </span>

            {/* Conteo aportes */}
            {nAportes > 0 && (
              <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {nAportes}/4
              </span>
            )}

            {/* Chevron */}
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${expandido ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* GPS de la planta */}
        {registro.planta.latitud != null && (
          <p className="text-[10px] text-gray-400 mt-1 ml-6">
            {registro.planta.latitud.toFixed(5)}, {registro.planta.longitud?.toFixed(5)}
          </p>
        )}

        {/* Fecha del evento (primer aporte) */}
        {registro.fechaEvento && (
          <p className="text-[10px] text-gray-400 mt-0.5 ml-6">
            Evento: {formatFechaHora(registro.fechaEvento)}
          </p>
        )}

        {/* Aviso campos faltantes */}
        {registro.estado === "PARCIAL" && faltantes.length > 0 && (
          <p className="text-[11px] text-amber-600 mt-1.5 ml-6">
            Faltan: {faltantes.join(", ")}
          </p>
        )}

        {/* Aviso invalidado */}
        {esInvalidado && (
          <p className="text-[11px] text-purple-600 mt-1.5 ml-6">
            Registro invalidado por adulteración
          </p>
        )}
      </button>

      {/* ── Contenido expandido ──────────────────────────────────────────────── */}
      {expandido && (
        <div className="border-t border-gray-100">
          {nAportes === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              Sin aportes registrados aún.
            </div>
          ) : (
            <>
              {/* Pestañas */}
              <div className="flex border-b border-gray-100 px-4">
                {(["consolidado", "aportes"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setVistaActiva(v)}
                    className={`py-2.5 px-1 mr-6 text-xs font-semibold border-b-2 transition-colors ${
                      vistaActiva === v
                        ? "border-verde-500 text-verde-600"
                        : "border-transparent text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {v === "consolidado" ? "Vista consolidada" : `Por técnico (${nAportes})`}
                  </button>
                ))}
              </div>

              <div className="p-4">
                {vistaActiva === "consolidado" ? (
                  <TablaConsolidada
                    aportes={registro.aportes}
                    camposRequeridos={camposRequeridos}
                    tecnicos={tecnicos}
                  />
                ) : (
                  <TablaAportes aportes={registro.aportes} />
                )}
              </div>
            </>
          )}

          {/* Panel de posiciones faltantes — solo si PARCIAL, campaña abierta y hay técnicos */}
          {registro.estado === "PARCIAL" && campanaAbierta && tecnicos.length > 0 && (() => {
            const faltantes = tecnicos.filter((t) => !posicionesAportadas.has(t.posicion));
            if (faltantes.length === 0) return null;
            return (
              <div className="mx-4 mb-4 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                <p className="text-[11px] font-semibold text-amber-700 mb-2">
                  Posiciones pendientes de sincronizar
                </p>
                <div className="space-y-3">
                  {faltantes.map((t) => {
                    let campos: string[] = [];
                    try { campos = JSON.parse(t.camposAsignados); } catch { /* ignore */ }
                    return (
                      <div key={t.posicion}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-bold bg-amber-400 text-white">
                            P{t.posicion}
                          </span>
                          <span className="text-xs text-amber-800 font-medium">
                            {t.tecnico.nombres} {t.tecnico.apellidos}
                          </span>
                          <span className="text-[10px] text-amber-500">
                            ({campos.join(", ")})
                          </span>
                        </div>
                        <RegistrarAporteFaltante
                          campanaId={_campanaId}
                          plantaId={registro.plantaId}
                          codigoPlanta={registro.planta.codigoPlanta}
                          tecnico={t.tecnico}
                          posicion={t.posicion}
                          camposAsignados={campos}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* contentHash del registro */}
          {registro.contentHash && (
            <div className="mx-4 mb-4 text-[10px] font-mono text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              <span className="text-emerald-400 mr-1">contentHash registro:</span>
              {registro.contentHash}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
