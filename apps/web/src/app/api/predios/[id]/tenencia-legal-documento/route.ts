import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = req.cookies.get("ac_token")?.value;
  if (!token) {
    return NextResponse.json({ message: "No autenticado" }, { status: 401 });
  }

  try {
    const res = await fetch(`${API_URL}/api/predios/${params.id}/tenencia-legal-documento`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json({ message: String(e) }, { status: 500 });
  }
}

// Reenvia el multipart/form-data (archivo) tal cual recibido.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = req.cookies.get("ac_token")?.value;
  if (!token) {
    return NextResponse.json({ message: "No autenticado" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const res = await fetch(`${API_URL}/api/predios/${params.id}/tenencia-legal-documento`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json({ message: String(e) }, { status: 500 });
  }
}
