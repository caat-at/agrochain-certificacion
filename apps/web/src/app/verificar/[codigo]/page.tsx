import { redirect } from "next/navigation";

/**
 * URL con segmento de ruta: /verificar/COL-05-2024-00001
 * El formulario real vive en /verificar y lee ?codigo= (flujo QR),
 * así que se reenvía ahí en vez de duplicar el layout.
 */
export default function VerificarPorRuta({
  params,
}: {
  params: { codigo: string };
}) {
  redirect(`/verificar?codigo=${encodeURIComponent(params.codigo)}`);
}
