"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const AMOY_SCAN = "https://amoy.polygonscan.com/tx";

const TIPOS = [
  { value: "BPA_ICA",           label: "BPA ICA (NTC 5400)" },
  { value: "ORGANICO",          label: "Orgánico certificado" },
  { value: "GLOBAL_GAP",        label: "GlobalG.A.P" },
  { value: "RAINFOREST",        label: "Rainforest Alliance" },
  { value: "INVIMA_INOCUIDAD",  label: "INVIMA Inocuidad" },
];

export default function EmitirCertificadoBtn({
  loteId,
  codigoLote,
}: {
  loteId: string;
  codigoLote: string;
}) {
  const router = useRouter();
  const [abierto,   setAbierto]   = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ txHash: string; tokenId: number } | null>(null);
  const [tipo,      setTipo]      = useState("BPA_ICA");
  const [vigencia,  setVigencia]  = useState("365");
  const [numCert,   setNumCert]   = useState(`BPA-ANT-${new Date().getFullYear()}-00001`);
  const [ipfsUri,   setIpfsUri]   = useState("ipfs://QmDemo123");

  async function handleEmitir(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/certificados/emitir", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loteId,
          numeroCertificado: numCert,
          tipo,
          diasVigencia: Number(vigencia),
          ipfsUri,
        }),
      });

      const data = await res.json() as {
        message?: string;
        warning?: string;
        blockchain?: { txHash: string; tokenId: number };
      };
      if (!res.ok) throw new Error(data.message ?? "Error al emitir");

      if (data.blockchain) {
        setResultado(data.blockchain);
      } else {
        if (data.warning) setError(`Advertencia: ${data.warning}`);
        setAbierto(false);
        router.refresh();
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  function handleCerrar() {
    setAbierto(false);
    setResultado(null);
    setError(null);
    router.refresh();
  }

  return (
    <>
      <button className="btn-primary text-sm py-1.5" onClick={() => setAbierto(true)}>
        Emitir certificado NFT
      </button>

      {abierto && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900">Emitir Certificado NFT</h3>
                <p className="text-sm text-gray-500 font-mono mt-0.5">{codigoLote}</p>
              </div>
              <button onClick={handleCerrar} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Resultado exitoso */}
            {resultado ? (
              <div className="p-6 space-y-4">
                <div className="text-center">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="font-semibold text-gray-900">¡Certificado NFT emitido!</p>
                  <p className="text-sm text-gray-500 mt-1">Token #{resultado.tokenId} minteado en Polygon Amoy</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Token ID</span>
                    <span className="font-mono font-semibold text-gray-800">#{resultado.tokenId}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">TX Polygon</span>
                    <a
                      href={`${AMOY_SCAN}/${resultado.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-purple-600 hover:underline"
                    >
                      {resultado.txHash.slice(0, 18)}…
                    </a>
                  </div>
                </div>
                <button onClick={handleCerrar} className="btn-primary w-full">Cerrar</button>
              </div>
            ) : (
            <form onSubmit={handleEmitir} className="p-6 space-y-4">
              <div>
                <label className="label">Tipo de certificación</label>
                <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                  {TIPOS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">N° Certificado oficial</label>
                <input
                  className="input font-mono"
                  value={numCert}
                  onChange={(e) => setNumCert(e.target.value)}
                  placeholder="BPA-ANT-2024-00001"
                  required
                />
              </div>

              <div>
                <label className="label">Días de vigencia</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="1825"
                  value={vigencia}
                  onChange={(e) => setVigencia(e.target.value)}
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  Máx. 1825 días (5 años). BPA típico: 365 días.
                </p>
              </div>

              <div>
                <label className="label">URI IPFS del certificado</label>
                <input
                  className="input font-mono text-sm"
                  value={ipfsUri}
                  onChange={(e) => setIpfsUri(e.target.value)}
                  placeholder="ipfs://Qm..."
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  JSON metadata del NFT en IPFS (Pinata)
                </p>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3">{error}</div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" className="btn-secondary flex-1" onClick={handleCerrar}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={loading}>
                  {loading ? "Emitiendo en Polygon…" : "Emitir NFT"}
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
