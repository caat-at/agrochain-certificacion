"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { VerificacionPublica } from "@/types";
import { formatFecha } from "@/lib/utils";

const API        = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const AMOY_SCAN  = "https://amoy.polygonscan.com/tx";

/* ── helpers ─────────────────────────────────────────────────────────────── */
function truncar(h: string, n = 10) {
  return h.length > n * 2 + 3 ? `${h.slice(0, n)}…${h.slice(-n)}` : h;
}

/* Dot de color */
function Dot({ color }: { color: "purple" | "yellow" | "green" | "gray" }) {
  const bg: Record<string, string> = {
    purple: "bg-purple-600",
    yellow: "bg-yellow-400",
    green:  "bg-emerald-400",
    gray:   "bg-gray-300",
  };
  return <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${bg[color]}`} />;
}

/* Fila TX Polygon */
function TxRow({ label, tx }: { label: string; tx: string }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <Dot color="purple" />
      <span className="text-gray-400 whitespace-nowrap">{label}</span>
      <a
        href={`${AMOY_SCAN}/${tx}`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-purple-600 hover:underline break-all"
      >
        {tx}
      </a>
    </div>
  );
}

/* Fila hash SHA-256 */
function HashRow({ label, hash }: { label: string; hash: string }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <Dot color="yellow" />
      <span className="text-gray-400 whitespace-nowrap">{label}</span>
      <span className="font-mono text-gray-600 break-all">{hash}</span>
    </div>
  );
}

/* ── componente principal ─────────────────────────────────────────────────── */
export default function VerificarForm() {
  const searchParams = useSearchParams();
  const [codigo,  setCodigo]  = useState(searchParams.get("codigo") ?? "");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [datos,   setDatos]   = useState<VerificacionPublica | null>(null);

  /* Auto-buscar si viene ?codigo= en la URL (QR scan) */
  useEffect(() => {
    const cod = searchParams.get("codigo");
    if (cod) buscarCodigo(cod);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function buscarCodigo(cod: string) {
    setLoading(true);
    setError(null);
    setDatos(null);
    try {
      const res  = await fetch(`${API}/api/verificar/${encodeURIComponent(cod.trim())}`);
      const data = await res.json() as VerificacionPublica & { message?: string };
      if (!res.ok) throw new Error(data.message ?? `Error ${res.status}`);
      setDatos(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!codigo.trim()) return;
    buscarCodigo(codigo);
  }

  /* ── render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* Buscador */}
      <div className="card">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            className="input flex-1"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Ej: COL-05-2024-00001"
            autoFocus
          />
          <button className="btn-primary px-6" disabled={loading}>
            {loading ? "Verificando..." : "Verificar"}
          </button>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Resultados */}
      {datos && (
        <div className="space-y-4">

          {/* ── Certificado ──────────────────────────────────────────────── */}
          {datos.certificado ? (
            <div className={`card border-2 ${
              datos.certificado.valido
                ? "border-verde-500 bg-verde-50"
                : "border-red-300 bg-red-50"
            }`}>
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                  datos.certificado.valido ? "bg-verde-500" : "bg-red-400"
                }`}>
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d={datos.certificado.valido
                        ? "M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
                        : "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"} />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className={`text-lg font-bold ${
                    datos.certificado.valido ? "text-verde-600" : "text-red-600"
                  }`}>
                    {datos.certificado.valido ? "CERTIFICADO VÁLIDO" : "CERTIFICADO INVÁLIDO"}
                  </p>
                  <p className="font-mono text-sm text-gray-700 mt-1">
                    {datos.certificado.numeroCertificado}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs text-gray-600">
                    <span><b>Tipo:</b> {datos.certificado.tipo.replace(/_/g, " ")}</span>
                    <span><b>Emitido:</b> {formatFecha(datos.certificado.fechaEmision)}</span>
                    <span><b>Vence:</b> {formatFecha(datos.certificado.fechaVencimiento)}</span>
                    {datos.certificado.tokenId && (
                      <span><b>NFT:</b> #{datos.certificado.tokenId}</span>
                    )}
                  </div>
                  {datos.certificado.aprobadoPor && (
                    <p className="text-xs text-gray-400 mt-2">
                      Certificado por: {datos.certificado.aprobadoPor}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="card bg-amber-50 border border-amber-200">
              <div className="flex items-center gap-3 text-amber-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="font-medium">Este lote aún no tiene certificado emitido</span>
              </div>
            </div>
          )}

          {/* ── Info del lote ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm">Lote agrícola</h3>
              <dl className="space-y-2 text-sm">
                <Item label="Código" value={datos.codigoLote} mono />
                <Item label="Especie" value={`${datos.especie}${datos.variedad ? ` · ${datos.variedad}` : ""}`} />
                <Item label="Estado" value={datos.estado.replace(/_/g, " ")} />
                <Item label="Eventos" value={`${datos.totalEventos} registros`} />
              </dl>
            </div>
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm">Predio y agricultor</h3>
              <dl className="space-y-2 text-sm">
                <Item label="Predio" value={datos.predio.nombre} />
                <Item label="Municipio" value={`${datos.predio.municipio}, ${datos.predio.departamento}`} />
                <Item label="Agricultor" value={datos.agricultor.nombre} />
              </dl>
            </div>
          </div>

          {/* ── Inspección BPA ────────────────────────────────────────────── */}
          {datos.inspeccion && (
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm">Resultado inspección BPA</h3>
              <div className="flex items-center gap-3 mb-3">
                <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                  datos.inspeccion.resultado === "APROBADO"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-red-100 text-red-700"
                }`}>
                  {datos.inspeccion.resultado ?? "—"}
                </span>
                {datos.inspeccion.puntajeBpa != null && (
                  <span className="text-sm text-gray-600">
                    Puntaje BPA: <b>{datos.inspeccion.puntajeBpa}/100</b>
                  </span>
                )}
                {datos.inspeccion.inspector && (
                  <span className="text-xs text-gray-400">Inspector: {datos.inspeccion.inspector}</span>
                )}
              </div>
              {(datos.inspeccion.hallazgosCriticos != null ||
                datos.inspeccion.hallazgosMayores != null ||
                datos.inspeccion.hallazgosMenores != null) && (
                <div className="flex gap-4 text-xs text-gray-600 mb-2">
                  {datos.inspeccion.hallazgosCriticos != null && (
                    <span className="text-red-600 font-medium">
                      Críticos: {datos.inspeccion.hallazgosCriticos}
                    </span>
                  )}
                  {datos.inspeccion.hallazgosMayores != null && (
                    <span className="text-orange-600 font-medium">
                      Mayores: {datos.inspeccion.hallazgosMayores}
                    </span>
                  )}
                  {datos.inspeccion.hallazgosMenores != null && (
                    <span className="text-yellow-600 font-medium">
                      Menores: {datos.inspeccion.hallazgosMenores}
                    </span>
                  )}
                </div>
              )}
              {datos.inspeccion.observaciones && (
                <p className="text-xs text-gray-500 italic">{datos.inspeccion.observaciones}</p>
              )}
            </div>
          )}

          {/* ── Trazabilidad Blockchain ────────────────────────────────────── */}
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-4 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13.828 10.172a4 4 0 0 0-5.656 0l-4 4a4 4 0 1 0 5.656 5.656l1.102-1.101m-.758-4.899a4 4 0 0 0 5.656 0l4-4a4 4 0 0 0-5.656-5.656l-1.1 1.1" />
              </svg>
              Trazabilidad en Polygon Amoy
            </h3>

            <div className="space-y-3">
              {/* Registro del lote */}
              {datos.blockchain.txRegistro && (
                <TxRow label="[Poly] Registro lote:" tx={datos.blockchain.txRegistro} />
              )}
              {datos.dataHash && (
                <HashRow label="Hash datos lote:" hash={datos.dataHash} />
              )}

              {/* Campañas */}
              {datos.campanas.map((c, i) => (
                <div key={i} className="space-y-1.5">
                  {c.txHash && (
                    <TxRow label={`[Poly] Campaña ${c.nombre}:`} tx={c.txHash} />
                  )}
                  {c.campanaHash && (
                    <HashRow label={`Hash campaña ${c.nombre}:`} hash={c.campanaHash} />
                  )}
                </div>
              ))}

              {/* Inspección */}
              {datos.inspeccion?.txHash && (
                <TxRow label="[Poly] Reporte BPA:" tx={datos.inspeccion.txHash} />
              )}
              {datos.inspeccion?.reporteHash && (
                <HashRow label="Hash reporte BPA:" hash={datos.inspeccion.reporteHash} />
              )}

              {/* Certificado NFT */}
              {datos.certificado?.txEmision && (
                <TxRow label="[Poly] Certificado NFT:" tx={datos.certificado.txEmision} />
              )}

              {/* Sin datos blockchain */}
              {!datos.blockchain.txRegistro &&
                !datos.dataHash &&
                datos.campanas.length === 0 &&
                !datos.inspeccion?.txHash &&
                !datos.certificado?.txEmision && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Dot color="gray" />
                  Pendiente de registro on-chain
                </div>
              )}
            </div>

            {/* Leyenda */}
            <div className="flex gap-4 mt-4 pt-3 border-t border-gray-100">
              <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
                <Dot color="purple" /> Transacción Polygon
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
                <Dot color="yellow" /> Hash SHA-256
              </span>
            </div>
          </div>

          {/* ── Timeline de eventos ───────────────────────────────────────── */}
          {datos.eventos.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-4 text-sm">
                Historial de producción ({datos.eventos.length} eventos)
              </h3>
              <div className="relative">
                <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-200" />
                <div className="space-y-4">
                  {datos.eventos.map((ev, i) => (
                    <div key={i} className="flex items-start gap-4 pl-8 relative">
                      <div className={`absolute left-2 top-1 w-3 h-3 rounded-full border-2 border-white ${
                        ev.hashVerificado ? "bg-emerald-400" : "bg-amber-400"
                      }`} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-800">
                            {ev.tipoEvento.replace(/_/g, " ")}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatFecha(ev.fechaEvento)}
                          </span>
                        </div>
                        {ev.descripcion && (
                          <p className="text-xs text-gray-500 mt-0.5">{ev.descripcion}</p>
                        )}
                        <span className={`text-[10px] mt-0.5 ${
                          ev.hashVerificado ? "text-emerald-500" : "text-amber-500"
                        }`}>
                          {ev.hashVerificado ? "✓ Integridad verificada" : "Pendiente verificación"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

function Item({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-gray-400 flex-shrink-0">{label}</dt>
      <dd className={`text-gray-800 font-medium text-right ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
