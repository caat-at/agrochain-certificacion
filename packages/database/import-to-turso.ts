/**
 * import-to-turso.ts
 * Migra datos de dev.db local → Turso cloud usando @libsql/client
 * Uso: npx tsx import-to-turso.ts
 */
import { createClient } from "@libsql/client";
import path from "path";

const DB_PATH   = path.join("C:/Proyectos/WINDOWS/POLYGON/CERTIFICACION/packages/database/dev.db");
const TURSO_URL = "libsql://agrochain-caat.aws-us-east-1.turso.io";
const TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzUyMjgxOTAsImlkIjoiMDE5ZDUzYzktMGIwMS03N2EyLThiYmUtNTI5MmNjNTA3YTNmIiwicmlkIjoiOGFlNjk3OGUtZmQ3OC00ZGYxLWE3OTgtYTNkNWJlMGJjMjY2In0.cv5msPaGv5mnfoVjdFUddGaPLTeUc47uVTUrEPLKqgf6qotoujc3lFswcMJJGTo5P0gnyxemmsb-rR5stQ2UAg";

async function main() {
  console.log("📦 Conectando a dev.db local...");
  const local = createClient({ url: `file:${DB_PATH}` });

  console.log("☁️  Conectando a Turso cloud...");
  const turso = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

  // Verificar conexión a Turso
  await turso.execute("SELECT 1");
  console.log("✅ Conexión a Turso OK\n");

  // Obtener todas las tablas locales
  const tablesResult = await local.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
  );
  const tables = tablesResult.rows.map((r) => r.name as string);
  console.log(`📋 Tablas a migrar: ${tables.length}`);

  // Paso 1: Crear estructura (DROP + CREATE) en Turso
  console.log("\n1️⃣  Creando estructura en Turso...");
  await turso.execute("PRAGMA foreign_keys=OFF");

  for (const table of tables) {
    const schemaResult = await local.execute(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name='${table}'`
    );
    const sql = schemaResult.rows[0]?.sql as string | null;
    if (!sql) continue;

    await turso.execute(`DROP TABLE IF EXISTS "${table}"`);
    await turso.execute(sql);

    // Recrear índices
    const indexResult = await local.execute(
      `SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='${table}' AND sql IS NOT NULL`
    );
    for (const row of indexResult.rows) {
      if (row.sql) {
        try { await turso.execute(row.sql as string); } catch {}
      }
    }
    process.stdout.write(`   ✓ ${table}\n`);
  }

  // Paso 2: Insertar datos tabla por tabla
  console.log("\n2️⃣  Insertando datos...");
  let totalRows = 0;

  for (const table of tables) {
    const dataResult = await local.execute(`SELECT * FROM "${table}"`);
    if (dataResult.rows.length === 0) {
      console.log(`   ○ ${table} (vacía)`);
      continue;
    }

    const cols = dataResult.columns;
    let inserted = 0;

    // Insertar en lotes de 50 para no sobrecargar
    const BATCH = 50;
    for (let i = 0; i < dataResult.rows.length; i += BATCH) {
      const batch = dataResult.rows.slice(i, i + BATCH);
      const statements = batch.map((row) => {
        const colNames = cols.map((c) => `"${c}"`).join(", ");
        const placeholders = cols.map(() => "?").join(", ");
        const values = cols.map((col) => {
          const v = row[col];
          if (v === null || v === undefined) return null;
          if (typeof v === "boolean") return v ? 1 : 0;
          return v;
        });
        return {
          sql: `INSERT OR REPLACE INTO "${table}" (${colNames}) VALUES (${placeholders})`,
          args: values as any[],
        };
      });

      await turso.batch(statements, "write");
      inserted += batch.length;
    }

    totalRows += inserted;
    console.log(`   ✓ ${table}: ${inserted} filas`);
  }

  await turso.execute("PRAGMA foreign_keys=ON");

  console.log(`\n✅ Migración completada — ${totalRows} filas totales en Turso`);

  // Verificación rápida
  console.log("\n3️⃣  Verificando datos en Turso...");
  const lotes = await turso.execute("SELECT codigoLote, estado FROM lotes");
  console.log("   Lotes:", lotes.rows.map((r) => `${r.codigoLote} (${r.estado})`).join(", "));
  const users = await turso.execute("SELECT COUNT(*) as n FROM usuarios");
  console.log("   Usuarios:", users.rows[0].n);
  const certs = await turso.execute("SELECT COUNT(*) as n FROM certificados");
  console.log("   Certificados:", certs.rows[0].n);

  local.close();
  turso.close();
  console.log("\n🎉 Listo. Ahora actualiza el .env con las credenciales de Turso.");
}

main().catch((e) => {
  console.error("❌ Error:", e.message ?? e);
  process.exit(1);
});
