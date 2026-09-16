import type { FastifyReply, FastifyRequest } from "fastify";
import type { RolUsuario } from "@agrochain/database";

// =============================================================================
// AGROCHAIN - Autenticacion y autorizacion
// Patron replicado de SSE (backend/src/middleware/auth.ts): un `authenticate`
// que verifica el JWT propio (emitido tras Cognito o fallback local, ver
// routes/auth.ts), mas middlewares de rol componibles y encadenables.
//
// En Fastify se implementan como `preHandler` en vez de middleware Express
// (req,res,next), pero cumplen la misma funcion: reemplazar el
// `if (payload.rol !== "ADMIN")` que hoy se repite inline en cada handler.
// =============================================================================

export interface JwtPayload {
  sub: string;
  email: string | null;
  rol: RolUsuario;
  nombre: string;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ message: "Token inválido o expirado" });
  }
}

export function requireRole(...roles: RolUsuario[]) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const payload = request.user as JwtPayload;
    if (!roles.includes(payload.rol)) {
      reply.status(403).send({ message: "No autorizado para esta operación" });
    }
  };
}

export const requireAdmin = requireRole("ADMIN");
