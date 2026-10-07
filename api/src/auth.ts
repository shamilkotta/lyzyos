import { createAuth } from "@lyzyos/auth/server";

export function getAuth(env: Env) {
  return createAuth({
    DB: env.DB,
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: env.BETTER_AUTH_URL,
    WEB_ORIGIN: env.WEB_ORIGIN,
  });
}

export async function requireSessionUser(request: Request, env: Env) {
  if (!env.BETTER_AUTH_SECRET) return null;
  const auth = getAuth(env);
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user ?? null;
}
