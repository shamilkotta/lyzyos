import { betterAuth } from "better-auth";
import { buildAuthConfig } from "./config";

/**
 * Better Auth CLI entry (`pnpm --filter @lyzyos/auth auth:generate`).
 * Schema is generated into `@lyzyos/db` via `--adapter drizzle --dialect sqlite`.
 * Runtime Workers use `createAuth` from `./server`.
 */
export const auth = betterAuth({
  ...buildAuthConfig(),
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-only-secret-replace-me-32chars!",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
});
