import "dotenv/config";
import { buildApp } from "./app.js";
import { startAutoSealCampanaChecker } from "./services/autoSealCampanaChecker.js";

const app = await buildApp();

// ── ARRANQUE ──────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port: PORT, host: HOST });
  console.log(`\n🚀 AgroChain API corriendo en http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
  startAutoSealCampanaChecker();
} catch (err) {
  app.log.error(err);
  process.exit(1);
}