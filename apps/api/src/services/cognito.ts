/**
 * Cliente AWS Cognito — patron replicado de SSE (backend/src/services/cognito.ts).
 * Cognito actua como IdP puro (login, alta/baja de usuarios, custom:rol);
 * la sesion de la API sigue siendo un JWT propio emitido en routes/auth.ts
 * despues de validar contra Cognito.
 *
 * `isCognitoConfigured()` es el interruptor: mientras no haya un User Pool
 * real en AWS (fase local), routes/auth.ts usa el fallback bcrypt contra
 * usuarios.password_hash. Activar Cognito en produccion no requiere tocar
 * ningun otro archivo, solo llenar las env vars.
 */
import {
  CognitoIdentityProviderClient,
  AdminInitiateAuthCommand,
  AdminRespondToAuthChallengeCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminGetUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const REGION    = process.env.AWS_REGION ?? "us-east-1";
const POOL_ID   = process.env.COGNITO_USER_POOL_ID;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID;

export function isCognitoConfigured(): boolean {
  return Boolean(POOL_ID && CLIENT_ID);
}

function getClient(): CognitoIdentityProviderClient {
  if (!POOL_ID || !CLIENT_ID) {
    throw new Error("Cognito no está configurado (COGNITO_USER_POOL_ID / COGNITO_CLIENT_ID)");
  }
  return new CognitoIdentityProviderClient({ region: REGION });
}

// Decodifica el payload de un JWT de Cognito ya validado por HTTPS, sin
// verificar la firma (no hace falta: llegó directo del AuthenticationResult).
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  const payload = parts[1];
  const b64 = payload.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (payload.length % 4)) % 4);
  try {
    const json = Buffer.from(b64, "base64").toString("utf-8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function mapCognitoError(err: unknown): Error {
  const name = (err as { name?: string })?.name ?? "CognitoError";
  const message = (err as { message?: string })?.message ?? "Error de Cognito";
  switch (name) {
    case "NotAuthorizedException":
      return new Error("Credenciales incorrectas");
    case "UserNotFoundException":
      return new Error("El usuario no existe en Cognito");
    case "UserNotConfirmedException":
      return new Error("El usuario no está confirmado");
    case "PasswordResetRequiredException":
      return new Error("Se requiere restablecer la contraseña");
    case "CodeDeliveryFailureException":
      return new Error("No se pudo entregar el código de verificación");
    case "InvalidPasswordException":
      return new Error("La contraseña no cumple la política del pool");
    case "UsernameExistsException":
      return new Error("El email ya existe en Cognito");
    default:
      return new Error(message);
  }
}

export interface CognitoLoginResult {
  sub: string;
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  requiresPasswordChange: boolean;
  session?: string;
}

export async function cognitoLogin(username: string, password: string): Promise<CognitoLoginResult> {
  try {
    const client = getClient();
    const result = await client.send(
      new AdminInitiateAuthCommand({
        UserPoolId: POOL_ID,
        ClientId: CLIENT_ID,
        AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
        AuthParameters: { USERNAME: username, PASSWORD: password },
      })
    );

    if (result.ChallengeName === "NEW_PASSWORD_REQUIRED" && result.Session) {
      return { sub: "", accessToken: "", idToken: "", requiresPasswordChange: true, session: result.Session };
    }

    const tokens = result.AuthenticationResult;
    if (!tokens?.IdToken || !tokens.AccessToken) {
      throw new Error("Cognito no devolvió tokens de autenticación");
    }
    const payload = decodeJwtPayload(tokens.IdToken) ?? {};

    return {
      sub: String(payload.sub ?? ""),
      accessToken: tokens.AccessToken,
      idToken: tokens.IdToken,
      refreshToken: tokens.RefreshToken,
      requiresPasswordChange: false,
    };
  } catch (err) {
    throw mapCognitoError(err);
  }
}

export async function cognitoCompletePasswordChange(
  username: string,
  newPassword: string,
  session: string
): Promise<CognitoLoginResult> {
  try {
    const client = getClient();
    const result = await client.send(
      new AdminRespondToAuthChallengeCommand({
        UserPoolId: POOL_ID,
        ClientId: CLIENT_ID,
        ChallengeName: "NEW_PASSWORD_REQUIRED",
        Session: session,
        ChallengeResponses: { USERNAME: username, NEW_PASSWORD: newPassword },
      })
    );
    const tokens = result.AuthenticationResult;
    if (!tokens?.IdToken || !tokens.AccessToken) {
      throw new Error("Cognito no devolvió tokens tras el cambio de contraseña");
    }
    const payload = decodeJwtPayload(tokens.IdToken) ?? {};
    return {
      sub: String(payload.sub ?? ""),
      accessToken: tokens.AccessToken,
      idToken: tokens.IdToken,
      refreshToken: tokens.RefreshToken,
      requiresPasswordChange: false,
    };
  } catch (err) {
    throw mapCognitoError(err);
  }
}

export async function cognitoCreateUser(opts: {
  email: string;
  rol: string;
  password?: string;
}): Promise<string> {
  try {
    const client = getClient();
    const username = opts.email.toLowerCase().trim();

    await client.send(
      new AdminCreateUserCommand({
        UserPoolId: POOL_ID,
        Username: username,
        MessageAction: "SUPPRESS",
        UserAttributes: [
          { Name: "email", Value: username },
          { Name: "email_verified", Value: "true" },
          { Name: "custom:rol", Value: opts.rol },
        ],
      })
    );

    if (opts.password) {
      await client.send(
        new AdminSetUserPasswordCommand({
          UserPoolId: POOL_ID,
          Username: username,
          Password: opts.password,
          Permanent: true,
        })
      );
    }

    const user = await client.send(new AdminGetUserCommand({ UserPoolId: POOL_ID, Username: username }));
    const sub = user.UserAttributes?.find((a) => a.Name === "sub")?.Value;
    if (!sub) throw new Error("Cognito no devolvió el sub del usuario creado");
    return sub;
  } catch (err) {
    throw mapCognitoError(err);
  }
}

export async function cognitoSetPassword(email: string, password: string): Promise<void> {
  try {
    const client = getClient();
    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: POOL_ID,
        Username: email.toLowerCase().trim(),
        Password: password,
        Permanent: true,
      })
    );
  } catch (err) {
    throw mapCognitoError(err);
  }
}

export async function cognitoSetRole(email: string, rol: string): Promise<void> {
  try {
    const client = getClient();
    await client.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: POOL_ID,
        Username: email.toLowerCase().trim(),
        UserAttributes: [{ Name: "custom:rol", Value: rol }],
      })
    );
  } catch (err) {
    throw mapCognitoError(err);
  }
}

export async function cognitoDeleteUser(email: string): Promise<void> {
  try {
    const client = getClient();
    await client.send(new AdminDeleteUserCommand({ UserPoolId: POOL_ID, Username: email.toLowerCase().trim() }));
  } catch (err) {
    throw mapCognitoError(err);
  }
}

export async function cognitoDisableUser(email: string): Promise<void> {
  try {
    const client = getClient();
    await client.send(new AdminDisableUserCommand({ UserPoolId: POOL_ID, Username: email.toLowerCase().trim() }));
  } catch (err) {
    throw mapCognitoError(err);
  }
}

export async function cognitoEnableUser(email: string): Promise<void> {
  try {
    const client = getClient();
    await client.send(new AdminEnableUserCommand({ UserPoolId: POOL_ID, Username: email.toLowerCase().trim() }));
  } catch (err) {
    throw mapCognitoError(err);
  }
}

export async function cognitoGetUser(email: string): Promise<{ sub: string; rol: string | null } | null> {
  try {
    const client = getClient();
    const user = await client.send(new AdminGetUserCommand({ UserPoolId: POOL_ID, Username: email.toLowerCase().trim() }));
    const sub = user.UserAttributes?.find((a) => a.Name === "sub")?.Value;
    const rol = user.UserAttributes?.find((a) => a.Name === "custom:rol")?.Value ?? null;
    if (!sub) return null;
    return { sub, rol };
  } catch (err) {
    const name = (err as { name?: string })?.name;
    if (name === "UserNotFoundException") return null;
    throw mapCognitoError(err);
  }
}
