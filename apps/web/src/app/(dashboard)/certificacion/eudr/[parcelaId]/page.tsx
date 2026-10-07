export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import dynamicImport from "next/dynamic";
import { apiFetch } from "@/lib/api";
import { EudrSeccion, type EudrEstadoParcela } from "./EudrSeccion";

const PoligonoMapa = dynamicImport(() => import("@/components/PoligonoMapa"), { ssr: false });

interface ParcelaResumen {
  id: string;
  predioId: string;
  predioNombre: string | null;
  codigoParcela: string;
  nombre: string | null;
  latitud: number | null;
  longitud: number | null;
  predioLatitud: number | null;
  predioLongitud: number | null;
}

interface PoligonoVigente {
  geojson: { type: string; coordinates: number[][][] };
  areaHaCalculada: number | null;
  fuente: string;
  version: number;
}

export default async function CertificacionEudrParcelaPage({ params }: { params: { parcelaId: string } }) {
  const { parcelaId } = params;
  const token = cookies().get("ac_token")?.value ?? "";

  let parcela: ParcelaResumen;
  let eudrEstado: EudrEstadoParcela | null = null;
  let poligono: PoligonoVigente | null = null;
  try {
    const res = await apiFetch<{ success: boolean; data: ParcelaResumen }>(`/api/parcelas/${parcelaId}`);
    if (!res.success) notFound();
    parcela = res.data;
    [eudrEstado, poligono] = await Promise.all([
      apiFetch<{ estado: EudrEstadoParcela }>(`/api/eudr/parcelas/${parcelaId}/estado`)
        .then((r) => r.estado)
        .catch(() => null),
      apiFetch<{ poligono: PoligonoVigente }>(`/api/parcelas/${parcelaId}/poligono`)
        .then((r) => r.poligono)
        .catch(() => null),
    ]);
  } catch {
    notFound();
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/certificacion/eudr" className="text-sm text-gray-400 hover:text-verde-500">← Certificación EUDR</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">
          {parcela.codigoParcela}{parcela.nombre ? ` — ${parcela.nombre}` : ""}
        </h1>
        <p className="text-gray-500 mt-1">
          {parcela.predioNombre ?? "—"}
          {" · "}
          <Link href={`/parcelas/${parcela.id}`} className="text-verde-500 hover:text-verde-600">
            Ver parcela →
          </Link>
        </p>
      </div>

      <div className="space-y-6">
        {/* Poligono de la parcela, solo lectura — para editarlo, ir al
            detalle de la parcela (gestion de tierra, no de certificacion) */}
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4">Polígono de la parcela</h2>
          <PoligonoMapa
            endpoint={`/api/parcelas/${parcela.id}/poligono`}
            centroLat={parcela.latitud ?? parcela.predioLatitud ?? 4.6}
            centroLon={parcela.longitud ?? parcela.predioLongitud ?? -74.1}
            poligonoInicial={poligono}
            color="#e11d48"
            soloLectura
          />
        </div>

        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4">EUDR — Deforestación cero</h2>
          <EudrSeccion parcelaId={parcela.id} estadoInicial={eudrEstado} token={token} />
        </div>
      </div>
    </div>
  );
}
