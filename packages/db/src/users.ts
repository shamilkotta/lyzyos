import { eq } from "drizzle-orm";
import { user } from "./auth-schema";
import { createDb } from "./client";

/** Fixed system accounts seeded after Better Auth migrations. */

export type SystemUser = {
  id: string;
  name: string;
  email: string;
};

/** Default human account — every request is treated as this user until real auth lands. */
export const DEFAULT_USER = {
  id: "usr_default",
  name: "You",
  email: "you@lyzy.local",
} as const satisfies SystemUser;

/** Agent account used for Lyzy-authored board nodes. */
export const LYZY_USER = {
  id: "usr_lyzy",
  name: "Lyzy",
  email: "lyzy@lyzy.local",
} as const satisfies SystemUser;

export const SYSTEM_USERS = {
  default: DEFAULT_USER,
  lyzy: LYZY_USER,
} as const;

/** Resolve the acting human user. Auth is not enforced yet — always the default account. */
export function currentUser(): SystemUser {
  return DEFAULT_USER;
}

export function lyzyUser(): SystemUser {
  return LYZY_USER;
}

/** Insert system users if missing (idempotent). */
export async function seedSystemUsers(d1: D1Database): Promise<void> {
  const db = createDb(d1);
  const now = new Date();

  for (const account of [DEFAULT_USER, LYZY_USER] satisfies SystemUser[]) {
    const existing = await db.query.user.findFirst({
      where: eq(user.id, account.id),
    });
    if (existing) continue;

    const emailTaken = await db.query.user.findFirst({
      where: eq(user.email, account.email),
    });
    if (emailTaken) continue;

    await db.insert(user).values({
      id: account.id,
      name: account.name,
      email: account.email,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
  }
}
