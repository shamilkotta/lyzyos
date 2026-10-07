import type { BetterAuthOptions } from "better-auth";

/** Shared Better Auth options (no database). Used by CLI export and runtime server. */
export const authConfig = {
  appName: "Lyzy",
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      // Swap for Resend/etc. when email delivery is wired.
      console.info(`[lyzy-auth] password reset for ${user.email}: ${url}`);
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
} satisfies BetterAuthOptions;

export type AuthEnv = {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  WEB_ORIGIN?: string;
};

export function trustedOrigins(webOrigin?: string): string[] {
  const origin = webOrigin ?? "http://localhost:3000";
  const alt = origin.includes("localhost")
    ? origin.replace("localhost", "127.0.0.1")
    : origin.includes("127.0.0.1")
      ? origin.replace("127.0.0.1", "localhost")
      : null;
  return alt ? [origin, alt] : [origin];
}
