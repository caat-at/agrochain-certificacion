import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

// GET /api/lotes/:id/satelital — proxy al backend: escenas satelitales sobre
// la parcela del lote. Query opcional: satellite, desde, hasta, nubosidad.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = req.cookies.get("ac_token")?.value;
  if (!token) {
    return NextResponse.json({ message: "No autenticado" }, { status: 401 });
  }

  try {
    const qs = req.nextUrl.searchParams.toString();
    const res = await fetch(`${API_URL}/api/lotes/${params.id}/satelital${qs ? `?${qs}` : ""}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json({ message: String(e) }, { status: 500 });
  }
}