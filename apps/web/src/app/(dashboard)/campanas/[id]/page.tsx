export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatFecha, truncarHash } from "@/lib/utils";
import Link from "next/link";
import {
  CerrarCampanaBtn,
  AbrirCampanaBtn,
  AsignarTecnicoBtn,
} from "./AccionesCampana";
import { RegistroExpandible } from "./RegistroExpandible";
import { VerificacionPanel } from "./VerificacionPanel";
import { PanelBlockchain } from "./PanelBlockchain";

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
  camposAsignados: string;  // JSON
  tecnico: { id: string; nombres: string; apellidos: string };
}

interface CampanaDetalle {
  id: string;
  nombre: string;
  codigo: string | null;
  descripcion: string | null;
  estado: "ACTIVA" | "ABIERTA" | "CERRADA";
  camposRequeridos: string[];
  campanaHash: string | null;
  txHash: string | null;
  cierreConAdvertencia: boolean | null;
  motivoCierre: string | null;
  fechaApertura: string;
  fechaCierre: string | null;
  lote: { id: string; codigoLote: string; especie: string; variedad: string | null; txRegistro: string | null };
  creador: { nombres: string; apellidos: string };
  cerrador: { nombres: string; apellidos: string } | null;
  tecnicos: CampanaTecnico[];
  registros: RegistroPlanta[];
  progreso: { total: number; completos: number; adulterados: number; pendientes: number };
}

// ─── Barra de progreso ────────────────────────────────────────────────────────

function BarraProgreso({ progreso }: { progreso: CampanaDetalle["progreso"] }) {
  const { total, completos, adulterados, pendientes } = progreso;
  if (total === 0) return null;
  const pctCompleto   = Math.round((completos / total) * 100);
  const pctAdulterado = Math.round((adulterados / total) * 100);
  const parciales     = total - completos - adulterados - pendientes;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{completos}/{total} plantas completas</span>
        <span className="font-semibold text-gray-700">{pctCompleto}%</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden flex">
        <div className="bg-emerald-500 transition-all" style={{ width: `${pctCompleto}%` }} />
        {pctAdulterado > 0 && (
          <div className="bg-red-400 transition-all" style={{ width: `${pctAdulterado}%` }} />
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400">
        <span className="text-emerald-600 font-medium">{completos} completos</span>
        {adulterados > 0 && (
          <span className="text-red-500 font-medium">{adulterados} adulterados</span>
        )}
        {parciales > 0 && (
          <span className="text-amber-500 font-medium">{parciales} parciales</span>
        )}
        <span>{pendientes} pendientes</span>
      </div>
    </div>
  );
}

// ─── Panel de técnicos asignados ──────────────────────────────────────────────

function PanelTecnicos({
  tecnicos,
  campanaId,
  campanaEstado,
}: {
  tecnicos: CampanaTecnico[];
  campanaId: string;
  campanaEstado: CampanaDetalle["estado"];
}) {
  const posicionesOcupadas = new Set(tecnicos.map((t) => t.posicion));
  const posicionesFaltantes = [1, 2, 3, 4].filter((p) => !posicionesOcupadas.has(p));
  const puedeAsignar = campanaEstado === "ACTIVA";

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-800">Técnicos asignados</h2>
        <span className="text-xs text-gray-400">{tecnicos.length}/4</span>
      </div>

      <div className="space-y-2.5">
        {[1, 2, 3, 4].map((pos) => {
          const t = tecnicos.find((x) => x.posicion === pos);
          let camposAsig: string[] = [];
          try { camposAsig = JSON.parse(t?.camposAsignados ?? "[]"); } catch { /* ignore */ }

          return (
            <div
              key={pos}
              className={`rounded-lg border p-3 ${
                t
                  ? "bg-white border-gray-200"
                  : "bg-gray-50 border-dashed border-gray-200"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 text-[11px] font-bold ${
                  t ? "bg-verde-500 text-white" : "bg-gray-200 text-gray-400"
                }`}>
                  P{pos}
                </div>
                <div className="flex-1 min-w-0">
                  {t ? (
                    <>
                      <p className="text-xs font-semibold text-gray-800">
                        {t.tecnico.nombres} {t.tecnico.apellidos}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {camposAsig.map((c) => (
                          <span
                            key={c}
                            className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Sin asignar</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Botón asignar — solo si campaña ACTIVA y faltan posiciones */}
      {puedeAsignar && posicionesFaltantes.length > 0 && (
        <div className="mt-4">
          <AsignarTecnicoBtn
            campanaId={campanaId}
            posicionesFaltantes={posicionesFaltantes}
            camposRequeridos={[]}
          />
        </div>
      )}

      {!puedeAsignar && campanaEstado === "ABIERTA" && tecnicos.length < 4 && (
        <p className="text-[11px] text-amber-600 mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Campaña abierta — para reasignar técnicos primero debe cerrarse.
        </p>
      )}
    </div>
  );
}

// ─── Badge de estado ──────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: CampanaDetalle["estado"] }) {
  if (estado === "ABIERTA") return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      Abierta
    </span>
  );
  if (estado === "ACTIVA") return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
      Activa (sin abrir)
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
      Cerrada
    </span>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default async function CampanaDetallePage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  let campana: CampanaDetalle;

  try {
    const res = await apiFetch<{ campana: CampanaDetalle }>(`/api/campanas/${id}`);
    campana = res.campana;
  } catch {
    notFound();
  }

  const campanaAbierta   = campana.estado === "ABIERTA";
  const campanaActiva    = campana.estado === "ACTIVA";
  const hayAdulterados   = campana.registros.some((r) => r.estado === "ADULTERADO");
  const tecnicosCompletos = campana.tecnicos.length === 4;

  // Ordenar: adulterados primero, luego parciales, luego pendientes, luego completos, invalidados al final
  const ordenEstado: Record<string, number> = {
    ADULTERADO: 0, PARCIAL: 1, PENDIENTE: 2, COMPLETO: 3, INVALIDADO: 4,
  };
  const registrosOrdenados = [...campana.registros].sort(
    (a, b) => (ordenEstado[a.estado] ?? 9) - (ordenEstado[b.estado] ?? 9)
  );

  return (
    <div className="max-w-5xl">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="mb-1">
            <Link href="/campanas" className="text-sm text-gray-400 hover:text-verde-500">
              ← Campañas
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <EstadoBadge estado={campana.estado} />
            <h1 className="text-2xl font-bold text-gray-900">{campana.nombre}</h1>
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-sm text-gray-500">
            <span className="font-mono text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
              {campana.lote.codigoLote}
            </span>
            {campana.codigo && (
              <span className="font-mono text-xs font-bold text-white bg-gray-600 px-2 py-0.5 rounded tracking-wide">
                {campana.codigo}
              </span>
            )}
            <span>
              {campana.lote.especie}
              {campana.lote.variedad ? ` · ${campana.lote.variedad}` : ""}
            </span>
          </div>
          {campana.descripcion && (
            <p className="text-sm text-gray-400 mt-1">{campana.descripcion}</p>
          )}
        </div>
      </div>

      {/* Aviso cierre con advertencia */}
      {campana.cierreConAdvertencia && campana.motivoCierre && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          <strong>Cerrada con advertencia:</strong> {campana.motivoCierre}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Columna principal — registros ──────────────────────────────── */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">
              Registros de plantas
              <span className="ml-2 text-xs font-normal text-gray-400">
                ({campana.registros.length})
              </span>
            </h2>
            {hayAdulterados && (
              <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
                ⚠ {campana.registros.filter((r) => r.estado === "ADULTERADO").length} adulterado(s)
              </span>
            )}
          </div>

          {registrosOrdenados.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-400 text-sm">No hay registros de plantas aún.</p>
              <p className="text-gray-300 text-xs mt-1">
                Los técnicos agregan aportes desde la app móvil.
              </p>
            </div>
          ) : (
            registrosOrdenados.map((registro) => (
              <RegistroExpandible
                key={registro.id}
                registro={registro}
                camposRequeridos={campana.camposRequeridos}
                campanaId={campana.id}
                codigoCampana={campana.codigo}
                campanaAbierta={campanaAbierta}
                tecnicos={campana.tecnicos}
              />
            ))
          )}
        </div>

        {/* ── Columna lateral ─────────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Progreso */}
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-4">Progreso</h2>
            <BarraProgreso progreso={campana.progreso} />
          </div>

          {/* Técnicos asignados */}
          <PanelTecnicos
            tecnicos={campana.tecnicos}
            campanaId={campana.id}
            campanaEstado={campana.estado}
          />

          {/* Info campaña */}
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-3">Información</h2>
            <dl className="space-y-2.5 text-xs">
              {campana.codigo && (
                <div>
                  <dt className="text-gray-400">Código campaña</dt>
                  <dd className="font-mono font-bold text-gray-800 mt-0.5 tracking-wide">{campana.codigo}</dd>
                </div>
              )}
              <div>
                <dt className="text-gray-400">Creada por</dt>
                <dd className="text-gray-700 font-medium mt-0.5">
                  {campana.creador.nombres} {campana.creador.apellidos}
                </dd>
              </div>
              <div>
                <dt className="text-gray-400">Fecha apertura</dt>
                <dd className="text-gray-700 font-medium mt-0.5">
                  {formatFecha(campana.fechaApertura)}
                </dd>
              </div>
              {campana.fechaCierre && (
                <div>
                  <dt className="text-gray-400">Fecha cierre</dt>
                  <dd className="text-gray-700 font-medium mt-0.5">
                    {formatFecha(campana.fechaCierre)}
                  </dd>
                </div>
              )}
              {campana.cerrador && (
                <div>
                  <dt className="text-gray-400">Cerrada por</dt>
                  <dd className="text-gray-700 font-medium mt-0.5">
                    {campana.cerrador.nombres} {campana.cerrador.apellidos}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Blockchain — hash de campaña + txHash + anclar */}
          {campana.estado === "CERRADA" && campana.campanaHash && (
            <PanelBlockchain
              campanaId={campana.id}
              loteId={campana.lote.id}
              campanaHash={campana.campanaHash}
              txHash={campana.txHash}
              loteTxRegistro={campana.lote.txRegistro}
            />
          )}

          {/* Resumen de integridad — solo si cerrada */}
          {campana.estado === "CERRADA" && (
            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-3">Integridad</h2>
              <div className="space-y-2 text-xs">
                {[
                  { label: "Completos",   count: campana.progreso.completos,  color: "text-emerald-600" },
                  { label: "Adulterados", count: campana.progreso.adulterados, color: "text-red-500" },
                  { label: "Invalidados",
                    count: campana.registros.filter((r) => r.estado === "INVALIDADO").length,
                    color: "text-purple-500" },
                  { label: "Incompletos",
                    count: campana.registros.filter((r) => ["PARCIAL", "PENDIENTE"].includes(r.estado)).length,
                    color: "text-gray-400" },
                ].map(({ label, count, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-gray-500">{label}</span>
                    <span className={`font-semibold ${color}`}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Acciones */}
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-4">Acciones</h2>
            <div className="space-y-3">
              {/* ACTIVA → ABIERTA */}
              {campanaActiva && (
                tecnicosCompletos ? (
                  <AbrirCampanaBtn campanaId={campana.id} />
                ) : (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                    Asigna los 4 técnicos antes de abrir la campaña.
                    <span className="block font-semibold mt-0.5">
                      {campana.tecnicos.length}/4 asignados
                    </span>
                  </div>
                )
              )}

              {/* ABIERTA → acciones */}
              {campanaAbierta && (
                <>
                  {hayAdulterados ? (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                      Hay registros adulterados. Puedes cerrar con advertencia o resolver primero.
                    </div>
                  ) : null}
                  <CerrarCampanaBtn
                    campanaId={campana.id}
                    hayIncompletos={campana.progreso.pendientes > 0 || campana.registros.some(
                      (r) => r.estado === "PARCIAL"
                    )}
                    hayAdulterados={hayAdulterados}
                  />
                </>
              )}

              {campana.estado === "CERRADA" && (
                <p className="text-xs text-gray-400 text-center py-1">
                  Campaña cerrada — solo lectura.
                </p>
              )}
            </div>
          </div>

          {/* Verificar integridad + historial */}
          <div className="mt-6">
            <VerificacionPanel campanaId={campana.id} campanaCerrada={campana.estado === "CERRADA"} />
          </div>
        </div>
      </div>
    </div>
  );
}
