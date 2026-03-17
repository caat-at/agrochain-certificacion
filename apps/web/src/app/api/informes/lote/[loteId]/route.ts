import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { cookies } from "next/headers";
import { InformeTrazabilidad } from "@/lib/pdf/InformeTrazabilidad";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

export async function GET(
  _req: NextRequest,
  context: { params: { loteId: string } }
) {
  const loteId = context.params.loteId;

  // Obtener token de sesión
  const cookieStore = await cookies();
  const token = cookieStore.get("ac_token")?.value;
  if (!token) {
    return NextResponse.json({ message: "No autenticado" }, { status: 401 });
  }

  // Obtener datos del informe desde la API
  const res = await fetch(`${API_URL}/api/informes/lote/${loteId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json(
      { message: (err as any).message ?? `Error ${res.status}` },
      { status: res.status }
    );
  }

  const data = await res.json();

  // Generar PDF
  let buffer: Buffer;
  try {
    buffer = await renderToBuffer(
      createElement(InformeTrazabilidad, { data })
    );
  } catch (pdfErr) {
    console.error("[PDF] Error al renderizar:", pdfErr);
    return NextResponse.json(
      { message: `Error al generar PDF: ${String(pdfErr)}` },
      { status: 500 }
    );
  }

  const codigoLote = data.lote?.codigoLote ?? loteId;
  const filename = `trazabilidad-${codigoLote}-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length":      String(buffer.byteLength),
    },
  });
}
