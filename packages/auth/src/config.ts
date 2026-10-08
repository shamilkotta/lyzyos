import type { BetterAuthOptions } from "better-auth";
import { admin } from "better-auth/plugins";

export type EmailMessage = { to: string; subject: string; text: string; html?: string };
export type EmailSender = (message: EmailMessage) => Promise<void>;

export type AuthPlugin = NonNullable<BetterAuthOptions["plugins"]>[number];

/** Fallback when no real email provider is wired (local dev): log the link to the server console. */
const consoleSender: EmailSender = async ({ to, subject, text }) => {
  console.info(`[lyzy-auth] email → ${to} · ${subject}\n${text}`);
};

function resetPasswordEmail(url: string): Pick<EmailMessage, "subject" | "text" | "html"> {
  const subject = "Set your LyzyOS password";
  const text = `Someone set up a LyzyOS account for you (or you asked to reset your password).\n\nSet your password here:\n${url}\n\nIf you did not expect this, you can ignore this email.`;
  const html = `<p>Someone set up a LyzyOS account for you (or you asked to reset your password).</p><p><a href="${url}">Set your password</a></p><p style="color:#888;font-size:12px">If you did not expect this, you can ignore this email.</p>`;
  return { subject, text, html };
}

/** Core options shared by the runtime and the CLI — everything except plugins. */
export function baseAuthOptions(sendEmail: EmailSender = consoleSender): BetterAuthOptions {
  return {
    appName: "Lyzy",
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 8,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail({ to: user.email, ...resetPasswordEmail(url) });
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
  };
}

/**
 * The admin plugin owns the role/banned/impersonatedBy schema and gates `createUser`.
 * Returned concretely (not widened) so its endpoint types flow to `auth.api`.
 */
export function adminPlugin(adminUserIds?: string[]) {
  return admin({
    defaultRole: "user",
    adminRoles: ["admin"],
    ...(adminUserIds?.length ? { adminUserIds } : {}),
  });
}

/** Full config for the Better Auth CLI (schema generation). Runtime uses `createAuth`. */
export function buildAuthConfig(
  options: { sendEmail?: EmailSender; adminUserIds?: string[] } = {},
): BetterAuthOptions {
  return {
    ...baseAuthOptions(options.sendEmail),
    plugins: [adminPlugin(options.adminUserIds)],
  };
}

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
