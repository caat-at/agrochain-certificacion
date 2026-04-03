/**
 * Cliente HTTP para el API de AgroChain.
 * Funciona tanto en Server Components (con cookies del request)
 * como en Client Components (leyendo el token del cookie almacenado).
 */
import { cookies } from "next/headers";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

// ── SERVER-SIDE (Server Components / Route Handlers) ─────────────────────────

async function getToken(): Promise<string | undefined> {
  try {
    const store = await cookies();
    return store.get("ac_token")?.value;
  } catch {
    return undefined;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const extraHeaders = (options.headers ?? {}) as Record<string, string>;
  const headers: Record<string, string> = {
    ...("body" in options && options.body !== undefined
      ? { "Content-Type": "application/json" }
      : {}),
    ...extraHeaders,
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new Error((err as { message?: string }).message ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── CLIENT-SIDE fetch wrapper ─────────────────────────────────────────────────
// Se usa desde componentes "use client" con el token en cookie

export function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
}
