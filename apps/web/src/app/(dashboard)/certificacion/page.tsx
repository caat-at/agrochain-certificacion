export const dynamic = "force-dynamic";
import { apiFetch } from "@/lib/api";
import { formatFecha } from "@/lib/utils";
import EmitirCertificadoBtn from "./EmitirCertificadoBtn";
import QRCodeImg from "@/components/QRCode";

interface LoteCosechado {
  id: string;
  codigoLote: string;
  especie: string;
  variedad: string | null;
  predioNombre: string;
  estadoLote: string;
  dataHash: string | null;
}

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
          Emitir NFT de certificado para lotes aprobados en inspección BPA
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
          <div className="space-y-3">
            {lotesListos.map((lote) => (
              <div key={lote.id} className="card border-l-4 border-l-amber-400">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono font-bold text-gray-900">{lote.codigoLote}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {lote.especie}{lote.variedad ? ` · ${lote.variedad}` : ""} · {lote.predioNombre}
                    </p>
                  </div>
                  <EmitirCertificadoBtn loteId={lote.id} codigoLote={lote.codigoLote} />
                </div>
              </div>
            ))}
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
