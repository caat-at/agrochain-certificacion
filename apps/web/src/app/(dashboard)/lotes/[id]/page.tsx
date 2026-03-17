export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { estadoColor, estadoLabel, formatFecha, truncarHash } from "@/lib/utils";
import { cookies } from "next/headers";
import Link from "next/link";
import QRCodeImg from "@/components/QRCode";
import RegistrarBlockchainBtn from "./RegistrarBlockchainBtn";
import { DescargarPdfBtn } from "./DescargarPdfBtn";

interface CampanaLote {
  id: string;
  nombre: string;
  estado: "ABIERTA" | "CERRADA";
  fechaApertura: string;
  fechaCierre: string | null;
  campanaHash: string | null;
  camposRequeridos: string;
  _count: { registros: number };
  creador: { nombres: string; apellidos: string };
}

interface LoteDetalle {
  id: string;
  codigoLote: string;
  especie: string;
  variedad: string | null;
  areaHa: number;
  estado: string;
  dataHash: string | null;
  txRegistro: string | null;
  fechaSiembra: string | null;
  fechaCosechaEst: string | null;
  createdAt: string;
  predio: {
    nombrePredio: string;
    departamento: string;
    municipio: string;
    vereda: string | null;
    latitud: number | null;
    longitud: number | null;
    altitudMsnm: number | null;
  };
  agricultor: { nombres: string; apellidos: string; numeroDocumento: string };
  eventos: Array<{
    id: string;
    tipoEvento: string;
    fechaEvento: string;
    descripcion: string;
    syncEstado: string;
    hashVerificado: boolean;
    contentHash: string | null;
    creadoEn: string;
  }>;
  certificado: {
    id: string;
    numeroCertificado: string;
    tipo: string;
    fechaEmision: string;
    fechaVencimiento: string;
    revocado: boolean;
    tokenId: number | null;
  } | null;
}

export default async function LoteDetallePage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  let lote: LoteDetalle;
  let campanas: CampanaLote[] = [];

  const token = cookies().get("ac_token")?.value ?? "";

  try {
    const [resLote, resCampanas] = await Promise.all([
      apiFetch<{ success: boolean; data: LoteDetalle }>(`/api/lotes/${id}`),
      apiFetch<{ campanas: CampanaLote[] }>(`/api/campanas?loteId=${id}`).catch(() => ({ campanas: [] })),
    ]);
    if (!resLote.success) notFound();
    lote = resLote.data;
    campanas = resCampanas.campanas;
  } catch {
    notFound();
  }

  const estadoCls = estadoColor(lote.estado as any);

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/lotes" className="text-sm text-gray-400 hover:text-verde-500">← Lotes</Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 font-mono">{lote.codigoLote}</h1>
          <p className="text-gray-500 mt-1">{lote.especie}{lote.variedad ? ` · ${lote.variedad}` : ""}</p>
        </div>
        <span className={`badge text-sm px-3 py-1 ${estadoCls}`}>
          {estadoLabel(lote.estado as any)}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info del predio */}
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-4">Predio</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <InfoItem label="Nombre" value={lote.predio.nombrePredio} />
              <InfoItem label="Área" value={`${lote.areaHa} ha`} />
              <InfoItem label="Departamento" value={lote.predio.departamento} />
              <InfoItem label="Municipio" value={lote.predio.municipio} />
              {lote.predio.vereda && <InfoItem label="Vereda" value={lote.predio.vereda} />}
              {lote.predio.altitudMsnm && (
                <InfoItem label="Altitud" value={`${lote.predio.altitudMsnm} msnm`} />
              )}
              {lote.fechaSiembra && (
                <InfoItem label="Siembra" value={formatFecha(lote.fechaSiembra)} />
              )}
              {lote.fechaCosechaEst && (
                <InfoItem label="Cosecha est." value={formatFecha(lote.fechaCosechaEst)} />
              )}
            </dl>
          </div>

          {/* Eventos de trazabilidad */}
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-4">
              Eventos de trazabilidad
              <span className="ml-2 text-xs font-normal text-gray-400">
                ({lote.eventos.length} registros)
              </span>
            </h2>

            {lote.eventos.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                Sin eventos registrados aún
              </p>
            ) : (
              <div className="space-y-3">
                {lote.eventos.map((ev) => (
                  <div key={ev.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                      ev.hashVerificado ? "bg-emerald-400" : "bg-amber-400"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-800">
                          {ev.tipoEvento.replace(/_/g, " ")}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatFecha(ev.fechaEvento)}
                        </span>
                      </div>
                      {ev.descripcion && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{ev.descripcion}</p>
                      )}
                      {ev.contentHash && (
                        <p className="text-[10px] text-gray-300 mt-1 font-mono">
                          SHA256: {truncarHash(ev.contentHash, 20)}
                        </p>
                      )}
                    </div>
                    <span className={`badge text-[10px] ${
                      ev.syncEstado === "VERIFICADO"
                        ? "bg-emerald-50 text-emerald-600"
                        : ev.syncEstado === "RECHAZADO"
                        ? "bg-red-50 text-red-600"
                        : "bg-amber-50 text-amber-600"
                    }`}>
                      {ev.syncEstado}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Campañas del lote */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">
                Campañas
                <span className="ml-2 text-xs font-normal text-gray-400">({campanas.length})</span>
              </h2>
              <Link
                href="/campanas"
                className="text-xs text-verde-500 hover:text-verde-600 font-medium"
              >
                Ver todas →
              </Link>
            </div>

            {campanas.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-gray-400">Sin campañas para este lote</p>
                <Link
                  href="/campanas"
                  className="inline-block mt-2 text-xs text-verde-500 hover:text-verde-600 font-medium"
                >
                  + Crear campaña
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {campanas.map((c) => {
                  const campos: string[] = (() => {
                    try { return JSON.parse(c.camposRequeridos); } catch { return []; }
                  })();
                  return (
                    <Link key={c.id} href={`/campanas/${c.id}`}>
                      <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            c.estado === "ABIERTA" ? "bg-emerald-500 animate-pulse" : "bg-gray-300"
                          }`} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{c.nombre}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              {c._count.registros} plantas · {campos.length} campos
                              {c.campanaHash && (
                                <span className="text-emerald-600 ml-1">· Hash ✓</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right ml-3">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                            c.estado === "ABIERTA"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-gray-100 text-gray-500 border-gray-200"
                          }`}>
                            {c.estado === "ABIERTA" ? "Abierta" : "Cerrada"}
                          </span>
                          <p className="text-[10px] text-gray-400 mt-1">
                            {formatFecha(c.fechaApertura)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Columna derecha */}
        <div className="space-y-6">
          {/* Agricultor */}
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-3">Agricultor</h2>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-verde-50 rounded-full flex items-center justify-center text-verde-500 font-semibold">
                {lote.agricultor.nombres.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {lote.agricultor.nombres} {lote.agricultor.apellidos}
                </p>
                <p className="text-xs text-gray-400">CC {lote.agricultor.numeroDocumento}</p>
              </div>
            </div>
          </div>

          {/* Informe PDF */}
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-3">Informe de trazabilidad</h2>
            <p className="text-xs text-gray-400 mb-3">
              Genera un PDF con campañas, registros de campo, hashes de integridad y certificado.
            </p>
            <DescargarPdfBtn loteId={lote.id} codigoLote={lote.codigoLote} />
          </div>

          {/* Integridad blockchain */}
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-3">Polygon Blockchain</h2>
            {lote.dataHash ? (
              <>
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                  <span className="font-medium">SHA256:</span>
                </div>
                <p className="text-[10px] font-mono text-gray-400 break-all leading-relaxed mb-3">
                  {lote.dataHash}
                </p>
                <RegistrarBlockchainBtn
                  loteId={lote.id}
                  txRegistro={lote.txRegistro}
                  token={token}
                />
              </>
            ) : (
              <p className="text-sm text-gray-400">Sin hash — sincroniza el lote desde la app móvil primero</p>
            )}
          </div>

          {/* Certificado */}
          {lote.certificado && (
            <div className={`card border-2 ${
              lote.certificado.revocado ? "border-red-200" : "border-verde-500"
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <svg className={`w-5 h-5 ${lote.certificado.revocado ? "text-red-400" : "text-verde-500"}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 0 0 1.946-.806 3.42 3.42 0 0 1 4.438 0 3.42 3.42 0 0 0 1.946.806 3.42 3.42 0 0 1 3.138 3.138 3.42 3.42 0 0 0 .806 1.946 3.42 3.42 0 0 1 0 4.438 3.42 3.42 0 0 0-.806 1.946 3.42 3.42 0 0 1-3.138 3.138 3.42 3.42 0 0 0-1.946.806 3.42 3.42 0 0 1-4.438 0 3.42 3.42 0 0 0-1.946-.806 3.42 3.42 0 0 1-3.138-3.138 3.42 3.42 0 0 0-.806-1.946 3.42 3.42 0 0 1 0-4.438 3.42 3.42 0 0 0 .806-1.946 3.42 3.42 0 0 1 3.138-3.138z" />
                </svg>
                <span className="font-semibold text-sm">
                  {lote.certificado.revocado ? "Certificado revocado" : "Certificado activo"}
                </span>
              </div>
              <dl className="space-y-1.5 text-xs">
                <InfoItem label="N°" value={lote.certificado.numeroCertificado} />
                <InfoItem label="Tipo" value={lote.certificado.tipo.replace(/_/g, " ")} />
                <InfoItem label="Emitido" value={formatFecha(lote.certificado.fechaEmision)} />
                <InfoItem label="Vence" value={formatFecha(lote.certificado.fechaVencimiento)} />
                {lote.certificado.tokenId && (
                  <InfoItem label="NFT Token" value={`#${lote.certificado.tokenId}`} />
                )}
              </dl>

              {/* QR de verificación pública */}
              {!lote.certificado.revocado && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col items-center gap-2">
                  <p className="text-xs text-gray-400 font-medium">Código QR de verificación</p>
                  <QRCodeImg
                    value={`${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/verificar?codigo=${lote.codigoLote}`}
                    size={140}
                  />
                  <p className="text-[10px] text-gray-300 font-mono">{lote.codigoLote}</p>
                </div>
              )}
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
