import { getUserById, listUsers } from "@lyzyos/db";
import { tryCatch } from "@lyzyos/utils";
import { headers } from "next/headers";
import { z } from "zod";
import { memberRoles } from "@/lib/roles";
import { routes } from "@/lib/routes";
import { getAuth } from "@/server/auth";
import { apiContext, HttpError, json, readJson, route } from "@/server/http";

const createMemberSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().pipe(z.email()),
  role: z.enum(memberRoles).default("user"),
});

export const GET = route(async () => {
  const { env } = await apiContext();
  const users = await listUsers(env.DB);
  return json({ users: users.map((u) => ({ ...u, createdAt: u.createdAt.getTime() })) });
});

export const POST = route(async (request) => {
  const { session, env } = await apiContext();

  // Only admins may add members (checked against the stored role, not just the session claim).
  const me = await getUserById(env.DB, session.user.id);
  if (me?.role !== "admin") throw new HttpError(403, "Admins only");

  const { name, email, role } = await readJson(request, createMemberSchema);
  const auth = await getAuth();
  const isAgent = role === "agent";

  // Agents never sign in, so they get no password and no setup email. Humans get a random
  // password plus a setup link (they never learn the random one).
  const [created, createError] = await tryCatch(
    auth.api.createUser({
      body: {
        name,
        email,
        // Stored verbatim in user.role; cast to satisfy the admin plugin's narrowed role union.
        role: role as "user" | "admin",
        ...(isAgent ? {} : { password: crypto.randomUUID() + crypto.randomUUID() }),
      },
      headers: await headers(),
    }),
  );
  if (createError || !created?.user) {
    const message = createError instanceof Error ? createError.message : "Could not create member";
    throw new HttpError(400, message);
  }

  if (!isAgent) {
    await tryCatch(
      auth.api.requestPasswordReset({ body: { email, redirectTo: routes.resetPassword } }),
    );
  }

  return json(
    {
      user: {
        id: created.user.id,
        name: created.user.name,
        email: created.user.email,
        role,
        setupEmailSent: !isAgent,
      },
    },
    201,
  );
});
