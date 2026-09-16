import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  listUsuarios,
  getUsuarioByEmail,
  getUsuarioById,
  createUsuario,
  updateUsuario,
} from "@agrochain/database";
import { createHash } from "crypto";

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

const CrearUsuarioSchema = z.object({
  nombres:    z.string().min(1),
  apellidos:  z.string().min(1),
  email:      z.string().email(),
  password:   z.string().min(6),
  rol:        z.enum(["ADMIN", "TECNICO", "AGRICULTOR", "INSPECTOR_ICA", "INSPECTOR_BPA", "CERTIFICADORA", "INVIMA"]),
});

function toPublico(usuario: Awaited<ReturnType<typeof getUsuarioById>>) {
  if (!usuario) return null;
  return {
    id: usuario.id,
    nombres: usuario.nombres,
    apellidos: usuario.apellidos,
    email: usuario.email,
    rol: usuario.rol,
    activo: usuario.activo,
    createdAt: usuario.createdAt,
  };
}

export async function usuariosRoutes(app: FastifyInstance) {
  // GET /api/usuarios — solo ADMIN
  app.get("/", { preHandler: [(app as any).authenticate] }, async (request, reply) => {
    const payload = (request as any).user as { rol: string };
    if (payload.rol !== "ADMIN") {
      return reply.status(403).send({ message: "Solo administradores" });
    }

    const { rol } = request.query as { rol?: string };
    const usuarios = await listUsuarios({ rol });

    return { usuarios: usuarios.map(toPublico) };
  });

  // POST /api/usuarios — crear usuario (solo ADMIN)
  app.post("/", { preHandler: [(app as any).authenticate] }, async (request, reply) => {
    const payload = (request as any).user as { rol: string };
    if (payload.rol !== "ADMIN") {
      return reply.status(403).send({ message: "Solo administradores" });
    }

    const parsed = CrearUsuarioSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.flatten().fieldErrors });
    }

    const { nombres, apellidos, email, password, rol } = parsed.data;

    const existente = await getUsuarioByEmail(email);
    if (existente) {
      return reply.status(409).send({ message: "Ya existe un usuario con ese email" });
    }

    // Documento provisional unico — el flujo actual no pide documento al crear
    // usuario desde este endpoint (heredado del comportamiento Prisma previo,
    // que dejaba numeroDocumento fuera del schema de creacion rapida de ADMIN).
    const numeroDocumento = `TMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const usuario = await createUsuario({
      nombres,
      apellidos,
      email,
      passwordHash: sha256(password),
      rol,
      tipoDocumento: "CC",
      numeroDocumento,
    });

    return reply.status(201).send({ usuario: toPublico(usuario) });
  });

  // PATCH /api/usuarios/:id — editar usuario (solo ADMIN)
  app.patch<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { rol: string };
      if (payload.rol !== "ADMIN") {
        return reply.status(403).send({ message: "Solo administradores" });
      }

      const { id } = request.params;
      const body = request.body as any;

      const EditarSchema = z.object({
        nombres:   z.string().min(1).optional(),
        apellidos: z.string().min(1).optional(),
        email:     z.string().email().optional(),
        rol:       z.enum(["ADMIN", "TECNICO", "AGRICULTOR", "INSPECTOR_ICA", "INSPECTOR_BPA", "CERTIFICADORA", "INVIMA"]).optional(),
        activo:    z.boolean().optional(),
        password:  z.string().min(6).optional(),
      });

      const parsed = EditarSchema.safeParse(body);
      if (!parsed.success) {
        return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.flatten().fieldErrors });
      }

      const existente = await getUsuarioById(id);
      if (!existente) return reply.status(404).send({ message: "Usuario no encontrado" });

      if (parsed.data.email && parsed.data.email !== existente.email) {
        const emailEnUso = await getUsuarioByEmail(parsed.data.email);
        if (emailEnUso) return reply.status(409).send({ message: "Ya existe un usuario con ese email" });
      }

      const { password, ...resto } = parsed.data;
      const actualizado = await updateUsuario(id, {
        ...resto,
        ...(password ? { passwordHash: sha256(password) } : {}),
      });

      if (actualizado === "no-changes" || !actualizado) {
        return reply.status(404).send({ message: "Usuario no encontrado" });
      }

      return { usuario: toPublico(actualizado) };
    }
  );
}
