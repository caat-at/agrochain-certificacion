/**
 * Catalogo de ubicacion (pais/departamento/municipio) — lectura publica,
 * usado por los selects encadenados de los formularios de predio.
 */
import type { FastifyInstance } from "fastify";
import { listPaises, listDepartamentos, listMunicipios } from "@agrochain/database";

export async function catalogoRoutes(app: FastifyInstance) {
  app.get("/paises", async () => {
    const paises = await listPaises();
    return { paises };
  });

  app.get("/departamentos", async (request) => {
    const { pais } = request.query as { pais?: string };
    const departamentos = await listDepartamentos(pais);
    return { departamentos };
  });

  app.get("/municipios", async (request) => {
    const { departamento } = request.query as { departamento?: string };
    const municipios = await listMunicipios(departamento);
    return { municipios };
  });
}
