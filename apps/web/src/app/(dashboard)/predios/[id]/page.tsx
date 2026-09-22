export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { apiFetch } from "@/lib/api";
import { StbnEvidenciaSeccion, type StbnSubcriterio, type StbnEvidenciaPilar } from "./StbnEvidenciaSeccion";
import { StbnEvaluacionSeccion, type StbnEvaluacion, type StbnCalificacion, type PuntajeStbnLote } from "./StbnEvaluacionSeccion";

interface LotePredio {
  id: string;
  codigoLote: string;
  especie: string;
  variedad: string | null;
  areaHa: number;
  estado: string;
  totalPlantas: number;
  loteIdOnchain: string | null;
}

interface PredioDetalle {
  id: string;
  nombrePredio: string;
  departamento: string;
  municipio: string;
  vereda: string | null;
  areaTotalHa: number;
  areaProductivaHa: number | null;
  areaBosqueHa: number | null;
  latitud: number;
  longitud: number;
  altitudMsnm: number | null;
  lotes: LotePredio[];
}

export default async function PredioDetallePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const token = cookies().get("ac_token")?.value ?? "";

  let predio: PredioDetalle;
  let subcriterios: StbnSubcriterio[] = [];
  let evidencias: StbnEvidenciaPilar[] = [];
  let evaluacion: StbnEvaluacion | null = null;
  let calificaciones: StbnCalificacion[] = [];
  let puntaje: PuntajeStbnLote | null = null;

  try {
    const [resPredio, resSubcriterios, resEvidencias, resEvaluacion] = await Promise.all([
      apiFetch<{ success: boolean; data: PredioDetalle }>(`/api/predios/${id}`),
      apiFetch<{ subcriterios: StbnSubcriterio[] }>(`/api/stbn/subcriterios`),
      apiFetch<{ evidencias: StbnEvidenciaPilar[] }>(`/api/stbn/predios/${id}/evidencias`),
      apiFetch<{ evaluacion: StbnEvaluacion | null; calificaciones: StbnCalificacion[] }>(
        `/api/stbn/predios/${id}/evaluacion`
      ),
    ]);
    if (!resPredio.success) notFound();
    predio = resPredio.data;
    subcriterios = resSubcriterios.subcriterios;
    evidencias = resEvidencias.evidencias;
    evaluacion = resEvaluacion.evaluacion;
    calificaciones = resEvaluacion.calificaciones;

    const primerLote = predio.lotes?.[0];
    if (primerLote) {
      const resPuntaje = await apiFetch<{ puntaje: PuntajeStbnLote }>(`/api/stbn/lotes/${primerLote.id}/puntaje`).catch(
        () => null
      );
      puntaje = resPuntaje?.puntaje ?? null;
    }
  } catch {
    notFound();
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link href="/predios" className="text-sm text-gray-400 hover:text-verde-500">← Predios</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{predio.nombrePredio}</h1>
          <p className="text-gray-500 mt-1">
            {predio.municipio}, {predio.departamento}{predio.vereda ? ` · ${predio.vereda}` : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Datos del predio */}
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-4">Datos del predio</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <InfoItem label="Área total" value={`${predio.areaTotalHa} ha`} />
              {predio.areaProductivaHa != null && (
                <InfoItem label="Área productiva" value={`${predio.areaProductivaHa} ha`} />
              )}
              {predio.areaBosqueHa != null && <InfoItem label="Área de bosque" value={`${predio.areaBosqueHa} ha`} />}
              {predio.altitudMsnm != null && <InfoItem label="Altitud" value={`${predio.altitudMsnm} msnm`} />}
              <InfoItem label="Coordenadas" value={`${predio.latitud}, ${predio.longitud}`} />
            </dl>
          </div>

          {/* Lotes del predio */}
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-4">
              Lotes
              <span className="ml-2 text-xs font-normal text-gray-400">({predio.lotes.length})</span>
            </h2>
            {predio.lotes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Sin lotes registrados en este predio</p>
            ) : (
              <div className="space-y-2">
                {predio.lotes.map((l) => (
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

          {/* Evidencia narrativa STBN por pilar */}
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-4">Evidencia STBN por pilar</h2>
            <StbnEvidenciaSeccion predioId={predio.id} evidenciasIniciales={evidencias} token={token} />
          </div>
        </div>

        {/* Columna derecha: evaluación + puntaje */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-4">Evaluación STBN</h2>
            <StbnEvaluacionSeccion
              predioId={predio.id}
              subcriterios={subcriterios}
              evaluacionInicial={evaluacion}
              calificacionesIniciales={calificaciones}
              puntajeInicial={puntaje}
              lotes={predio.lotes.map((l) => ({ id: l.id, codigoLote: l.codigoLote, registradoOnchain: !!l.loteIdOnchain }))}
              token={token}
            />
          </div>
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
