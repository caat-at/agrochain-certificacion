import { createHash } from "crypto";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import pool from "./db/client.js";

// Desde src/ con tsx y desde dist/ compilado, esta ruta resuelve al mismo
// lugar: <paquete>/sql
const SQL_DIR = fileURLToPath(new URL("../sql/", import.meta.url));

type Migracion = {
  archivo: string;
  sql: string;
  checksum: string;
};

type Registrada = {
  archivo: string;
  checksum: string;
};

function crearChecksum(sql: string): string {
  return createHash("sha256").update(sql).digest("hex");
}

function listarMigraciones(): Migracion[] {
  return readdirSync(SQL_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((archivo) => {
      const sql = readFileSync(join(SQL_DIR, archivo), "utf8");
      return { archivo, sql, checksum: crearChecksum(sql) };
    });
}

async function ensureTablaMigraciones(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      archivo     text PRIMARY KEY,
      checksum    text NOT NULL,
      aplicado_en timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function obtenerAplicadas(): Promise<Registrada[]> {
  const { rows } = await pool.query<Registrada>(
    "SELECT archivo, checksum FROM schema_migrations ORDER BY archivo"
  );
  return rows;
}

async function contarTablasDeNegocio(): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(
    `SELECT count(*) AS n
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name <> 'schema_migrations'`
  );
  return Number(rows[0].n);
}

async function registrar(
  archivo: string,
  checksum: string,
  client?: { query: (q: string, v?: unknown[]) => Promise<unknown> }
) {
  const executor = client ?? pool;
  await executor.query(
    "INSERT INTO schema_migrations (archivo, checksum) VALUES ($1, $2) ON CONFLICT (archivo) DO NOTHING",
    [archivo, checksum]
  );
}

function detectarDrift(
  aplicadas: Registrada[],
  migraciones: Migracion[]
): Migracion[] {
  const porNombre = new Map(aplicadas.map((a) => [a.archivo, a.checksum]));
  return migraciones.filter(
    (m) => porNombre.has(m.archivo) && porNombre.get(m.archivo) !== m.checksum
  );
}

async function migrate(dryRun: boolean): Promise<void> {
  console.log("🔧 Iniciando migraciones de AgroChain...\n");

  const migraciones = listarMigraciones();
  if (migraciones.length === 0) {
    console.error(`   ❌ No se encontraron .sql en ${SQL_DIR}`);
    process.exitCode = 1;
    return;
  }
  console.log(`   📂 ${migraciones.length} archivos en ${SQL_DIR}`);

  await ensureTablaMigraciones();
  let aplicadas = await obtenerAplicadas();

  // ── BOOTSTRAP ────────────────────────────────────────────────────────────
  // El Postgres local aplica los .sql por docker-entrypoint-initdb.d y no
  // deja registro. Si el esquema ya existe pero schema_migrations esta
  // vacia, adoptamos esos archivos como ya aplicados en vez de re-ejecutarlos
  // (00_schema.sql usa CREATE TABLE sin IF NOT EXISTS y no correria dos veces).
  if (aplicadas.length === 0 && (await contarTablasDeNegocio()) > 0) {
    console.log(
      "\n   ℹ️  El esquema ya existe pero no hay registro de migraciones."
    );
    console.log(
      "      Asumiendo que docker-entrypoint-initdb.d aplicó estos archivos."
    );
    if (dryRun) {
      console.log(
        `      En modo --dry-run NO se registran. Aplicarías ${migraciones.length} archivos.`
      );
    } else {
      for (const m of migraciones) await registrar(m.archivo, m.checksum);
      aplicadas = await obtenerAplicadas();
      console.log(
        `      ✅ ${aplicadas.length} archivos adoptados como aplicados.`
      );
    }
  }

  // ── DRIFT ────────────────────────────────────────────────────────────────
  const drift = detectarDrift(aplicadas, migraciones);
  if (drift.length > 0) {
    console.log("\n   ⚠️  DRIFT DETECTADO — un archivo ya aplicado fue editado:");
    for (const m of drift) console.log(`      • ${m.archivo}`);
    console.log(
      "      Esto ya se aplicó en otra BD. No lo edites: crea un .sql nuevo."
    );
  }

  // ── PENDIENTES ───────────────────────────────────────────────────────────
  const aplicadasNombres = new Set(aplicadas.map((a) => a.archivo));
  const pendientes = migraciones.filter((m) => !aplicadasNombres.has(m.archivo));

  if (pendientes.length === 0) {
    console.log("\n   ✅ Base de datos al día. Nada pendiente.");
    return;
  }

  console.log(`\n   📋 ${pendientes.length} pendientes:`);
  for (const m of pendientes) console.log(`      ${m.archivo}`);

  if (dryRun) {
    console.log("\n   🔍 --dry-run: no se aplicó nada.");
    return;
  }

  // ── APLICAR ──────────────────────────────────────────────────────────────
  for (const [i, m] of pendientes.entries()) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(m.sql);
      await registrar(m.archivo, m.checksum, client);
      await client.query("COMMIT");
      console.log(`   ✅ [${i + 1}/${pendientes.length}] ${m.archivo}`);
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error(`   ❌ Falló ${m.archivo}: ${(err as Error).message}`);
      console.error(
         "      Se revirtió. La migración quedó sin aplicar; corrige y reintenta."
      );
      process.exitCode = 1;
      return;
    } finally {
      client.release();
    }
  }

  console.log(`\n   ✅ ${pendientes.length} migraciones aplicadas.`);
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run") || process.argv.includes("-n");
  await migrate(dryRun);
}

main()
  .catch((err) => {
    console.error("💥 Migración abortada:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });