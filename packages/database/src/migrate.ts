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

function numeroArchivo(archivo: string): number {
  const n = Number.parseInt(archivo.slice(0, 2), 10);
  return Number.isNaN(n) ? 0 : n;
}

function parseBaseline(argv: string[]): number | null {
  const flag = argv.find((a) => a.startsWith("--baseline="));
  if (!flag) return null;
  const n = Number.parseInt(flag.slice("--baseline=".length), 10);
  return Number.isNaN(n) ? null : n;
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

async function migrate(dryRun: boolean, baseline: number | null): Promise<void> {
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

  // ── BASELINE ─────────────────────────────────────────────────────────────
  // Un volumen creado por docker-entrypoint-initdb.d NO deja registro. Si el
  // esquema existe pero schema_migrations esta vacia, no se puede saber que
  // archivos se aplicaron: ese volumen puede estar en 00-06 y necesitar 07-13.
  // Adivinar deja la base rota en silencio, asi que se exige que el operador
  // declare el estado en vez de suponerlo.
  if (aplicadas.length === 0 && (await contarTablasDeNegocio()) > 0) {
    if (baseline === null) {
      console.error(
        "\n   ⛔ La base tiene tablas pero schema_migrations está vacía."
      );
      console.error(
        "      No se puede inferir qué archivos se aplicaron. Un volumen viejo"
      );
      console.error(
        "      puede estar en 00-06 y necesitar 07-13; asumirlo lo deja roto."
      );
      console.error("");
      console.error("      Indicá el estado real y reintentá:");
      console.error(
        "        pnpm db:migrate --baseline=06   # registra 00..06 sin ejecutarlos"
      );
      process.exitCode = 1;
      return;
    }

    const hasta = migraciones.filter((m) => numeroArchivo(m.archivo) <= baseline);
    console.log(
      `\n   ℹ️  Baseline ${String(baseline).padStart(2, "0")}: ${hasta.length} archivos registrados SIN ejecutarse.`
    );
    if (dryRun) {
      console.log("      (--dry-run: no se registran nada)");
    } else {
      for (const m of hasta) await registrar(m.archivo, m.checksum);
      aplicadas = await obtenerAplicadas();
      console.log(`      ✅ Baseline registrado. Quedan por aplicar los siguientes.`);
    }
  } else if (baseline !== null && aplicadas.length === 0) {
    console.log(
      "\n   ℹ️  --baseline ignorado: la base está vacía, se aplicarán todos los archivos."
    );
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
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run") || argv.includes("-n");
  const baseline = parseBaseline(argv);
  console.log(
    "  --dry-run    lista pendientes sin tocar la base\n" +
      "  --baseline=N registra 00..N como aplicados SIN ejecutarlos\n"
  );
  await migrate(dryRun, baseline);
}

main()
  .catch((err) => {
    console.error("💥 Migración abortada:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });