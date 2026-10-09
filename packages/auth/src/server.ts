import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDb } from "@lyzyos/db";
import * as authSchema from "@lyzyos/db/auth-schema";
import { oneTimeToken } from "better-auth/plugins/one-time-token";
import {
  adminPlugin,
  baseAuthOptions,
  trustedOrigins,
  type AuthEnv,
  type AuthPlugin,
} from "./config";
import type { EmailSender } from "./config";

export type CreateAuthOptions<P extends readonly AuthPlugin[] = []> = {
  /** Extra plugins (e.g. nextCookies on web). Kept as a concrete tuple so endpoint types flow. */
  plugins?: P;
  sendEmail?: EmailSender;
  adminUserIds?: string[];
  waitUntil?: (promise: Promise<unknown>) => void;
};

export function createAuth<const P extends readonly AuthPlugin[] = []>(
  env: AuthEnv,
  options: CreateAuthOptions<P> = {},
) {
  const db = createDb(env.DB);
  return betterAuth({
    ...baseAuthOptions(options.sendEmail),
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: authSchema,
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: trustedOrigins(env.WEB_ORIGIN),
    plugins: [
      adminPlugin(options.adminUserIds),
      oneTimeToken({ expiresIn: 1, disableSetSessionCookie: true }),
      ...((options.plugins ?? []) as P),
    ],
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

export type Auth = ReturnType<typeof createAuth>;
