export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import Link from "next/link";
import dynamicImport from "next/dynamic";
import { apiFetch } from "@/lib/api";

const PoligonoMapa = dynamicImport(() => import("@/components/PoligonoMapa"), { ssr: false });

interface LoteParcela {
  id: string;
  codigoLote: string;
  especie: string;
  variedad: string | null;
  areaHa: number;
  estado: string;
  totalPlantas: number;
  loteIdOnchain: string | null;
}

interface ParcelaDetalle {
  id: string;
  predioId: string;
  predioNombre: string | null;
  predioLatitud: number | null;
  predioLongitud: number | null;
  codigoParcela: string;
  nombre: string | null;
  areaHa: number;
  latitud: number | null;
  longitud: number | null;
  usoActual: string | null;
  activo: boolean;
  lotes: LoteParcela[];
}

interface PoligonoVigente {
  geojson: { type: string; coordinates: number[][][] };
  areaHaCalculada: number | null;
  fuente: string;
  version: number;
}

interface ParcelaHermana {
  id: string;
  codigoParcela: string;
}

// Paleta para distinguir las parcelas hermanas en el mapa — se repite
// ciclicamente si hay mas parcelas que colores.
const PALETA_PARCELAS = ["#f59e0b", "#16a34a", "#9333ea", "#0891b2", "#db2777", "#e11d48"];

export default async function ParcelaDetallePage({ params }: { params: { id: string } }) {
  const { id } = params;

  let parcela: ParcelaDetalle;
  let poligono: PoligonoVigente | null = null;
  let poligonoPredio: PoligonoVigente | null = null;
  let poligonosHermanasVisibles = 0;
  const capasReferencia: { geojson: PoligonoVigente["geojson"]; color: string; etiqueta: string }[] = [];
  try {
    const res = await apiFetch<{ success: boolean; data: ParcelaDetalle }>(`/api/parcelas/${id}`);
    if (!res.success) notFound();
    parcela = res.data;

    const [resPoligono, resPoligonoPredio, resHermanas] = await Promise.all([
      apiFetch<{ poligono: PoligonoVigente }>(`/api/parcelas/${id}/poligono`)
        .then((r) => r.poligono)
        .catch(() => null),
      apiFetch<{ poligono: PoligonoVigente }>(`/api/predios/${parcela.predioId}/poligono`)
        .then((r) => r.poligono)
        .catch(() => null),
      apiFetch<{ parcelas: ParcelaHermana[] }>(`/api/parcelas?predioId=${parcela.predioId}`)
        .then((r) => r.parcelas.filter((p) => p.id !== id))
        .catch(() => []),
    ]);
    poligono = resPoligono;
    poligonoPredio = resPoligonoPredio;

    if (poligonoPredio) {
      capasReferencia.push({ geojson: poligonoPredio.geojson, color: "#3388ff", etiqueta: parcela.predioNombre ?? "Predio" });
    }

    const poligonosHermanas = await Promise.all(
      resHermanas.map((h) =>
        apiFetch<{ poligono: PoligonoVigente }>(`/api/parcelas/${h.id}/poligono`)
          .then((r) => r.poligono)
          .catch(() => null)
      )
    );
    poligonosHermanas.forEach((pol, i) => {
      if (pol) {
        capasReferencia.push({
          geojson: pol.geojson,
          color: PALETA_PARCELAS[i % PALETA_PARCELAS.length],
          etiqueta: resHermanas[i].codigoParcela,
        });
        poligonosHermanasVisibles++;
      }
    });
  } catch {
    notFound();
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link href={`/predios/${parcela.predioId}`} className="text-sm text-gray-400 hover:text-verde-500">
          ← {parcela.predioNombre ?? "Predio"}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">
          {parcela.codigoParcela}{parcela.nombre ? ` — ${parcela.nombre}` : ""}
        </h1>
        <p className="text-gray-500 mt-1">
          {parcela.areaHa} ha{parcela.usoActual ? ` · ${parcela.usoActual}` : ""}
        </p>
      </div>

      <div className="space-y-6">
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4">Datos de la parcela</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <InfoItem label="Área" value={`${parcela.areaHa} ha`} />
            <InfoItem label="Uso actual" value={parcela.usoActual ?? "—"} />
            {parcela.latitud != null && parcela.longitud != null && (
              <InfoItem label="Coordenadas" value={`${parcela.latitud}, ${parcela.longitud}`} />
            )}
            <InfoItem label="Estado" value={parcela.activo ? "Activa" : "Inactiva"} />
          </dl>
        </div>

        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4">Polígono de la parcela</h2>
          <PoligonoMapa
            endpoint={`/api/parcelas/${parcela.id}/poligono`}
            centroLat={parcela.latitud ?? parcela.predioLatitud ?? 4.6}
            centroLon={parcela.longitud ?? parcela.predioLongitud ?? -74.1}
            poligonoInicial={poligono}
            color="#e11d48"
            capasReferencia={capasReferencia}
          />
          {(poligonoPredio || poligonosHermanasVisibles > 0) && (
            <p className="text-xs text-gray-400 mt-2">
              {poligonoPredio && "El trazo azul punteado muestra el límite del predio. "}
              {poligonosHermanasVisibles > 0 &&
                `Los demás trazos punteados de color son ${poligonosHermanasVisibles === 1 ? "la otra parcela" : "las otras parcelas"} del mismo predio.`}
            </p>
          )}
        </div>

        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4">
            Lotes
            <span className="ml-2 text-xs font-normal text-gray-400">({parcela.lotes.length})</span>
          </h2>
          {parcela.lotes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin lotes registrados en esta parcela</p>
          ) : (
            <div className="space-y-2">
              {parcela.lotes.map((l) => (
                <Link key={l.id} href={`/lotes/${l.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors">
                    <div>
                      <p className="text-sm font-mono font-medium text-gray-800">{l.codigoLote}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {l.especie}{l.variedad ? ` · ${l.variedad}` : ""} · {l.areaHa} ha
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!l.loteIdOnchain && (
                        <span className="badge bg-amber-50 text-amber-600 text-[10px]" title="No registrado en blockchain">
                          Sin blockchain
                        </span>
                      )}
                      <span className="badge bg-gray-100 text-gray-600 text-xs">{l.estado}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-gray-400 text-xs">{label}</dt>
      <dd className="text-gray-800 font-medium text-sm mt-0.5">{value}</dd>
    </div>
  );
}
