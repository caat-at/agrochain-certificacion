"use client";
import { useState } from "react";

const Spinner = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
  </svg>
);

export function DescargarPdfBtn({
  loteId,
  codigoLote,
  compact = false,
}: {
  loteId: string;
  codigoLote: string;
  compact?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function obtenerBlob(): Promise<string | null> {
    if (blobUrl) return blobUrl;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/informes/lote/${loteId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message ?? `Error ${res.status}`);
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      setBlobUrl(url);
      return url;
    } catch (e) {
      setError(String(e));
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function handleVer() {
    const url = await obtenerBlob();
    if (url) window.open(url, "_blank", "noopener");
  }

  async function handleDescargar() {
    const url = await obtenerBlob();
    if (!url) return;
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `trazabilidad-${codigoLote}-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Modo compacto: icono de abrir en pestana
  if (compact) {
    return (
      <button
        onClick={handleVer}
        disabled={loading}
        title={`Ver informe PDF ${codigoLote}`}
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 hover:bg-red-50 hover:border-red-200 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
      >
        {loading ? (
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M7 21h10a2 2 0 0 0 2-2V9.414a1 1 0 0 0-.293-.707l-5.414-5.414A1 1 0 0 0 12.586 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z" />
          </svg>
        )}
      </button>
    );
  }

  // Modo completo: boton Ver + boton Descargar
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          onClick={handleVer}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? <Spinner /> : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 21h10a2 2 0 0 0 2-2V9.414a1 1 0 0 0-.293-.707l-5.414-5.414A1 1 0 0 0 12.586 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z" />
            </svg>
          )}
          {loading ? "Generando..." : "Ver informe PDF"}
        </button>

        <button
          onClick={handleDescargar}
          disabled={loading}
          title="Descargar PDF"
          className="flex items-center justify-center px-3 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-gray-700 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? <Spinner /> : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          )}
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
          {error}
        </p>
      )}
    </div>
  );
}
