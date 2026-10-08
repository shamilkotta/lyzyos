import { getUserById, listUsers } from "@lyzyos/db";
import { getAuth } from "@/server/auth";
import { getEnv } from "@/server/env";
import { requireSession } from "@/server/session";
import { tryCatch } from "@lyzyos/utils";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const memberRoles = ["user", "admin", "agent"] as const;

const createMemberSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email(),
  role: z.enum(memberRoles).default("user"),
});

export async function GET() {
  await requireSession();
  const env = await getEnv();
  const users = await listUsers(env.DB);

  return NextResponse.json(
    { data: { users: users.map((u) => ({ ...u, createdAt: u.createdAt.getTime() })) } },
    { status: 200 },
  );
}

export async function POST(request: Request) {
  const session = await requireSession();
  const env = await getEnv();

  // Only admins may add members (checked against the stored role, not just the session claim).
  const me = await getUserById(env.DB, session.user.id);
  if (me?.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const [raw, jsonError] = await tryCatch(request.json());
  if (jsonError) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = createMemberSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  const { name, email, role } = parsed.data;
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
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!isAgent) {
    await tryCatch(
      auth.api.requestPasswordReset({
        body: { email, redirectTo: "/reset-password" },
      }),
    );
  }

  return NextResponse.json(
    {
      data: {
        user: {
          id: created.user.id,
          name: created.user.name,
          email: created.user.email,
          role,
          setupEmailSent: !isAgent,
        },
      },
    },
    { status: 201 },
  );
}
