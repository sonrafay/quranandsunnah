// src/lib/server/env.ts
export function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v || !v.trim()) throw new Error(`Missing env ${key}`);
  return v;
}

export function qfAuthBase(): string {
  return process.env.QF_ENV === "prod"
    ? "https://oauth2.quran.foundation"
    : "https://prelive-oauth2.quran.foundation";
}

export function qfApiBase(): string {
  return process.env.QF_ENV === "prod"
    ? "https://apis.quran.foundation/content/api/v4"
    : "https://apis-prelive.quran.foundation/content/api/v4";
}

export const QF_CLIENT_ID = () => requireEnv("QF_CLIENT_ID");
export const QF_CLIENT_SECRET = () => requireEnv("QF_CLIENT_SECRET");
