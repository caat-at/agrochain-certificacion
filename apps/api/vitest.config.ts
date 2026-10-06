import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    // El JWT debe poder firmarse dentro del test con el mismo secreto que usa
    // buildApp(). Sin esto el token autogenerado no validaria contra el app.
    env: {
      NODE_ENV: "test",
      JWT_SECRET: "dev-secret-cambiar-en-produccion",
      // Pg construye el pool al importar y solo conecta al primer query. Con una
      // URL inventada, cualquier query que se escape del mock falla rapido en
      // vez de colgarse esperando a Docker.
      DATABASE_URL: "postgresql://agrochain_app@localhost:5554/never",
    },
  },
});