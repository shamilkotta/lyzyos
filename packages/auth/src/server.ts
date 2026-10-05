import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDb, seedSystemUsers } from "@lyzyos/db";
import * as authSchema from "@lyzyos/db/auth-schema";
import { authConfig, trustedOrigins, type AuthEnv } from "./config";

export type Auth = ReturnType<typeof createAuth>;

export function createAuth(env: AuthEnv) {
  const db = createDb(env.DB);
  return betterAuth({
    ...authConfig,
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: authSchema,
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: trustedOrigins(env.WEB_ORIGIN),
  });
}

let authReady: Promise<void> | null = null;

/** Ensure auth tables exist (via db ensureSchema) and system users are seeded. */
export function ensureAuth(env: AuthEnv): Promise<void> {
  if (!authReady) {
    authReady = seedSystemUsers(env.DB).catch((err) => {
      authReady = null;
      throw err;
    });
  }
  return authReady;
}
