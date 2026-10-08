import { nextCookies } from "better-auth/next-js";
import { createAuth } from "@lyzyos/auth/server";
import { getEnv, getExecutionContext } from "./env";
import { makeEmailSender } from "./email";

export async function getAuth() {
  const env = await getEnv();
  const ctx = await getExecutionContext();

  if (!env.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET is not configured");
  }

  return createAuth(
    {
      DB: env.DB,
      BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
      BETTER_AUTH_URL: env.BETTER_AUTH_URL,
      WEB_ORIGIN: env.WEB_ORIGIN,
    },
    {
      plugins: [nextCookies()],
      sendEmail: makeEmailSender(env.EMAIL),
      waitUntil: ctx ? (promise) => ctx.waitUntil(promise) : undefined,
    },
  );
}
