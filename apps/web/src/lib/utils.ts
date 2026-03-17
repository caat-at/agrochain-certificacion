import { EstadoLote } from "@/types";

export function estadoColor(estado: EstadoLote): string {
  const map: Record<EstadoLote, string> = {
    REGISTRADO:             "bg-blue-100 text-blue-700",
    EN_PRODUCCION:          "bg-emerald-100 text-emerald-700",
    COSECHADO:              "bg-amber-100 text-amber-700",
    INSPECCION_SOLICITADA:  "bg-purple-100 text-purple-700",
    EN_INSPECCION:          "bg-orange-100 text-orange-700",
    CERTIFICADO:            "bg-green-100 text-green-800",
    RECHAZADO:              "bg-red-100 text-red-700",
    REVOCADO:               "bg-gray-100 text-gray-600",
  };
  return map[estado] ?? "bg-gray-100 text-gray-600";
}

export function estadoLabel(estado: EstadoLote): string {
  return estado.replace(/_/g, " ");
}

export function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export function formatFechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function truncarHash(hash: string | null, chars = 12): string {
  if (!hash) return "—";
  return `${hash.substring(0, chars)}...`;
}

export function explorerUrl(hash: string, red: "amoy" | "polygon" = "amoy"): string {
  const base = red === "amoy"
    ? "https://amoy.polygonscan.com"
    : "https://polygonscan.com";
  return `${base}/tx/${hash}`;
}
