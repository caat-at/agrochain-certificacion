export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { apiFetch } from "@/lib/api";
import { StbnEvidenciaSeccion, type StbnSubcriterio, type StbnEvidenciaPilar } from "../StbnEvidenciaSeccion";
import { StbnEvaluacionSeccion, type StbnEvaluacion, type StbnCalificacion, type PuntajeStbnLote } from "../StbnEvaluacionSeccion";

interface LotePredio {
  id: string;
  codigoLote: string;
  loteIdOnchain: string | null;
}

interface PredioResumen {
  id: string;
  nombrePredio: string;
  lotes: LotePredio[];
}

export default async function PredioStbnPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const token = cookies().get("ac_token")?.value ?? "";

  let predio: PredioResumen;
  let subcriterios: StbnSubcriterio[] = [];
  let evidencias: StbnEvidenciaPilar[] = [];
  let evaluacion: StbnEvaluacion | null = null;
  let calificaciones: StbnCalificacion[] = [];
  let puntaje: PuntajeStbnLote | null = null;

  try {
    const [resPredio, resSubcriterios, resEvidencias, resEvaluacion] = await Promise.all([
      apiFetch<{ success: boolean; data: PredioResumen }>(`/api/predios/${id}`),
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
      <div className="mb-6">
        <Link href={`/predios/${predio.id}`} className="text-sm text-gray-400 hover:text-verde-500">
          ← {predio.nombrePredio}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Certificación STBN</h1>
        <p className="text-gray-500 mt-1">{predio.nombrePredio}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-4">Evidencia STBN por pilar</h2>
            <StbnEvidenciaSeccion predioId={predio.id} evidenciasIniciales={evidencias} token={token} />
          </div>
        </div>

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
