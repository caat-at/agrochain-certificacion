import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "@agrochain/database";
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

export async function usuariosRoutes(app: FastifyInstance) {
  // GET /api/usuarios — solo ADMIN
  app.get("/", { preHandler: [(app as any).authenticate] }, async (request, reply) => {
    const payload = (request as any).user as { rol: string };
    if (payload.rol !== "ADMIN") {
      return reply.status(403).send({ message: "Solo administradores" });
    }

    const { rol } = request.query as { rol?: string };

    const usuarios = await db.usuario.findMany({
      where: rol ? { rol: rol as any } : undefined,
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        email: true,
        rol: true,
        activo: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return { usuarios };
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

    const existente = await db.usuario.findUnique({ where: { email } });
    if (existente) {
      return reply.status(409).send({ message: "Ya existe un usuario con ese email" });
    }

    const usuario = await db.usuario.create({
      data: {
        nombres,
        apellidos,
        email,
        passwordHash: sha256(password),
        rol: rol as any,
        activo: true,
      },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        email: true,
        rol: true,
        activo: true,
        createdAt: true,
      },
    });

    return reply.status(201).send({ usuario });
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

      const existente = await db.usuario.findUnique({ where: { id } });
      if (!existente) return reply.status(404).send({ message: "Usuario no encontrado" });

      if (parsed.data.email && parsed.data.email !== existente.email) {
        const emailEnUso = await db.usuario.findUnique({ where: { email: parsed.data.email } });
        if (emailEnUso) return reply.status(409).send({ message: "Ya existe un usuario con ese email" });
      }

      const { password, ...resto } = parsed.data;
      const dataActualizar: any = { ...resto };
      if (password) dataActualizar.passwordHash = sha256(password);

      const actualizado = await db.usuario.update({
        where: { id },
        data:  dataActualizar,
        select: {
          id: true, nombres: true, apellidos: true,
          email: true, rol: true, activo: true, createdAt: true,
        },
      });

      return { usuario: actualizado };
    }
  );
}
