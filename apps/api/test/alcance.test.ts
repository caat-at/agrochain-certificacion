import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { crearApp, firmar, conToken } from "./helpers.js";

const LOTE_AJENO = "11111111-1111-4111-8111-111111111111";
const LOTE_PROPIO = "22222222-2222-4222-8222-222222222222";
const AGRICULTOR = "aaaa-usuario-agricultor";
const ADMIN = "bbbb-usuario-admin";

const lote = (id: string) => ({
  id,
  codigoLote: "lote_001",
  agricultorId: AGRICULTOR,
  predioId: "p",
  parcelaId: "par",
  predio: { id: "p", propietario: null },
  agricultor: null,
  plantas: [],
  eventos: [],
  certificado: null,
  campanas: [],
});

vi.mock("@agrochain/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@agrochain/database")>();
  return {
    ...actual,
    getLoteDetalle: vi.fn(async (id: string) => (id === LOTE_PROPIO ? lote(id) : null)),
    getLoteConDetalleByCodigo: vi.fn(async () => lote(LOTE_PROPIO)),
    getLoteById: vi.fn(async (id: string) => (id === LOTE_PROPIO ? { id, parcelaId: "par" } : null)),
    getEventoProduccionDetalle: vi.fn(async () => ({ id: "ev" })),
    listEventosProduccion: vi.fn(async () => [{ id: "ev" }]),
    listLotesConResumen: vi.fn(async () => []),
    listPlantasByLote: vi.fn(async () => []),
  };
});

const db = await import("@agrochain/database");
let app: FastifyInstance;
let tokenAgricultor: string;
let tokenAdmin: string;
let tokenConsumidor: string;

beforeAll(async () => {
  app = await crearApp();
  tokenAgricultor = firmar(app, { sub: AGRICULTOR, rol: "AGRICULTOR" });
  tokenAdmin = firmar(app, { sub: ADMIN, rol: "ADMIN" });
  tokenConsumidor = firmar(app, { sub: "cccc", rol: "CONSUMIDOR" });
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("lectura de lote por id", () => {
  it("el agricultor ve su propio lote", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/lotes/${LOTE_PROPIO}`,
      headers: conToken(tokenAgricultor),
    });
    expect(res.statusCode).toBe(200);
    expect(db.getLoteDetalle).toHaveBeenCalledWith(LOTE_PROPIO, AGRICULTOR);
  });

  it("el agricultor ve 404 para un lote ajeno, no 403", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/lotes/${LOTE_AJENO}`,
      headers: conToken(tokenAgricultor),
    });
    expect(res.statusCode).toBe(404);
    expect(db.getLoteDetalle).toHaveBeenCalledWith(LOTE_AJENO, AGRICULTOR);
  });

  it("el admin no tiene filtro de propiedad", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/lotes/${LOTE_AJENO}`,
      headers: conToken(tokenAdmin),
    });
    expect(res.statusCode).toBe(404);
    expect(db.getLoteDetalle).toHaveBeenCalledWith(LOTE_AJENO, undefined);
  });

  it("un CONSUMIDOR no accede ni siquiera al de su propio rol", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/lotes/${LOTE_PROPIO}`,
      headers: conToken(tokenConsumidor),
    });
    expect(res.statusCode).toBe(403);
    expect(db.getLoteDetalle).not.toHaveBeenCalled();
  });
});

describe("lote por codigo", () => {
  it("acota por agricultor en vez de devolver cualquier codigo", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/lotes/codigo/lote_001",
      headers: conToken(tokenAgricultor),
    });
    expect(res.statusCode).toBe(200);
    expect(db.getLoteConDetalleByCodigo).toHaveBeenCalledWith("lote_001", AGRICULTOR);
  });

  it("el admin busca por codigo sin filtro", async () => {
    await app.inject({
      method: "GET",
      url: "/api/lotes/codigo/lote_001",
      headers: conToken(tokenAdmin),
    });
    expect(db.getLoteConDetalleByCodigo).toHaveBeenCalledWith("lote_001", undefined);
  });
});

describe("listado de eventos", () => {
  it("un agricultor solo recibe eventos de sus lotes", async () => {
    await app.inject({ method: "GET", url: "/api/eventos", headers: conToken(tokenAgricultor) });
    expect(db.listEventosProduccion).toHaveBeenCalledWith(
      expect.objectContaining({ agricultorId: AGRICULTOR })
    );
  });

  it("el admin recibe eventos de todos los lotes", async () => {
    await app.inject({ method: "GET", url: "/api/eventos", headers: conToken(tokenAdmin) });
    expect(db.listEventosProduccion).toHaveBeenCalledWith(
      expect.objectContaining({ agricultorId: undefined })
    );
  });

  it("un CONSUMIDOR no lista eventos", async () => {
    const res = await app.inject({ method: "GET", url: "/api/eventos", headers: conToken(tokenConsumidor) });
    expect(res.statusCode).toBe(403);
    expect(db.listEventosProduccion).not.toHaveBeenCalled();
  });
});

describe("evento individual", () => {
  it("acota el detalle por el agricultor del lote que lo contiene", async () => {
    await app.inject({
      method: "GET",
      url: "/api/eventos/ev-1",
      headers: conToken(tokenAgricultor),
    });
    expect(db.getEventoProduccionDetalle).toHaveBeenCalledWith("ev-1", AGRICULTOR);
  });

  it("el admin ve el detalle sin filtro", async () => {
    await app.inject({
      method: "GET",
      url: "/api/eventos/ev-1",
      headers: conToken(tokenAdmin),
    });
    expect(db.getEventoProduccionDetalle).toHaveBeenCalledWith("ev-1", undefined);
  });
});

describe("plantas del lote", () => {
  it("el agricultor no lee plantas de lotes ajenos", async () => {
    await app.inject({
      method: "GET",
      url: `/api/lotes/${LOTE_AJENO}/plantas`,
      headers: conToken(tokenAgricultor),
    });
    expect(db.listPlantasByLote).toHaveBeenCalledWith(LOTE_AJENO, AGRICULTOR);
  });
});
