import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";

// Cada test firma su propio token con el secreto del app, asi que no hay que
// fixturear JWTs manuales: si cambia el esquema del payload, el test falla aca.
export interface TokenAfirmado {
  sub: string;
  rol: string;
}

export async function crearApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  await app.ready();
  return app;
}

export function firmar(app: FastifyInstance, payload: TokenAfirmado): string {
  return app.jwt.sign({
    sub: payload.sub,
    rol: payload.rol,
    email: `${payload.sub}@agrochain.co`,
    nombre: payload.sub,
  } as never);
}

export function conToken(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
