"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const AMOY_SCAN = "https://amoy.polygonscan.com/tx";

export default function AnclarInspeccionBtn({ inspeccionId }: { inspeccionId: string }) {
  const router  = useRouter();
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [txHash,   setTxHash]   = useState<string | null>(null);

  async function handleAnclar() {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/inspecciones/${inspeccionId}/anclar`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      setTxHash(data.txHash);
      router.refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  if (txHash) {
    return (
      <a
        href={`${AMOY_SCAN}/${txHash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-purple-600 hover:underline font-mono text-xs"
        title={txHash}
      >
        {txHash.slice(0, 10)}…
      </a>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleAnclar}
        disabled={loading}
        className="text-xs px-2 py-1 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-200 disabled:opacity-50 transition-colors"
      >
        {loading ? "Anclando…" : "Anclar en Polygon"}
      </button>
      {error && (
        <span className="text-xs text-red-500 max-w-[140px] truncate" title={error}>
          {error.replace("Error: ", "").slice(0, 40)}
        </span>
      )}
    </div>
  );
}
