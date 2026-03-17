"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getApiUrl } from "@/lib/client";

interface Props {
  loteId:    string;
  txRegistro: string | null;
  token:     string;
}

export default function RegistrarBlockchainBtn({ loteId, txRegistro, token }: Props) {
  const router  = useRouter();
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState<string | null>(null);
  const [txHash,  setTxHash]    = useState<string | null>(txRegistro);

  const explorerBase = "https://amoy.polygonscan.com";

  async function handleRegistrar() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/lotes/${loteId}/registrar-blockchain`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { txHash?: string; message?: string };
      if (!res.ok) throw new Error(data.message ?? `Error ${res.status}`);
      setTxHash(data.txHash ?? null);
      router.refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  if (txHash) {
    return (
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.707-9.293a1 1 0 0 0-1.414-1.414L9 10.586 7.707 9.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4z"/>
          </svg>
          Registrado en Polygon Amoy
        </div>
        <p className="text-[10px] font-mono text-gray-400 break-all">{txHash}</p>
        <a
          href={`${explorerBase}/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline"
        >
          Ver en PolygonScan →
        </a>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <button
        onClick={handleRegistrar}
        disabled={loading}
        className="w-full btn-primary text-sm py-2 disabled:opacity-50"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Enviando a Polygon...
          </span>
        ) : (
          "Registrar en blockchain"
        )}
      </button>
      {error && (
        <p className="text-xs text-red-500 break-words">{error}</p>
      )}
    </div>
  );
}
