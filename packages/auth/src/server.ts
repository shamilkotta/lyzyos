import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDb } from "@lyzyos/db";
import * as authSchema from "@lyzyos/db/auth-schema";
import { authConfig, trustedOrigins, type AuthEnv } from "./config";

export type Auth = ReturnType<typeof createAuth>;

export type CreateAuthOptions = {
  plugins?: BetterAuthOptions["plugins"];
  waitUntil?: (promise: Promise<unknown>) => void;
};

export function createAuth(env: AuthEnv, options: CreateAuthOptions = {}) {
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
    plugins: options.plugins ?? [],
    ...(options.waitUntil
      ? {
          advanced: {
            backgroundTasks: {
              handler: options.waitUntil,
            },
          },
        }
      : {}),
  });
}
