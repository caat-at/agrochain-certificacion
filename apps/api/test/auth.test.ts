import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { crearApp, firmar, conToken } from "./helpers.js";

// Los tests de autorizacion no dependen de Postgres: cualquier query que se
// escape del mock tiene que explotar enseguida, no conectarse a una BD real.
vi.mock("@agrochain/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@agrochain/database")>();
  return {
    ...actual,
    getLoteDetalle: vi.fn(async () => null),
    getLoteConDetalleByCodigo: vi.fn(async () => null),
    getLoteById: vi.fn(async () => null),
    listLotesConResumen: vi.fn(async () => []),
    listEventosProduccion: vi.fn(async () => []),
    getEventoProduccionDetalle: vi.fn(async () => null),
    listPlantasByLote: vi.fn(async () => []),
    listPaises: vi.fn(async () => [{ codigo: "CO", nombre: "Colombia" }]),
    // null -> el handler responde 404 y jamas ve un 401. Eso es lo que hay que
    // probar: si alguien le pone preHandler a /verificar, se rompe enseguida.
    getLoteParaVerificacionPublica: vi.fn(async () => null),
  };
});

let app: FastifyInstance;

beforeAll(async () => {
  app = await crearApp();
});

afterAll(async () => {
  await app.close();
});

const RUTAS_PROTEGIDAS = [
  { method: "GET" as const, url: "/api/lotes/00000000-0000-4000-8000-000000000000" },
  { method: "GET" as const, url: "/api/lotes/codigo/lote_001" },
  { method: "GET" as const, url: "/api/eventos" },
  { method: "GET" as const, url: "/api/eventos/00000000-0000-4000-8000-000000000000" },
];

describe("rutas protegidas sin credencial", () => {
  for (const ruta of RUTAS_PROTEGIDAS) {
    it(`${ruta.method} ${ruta.url} responde 401`, async () => {
      const res = await app.inject(ruta);
      expect(res.statusCode).toBe(401);
    });
  }

  it("el body del 401 no expone el codigo interno de Fastify", async () => {
    const res = await app.inject({ method: "GET", url: "/api/eventos" });
    expect(res.statusCode).toBe(401);
    // Este era el punto de 918c609: antes respondia un FST_JWT_NO_AUTHORIZATION_IN_HEADER
    // que revela como esta construida la app. El mensaje es el del middleware.
    expect(res.body).not.toContain("FST_JWT");
    expect(JSON.parse(res.body)).toEqual({ message: "Token inválido o expirado" });
  });

  it("el 401 del decorator coincide con el del middleware", async () => {
    const decorator = await app.inject({ method: "GET", url: "/api/eventos" });

    // Ruta protegida con el `authenticate` importado, no el decorator.
    const middleware = await app.inject({
      method: "POST",
      url: "/api/sync/eventos",
      payload: { eventos: [] },
    });

    expect(decorator.statusCode).toBe(401);
    expect(middleware.statusCode).toBe(401);
    expect(JSON.parse(decorator.body)).toEqual(JSON.parse(middleware.body));
  });

  it("rechaza un token firmado con otro secreto", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/eventos",
      headers: { Authorization: "Bearer " + "header.payload.firma" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("no ejecuta el handler cuando no hay token", async () => {
    const { listEventosProduccion } = await import("@agrochain/database");
    vi.mocked(listEventosProduccion).mockClear();

    const res = await app.inject({ method: "GET", url: "/api/eventos" });

    expect(res.statusCode).toBe(401);
    expect(listEventosProduccion).not.toHaveBeenCalled();
  });
});

describe("rutas publicas siguen publicas", () => {
  it("GET /health sin token", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).status).toBe("ok");
  });

  it("GET /api/catalogo/paises sin token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/catalogo/paises" });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).paises).toHaveLength(1);
  });

  it("GET /api/verificar/:codigoLote sin token (portal del consumidor)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/verificar/lote_001" });
    expect(res.statusCode).toBe(404);
    expect(res.statusCode).not.toBe(401);
  });
});
