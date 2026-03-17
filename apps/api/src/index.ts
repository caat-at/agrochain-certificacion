import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";

import { authRoutes } from "./routes/auth.js";
import { prediosRoutes } from "./routes/predios.js";
import { lotesRoutes } from "./routes/lotes.js";
import { eventosRoutes } from "./routes/eventos.js";
import { syncRoutes } from "./routes/sync.js";
import { verificacionRoutes } from "./routes/verificacion.js";
import { usuariosRoutes } from "./routes/usuarios.js";
import { certificadosRoutes } from "./routes/certificados.js";
import { inspeccionesRoutes } from "./routes/inspecciones.js";
import { campanasRoutes } from "./routes/campanas.js";
import { metricasRoutes }  from "./routes/metricas.js";
import { informesRoutes }  from "./routes/informes.js";
import { verificarConexion } from "./services/blockchain.js";

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === "production" ? "warn" : "info",
  },
});

// ── PLUGINS ──────────────────────────────────────────────────────────────────
await app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? "*",
  credentials: true,
});

await app.register(jwt, {
  secret: process.env.JWT_SECRET ?? "dev-secret-cambiar-en-produccion",
});

// Decorar authenticate para las rutas protegidas
app.decorate("authenticate", async function (request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

await app.register(multipart, {
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max por archivo
});

// ── RUTAS ─────────────────────────────────────────────────────────────────────
await app.register(authRoutes,         { prefix: "/api/auth" });
await app.register(prediosRoutes,      { prefix: "/api/predios" });
await app.register(lotesRoutes,        { prefix: "/api/lotes" });
await app.register(eventosRoutes,      { prefix: "/api/eventos" });
await app.register(syncRoutes,         { prefix: "/api/sync" });
await app.register(verificacionRoutes, { prefix: "/api/verificar" });
await app.register(usuariosRoutes,     { prefix: "/api/usuarios" });
await app.register(certificadosRoutes,   { prefix: "/api/certificados" });
await app.register(inspeccionesRoutes,  { prefix: "/api/inspecciones" });
await app.register(campanasRoutes,      { prefix: "/api/campanas" });
await app.register(metricasRoutes,      { prefix: "/api/metricas" });
await app.register(informesRoutes,      { prefix: "/api/informes" });

// ── HEALTH CHECK ──────────────────────────────────────────────────────────────
app.get("/health", async () => ({
  status: "ok",
  version: "0.0.1",
  timestamp: new Date().toISOString(),
}));

app.get("/api/blockchain/status", async () => {
  const estado = await verificarConexion();
  return estado;
});

// ── ARRANQUE ──────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port: PORT, host: HOST });
  console.log(`\n🚀 AgroChain API corriendo en http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
