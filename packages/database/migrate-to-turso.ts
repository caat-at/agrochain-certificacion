/**
 * migrate-to-turso.ts
 * Exporta dev.db local → archivo SQL para importar en Turso
 *
 * Uso:
 *   npx tsx migrate-to-turso.ts
 *
 * Genera: packages/database/turso-migration.sql
 * Luego importar con:
 *   turso db shell agrochain < turso-migration.sql
 */
import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";

const DB_PATH = path.join(import.meta.dirname ?? __dirname, "dev.db");
const OUT_FILE = path.join(import.meta.dirname ?? __dirname, "turso-migration.sql");

async function main() {
  console.log("📦 Conectando a dev.db local...");

  const client = createClient({ url: `file:${DB_PATH}` });

  // Obtener todas las tablas (excluir tablas internas de SQLite)
  const tablesResult = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream_%' ORDER BY name`
  );

  const tables = tablesResult.rows.map((r) => r.name as string);
  console.log(`✅ Tablas encontradas: ${tables.length}`);
  console.log("   " + tables.join(", "));

  const lines: string[] = [];

  lines.push("-- AgroChain migration from dev.db to Turso");
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("PRAGMA foreign_keys=OFF;");
  lines.push("BEGIN TRANSACTION;");
  lines.push("");

  for (const table of tables) {
    console.log(`  → Exportando tabla: ${table}`);

    // Schema de la tabla
    const schemaResult = await client.execute(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name='${table}'`
    );
    const sql = schemaResult.rows[0]?.sql as string | null;
    if (sql) {
      lines.push(`-- Tabla: ${table}`);
      lines.push(`DROP TABLE IF EXISTS "${table}";`);
      lines.push(sql + ";");
      lines.push("");
    }

    // Índices de la tabla
    const indexResult = await client.execute(
      `SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='${table}' AND sql IS NOT NULL`
    );
    for (const row of indexResult.rows) {
      if (row.sql) lines.push((row.sql as string) + ";");
    }

    // Datos
    const dataResult = await client.execute(`SELECT * FROM "${table}"`);
    if (dataResult.rows.length > 0) {
      const cols = dataResult.columns.map((c) => `"${c}"`).join(", ");
      for (const row of dataResult.rows) {
        const vals = dataResult.columns.map((col) => {
          const v = row[col];
          if (v === null || v === undefined) return "NULL";
          if (typeof v === "number" || typeof v === "bigint") return String(v);
          if (typeof v === "boolean") return v ? "1" : "0";
          // Escapar strings: reemplazar ' por ''
          return `'${String(v).replace(/'/g, "''")}'`;
        });
        lines.push(`INSERT INTO "${table}" (${cols}) VALUES (${vals.join(", ")});`);
      }
      console.log(`     ${dataResult.rows.length} filas`);
    } else {
      console.log(`     (vacía)`);
    }
    lines.push("");
  }

  lines.push("COMMIT;");
  lines.push("PRAGMA foreign_keys=ON;");

  fs.writeFileSync(OUT_FILE, lines.join("\n"), "utf8");

  const sizeMB = (fs.statSync(OUT_FILE).size / 1024 / 1024).toFixed(2);
  console.log("");
  console.log(`✅ Archivo generado: turso-migration.sql (${sizeMB} MB)`);
  console.log("");
  console.log("📋 Siguiente paso — importar en Turso:");
  console.log("   turso db shell agrochain < turso-migration.sql");

  await client.close();
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
