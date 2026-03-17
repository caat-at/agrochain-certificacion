import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { Usuario } from "@/types";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-secret-cambiar-en-produccion"
);
const COOKIE_NAME = "ac_token";

export async function getSession(): Promise<Usuario | null> {
  try {
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, SECRET);
    return {
      id:     payload.sub as string,
      nombre: payload.nombre as string,
      email:  payload.email as string,
      rol:    payload.rol as Usuario["rol"],
    };
  } catch {
    return null;
  }
}

export function setSessionCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
