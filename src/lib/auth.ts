import { SignJWT, jwtVerify } from "jose";
import { AppUserRole } from "@/generated/prisma/client";

export interface JwtPayload {
  sub: string;
  email: string;
  role: AppUserRole;
  displayName: string;
  mustResetPassword?: boolean;
}

const TOKEN_COOKIE_NAME = "auth_token";
const TOKEN_EXPIRY = "7d";

function getSecret() {
  const secret = process.env.AUTH_TOKEN_SECRET;
  if (!secret) {
    throw new Error("AUTH_TOKEN_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function createToken(payload: JwtPayload): Promise<string> {
  const claims: Record<string, unknown> = {
    email: payload.email,
    role: payload.role,
    displayName: payload.displayName,
  };
  if (payload.mustResetPassword) {
    claims.mustResetPassword = true;
  }
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return {
    sub: payload.sub as string,
    email: payload.email as string,
    role: payload.role as AppUserRole,
    displayName: payload.displayName as string,
    mustResetPassword: payload.mustResetPassword === true,
  };
}

export { TOKEN_COOKIE_NAME };
