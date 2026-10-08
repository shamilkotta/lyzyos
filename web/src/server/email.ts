import "server-only";
import type { EmailSender } from "@lyzyos/auth";

const FROM_ADDRESS = "lyzyos@shamilkotta.me";
const FROM_NAME = "LyzyOS";

export function makeEmailSender(binding: SendEmail | undefined): EmailSender | undefined {
  if (!binding) return undefined;
  return async ({ to, subject, text, html }) => {
    try {
      await binding.send({
        from: { name: FROM_NAME, email: FROM_ADDRESS },
        to,
        subject,
        text,
        ...(html ? { html } : {}),
      });
    } catch (error) {
      console.info(`[lyzy-email] send skipped (${String(error)}) → ${to} · ${subject}\n${text}`);
    }
  };
}
