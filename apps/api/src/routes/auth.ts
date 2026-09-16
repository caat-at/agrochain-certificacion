import type { FastifyInstance } from "fastify";
import { z } from "zod";
import bcrypt from "bcrypt";
import { getUsuarioByEmail, getUsuarioById, getUsuarioByCognitoSub, createUsuario, updateUsuario } from "@agrochain/database";
import { createHash } from "crypto";
import {
  isCognitoConfigured,
  cognitoLogin,
  cognitoCompletePasswordChange,
  cognitoGetUser,
} from "../services/cognito.js";

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

const CompletarPasswordSchema = z.object({
  email:       z.string().email(),
  newPassword: z.string().min(8),
  session:     z.string().min(1),
});

// Legado — usuarios sembrados/creados antes de activar bcrypt siguen con
// SHA256 sin sal. Se acepta en el fallback local y se migra a bcrypt in-place
// en el primer login exitoso, para no forzar un reset masivo de contraseñas.
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function esHashBcrypt(hash: string): boolean {
  return hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$");
}

function usuarioPublico(usuario: { id: string; nombres: string; apellidos: string; email: string | null; rol: string }) {
  return {
    id:     usuario.id,
    nombre: `${usuario.nombres} ${usuario.apellidos}`,
    email:  usuario.email,
    rol:    usuario.rol,
  };
}

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/login
  app.post<{ Body: z.infer<typeof LoginSchema> }>("/login", async (request, reply) => {
    const parsed = LoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: "Email y contraseña requeridos" });
    }

    const { email, password } = parsed.data;

    // ── Flujo Cognito (activo solo si COGNITO_USER_POOL_ID/CLIENT_ID están configurados) ──
    if (isCognitoConfigured()) {
      try {
        const resultado = await cognitoLogin(email, password);

        if (resultado.requiresPasswordChange) {
          return reply.status(200).send({
            requiresPasswordChange: true,
            session: resultado.session,
            email,
          });
        }

        // Auto-provisioning: si el usuario existe en Cognito pero aún no en
        // la tabla local, se crea el perfil ligado por cognito_sub.
        let usuario = await getUsuarioByCognitoSub(resultado.sub);
        if (!usuario) {
          const cognitoUser = await cognitoGetUser(email);
          const existentePorEmail = await getUsuarioByEmail(email);
          if (existentePorEmail) {
            const actualizado = await updateUsuario(existentePorEmail.id, { cognitoSub: resultado.sub });
            usuario = actualizado === "no-changes" || !actualizado ? existentePorEmail : actualizado;
          } else {
            usuario = await createUsuario({
              nombres: email.split("@")[0],
              apellidos: "",
              tipoDocumento: "CC",
              numeroDocumento: `COGNITO-${resultado.sub}`,
              email,
              cognitoSub: resultado.sub,
              rol: (cognitoUser?.rol as any) ?? "CONSUMIDOR",
            });
          }
        }

        if (!usuario.activo) {
          return reply.status(401).send({ message: "Usuario inactivo" });
        }

        const token = app.jwt.sign(
          { sub: usuario.id, email: usuario.email, rol: usuario.rol, nombre: `${usuario.nombres} ${usuario.apellidos}` },
          { expiresIn: "8h" }
        );

        return { token, usuario: usuarioPublico(usuario) };
      } catch (err) {
        return reply.status(401).send({ message: err instanceof Error ? err.message : "Credenciales inválidas" });
      }
    }

    // ── Fallback local (Cognito no configurado — fase de desarrollo local) ──
    const usuario = await getUsuarioByEmail(email);
    if (!usuario || !usuario.activo || !usuario.passwordHash) {
      return reply.status(401).send({ message: "Credenciales inválidas" });
    }

    let valido: boolean;
    if (esHashBcrypt(usuario.passwordHash)) {
      valido = await bcrypt.compare(password, usuario.passwordHash);
    } else {
      // Compatibilidad con usuarios sembrados/creados con el esquema SHA256 previo
      valido = usuario.passwordHash === sha256(password);
      if (valido) {
        // Migración transparente a bcrypt en el primer login exitoso
        const nuevoHash = await bcrypt.hash(password, 10);
        await updateUsuario(usuario.id, { passwordHash: nuevoHash });
      }
    }

    if (!valido) {
      return reply.status(401).send({ message: "Credenciales inválidas" });
    }

    const token = app.jwt.sign(
      { sub: usuario.id, email: usuario.email, rol: usuario.rol, nombre: `${usuario.nombres} ${usuario.apellidos}` },
      { expiresIn: "8h" }
    );

    return { token, usuario: usuarioPublico(usuario) };
  });

  // POST /api/auth/complete-password-change — responde al challenge NEW_PASSWORD_REQUIRED de Cognito
  app.post<{ Body: z.infer<typeof CompletarPasswordSchema> }>("/complete-password-change", async (request, reply) => {
    if (!isCognitoConfigured()) {
      return reply.status(503).send({ message: "Cognito no está configurado en este entorno" });
    }

    const parsed = CompletarPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: "Datos inválidos" });
    }
    const { email, newPassword, session } = parsed.data;

    try {
      const resultado = await cognitoCompletePasswordChange(email, newPassword, session);

      let usuario = await getUsuarioByCognitoSub(resultado.sub);
      if (!usuario) {
        const existentePorEmail = await getUsuarioByEmail(email);
        if (existentePorEmail) {
          const actualizado = await updateUsuario(existentePorEmail.id, { cognitoSub: resultado.sub });
          usuario = actualizado === "no-changes" || !actualizado ? existentePorEmail : actualizado;
        }
      }
      if (!usuario) {
        return reply.status(404).send({ message: "Usuario no encontrado tras el cambio de contraseña" });
      }

      const token = app.jwt.sign(
        { sub: usuario.id, email: usuario.email, rol: usuario.rol, nombre: `${usuario.nombres} ${usuario.apellidos}` },
        { expiresIn: "8h" }
      );

      return { token, usuario: usuarioPublico(usuario) };
    } catch (err) {
      return reply.status(400).send({ message: err instanceof Error ? err.message : "Error al completar el cambio de contraseña" });
    }
  });

  // GET /api/auth/me — verificar token activo
  app.get("/me", { preHandler: [(app as any).authenticate] }, async (request, reply) => {
    const payload = (request as any).user as { sub: string };
    const usuario = await getUsuarioById(payload.sub);
    if (!usuario) return reply.status(404).send({ message: "Usuario no encontrado" });
    return usuarioPublico(usuario);
  });
}
