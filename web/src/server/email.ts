import "server-only";
import type { EmailSender } from "@lyzyos/auth";

const FROM_ADDRESS = "lyzyos@shamilkotta.com";
const FROM_NAME = "LyzyOS";

/**
 * Builds an email sender backed by the Cloudflare `send_email` worker binding.
 * Returns undefined when the binding is absent so auth falls back to console logging — this is the
 * local `next dev` path, where the binding does not exist and `cloudflare:email` cannot be loaded.
 * The `cloudflare:email` module is imported lazily so it only resolves inside the real worker.
 */
export function makeEmailSender(binding: SendEmail | undefined): EmailSender | undefined {
  if (!binding) return undefined;
  return async ({ to, subject, text, html }) => {
    try {
      const { EmailMessage } = await import("cloudflare:email");
      const raw = buildMimeMessage({ to, subject, text, html });
      await binding.send(new EmailMessage(FROM_ADDRESS, to, raw));
    } catch (error) {
      // `next dev` has the binding stub but can't load cloudflare:email, and a real send can fail
      // before the domain is verified. Email is best-effort — log the link instead of throwing.
      console.info(`[lyzy-email] send skipped (${String(error)}) → ${to} · ${subject}\n${text}`);
    }
  };
}

function base64Utf8(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = btoa(binary);
  return encoded.replace(/.{76}/g, "$&\r\n");
}

function encodeSubject(subject: string) {
  // RFC 2047 encoded-word so non-ASCII subjects survive.
  return /^[\x20-\x7e]*$/.test(subject)
    ? subject
    : `=?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(subject)))}?=`;
}

function buildMimeMessage(msg: { to: string; subject: string; text: string; html?: string }) {
  const boundary = `b_${crypto.randomUUID().replace(/-/g, "")}`;
  const headers = [
    `From: ${FROM_NAME} <${FROM_ADDRESS}>`,
    `To: ${msg.to}`,
    `Subject: ${encodeSubject(msg.subject)}`,
    `Message-ID: <${crypto.randomUUID()}@shamilkotta.com>`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
  ];

  if (!msg.html) {
    headers.push('Content-Type: text/plain; charset="utf-8"', "Content-Transfer-Encoding: base64");
    return `${headers.join("\r\n")}\r\n\r\n${base64Utf8(msg.text)}\r\n`;
  }

  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
  const parts = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Utf8(msg.text),
    `--${boundary}`,
    'Content-Type: text/html; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Utf8(msg.html),
    `--${boundary}--`,
    "",
  ];
  return `${headers.join("\r\n")}\r\n\r\n${parts.join("\r\n")}`;
}
