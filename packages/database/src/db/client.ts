import { Pool } from "pg";

// AgroChain usa el puerto 5434 en local (5433 ya lo ocupa el proyecto
// hermano SSE, 5432 el Postgres nativo del equipo) — ver docker-compose.yml.
const connectionString =
  process.env.DATABASE_URL ??
  `postgresql://${process.env.DB_USER ?? "agrochain_app"}:${process.env.DB_PASSWORD ?? "agrochain_app_dev"}@${process.env.DB_HOST ?? "localhost"}:${process.env.DB_PORT ?? 5434}/${process.env.DB_NAME ?? "agrochain_db"}`;

// RDS (y la mayoria de proveedores gestionados) exige TLS. Los contenedores
// locales (postgres/localhost) no lo requieren, asi que se activa solo
// cuando el host de la connection string no es uno de esos.
const requiresSsl = !/@(localhost|postgres|127\.0\.0\.1):/i.test(connectionString);

const pool = new Pool({
  connectionString,
  ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
});

pool.on("error", (err) => {
  console.error("PostgreSQL pool error:", err);
});

export default pool;
