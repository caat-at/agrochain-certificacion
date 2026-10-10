export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import dynamicImport from "next/dynamic";
import { apiFetch } from "@/lib/api";
import { EudrSeccion, type EudrEstadoParcela } from "./EudrSeccion";
import { EvaluacionRiesgoParcelaSeccion, type EudrEvaluacionRiesgoParcela } from "./EvaluacionRiesgoParcelaSeccion";

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

interface MedidaMitigacion {
  id: string;
  descripcion: string;
  responsable: string | null;
}

interface EudrEstadoRiesgo {
  predio: { tieneEvaluacion: boolean; nivelRiesgoGlobal: string | null };
  parcela: { tieneEvaluacion: boolean; nivelRiesgoGlobal: string | null };
  esAceptable: boolean;
}

interface ParcelaHermana {
  id: string;
  codigoParcela: string;
}

// Paleta para distinguir las parcelas hermanas en el mapa — se repite
// ciclicamente si hay mas parcelas que colores. Misma paleta que el
// detalle de parcela (/parcelas/[id]/page.tsx), para consistencia visual.
const PALETA_PARCELAS = ["#f59e0b", "#16a34a", "#9333ea", "#0891b2", "#db2777", "#e11d48"];

export default async function CertificacionEudrParcelaPage({ params }: { params: { parcelaId: string } }) {
  const { parcelaId } = params;
  const token = cookies().get("ac_token")?.value ?? "";

  let parcela: ParcelaResumen;
  let eudrEstado: EudrEstadoParcela | null = null;
  let poligono: PoligonoVigente | null = null;
  let evaluacionParcela: EudrEvaluacionRiesgoParcela | null = null;
  let medidasParcela: MedidaMitigacion[] = [];
  let estadoRiesgo: EudrEstadoRiesgo | null = null;
  let poligonoPredio: PoligonoVigente | null = null;
  let poligonosHermanasVisibles = 0;
  const capasReferencia: { geojson: PoligonoVigente["geojson"]; color: string; etiqueta: string }[] = [];
  try {
    const res = await apiFetch<{ success: boolean; data: ParcelaResumen }>(`/api/parcelas/${parcelaId}`);
    if (!res.success) notFound();
    parcela = res.data;
    const [eudrEstadoRes, poligonoRes, evalRes, estadoRiesgoRes, poligonoPredioRes, hermanasRes] = await Promise.all([
      apiFetch<{ estado: EudrEstadoParcela }>(`/api/eudr/parcelas/${parcelaId}/estado`)
        .then((r) => r.estado)
        .catch(() => null),
      apiFetch<{ poligono: PoligonoVigente }>(`/api/parcelas/${parcelaId}/poligono`)
        .then((r) => r.poligono)
        .catch(() => null),
      apiFetch<{ evaluacion: EudrEvaluacionRiesgoParcela | null; medidas: MedidaMitigacion[] }>(
        `/api/eudr/parcelas/${parcelaId}/evaluacion-riesgo`
      ).catch(() => ({ evaluacion: null, medidas: [] })),
      apiFetch<{ estadoRiesgo: EudrEstadoRiesgo }>(`/api/eudr/parcelas/${parcelaId}/estado-riesgo`)
        .then((r) => r.estadoRiesgo)
        .catch(() => null),
      apiFetch<{ poligono: PoligonoVigente }>(`/api/predios/${parcela.predioId}/poligono`)
        .then((r) => r.poligono)
        .catch(() => null),
      apiFetch<{ parcelas: ParcelaHermana[] }>(`/api/parcelas?predioId=${parcela.predioId}`)
        .then((r) => r.parcelas.filter((p) => p.id !== parcelaId))
        .catch(() => []),
    ]);
    eudrEstado = eudrEstadoRes;
    poligono = poligonoRes;
    evaluacionParcela = evalRes.evaluacion;
    medidasParcela = evalRes.medidas;
    estadoRiesgo = estadoRiesgoRes;

    poligonoPredio = poligonoPredioRes;
    if (poligonoPredio) {
      capasReferencia.push({ geojson: poligonoPredio.geojson, color: "#3388ff", etiqueta: parcela.predioNombre ?? "Predio" });
    }

    const poligonosHermanas = await Promise.all(
      hermanasRes.map((h) =>
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
          etiqueta: hermanasRes[i].codigoParcela,
        });
        poligonosHermanasVisibles++;
      }
    });
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
            capasReferencia={capasReferencia}
            soloLectura
          />
          {(poligonoPredio || poligonosHermanasVisibles > 0) && (
            <p className="text-xs text-gray-400 mt-2">
              {poligonoPredio && "El trazo azul punteado muestra el límite del predio. "}
              {poligonosHermanasVisibles > 0 &&
                `Los demás trazos punteados de color son ${poligonosHermanasVisibles === 1 ? "la otra parcela" : "las otras parcelas"} del mismo predio.`}
            </p>
          )}
        </div>

        {/* Evaluacion de riesgo (Art. 9-11) — requisito previo a la
            declaracion. El nivel PREDIO es compartido por todas sus parcelas
            y se gestiona en su propia pagina. */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Evaluación de riesgo — Predio</h2>
            <Link href={`/certificacion/eudr/predio/${parcela.predioId}`} className="text-xs text-verde-500 hover:text-verde-600 font-medium">
              Gestionar evaluación del predio →
            </Link>
          </div>
          {estadoRiesgo && (
            <div className="flex flex-wrap gap-2">
              <span className={`badge text-xs ${estadoRiesgo.predio.tieneEvaluacion ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
                {estadoRiesgo.predio.tieneEvaluacion ? `Riesgo predio: ${estadoRiesgo.predio.nivelRiesgoGlobal}` : "Sin evaluación de predio"}
              </span>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4">Evaluación de riesgo — Parcela</h2>
          <EvaluacionRiesgoParcelaSeccion
            parcelaId={parcela.id}
            evaluacionInicial={evaluacionParcela}
            medidasIniciales={medidasParcela}
            poligonoFuente={poligono?.fuente ?? null}
            token={token}
          />
        </div>

        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4">EUDR — Deforestación cero</h2>
          {estadoRiesgo && !estadoRiesgo.esAceptable && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 mb-4">
              Completa la evaluación de riesgo (predio y parcela) con un resultado aceptable antes de poder crear la declaración.
            </div>
          )}
          <EudrSeccion parcelaId={parcela.id} estadoInicial={eudrEstado} token={token} />
        </div>
      </div>
    </div>
  );
}
