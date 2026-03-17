import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "@agrochain/database";
import { createHash } from "crypto";

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/login
  app.post<{ Body: z.infer<typeof LoginSchema> }>("/login", async (request, reply) => {
    const parsed = LoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: "Email y contraseña requeridos" });
    }

    const { email, password } = parsed.data;

    const usuario = await db.usuario.findUnique({ where: { email } });
    if (!usuario || !usuario.activo) {
      return reply.status(401).send({ message: "Credenciales inválidas" });
    }

    // Verificar contraseña (hash SHA256 simple — en producción usar bcrypt)
    const hashRecibido = sha256(password);
    if (usuario.passwordHash !== hashRecibido) {
      return reply.status(401).send({ message: "Credenciales inválidas" });
    }

    const token = app.jwt.sign(
      {
        sub:    usuario.id,
        email:  usuario.email,
        rol:    usuario.rol,
        nombre: `${usuario.nombres} ${usuario.apellidos}`,
      },
      { expiresIn: "7d" }
    );

    return {
      token,
      usuario: {
        id:     usuario.id,
        nombre: `${usuario.nombres} ${usuario.apellidos}`,
        email:  usuario.email,
        rol:    usuario.rol,
      },
    };
  });

  // GET /api/auth/me — verificar token activo
  app.get("/me", { preHandler: [(app as any).authenticate] }, async (request, reply) => {
    const payload = (request as any).user as { sub: string };
    const usuario = await db.usuario.findUnique({
      where: { id: payload.sub },
      select: { id: true, nombres: true, apellidos: true, email: true, rol: true },
    });
    if (!usuario) return reply.status(404).send({ message: "Usuario no encontrado" });
    return {
      id:     usuario.id,
      nombre: `${usuario.nombres} ${usuario.apellidos}`,
      email:  usuario.email,
      rol:    usuario.rol,
    };
  });
}
