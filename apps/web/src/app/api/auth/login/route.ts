import { NextRequest, NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

export async function POST(req: NextRequest) {
  const body = await req.json() as { email: string; password: string };

  const apiRes = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await apiRes.json() as { token?: string; message?: string; usuario?: unknown };

  if (!apiRes.ok || !data.token) {
    return NextResponse.json(
      { message: data.message ?? "Credenciales inválidas" },
      { status: 401 }
    );
  }

  const res = NextResponse.json({ ok: true, usuario: data.usuario });
  res.headers.set("Set-Cookie", setSessionCookie(data.token));
  return res;
}
