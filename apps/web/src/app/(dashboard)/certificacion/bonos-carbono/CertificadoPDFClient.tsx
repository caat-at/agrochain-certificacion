"use client";
import dynamic from "next/dynamic";

const DescargarCertificadoBtn = dynamic(
  () => import("./CertificadoPDF"),
  { ssr: false }
);

export default DescargarCertificadoBtn;