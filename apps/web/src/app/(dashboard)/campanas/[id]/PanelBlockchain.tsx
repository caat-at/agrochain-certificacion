"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const AMOY_SCAN = "https://amoy.polygonscan.com/tx";

function IconChain() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}

export function PanelBlockchain({
  campanaId,
  loteId,
  campanaHash,
  txHash:         txHashInicial,
  loteTxRegistro: loteTxInicial,
}: {
  campanaId:      string;
  loteId:         string;
  campanaHash:    string;
  txHash:         string | null;
  loteTxRegistro: string | null;
}) {
  const router = useRouter();

  const [loteTx, setLoteTx] = useState(loteTxInicial);
  const [txHash, setTxHash] = useState(txHashInicial);

  const [loadingLote,    setLoadingLote]    = useState(false);
  const [loadingCampana, setLoadingCampana] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info,  setInfo]  = useState<string | null>(null);

  const loteAnclado    = !!loteTx;
  const campanaAnclada = !!txHash;

  async function handleRegistrarLote() {
    if (!confirm("¿Registrar el lote en Polygon Amoy? Esto enviará una transacción blockchain.")) return;
    setLoadingLote(true);
    setError(null);
    setInfo(null);
    try {
      const res  = await fetch(`/api/lotes/${loteId}/registrar-blockchain`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      setLoteTx(data.txHash);
      setInfo(`Lote registrado en Polygon — bloque ${data.blockNumber}.`);
      router.refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoadingLote(false);
    }
  }

  async function handleAnclarCampana() {
    if (!confirm(
      campanaAnclada
        ? "Ya existe un txHash. ¿Re-anclar el hash de campaña en Polygon? Se generará una nueva transacción."
        : "¿Anclar el hash de campaña en Polygon Amoy?"
    )) return;
    setLoadingCampana(true);
    setError(null);
    setInfo(null);
    try {
      const res  = await fetch(`/api/campanas/${campanaId}/anclar-blockchain`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      setTxHash(data.txHash);
      setInfo(`Hash de campaña anclado — bloque ${data.blockNumber} · gas ${data.gasUsed}.`);
      router.refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoadingCampana(false);
    }
  }

  return (
    <div className="card border-purple-200 bg-purple-50 space-y-4">
      {/* Encabezado */}
      <div className="flex items-center gap-2">
        <span className="text-purple-600"><IconChain /></span>
        <span className="text-xs font-semibold text-purple-800">Registro en Polygon Amoy</span>
        {campanaAnclada ? (
          <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
            ✓ Anclado
          </span>
        ) : (
          <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
            Pendiente
          </span>
        )}
      </div>

      {/* PASO 1 — Lote */}
      <div className={`rounded-lg border px-3 py-2.5 space-y-2 text-[11px] ${
        loteAnclado ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
      }`}>
        <p className={`font-semibold ${loteAnclado ? "text-emerald-700" : "text-amber-700"}`}>
          {loteAnclado ? "✓ Paso 1 — Lote registrado en blockchain" : "Paso 1 — Registrar lote en blockchain"}
        </p>
        {loteAnclado ? (
          <a
            href={`${AMOY_SCAN}/${loteTx}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-blue-600 hover:underline break-all"
          >
            {loteTx}
          </a>
        ) : (
          <>
            <p className="text-amber-600">El lote debe existir en blockchain antes de anclar la campaña.</p>
            <button
              onClick={handleRegistrarLote}
              disabled={loadingLote}
              className="mt-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {loadingLote ? "Registrando lote…" : "Registrar lote en Polygon"}
            </button>
          </>
        )}
      </div>

      {/* PASO 2 — Campaña */}
      <div className={`rounded-lg border px-3 py-2.5 space-y-2 text-[11px] ${
        !loteAnclado
          ? "border-gray-100 bg-gray-50 opacity-50"
          : campanaAnclada
            ? "border-emerald-200 bg-emerald-50"
            : "border-purple-200 bg-white"
      }`}>
        <p className={`font-semibold ${campanaAnclada ? "text-emerald-700" : "text-purple-800"}`}>
          {campanaAnclada ? "✓ Paso 2 — Hash de campaña anclado" : "Paso 2 — Anclar hash de campaña"}
        </p>

        <div>
          <p className="text-gray-400 mb-0.5">Hash sellado al cierre:</p>
          <p className="font-mono text-gray-700 break-all">{campanaHash}</p>
        </div>

        {campanaAnclada && (
          <div>
            <p className="text-gray-400 mb-0.5">Transacción en Polygon Amoy:</p>
            <a
              href={`${AMOY_SCAN}/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-blue-600 hover:underline break-all"
            >
              {txHash}
            </a>
          </div>
        )}

        {loteAnclado && (
          <button
            onClick={handleAnclarCampana}
            disabled={loadingCampana}
            className={`w-full mt-1 px-3 py-2 text-[11px] font-semibold rounded-lg transition-colors disabled:opacity-50 ${
              campanaAnclada
                ? "border border-purple-300 text-purple-700 hover:bg-purple-100"
                : "bg-purple-600 hover:bg-purple-700 text-white"
            }`}
          >
            {loadingCampana
              ? "Enviando a Polygon…"
              : campanaAnclada
                ? "Re-anclar en Polygon"
                : "Anclar hash en Polygon Amoy"}
          </button>
        )}
      </div>

      {/* Feedback */}
      {info && (
        <p className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5">{info}</p>
      )}
      {error && (
        <p className="text-[10px] text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">{error}</p>
      )}
    </div>
  );
}
