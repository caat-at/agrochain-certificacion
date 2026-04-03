export const dynamic = "force-dynamic";
import { apiFetch } from "@/lib/api";
import { formatFecha } from "@/lib/utils";
import EmitirCertificadoBtn from "./EmitirCertificadoBtn";
import QRCodeImg from "@/components/QRCode";
import DescargarCertificadoBtn from "./CertificadoPDF";

const AMOY_SCAN = "https://amoy.polygonscan.com/tx";

interface Inspeccion {
  id: string;
  resultado: string;
  puntaje: number | null;
  hallazgosCriticos: number;
  hallazgosMayores: number;
  hallazgosMenores: number;
  observaciones: string | null;
  fechaRealizada: string | null;
  txHash: string | null;
  inspector: { nombres: string; apellidos: string } | null;
}

interface LoteCosechado {
  id: string;
  codigoLote: string;
  especie: string;
  variedad: string | null;
  predioNombre: string;
  estadoLote: string;
  dataHash: string | null;
  areaHa: number | null;
  destinoProduccion: string | null;
  txRegistro: string | null;
  inspeccion: Inspeccion | null;
  campanasVerificadas: number;
  campanas: Array<{
    id: string;
    nombre: string;
    campanaHash: string;
    txHash: string | null;
    fechaCierre: string | null;
  }>;
}

const RESULTADO_LABEL: Record<string, { label: string; color: string }> = {
  APROBADO:                   { label: "Aprobado",                   color: "bg-emerald-100 text-emerald-700" },
  APROBADO_CON_OBSERVACIONES: { label: "Aprobado con observaciones", color: "bg-amber-100 text-amber-700" },
  RECHAZADO:                  { label: "Rechazado",                  color: "bg-red-100 text-red-600" },
};

export default async function CertificacionPage() {
  let lotesListos: LoteCosechado[] = [];
  let certificadosEmitidos: any[] = [];

  try {
    const [lotesData, certsData] = await Promise.allSettled([
      apiFetch<{ lotes: LoteCosechado[] }>("/api/lotes"),
      apiFetch<{ certificados: any[] }>("/api/certificados"),
    ]);

    if (lotesData.status === "fulfilled") {
      lotesListos = lotesData.value.lotes.filter((l) => l.estadoLote === "COSECHADO");
    }
    if (certsData.status === "fulfilled") {
      certificadosEmitidos = certsData.value.certificados ?? [];
    }
  } catch {
    // Sin datos
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Certificación</h1>
        <p className="text-sm text-gray-500 mt-1">
          Revisar inspección y emitir NFT de certificado para lotes aprobados en BPA
        </p>
      </div>

      {/* Lotes listos para certificar */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          Lotes listos para certificar
          <span className="ml-2 badge bg-amber-100 text-amber-700">
            {lotesListos.length}
          </span>
        </h2>

        {lotesListos.length === 0 ? (
          <div className="card text-center py-12 text-gray-400">
            <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 0 0 1.946-.806 3.42 3.42 0 0 1 4.438 0 3.42 3.42 0 0 0 1.946.806 3.42 3.42 0 0 1 3.138 3.138 3.42 3.42 0 0 0 .806 1.946 3.42 3.42 0 0 1 0 4.438 3.42 3.42 0 0 0-.806 1.946 3.42 3.42 0 0 1-3.138 3.138 3.42 3.42 0 0 0-1.946.806 3.42 3.42 0 0 1-4.438 0 3.42 3.42 0 0 0-1.946-.806 3.42 3.42 0 0 1-3.138-3.138 3.42 3.42 0 0 0-.806-1.946 3.42 3.42 0 0 1 0-4.438 3.42 3.42 0 0 0 .806-1.946 3.42 3.42 0 0 1 3.138-3.138z" />
            </svg>
            <p className="font-medium">Sin lotes en estado COSECHADO</p>
            <p className="text-sm mt-1">Los lotes deben pasar por inspección BPA primero</p>
          </div>
        ) : (
          <div className="space-y-4">
            {lotesListos.map((lote) => {
              const insp = lote.inspeccion;
              const res  = insp ? RESULTADO_LABEL[insp.resultado] : null;

              return (
                <div key={lote.id} className="card border-l-4 border-l-amber-400 space-y-4">

                  {/* Cabecera lote */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-mono font-bold text-gray-900">{lote.codigoLote}</p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {lote.especie}{lote.variedad ? ` · ${lote.variedad}` : ""} · {lote.predioNombre}
                        {lote.areaHa ? ` · ${lote.areaHa} ha` : ""}
                      </p>
                    </div>
                    <EmitirCertificadoBtn loteId={lote.id} codigoLote={lote.codigoLote} />
                  </div>

                  {/* Panel de inspección */}
                  {insp ? (
                    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Resultado de inspección BPA
                        </p>
                        {res && (
                          <span className={`badge text-xs ${res.color}`}>{res.label}</span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                        {/* Puntaje */}
                        {insp.puntaje != null && (
                          <div className="col-span-2 flex items-center gap-3">
                            <span className="text-gray-500 text-sm">Puntaje:</span>
                            <span className="font-bold text-gray-900 text-lg">{insp.puntaje}/100</span>
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${insp.puntaje >= 80 ? "bg-emerald-500" : insp.puntaje >= 60 ? "bg-amber-400" : "bg-red-500"}`}
                                style={{ width: `${insp.puntaje}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Hallazgos */}
                        <div className="col-span-2 flex gap-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold">
                            {insp.hallazgosCriticos} críticos
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 font-semibold">
                            {insp.hallazgosMayores} mayores
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-semibold">
                            {insp.hallazgosMenores} menores
                          </span>
                        </div>

                        {/* Inspector y fecha */}
                        {(insp.inspector || insp.fechaRealizada) && (
                          <div className="col-span-2 text-xs text-gray-500">
                            {insp.inspector && (
                              <span>Inspector: {insp.inspector.nombres} {insp.inspector.apellidos}</span>
                            )}
                            {insp.fechaRealizada && (
                              <span className="ml-2">· {formatFecha(insp.fechaRealizada)}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Observaciones */}
                      {insp.observaciones && (
                        <p className="text-xs text-gray-600 bg-white rounded-lg p-2 border border-gray-100">
                          <span className="font-semibold text-gray-500">Observaciones: </span>
                          {insp.observaciones}
                        </p>
                      )}

                      {/* Trazabilidad blockchain */}
                      <div className="pt-2 border-t border-gray-100 space-y-1.5">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Trazabilidad en Polygon Amoy</p>

                        {/* TX registro del lote */}
                        {lote.txRegistro ? (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                            <span className="text-gray-500">Lote registrado:</span>
                            <a
                              href={`${AMOY_SCAN}/${lote.txRegistro}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-purple-600 hover:underline break-all"
                            >
                              {lote.txRegistro}
                            </a>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
                            <span>Lote sin registro en blockchain</span>
                          </div>
                        )}

                        {/* Campañas verificadas */}
                        {lote.campanas && lote.campanas.length > 0 ? (
                          lote.campanas.map((c) => (
                            <div key={c.id} className="space-y-0.5">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                                <span className="text-gray-500">Campaña <span className="font-medium text-gray-700">{c.nombre}</span>:</span>
                              </div>
                              <div className="pl-4 space-y-0.5">
                                <div className="flex items-center gap-1 text-xs">
                                  <span className="text-gray-400">SHA256:</span>
                                  <span className="font-mono text-gray-600 break-all">{c.campanaHash}</span>
                                </div>
                                {c.txHash ? (
                                  <div className="flex items-center gap-1 text-xs">
                                    <span className="text-gray-400">TX Polygon:</span>
                                    <a
                                      href={`${AMOY_SCAN}/${c.txHash}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-mono text-purple-600 hover:underline break-all"
                                    >
                                      {c.txHash}
                                    </a>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400 pl-1">Sin TX en Polygon</span>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
                            <span>Sin campañas verificadas en blockchain</span>
                          </div>
                        )}

                        {/* TX inspección */}
                        {insp.txHash ? (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                            <span className="text-gray-500">Reporte inspección:</span>
                            <a
                              href={`${AMOY_SCAN}/${insp.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-purple-600 hover:underline break-all"
                            >
                              {insp.txHash}
                            </a>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
                            <span>Reporte de inspección sin ancla blockchain</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-700">
                      Sin registro de inspección — el lote fue marcado COSECHADO directamente.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Certificados emitidos */}
      {certificadosEmitidos.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-3">
            Certificados emitidos
          </h2>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">N° Certificado</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Lote</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Emitido</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Estado</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">NFT</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">QR</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {certificadosEmitidos.map((cert) => (
                  <tr key={cert.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold">
                      {cert.numeroCertificado}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {cert.lote?.codigoLote ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {cert.tipo?.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {cert.fechaEmision ? formatFecha(cert.fechaEmision) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${cert.revocado
                        ? "bg-red-100 text-red-600"
                        : "bg-emerald-100 text-emerald-700"}`}>
                        {cert.revocado ? "Revocado" : "Válido"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">
                      {cert.tokenId ? `#${cert.tokenId}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {!cert.revocado && cert.lote?.codigoLote && (
                        <QRCodeImg
                          value={`${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/verificar?codigo=${cert.lote.codigoLote}`}
                          size={64}
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <DescargarCertificadoBtn cert={{
                        numeroCertificado: cert.numeroCertificado,
                        tipo:              cert.tipo,
                        fechaEmision:      cert.fechaEmision,
                        fechaVencimiento:  cert.fechaVencimiento,
                        revocado:          cert.revocado,
                        nftTokenId:        cert.nftTokenId,
                        txEmision:         cert.txEmision,
                        aprobadoPor:       cert.aprobadoPor,
                        lote: cert.lote ? {
                          codigoLote:  cert.lote.codigoLote,
                          especie:     cert.lote.especie,
                          variedad:    cert.lote.variedad,
                          predioNombre: cert.lote.predio?.nombrePredio,
                          dataHash:    cert.lote.dataHash,
                          txRegistro:  cert.lote.txRegistro,
                          campanas:    cert.lote.campanas ?? [],
                          inspeccion:  cert.lote.inspecciones?.[0] ?? null,
                        } : null,
                      }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Info flujo */}
      <div className="mt-8 card bg-verde-50 border border-verde-100">
        <h3 className="font-semibold text-verde-500 mb-3 text-sm">
          Flujo de certificación on-chain (Polygon)
        </h3>
        <ol className="space-y-2 text-sm text-verde-500">
          {[
            "Lote debe estar en estado COSECHADO (inspección aprobada)",
            "Certificadora revisa resultado de inspección, puntaje y hallazgos",
            "Certificadora emite NFT ERC-721 al agricultor",
            "CertificadoNFT llama a LoteRegistry.certificarLote() automáticamente",
            "El lote pasa a estado CERTIFICADO en blockchain",
            "El agricultor recibe el NFT en su wallet — puede transferirlo con el producto",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="w-5 h-5 bg-verde-100 text-verde-500 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
