import "server-only";
import type { EmailSender } from "@lyzyos/auth";

const FROM_NAME = "LyzyOS";

type EmailSenderOptions = {
  /** Local development only. Reset links are sensitive and must never reach production logs. */
  logToConsole?: boolean;
  fromAddress?: string;
};

export function makeEmailSender(
  binding: SendEmail | undefined,
  { logToConsole = false, fromAddress }: EmailSenderOptions = {},
): EmailSender {
  return async ({ to, subject, text, html }) => {
    if (!binding || !fromAddress) {
      if (logToConsole) {
        console.info(`[lyzy-auth:development] email → ${to} · ${subject}\n${text}`);
      } else {
        console.error("[lyzy-email] email delivery is not configured");
      }
      return;
    }

    try {
      await binding.send({
        from: { name: FROM_NAME, email: fromAddress },
        to,
        subject,
        text,
        ...(html ? { html } : {}),
      });
    } catch {
      console.error("[lyzy-email] delivery failed");
    }
  };
}
