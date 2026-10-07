import Link from "next/link";

const OPCIONES = [
  {
    href: "/certificacion/eudr",
    titulo: "EUDR",
    descripcion: "Debida diligencia de deforestación-cero (Reglamento UE 2023/1115) por lote — requisito para exportar a la Unión Europea.",
    icono: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M12 21c4.97-4.03 8-7.75 8-11.5A8 8 0 1 0 4 9.5C4 13.25 7.03 16.97 12 21Z" />
    ),
  },
  {
    href: "/certificacion/stbn",
    titulo: "STBN",
    descripcion: "Evaluación por pilares (Conservación, Comunidad, Justicia Social, Tecnología, Derechos Humanos) — PlanetAI Nature Space.",
    icono: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    ),
  },
  {
    href: "/certificacion/bonos-carbono",
    titulo: "Bonos de Carbono",
    descripcion: "Emisión de certificado NFT en blockchain (Polygon) para lotes aprobados en inspección BPA.",
    icono: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 0 0 1.946-.806 3.42 3.42 0 0 1 4.438 0 3.42 3.42 0 0 0 1.946.806 3.42 3.42 0 0 1 3.138 3.138 3.42 3.42 0 0 0 .806 1.946 3.42 3.42 0 0 1 0 4.438 3.42 3.42 0 0 0-.806 1.946 3.42 3.42 0 0 1-3.138 3.138 3.42 3.42 0 0 0-1.946.806 3.42 3.42 0 0 1-4.438 0 3.42 3.42 0 0 0-1.946-.806 3.42 3.42 0 0 1-3.138-3.138 3.42 3.42 0 0 0-.806-1.946 3.42 3.42 0 0 1 0-4.438 3.42 3.42 0 0 0 .806-1.946 3.42 3.42 0 0 1 3.138-3.138z" />
    ),
  },
];

export default function CertificacionHubPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Certificación</h1>
        <p className="text-sm text-gray-500 mt-1">Elige el tipo de certificación a gestionar</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {OPCIONES.map((op) => (
          <Link key={op.href} href={op.href}>
            <div className="card h-full hover:border-verde-300 hover:shadow-sm transition-all">
              <svg className="w-8 h-8 text-verde-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {op.icono}
              </svg>
              <h2 className="font-semibold text-gray-900">{op.titulo}</h2>
              <p className="text-xs text-gray-500 mt-1.5">{op.descripcion}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
