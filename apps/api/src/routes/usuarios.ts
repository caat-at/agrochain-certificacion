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
import {
  isCognitoConfigured,
  cognitoCreateUser,
  cognitoSetPassword,
  cognitoSetRole,
  cognitoDisableUser,
  cognitoEnableUser,
  cognitoDeleteUser,
} from "../services/cognito.js";

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

// Politica del User Pool (ver provisionamiento): solo longitud minima 8,
// sin exigir mayuscula/minuscula/numero — se valida en el mismo shape tanto
// si Cognito esta activo como en el fallback local.
const PasswordSchema = z.string().min(8, "Mínimo 8 caracteres");

const CrearUsuarioSchema = z.object({
  nombres:    z.string().min(1),
  apellidos:  z.string().min(1),
  email:      z.string().email(),
  password:   PasswordSchema,
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
    tieneCuentaCognito: !!usuario.cognitoSub,
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

    // Con Cognito activo, la cuenta se crea primero ahi (es el IdP real) y
    // recien despues en Postgres, vinculada por cognito_sub — mismo orden
    // que el auto-provisioning de routes/auth.ts. Si Cognito falla, no se
    // toca la tabla local (evita usuarios huerfanos sin forma de loguearse).
    let cognitoSub: string | null = null;
    if (isCognitoConfigured()) {
      try {
        cognitoSub = await cognitoCreateUser({ email, rol, password });
      } catch (err) {
        return reply.status(400).send({ message: err instanceof Error ? err.message : "Error creando el usuario en Cognito" });
      }
    }

    const usuario = await createUsuario({
      nombres,
      apellidos,
      email,
      passwordHash: isCognitoConfigured() ? null : sha256(password),
      cognitoSub,
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
        password:  PasswordSchema.optional(),
      });

      const parsed = EditarSchema.safeParse(body);
      if (!parsed.success) {
        return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.flatten().fieldErrors });
      }

      const existente = await getUsuarioById(id);
      if (!existente) return reply.status(404).send({ message: "Usuario no encontrado" });

      if (parsed.data.email && parsed.data.email !== existente.email) {
        // Cognito usa el email como Username inmutable — cambiarlo aqui
        // desincronizaria la cuenta local del IdP (el login busca por sub,
        // pero AdminInitiateAuth necesita el Username/email original).
        if (existente.cognitoSub) {
          return reply.status(400).send({
            message: "No se puede cambiar el email de un usuario con cuenta en Cognito. Desactívalo y crea uno nuevo si necesita otro correo.",
          });
        }
        const emailEnUso = await getUsuarioByEmail(parsed.data.email);
        if (emailEnUso) return reply.status(409).send({ message: "Ya existe un usuario con ese email" });
      }

      // Propagar a Cognito antes de tocar Postgres — si el IdP rechaza el
      // cambio (p.ej. password fuera de politica) no queda un estado a medias.
      if (existente.cognitoSub && existente.email) {
        try {
          if (parsed.data.rol && parsed.data.rol !== existente.rol) {
            await cognitoSetRole(existente.email, parsed.data.rol);
          }
          if (parsed.data.password) {
            await cognitoSetPassword(existente.email, parsed.data.password);
          }
          if (parsed.data.activo === false && existente.activo) {
            await cognitoDisableUser(existente.email);
          } else if (parsed.data.activo === true && !existente.activo) {
            await cognitoEnableUser(existente.email);
          }
        } catch (err) {
          return reply.status(400).send({ message: err instanceof Error ? err.message : "Error actualizando el usuario en Cognito" });
        }
      }

      const { password, ...resto } = parsed.data;
      const actualizado = await updateUsuario(id, {
        ...resto,
        ...(password && !existente.cognitoSub ? { passwordHash: sha256(password) } : {}),
      });

      if (actualizado === "no-changes" || !actualizado) {
        return reply.status(404).send({ message: "Usuario no encontrado" });
      }

      return { usuario: toPublico(actualizado) };
    }
  );

  // DELETE /api/usuarios/:id — solo ADMIN. Baja logica (activo=false) mas
  // baja real en Cognito si aplica, nunca borra la fila (preserva historial
  // de auditoria: aportes, certificados, etc. referencian al usuario).
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const payload = (request as any).user as { rol: string };
      if (payload.rol !== "ADMIN") {
        return reply.status(403).send({ message: "Solo administradores" });
      }

      const existente = await getUsuarioById(request.params.id);
      if (!existente) return reply.status(404).send({ message: "Usuario no encontrado" });

      if (existente.cognitoSub && existente.email) {
        try {
          await cognitoDeleteUser(existente.email);
        } catch (err) {
          return reply.status(400).send({ message: err instanceof Error ? err.message : "Error eliminando el usuario en Cognito" });
        }
      }

      const actualizado = await updateUsuario(existente.id, { activo: false });
      if (actualizado === "no-changes" || !actualizado) {
        return reply.status(404).send({ message: "Usuario no encontrado" });
      }

      return { success: true, usuario: toPublico(actualizado) };
    }
  );
}
