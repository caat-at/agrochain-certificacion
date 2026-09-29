/**
 * Rutas de propietarios — dueño legal del predio, sin cuenta de usuario/login.
 * GET /api/propietarios — listar (ADMIN)
 * POST /api/propietarios — crear (ADMIN)
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { listPropietarios, createPropietario, getPropietarioById, updatePropietario } from "@agrochain/database";

const CrearPropietarioSchema = z.object({
  nombres: z.string().min(1).max(150),
  apellidos: z.string().min(1).max(150),
  tipoDocumento: z.enum(["CC", "CE", "NIT", "PPN"]),
  numeroDocumento: z.string().min(1).max(30),
  email: z.string().email().optional(),
  telefono: z.string().max(30).optional(),
  direccion: z.string().max(255).optional(),
});

const EditarPropietarioSchema = z.object({
  nombres: z.string().min(1).max(150).optional(),
  apellidos: z.string().min(1).max(150).optional(),
  tipoDocumento: z.enum(["CC", "CE", "NIT", "PPN"]).optional(),
  numeroDocumento: z.string().min(1).max(30).optional(),
  email: z.string().email().nullable().optional(),
  telefono: z.string().max(30).nullable().optional(),
  direccion: z.string().max(255).nullable().optional(),
  activo: z.boolean().optional(),
});

export async function propietariosRoutes(app: FastifyInstance) {
  // GET /api/propietarios — listar (solo ADMIN)
  app.get("/", { preHandler: [(app as any).authenticate] }, async (request, reply) => {
    const payload = (request as any).user as { rol: string };
    if (payload.rol !== "ADMIN") {
      return reply.status(403).send({ message: "Solo administradores" });
    }

    const propietarios = await listPropietarios();
    return { propietarios };
  });

  // POST /api/propietarios — crear (solo ADMIN)
  app.post("/", { preHandler: [(app as any).authenticate] }, async (request, reply) => {
    const payload = (request as any).user as { rol: string };
    if (payload.rol !== "ADMIN") {
      return reply.status(403).send({ message: "Solo administradores" });
    }

    const parsed = CrearPropietarioSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.flatten().fieldErrors });
    }

    const propietario = await createPropietario(parsed.data);
    return reply.status(201).send({ success: true, data: propietario });
  });

  // GET /api/propietarios/:id — detalle
  app.get<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { rol: string };
      if (payload.rol !== "ADMIN") {
        return reply.status(403).send({ message: "Solo administradores" });
      }

      const propietario = await getPropietarioById(request.params.id);
      if (!propietario) {
        return reply.status(404).send({ message: "Propietario no encontrado" });
      }
      return { success: true, data: propietario };
    }
  );

  // PATCH /api/propietarios/:id — editar (solo ADMIN)
  app.patch<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { rol: string };
      if (payload.rol !== "ADMIN") {
        return reply.status(403).send({ message: "Solo administradores" });
      }

      const parsed = EditarPropietarioSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.flatten().fieldErrors });
      }

      const existente = await getPropietarioById(request.params.id);
      if (!existente) {
        return reply.status(404).send({ message: "Propietario no encontrado" });
      }

      const actualizado = await updatePropietario(request.params.id, parsed.data);
      if (actualizado === "no-changes") {
        return { success: true, data: existente };
      }
      return { success: true, data: actualizado };
    }
  );
}
