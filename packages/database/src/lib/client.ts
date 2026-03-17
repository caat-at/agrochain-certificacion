import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

// Singleton para reutilizar conexion
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  const authToken = process.env.DATABASE_AUTH_TOKEN;

  if (!url) {
    throw new Error("DATABASE_URL no definida en variables de entorno");
  }

  // Modo local (desarrollo sin Turso)
  if (url.startsWith("file:")) {
    return new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
    });
  }

  // Modo Turso (produccion / staging)
  const adapter = new PrismaLibSQL({
    url,
    authToken,
  });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

// Proxy lazy: el cliente se instancia solo en el primer acceso a cualquier propiedad.
// Garantiza que process.env ya tiene los valores de dotenv cuando se llama createPrismaClient().
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!globalThis.__prisma) {
      globalThis.__prisma = createPrismaClient();
    }
    const val = (globalThis.__prisma as unknown as Record<string | symbol, unknown>)[prop as string];
    return typeof val === "function"
      ? (val as (...a: unknown[]) => unknown).bind(globalThis.__prisma)
      : val;
  },
});
