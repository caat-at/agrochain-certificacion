export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { apiFetch } from "@/lib/api";
import {
  EvaluacionRiesgoPredioSeccion,
  type EudrPaisRiesgo,
  type EudrEvaluacionRiesgoPredio,
} from "./EvaluacionRiesgoPredioSeccion";

interface PredioResumen {
  id: string;
  nombrePredio: string;
  matriculaInmobiliaria: string | null;
  codigoIca: string | null;
  certifUsoSuelo: string | null;
  territorioIndigena: boolean;
  territorioIndigenaDetalle: string | null;
}

interface MedidaMitigacion {
  id: string;
  descripcion: string;
  responsable: string | null;
  createdAt: string;
}

interface DocumentoTenenciaLegal {
  id: string;
  originalName: string;
  url: string;
}

export default async function CertificacionEudrPredioPage({ params }: { params: { predioId: string } }) {
  const { predioId } = params;
  const token = cookies().get("ac_token")?.value ?? "";

  let predio: PredioResumen;
  let evaluacion: EudrEvaluacionRiesgoPredio | null = null;
  let medidas: MedidaMitigacion[] = [];
  let paises: EudrPaisRiesgo[] = [];
  let documentoTenenciaLegal: DocumentoTenenciaLegal | null = null;
  try {
    const res = await apiFetch<{ success: boolean; data: PredioResumen }>(`/api/predios/${predioId}`);
    if (!res.success) notFound();
    predio = res.data;

    const [resEval, resPaises, resDoc] = await Promise.all([
      apiFetch<{ evaluacion: EudrEvaluacionRiesgoPredio | null; medidas: MedidaMitigacion[] }>(
        `/api/eudr/predios/${predioId}/evaluacion-riesgo`
      ).catch(() => ({ evaluacion: null, medidas: [] })),
      apiFetch<{ paises: EudrPaisRiesgo[] }>(`/api/eudr/paises-riesgo`).catch(() => ({ paises: [] })),
      apiFetch<{ documento: DocumentoTenenciaLegal | null }>(`/api/predios/${predioId}/tenencia-legal-documento`)
        .then((r) => r.documento)
        .catch(() => null),
    ]);
    evaluacion = resEval.evaluacion;
    medidas = resEval.medidas;
    paises = resPaises.paises;
    documentoTenenciaLegal = resDoc;
  } catch {
    notFound();
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/certificacion/eudr" className="text-sm text-gray-400 hover:text-verde-500">← Certificación EUDR</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">{predio.nombrePredio}</h1>
        <p className="text-gray-500 mt-1">
          <Link href={`/predios/${predio.id}`} className="text-verde-500 hover:text-verde-600">
            Ver predio →
          </Link>
        </p>
      </div>

      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4">Evaluación de riesgo EUDR — Predio</h2>
        <EvaluacionRiesgoPredioSeccion
          predioId={predio.id}
          evaluacionInicial={evaluacion}
          medidasIniciales={medidas}
          documentoTenenciaLegal={documentoTenenciaLegal}
          paises={paises}
          datosGeneralesPredio={{
            matriculaInmobiliaria: predio.matriculaInmobiliaria,
            codigoIca: predio.codigoIca,
            certifUsoSuelo: predio.certifUsoSuelo,
            territorioIndigena: predio.territorioIndigena,
            territorioIndigenaDetalle: predio.territorioIndigenaDetalle,
          }}
          token={token}
        />
      </div>
    </div>
  );
}
