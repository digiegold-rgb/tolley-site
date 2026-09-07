/**
 * Pure library-PIN helpers (no Next imports) so node:test can load them.
 * Cookie issue/clear + requireGenerateLibrary live in generate-library-auth.ts.
 */

import { createHmac } from "node:crypto";

import { secretEquals } from "./secret-compare";

export const GENERATE_LIBRARY_COOKIE = "generate_library";
export const GENERATE_LIBRARY_MAX_AGE_SEC = 4 * 60 * 60;
/** Local/test fallback only. Production must set GENERATE_LIBRARY_PIN. */
export const GENERATE_LIBRARY_PIN_LOCAL_FALLBACK = "4044";

export type GenerateLibraryCookieOptions = {
  name: string;
  value: string;
  maxAge: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
};

export function expectedGenerateLibraryPin(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = (env.GENERATE_LIBRARY_PIN || "").trim();
  if (fromEnv) return fromEnv;
  if (env.NODE_ENV === "production") return "";
  return GENERATE_LIBRARY_PIN_LOCAL_FALLBACK;
}

export function verifyGenerateLibraryPin(
  pin: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return secretEquals((pin || "").trim(), expectedGenerateLibraryPin(env));
}

function librarySigningSecret(env: NodeJS.ProcessEnv = process.env): string {
  return (env.AUTH_SECRET || env.GENERATE_LIBRARY_SECRET || "").trim();
}

function signLibraryToken(actor: string, pin: string, iat: number, env: NodeJS.ProcessEnv): string {
  const secret = librarySigningSecret(env);
  return createHmac("sha256", secret)
    .update(`generate-library:${actor}:${pin}:${iat}`)
    .digest("base64url");
}

export function buildGenerateLibraryToken(
  actor: string,
  env: NodeJS.ProcessEnv = process.env,
  nowSec = Math.floor(Date.now() / 1000),
): string | null {
  const pin = expectedGenerateLibraryPin(env);
  const secret = librarySigningSecret(env);
  const who = (actor || "").trim();
  if (!pin || !secret || !who) return null;
  return `${nowSec}.${signLibraryToken(who, pin, nowSec, env)}`;
}

export function verifyGenerateLibraryCookie(
  token: string | null | undefined,
  actor: string,
  env: NodeJS.ProcessEnv = process.env,
  nowSec = Math.floor(Date.now() / 1000),
): boolean {
  const value = (token || "").trim();
  const who = (actor || "").trim();
  const pin = expectedGenerateLibraryPin(env);
  const secret = librarySigningSecret(env);
  if (!value || !who || !pin || !secret) return false;

  const dot = value.indexOf(".");
  if (dot < 1) return false;
  const iat = Number(value.slice(0, dot));
  const sig = value.slice(dot + 1);
  if (!Number.isInteger(iat) || iat <= 0 || !sig) return false;

  const ageSeconds = nowSec - iat;
  if (ageSeconds > GENERATE_LIBRARY_MAX_AGE_SEC || ageSeconds < -60) return false;

  return secretEquals(sig, signLibraryToken(who, pin, iat, env));
}

export function generateLibraryCookieOptions(value: string, maxAge: number): GenerateLibraryCookieOptions {
  return {
    name: GENERATE_LIBRARY_COOKIE,
    value,
    maxAge,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}

export function buildGenerateLibraryCookie(
  actor: string,
  env: NodeJS.ProcessEnv = process.env,
): GenerateLibraryCookieOptions | null {
  const token = buildGenerateLibraryToken(actor, env);
  if (!token) return null;
  return generateLibraryCookieOptions(token, GENERATE_LIBRARY_MAX_AGE_SEC);
}

export function clearGenerateLibraryCookie(): GenerateLibraryCookieOptions {
  return generateLibraryCookieOptions("", 0);
}

export function redactGenerateLibraryJobs<T>(jobs: T[], unlocked: boolean): T[] {
  return unlocked ? jobs : [];
}
