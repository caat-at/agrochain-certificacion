/**
 * Catalogo de ubicacion (pais/departamento/municipio) — lectura publica,
 * usado por los selects encadenados de los formularios de predio.
 */
import type { FastifyInstance } from "fastify";
import { listPaises, listDepartamentos, listMunicipios, listEspecies } from "@agrochain/database";

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

  // Catalogo de especies con tipo de ciclo (PERENNE/ANUAL) — usado por el
  // formulario de lote para decidir si sugerir reuso de plantas existentes.
  app.get("/especies", async (request) => {
    const { tipoCiclo } = request.query as { tipoCiclo?: "PERENNE" | "ANUAL" };
    const especies = await listEspecies(tipoCiclo);
    return { especies };
  });
}
