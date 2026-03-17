"use client";
import { useState } from "react";
import { VerificacionPublica } from "@/types";
import { formatFecha, truncarHash } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function VerificarForm() {
  const [codigo,   setCodigo]   = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [datos,    setDatos]    = useState<VerificacionPublica | null>(null);

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    if (!codigo.trim()) return;
    setLoading(true);
    setError(null);
    setDatos(null);

    try {
      const res = await fetch(`${API}/api/verificar/${encodeURIComponent(codigo.trim())}`);
      const data = await res.json() as VerificacionPublica & { message?: string };
      if (!res.ok) throw new Error(data.message ?? `Error ${res.status}`);
      setDatos(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Buscador */}
      <div className="card">
        <form onSubmit={buscar} className="flex gap-3">
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
          {/* Certificado */}
          {datos.certificado ? (
            <div className={`card border-2 ${
              datos.certificado.valido ? "border-verde-500 bg-verde-50" : "border-red-300 bg-red-50"
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
                    datos.certificado.valido ? "text-verde-500" : "text-red-600"
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

          {/* Info del lote */}
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

          {/* Blockchain */}
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-3 text-sm">Registro en Polygon Blockchain</h3>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                datos.blockchain.registrado ? "bg-emerald-400" : "bg-gray-300"
              }`} />
              <span className="text-sm text-gray-700">
                {datos.blockchain.registrado
                  ? "Verificado en Polygon — datos inmutables"
                  : "Pendiente de registro on-chain"}
              </span>
            </div>
            {datos.blockchain.loteIdHash && (
              <p className="mt-2 text-[11px] font-mono text-gray-400 break-all">
                Lote ID (on-chain): {datos.blockchain.loteIdHash}
              </p>
            )}
            {datos.blockchain.explorerUrl && (
              <a
                href={datos.blockchain.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-blue-500 hover:underline"
              >
                Ver en PolygonScan
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>

          {/* Timeline de eventos */}
          {datos.eventos.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-4 text-sm">
                Trazabilidad de producción
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
                        <div className="flex items-center gap-1 mt-1">
                          {ev.hashVerificado ? (
                            <span className="text-[10px] text-emerald-500 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.707-9.293a1 1 0 0 0-1.414-1.414L9 10.586 7.707 9.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4z" />
                              </svg>
                              Integridad verificada
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-500">Pendiente verificación</span>
                          )}
                        </div>
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
    <div className="flex justify-between">
      <dt className="text-gray-400">{label}</dt>
      <dd className={`text-gray-800 font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
