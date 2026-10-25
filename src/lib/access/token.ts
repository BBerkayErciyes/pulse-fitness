import { randomUUID } from "node:crypto";
import { errors, jwtVerify, SignJWT } from "jose";

export const ACCESS_TOKEN_TTL_SECONDS = 30;

const ISSUER = "pulse-fitness";
const AUDIENCE = "pulse-gate";
const ALG = "HS256";

function secretKey(): Uint8Array {
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ACCESS_TOKEN_SECRET must be set to at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export interface IssuedAccessToken {
  token: string;
  tokenId: string;
  expiresAt: Date;
}

export async function issueAccessToken(userId: string): Promise<IssuedAccessToken> {
  const tokenId = randomUUID();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const exp = nowSeconds + ACCESS_TOKEN_TTL_SECONDS;

  const token = await new SignJWT()
    .setProtectedHeader({ alg: ALG })
    .setSubject(userId)
    .setJti(tokenId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(exp)
    .sign(secretKey());

  return { token, tokenId, expiresAt: new Date(exp * 1000) };
}

export type VerifyResult =
  | { ok: true; userId: string; tokenId: string }
  | { ok: false; reason: "token_expired" | "invalid_token" };

export async function verifyAccessToken(token: string): Promise<VerifyResult> {
  try {
    // exp is checked by jose against the server clock (no tolerance).
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: [ALG],
      issuer: ISSUER,
      audience: AUDIENCE,
      requiredClaims: ["sub", "jti", "exp"],
    });
    return { ok: true, userId: payload.sub!, tokenId: payload.jti! };
  } catch (err) {
    if (err instanceof errors.JWTExpired) return { ok: false, reason: "token_expired" };
    if (err instanceof errors.JOSEError) return { ok: false, reason: "invalid_token" };
    throw err;
  }
}
